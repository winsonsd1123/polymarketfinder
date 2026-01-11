import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { fetchRecentTrades, fetchRecentTradesBatch, type PolymarketTrade } from '@/lib/polymarket';
import { analyzeWallet, type WalletAnalysisResult } from '@/lib/analyzer';
import { supabase, TABLES } from '@/lib/supabase';
import { getBeijingTime, toBeijingTime, parseToUTCDate } from '@/lib/time-utils';
import { calculateWinRate, saveWinRateToDatabase, isHighWinRate, getWinRateThreshold } from '@/lib/win-rate';

/**
 * 扫描结果统计
 */
interface ScanResult {
  totalTrades: number;
  processedWallets: number;
  newWallets: number;
  suspiciousWallets: number;
  skippedWallets: number;
  highWinRateWallets: number;
  errors: number;
  details: {
    newWallets: string[];
    suspiciousWallets: string[];
    highWinRateWallets: string[];
    errors: string[];
  };
}

/**
 * 处理单个钱包的分析和入库
 * 
 * 重要逻辑说明：
 * 1. 此函数只对本次扫描中出现的钱包调用
 * 2. 如果原来监控的钱包没出现在这批交易里面，不会调用此函数，不处理（符合需求）
 * 3. 胜率分析基于钱包的所有历史已结算持仓（Closed Positions API）
 * 4. 交易提醒只记录本次扫描中的交易
 * 
 * @param address 钱包地址（本次扫描中出现的钱包）
 * @param trades 本次扫描中该钱包的所有交易记录
 * @param scanLogId 扫描日志ID（用于创建提醒记录）
 */
async function processWallet(
  address: string,
  trades: PolymarketTrade[],
  scanLogId?: string | null
): Promise<{ success: boolean; isNew: boolean; isSuspicious: boolean; isHighWinRate?: boolean; error?: string; shouldStop?: boolean }> {
  try {
    const normalizedAddress = address.toLowerCase();

    // 检查钱包是否已存在
    const { data: existingWallet, error: findError } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .select('id, lastActiveAt, riskScore, wallet_type')
      .eq('address', normalizedAddress)
      .single();

    if (existingWallet && !findError) {
      // 已存在的钱包：本次扫描有交易，更新最后活跃时间
      // 注意：如果钱包不在本次扫描中，不会调用此函数，所以不会更新
      await supabase
        .from(TABLES.MONITORED_WALLETS)
        .update({ lastActiveAt: getBeijingTime() })
        .eq('id', existingWallet.id);
      
      // 【修复】为已存在的钱包插入本次扫描的交易记录
      // 检查本次扫描的交易是否已经存在于 trade_events 表中（避免重复插入）
      if (trades.length > 0) {
        try {
          // 查询该钱包最近的交易记录，检查是否有重复
          const { data: recentTrades } = await supabase
            .from(TABLES.TRADE_EVENTS)
            .select('timestamp, amount, marketId')
            .eq('walletId', existingWallet.id)
            .order('timestamp', { ascending: false })
            .limit(10);
          
          // 构建交易事件记录
          const tradeEvents = trades.map(trade => {
            const isBuy = (trade as any).side === 'BUY' || (trade as any).side !== 'SELL';
            const outcome = trade.outcome || null;
            const tradeBeijingTime = toBeijingTime(parseToUTCDate(trade.timestamp));
            
            return {
              marketId: trade.asset_id,
              walletId: existingWallet.id,
              amount: trade.amount_usdc,
              isBuy: isBuy,
              outcome: outcome,
              timestamp: tradeBeijingTime,
              createdAt: getBeijingTime(),
            };
          });
          
          // 过滤掉可能已存在的交易（基于时间戳和金额的简单去重）
          const newTradeEvents = tradeEvents.filter(newTrade => {
            return !recentTrades?.some(existingTrade => 
              existingTrade.timestamp === newTrade.timestamp &&
              existingTrade.amount === newTrade.amount &&
              existingTrade.marketId === newTrade.marketId
            );
          });
          
          // 只插入新交易
          if (newTradeEvents.length > 0) {
            const { error: tradeError } = await supabase
              .from(TABLES.TRADE_EVENTS)
              .insert(newTradeEvents);
            
            if (tradeError) {
              console.error(`[已存在钱包] 插入交易事件失败 (${normalizedAddress}):`, tradeError);
            } else {
              console.log(`✅ [已存在钱包] 为钱包 ${normalizedAddress} 插入了 ${newTradeEvents.length} 条新交易事件记录`);
            }
          }
        } catch (error) {
          console.warn(`[已存在钱包] 处理交易记录失败 (${normalizedAddress}):`, error);
          // 不影响主流程
        }
      }
      
      // 路径2：计算胜率（仅对本次扫描中出现的钱包）
      // 胜率分析基于钱包的所有历史已结算持仓，但只对本次扫描中的钱包计算
      // 注意：如果钱包不在本次扫描中，不会调用此函数，所以这里只处理本次扫描中的钱包
      let isHighWinRateWallet = false;
      try {
        // 【新增规则】如果本次扫描的所有单笔交易金额都低于1000，跳过高胜率分析
        const hasLargeTrade = trades.some(t => t.amount_usdc >= 1000);
        if (!hasLargeTrade) {
          const maxTradeAmount = Math.max(...trades.map(t => t.amount_usdc));
          console.log(`[已存在钱包] 钱包 ${normalizedAddress} 本次扫描最大单笔交易金额 ${maxTradeAmount.toFixed(2)} < 1000，跳过高胜率分析`);
        } else {
          const winRateResult = await calculateWinRate(normalizedAddress);
          if (winRateResult && winRateResult.totalPositions >= 5) {
          // 保存到胜率库
          await saveWinRateToDatabase(normalizedAddress, winRateResult);
          
          // 如果胜率达标，更新 monitored_wallets 并创建提醒
          if (isHighWinRate(winRateResult.winRate)) {
            isHighWinRateWallet = true;
            
            // 检查钱包类型，追加 'high_win_rate'
            const { data: wallet } = await supabase
              .from(TABLES.MONITORED_WALLETS)
              .select('wallet_type')
              .eq('id', existingWallet.id)
              .single();
            
            const currentTypes = (wallet?.wallet_type as string[]) || [];
            // 如果没有类型，根据 riskScore 判断
            const riskScore = (existingWallet as any).riskScore || 0;
            const defaultTypes = currentTypes.length === 0 
              ? (riskScore >= 50 ? ['suspicious'] : [])
              : currentTypes;
            const hasHighWinRate = Array.isArray(defaultTypes) && defaultTypes.includes('high_win_rate');
            
            if (!hasHighWinRate) {
              const updatedTypes = [...defaultTypes, 'high_win_rate'];
              await supabase
                .from(TABLES.MONITORED_WALLETS)
                .update({
                  wallet_type: updatedTypes,
                  win_rate: winRateResult.winRate,
                  total_profit: winRateResult.totalProfit,
                  win_rate_updated_at: getBeijingTime(),
                })
                .eq('id', existingWallet.id);
            } else {
              // 更新胜率数据
              await supabase
                .from(TABLES.MONITORED_WALLETS)
                .update({
                  win_rate: winRateResult.winRate,
                  total_profit: winRateResult.totalProfit,
                  win_rate_updated_at: getBeijingTime(),
                })
                .eq('id', existingWallet.id);
            }
            
            // 创建提醒记录（记录本次扫描的交易）
            // 注意：只记录本次扫描中的交易，不记录历史交易
            if (trades.length > 0 && scanLogId) {
              await supabase
                .from(TABLES.HIGH_WIN_RATE_ALERTS)
                .insert({
                  wallet_address: normalizedAddress,
                  scan_log_id: scanLogId,
                  trade_count: trades.length, // 本次扫描的交易数量
                  win_rate: winRateResult.winRate, // 基于所有历史已结算持仓计算的胜率
                  detected_at: getBeijingTime(),
                  created_at: getBeijingTime(),
                });
            }
          }
        }
        }
      } catch (error) {
        console.warn(`[路径2] 计算钱包 ${normalizedAddress} 胜率失败:`, error);
        // 不影响主流程
      }
      
      return { success: true, isNew: false, isSuspicious: false, isHighWinRate: isHighWinRateWallet };
    }

    // 新钱包，进行分析（传入本次扫描中该钱包的所有交易）
    // 【验证模式】如果 Alchemy API 查不到钱包创建时间，会抛出错误
    // 使用第一笔交易的时间作为当前交易时间（用于计算交易时间相关评分）
    const firstTrade = trades[0];
    const currentTradeTime = parseToUTCDate(firstTrade.timestamp);
    let analysis;
    try {
      analysis = await analyzeWallet(
        normalizedAddress,
        trades, // 传入本次扫描中该钱包的所有交易
        firstTrade.amount_usdc, // 使用第一笔交易的金额
        currentTradeTime
      );
    } catch (error) {
      // 检查是否是验证模式的错误（Alchemy API 失败）
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('[验证模式]')) {
        console.error(`\n❌ [验证模式] 停止扫描: ${errorMessage}`);
        return { 
          success: false, 
          isNew: false, 
          isSuspicious: false, 
          error: errorMessage,
          shouldStop: true // 标记需要停止扫描
        };
      }
      // 其他错误也抛出
      throw error;
    }

    // 打印详细的分值计算过程
    console.log(`\n📊 钱包分析: ${normalizedAddress}`);
    console.log(`   总分: ${analysis.score} 分`);
    console.log(`   是否可疑: ${analysis.isSuspicious ? '✅ 是' : '❌ 否'}`);
    console.log(`   详细评分:`);
    console.log(`     - 钱包年龄: ${analysis.checks.walletAge.score} 分 (${analysis.checks.walletAge.ageHours ? `${analysis.checks.walletAge.ageHours.toFixed(2)} 小时` : '未知'})`);
    console.log(`     - 交易次数: ${analysis.checks.transactionCount.score} 分 (nonce: ${analysis.checks.transactionCount.nonce})`);
    console.log(`     - 市场参与度: ${analysis.checks.marketParticipation.score} 分 (${analysis.checks.marketParticipation.marketCount} 个市场)`);
    if (analysis.checks.transactionAmount) {
      console.log(`     - 交易规模: ${analysis.checks.transactionAmount.score} 分 ($${analysis.checks.transactionAmount.amount.toFixed(2)})`);
    }
    if (analysis.checks.wcTxGap) {
      console.log(`     - WC/TX 时间: ${analysis.checks.wcTxGap.score} 分 (${analysis.checks.wcTxGap.gapPercentage?.toFixed(2)}%)`);
    }
    if (analysis.checks.transactionRecency) {
      console.log(`     - 交易时间: ${analysis.checks.transactionRecency.score} 分 (${analysis.checks.transactionRecency.hoursSinceTransaction?.toFixed(2)} 小时前)`);
    }
    console.log(`   详情: ${analysis.details}`);

    // 保存分析历史记录（无论是否可疑都保存）
    try {
      // 钱包创建时间（UTC时间，从 Alchemy API 获取的第一笔交易时间）
      // 需要转换为北京时间存储
      const walletCreatedAtBeijing = analysis.checks.walletAge.firstTxTime
        ? toBeijingTime(analysis.checks.walletAge.firstTxTime)
        : null;
      
      await supabase
        .from(TABLES.WALLET_ANALYSIS_HISTORY)
        .insert({
          wallet_address: normalizedAddress,
          total_score: analysis.score,
          is_suspicious: analysis.isSuspicious,
          analysis_details: analysis.details,
          wallet_age_score: analysis.checks.walletAge.score,
          wallet_age_hours: analysis.checks.walletAge.ageHours,
          wallet_created_at: walletCreatedAtBeijing, // 钱包在链上的创建时间（北京时间）
          transaction_count_score: analysis.checks.transactionCount.score,
          transaction_count_nonce: analysis.checks.transactionCount.nonce,
          market_participation_score: analysis.checks.marketParticipation.score,
          market_participation_count: analysis.checks.marketParticipation.marketCount,
          transaction_amount_score: analysis.checks.transactionAmount?.score || 0,
          transaction_amount: analysis.checks.transactionAmount?.amount || null,
          wc_tx_gap_score: analysis.checks.wcTxGap?.score || 0,
          wc_tx_gap_percentage: analysis.checks.wcTxGap?.gapPercentage || null,
          transaction_recency_score: analysis.checks.transactionRecency?.score || 0,
          transaction_recency_hours: analysis.checks.transactionRecency?.hoursSinceTransaction || null,
          funding_source: analysis.checks.fundingSource?.sourceAddress || null,
          analyzed_at: getBeijingTime(),
          created_at: getBeijingTime(), // 显式设置创建时间为北京时间，而不是使用数据库默认值
        });
    } catch (error) {
      console.warn(`保存分析历史记录失败: ${error}`);
      // 不影响主流程，继续执行
    }

    // 如果可疑（score >= 50），存入数据库（按照截图规则，重点关注新钱包和市场参与度）
    if (analysis.isSuspicious && analysis.score >= 50) {
      // 处理所有交易，确保市场和交易事件都被记录
      // 使用第一笔交易的市场ID作为主要市场
      const firstTrade = trades[0];
      const marketId = firstTrade.asset_id;
      
      // 检查市场是否存在
      const { data: existingMarket } = await supabase
        .from(TABLES.MARKETS)
        .select('id, volume')
        .eq('id', marketId)
        .single();

      // 统计所有交易的总金额（用于市场交易量）
      const totalAmount = trades.reduce((sum, t) => sum + t.amount_usdc, 0);
      
      if (!existingMarket) {
        // 创建新市场（使用 API 返回的标题，如果没有则使用 ID，使用北京时间）
        const marketTitle = (firstTrade as any).title || `Market ${marketId.substring(0, 20)}...`;
        const beijingNow = getBeijingTime();
        const { error: marketError } = await supabase
          .from(TABLES.MARKETS)
          .insert({
            id: marketId,
            title: marketTitle,
            volume: totalAmount,
            createdAt: beijingNow, // 显式设置创建时间为北京时间
            updatedAt: beijingNow, // 显式设置更新时间为北京时间
          });
        
        if (marketError) {
          console.error('创建市场失败:', marketError);
        }
      } else {
        // 更新市场交易量（使用北京时间）
        await supabase
          .from(TABLES.MARKETS)
          .update({ 
            volume: existingMarket.volume + totalAmount,
            updatedAt: getBeijingTime(), // 显式设置更新时间为北京时间
          })
          .eq('id', marketId);
      }
      
      // 处理所有交易涉及的市场（确保所有市场都被创建）
      const uniqueMarkets = new Map<string, PolymarketTrade>();
      for (const t of trades) {
        if (!uniqueMarkets.has(t.asset_id)) {
          uniqueMarkets.set(t.asset_id, t);
        }
      }
      
      // 为每个唯一市场创建或更新记录
      for (const [marketIdKey, marketTrade] of uniqueMarkets.entries()) {
        if (marketIdKey === marketId) continue; // 已经处理过了
        
        const { data: market } = await supabase
          .from(TABLES.MARKETS)
          .select('id, volume')
          .eq('id', marketIdKey)
          .single();
        
        if (!market) {
          const marketTitle = (marketTrade as any).title || `Market ${marketIdKey.substring(0, 20)}...`;
          const marketAmount = trades.filter(t => t.asset_id === marketIdKey).reduce((sum, t) => sum + t.amount_usdc, 0);
          await supabase
            .from(TABLES.MARKETS)
            .insert({
              id: marketIdKey,
              title: marketTitle,
              volume: marketAmount,
              createdAt: getBeijingTime(),
              updatedAt: getBeijingTime(),
            });
        } else {
          const marketAmount = trades.filter(t => t.asset_id === marketIdKey).reduce((sum, t) => sum + t.amount_usdc, 0);
          await supabase
            .from(TABLES.MARKETS)
            .update({ 
              volume: market.volume + marketAmount,
              updatedAt: getBeijingTime(),
            })
            .eq('id', marketIdKey);
        }
      }

      // 创建监控钱包（使用北京时间）
      const beijingNow = getBeijingTime();
      // 钱包创建时间（UTC时间，从 Alchemy API 获取的第一笔交易时间）
      // 需要转换为北京时间存储
      const walletCreatedAtBeijing = analysis.checks.walletAge.firstTxTime
        ? toBeijingTime(analysis.checks.walletAge.firstTxTime)
        : null;
      
      const { data: wallet, error: walletError } = await supabase
        .from(TABLES.MONITORED_WALLETS)
        .insert({
          address: normalizedAddress,
          riskScore: analysis.score,
          fundingSource: analysis.checks.fundingSource?.sourceAddress || null,
          lastActiveAt: beijingNow,
          walletCreatedAt: walletCreatedAtBeijing, // 钱包在链上的创建时间（北京时间）
          wallet_type: ['suspicious'], // 可疑钱包类型
          createdAt: beijingNow, // 显式设置创建时间为北京时间
          updatedAt: beijingNow, // 显式设置更新时间为北京时间
        })
        .select()
        .single();

      if (walletError || !wallet) {
        console.error('创建钱包失败:', walletError);
        return { success: false, isNew: true, isSuspicious: true, error: walletError?.message };
      }

      // 为所有交易创建交易事件记录
      const tradeEvents = trades.map(trade => {
        // 从交易数据中获取方向（Data API 返回 side 字段：BUY 或 SELL）
        const isBuy = (trade as any).side === 'BUY' || (trade as any).side !== 'SELL';
        
        // 获取 outcome (YES/NO)
        const outcome = trade.outcome || null;

        // 交易时间转换为北京时间
        const tradeBeijingTime = toBeijingTime(parseToUTCDate(trade.timestamp));
        
        return {
          marketId: trade.asset_id,
          walletId: wallet.id,
          amount: trade.amount_usdc,
          isBuy: isBuy,
          outcome: outcome, // YES 或 NO
          timestamp: tradeBeijingTime,
          createdAt: getBeijingTime(), // 显式设置创建时间为北京时间
        };
      });

      // 批量插入交易事件
      const { error: tradeError } = await supabase
        .from(TABLES.TRADE_EVENTS)
        .insert(tradeEvents);

      if (tradeError) {
        console.error('创建交易事件失败:', tradeError);
      } else {
        console.log(`✅ 为钱包 ${normalizedAddress} 创建了 ${tradeEvents.length} 条交易事件记录`);
      }

      // 路径2：计算胜率（新钱包也计算）
      let isHighWinRateWallet = false;
      try {
        const winRateResult = await calculateWinRate(normalizedAddress);
        if (winRateResult && winRateResult.totalPositions >= 5) {
          // 保存到胜率库
          await saveWinRateToDatabase(normalizedAddress, winRateResult);
          
          // 如果胜率达标，更新 monitored_wallets
          if (isHighWinRate(winRateResult.winRate)) {
            isHighWinRateWallet = true;
            
            // 更新钱包类型，追加 'high_win_rate'
            await supabase
              .from(TABLES.MONITORED_WALLETS)
              .update({
                wallet_type: ['suspicious', 'high_win_rate'],
                win_rate: winRateResult.winRate,
                total_profit: winRateResult.totalProfit,
                win_rate_updated_at: getBeijingTime(),
              })
              .eq('id', wallet.id);
            
            // 创建提醒记录
            if (scanLogId) {
              await supabase
                .from(TABLES.HIGH_WIN_RATE_ALERTS)
                .insert({
                  wallet_address: normalizedAddress,
                  scan_log_id: scanLogId,
                  trade_count: trades.length,
                  win_rate: winRateResult.winRate,
                  detected_at: getBeijingTime(),
                  created_at: getBeijingTime(),
                });
            }
          }
        }
      } catch (error) {
        console.warn(`[路径2] 计算钱包 ${normalizedAddress} 胜率失败:`, error);
        // 不影响主流程
      }
      
      return { success: true, isNew: true, isSuspicious: true, isHighWinRate: isHighWinRateWallet };
    }

    // 路径2：如果不可疑，但可能是高胜率钱包
    let isHighWinRateWallet = false;
    try {
      // 【新增规则】如果本次扫描的所有单笔交易金额都低于1000，跳过高胜率分析
      const hasLargeTrade = trades.some(t => t.amount_usdc >= 1000);
      if (!hasLargeTrade) {
        const maxTradeAmount = Math.max(...trades.map(t => t.amount_usdc));
        console.log(`[新钱包-高胜率] 钱包 ${normalizedAddress} 本次扫描最大单笔交易金额 ${maxTradeAmount.toFixed(2)} < 1000，跳过高胜率分析`);
      } else {
        const winRateResult = await calculateWinRate(normalizedAddress);
        if (winRateResult && winRateResult.totalPositions >= 5) {
        // 保存到胜率库
        await saveWinRateToDatabase(normalizedAddress, winRateResult);
        
        // 如果胜率达标，创建 monitored_wallets 记录
        if (isHighWinRate(winRateResult.winRate)) {
          isHighWinRateWallet = true;
          
          const beijingNow = getBeijingTime();
          
          // 处理所有交易涉及的市场（确保所有市场都被创建）
          const uniqueMarkets = new Map<string, PolymarketTrade>();
          for (const t of trades) {
            if (!uniqueMarkets.has(t.asset_id)) {
              uniqueMarkets.set(t.asset_id, t);
            }
          }
          
          // 为每个唯一市场创建或更新记录
          for (const [marketId, marketTrade] of uniqueMarkets.entries()) {
            const { data: existingMarket } = await supabase
              .from(TABLES.MARKETS)
              .select('id, volume')
              .eq('id', marketId)
              .single();
            
            // 计算该市场的总交易金额
            const marketTrades = trades.filter(t => t.asset_id === marketId);
            const marketTotalAmount = marketTrades.reduce((sum, t) => sum + t.amount_usdc, 0);
            
            if (!existingMarket) {
              const marketTitle = (marketTrade as any).title || `Market ${marketId.substring(0, 20)}...`;
              const { error: marketError } = await supabase
                .from(TABLES.MARKETS)
                .insert({
                  id: marketId,
                  title: marketTitle,
                  volume: marketTotalAmount,
                  createdAt: beijingNow,
                  updatedAt: beijingNow,
                });
              
              if (marketError) {
                console.error(`[新钱包-高胜率] 创建市场失败 (${marketId}):`, marketError);
              }
            } else {
              await supabase
                .from(TABLES.MARKETS)
                .update({
                  volume: existingMarket.volume + marketTotalAmount,
                  updatedAt: beijingNow,
                })
                .eq('id', marketId);
            }
          }
          
          // 创建监控钱包记录（高胜率钱包）
          // 【修复】使用 upsert 避免地址冲突
          const { data: wallet, error: walletError } = await supabase
            .from(TABLES.MONITORED_WALLETS)
            .upsert({
              address: normalizedAddress,
              riskScore: 0, // 未进行可疑分析
              fundingSource: null,
              lastActiveAt: beijingNow,
              walletCreatedAt: null,
              wallet_type: ['high_win_rate'],
              win_rate: winRateResult.winRate,
              total_profit: winRateResult.totalProfit,
              win_rate_updated_at: beijingNow,
              createdAt: beijingNow,
              updatedAt: beijingNow,
            }, {
              onConflict: 'address',
            })
            .select()
            .single();
          
          if (walletError) {
            console.error(`[新钱包-高胜率] 创建/更新钱包失败 (${normalizedAddress}):`, walletError);
          } else if (wallet) {
            // 创建交易事件记录
            const tradeEvents = trades.map(trade => {
              const isBuy = (trade as any).side === 'BUY' || (trade as any).side !== 'SELL';
              const outcome = trade.outcome || null;
              const tradeBeijingTime = toBeijingTime(parseToUTCDate(trade.timestamp));
              
              return {
                marketId: trade.asset_id,
                walletId: wallet.id,
                amount: trade.amount_usdc,
                isBuy: isBuy,
                outcome: outcome,
                timestamp: tradeBeijingTime,
                createdAt: getBeijingTime(),
              };
            });
            
            // 【修复】添加错误检查
            const { error: tradeError } = await supabase
              .from(TABLES.TRADE_EVENTS)
              .insert(tradeEvents);
            
            if (tradeError) {
              console.error(`[新钱包-高胜率] 插入交易事件失败 (${normalizedAddress}):`, tradeError);
            } else {
              console.log(`✅ [新钱包-高胜率] 为钱包 ${normalizedAddress} 创建了 ${tradeEvents.length} 条交易事件记录`);
            }
            
            // 创建提醒记录
            if (scanLogId) {
              const { error: alertError } = await supabase
                .from(TABLES.HIGH_WIN_RATE_ALERTS)
                .insert({
                  wallet_address: normalizedAddress,
                  scan_log_id: scanLogId,
                  trade_count: trades.length,
                  win_rate: winRateResult.winRate,
                  detected_at: beijingNow,
                  created_at: beijingNow,
                });
              
              if (alertError) {
                console.error(`[新钱包-高胜率] 创建提醒记录失败 (${normalizedAddress}):`, alertError);
              }
            }
          } else {
            console.error(`[新钱包-高胜率] 钱包创建/更新后未返回数据 (${normalizedAddress})`);
          }
        }
      }
      }
    } catch (error) {
      console.warn(`[路径2] 计算钱包 ${normalizedAddress} 胜率失败:`, error);
      // 不影响主流程
    }
    
    return { success: true, isNew: true, isSuspicious: false, isHighWinRate: isHighWinRateWallet };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`处理钱包 ${address} 时出错:`, errorMessage);
    return {
      success: false,
      isNew: false,
      isSuspicious: false,
      error: errorMessage,
    };
  }
}

/**
 * GET /api/cron/scan
 * 扫描最新的交易并分析可疑钱包
 * 
 * 支持 Vercel Cron Jobs 自动调用
 * 配置在 vercel.json 中：每5分钟自动运行一次
 */
export async function GET(request: NextRequest) {
  // 检查是否是 Vercel Cron 调用（可选的安全检查）
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');
  
  // Vercel Cron 会在请求头中包含 authorization，可以验证
  // 如果设置了 CRON_SECRET，则验证它
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
    // 允许 Vercel Cron 和手动调用（开发环境）
    if (process.env.NODE_ENV === 'production' && !isVercelCron) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }
  const startTime = Date.now();
  const scanStartTime = getBeijingTime(); // 使用北京时间
  const result: ScanResult = {
    totalTrades: 0,
    processedWallets: 0,
    newWallets: 0,
    suspiciousWallets: 0,
    skippedWallets: 0,
    highWinRateWallets: 0,
    errors: 0,
    details: {
      newWallets: [],
      suspiciousWallets: [],
      highWinRateWallets: [],
      errors: [],
    },
  };

  // 创建扫描日志记录
  let scanLogId: string | null = null;
  try {
    const { data: scanLog, error: logError } = await supabase
      .from(TABLES.SCAN_LOGS)
      .insert({
        started_at: scanStartTime,
        created_at: scanStartTime, // 显式设置创建时间为北京时间，而不是使用数据库默认值
        success: true,
      })
      .select('id')
      .single();
    
    if (!logError && scanLog) {
      scanLogId = scanLog.id;
    }
  } catch (error) {
    console.warn('创建扫描日志失败:', error);
  }

  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '5000', 10); // 默认增加到 5000
    const useMockData = searchParams.get('mock') === 'true';
    const concurrency = parseInt(searchParams.get('concurrency') || '5', 10);
    const useBatch = searchParams.get('batch') !== 'false'; // 默认使用批量获取

    console.log(`🚀 开始扫描交易 (limit: ${limit}, batch: ${useBatch}, mock: ${useMockData}, concurrency: ${concurrency})`);

    // 1. 获取最近的交易（如果 limit > 1000，使用批量获取）
    const trades = limit > 1000 || useBatch
      ? await fetchRecentTradesBatch(limit, 500, useMockData)
      : await fetchRecentTrades(limit, useMockData);
    result.totalTrades = trades.length;

    if (trades.length === 0) {
      return NextResponse.json({
        success: true,
        message: '未获取到交易数据',
        result,
        duration: Date.now() - startTime,
      });
    }

    // 2. 按钱包地址分组交易（保留每个钱包的所有交易记录）
    // 重要：只对本次扫描中出现的钱包进行分析
    // 如果原来监控的钱包没出现在这批交易里面，不会处理（符合需求）
    const walletTradesMap = new Map<string, PolymarketTrade[]>();
    for (const trade of trades) {
      const address = trade.maker_address.toLowerCase();
      if (!walletTradesMap.has(address)) {
        walletTradesMap.set(address, []);
      }
      walletTradesMap.get(address)!.push(trade);
    }

    console.log(`📊 发现 ${walletTradesMap.size} 个唯一钱包地址（仅本次扫描中出现的钱包）`);
    // 打印每个钱包的交易数量统计
    const walletStats = Array.from(walletTradesMap.entries()).map(([addr, trades]) => ({
      address: addr,
      tradeCount: trades.length,
    }));
    console.log(`📊 钱包交易统计: ${walletStats.slice(0, 10).map(s => `${s.address.substring(0, 8)}...(${s.tradeCount}笔)`).join(', ')}${walletStats.length > 10 ? '...' : ''}`);

    // 3. 使用 p-limit 控制并发处理钱包
    const limitConcurrency = pLimit(concurrency);
    const processPromises = Array.from(walletTradesMap.entries()).map(([address, walletTrades]) =>
      limitConcurrency(async () => {
        const processResult = await processWallet(address, walletTrades, scanLogId);
        result.processedWallets++;

        if (!processResult.success) {
          result.errors++;
          result.details.errors.push(`${address}: ${processResult.error}`);
          
          // 【验证模式】如果遇到 Alchemy API 错误，立即停止扫描
          if (processResult.shouldStop) {
            console.error(`\n🛑 [验证模式] 遇到 Alchemy API 错误，停止扫描`);
            throw new Error(`[验证模式] 扫描停止: ${processResult.error}`);
          }
        } else if (processResult.isNew) {
          result.newWallets++;
          result.details.newWallets.push(address);
          if (processResult.isSuspicious) {
            result.suspiciousWallets++;
            result.details.suspiciousWallets.push(address);
          }
          if (processResult.isHighWinRate) {
            result.highWinRateWallets++;
            result.details.highWinRateWallets.push(address);
          }
        } else {
          result.skippedWallets++;
          if (processResult.isHighWinRate) {
            result.highWinRateWallets++;
            result.details.highWinRateWallets.push(address);
          }
        }
      })
    );

    // 等待所有处理完成
    await Promise.all(processPromises);

    const duration = Date.now() - startTime;

    console.log(`\n✅ 扫描完成:`);
    console.log(`   总交易数: ${result.totalTrades}`);
    console.log(`   处理钱包数: ${result.processedWallets}`);
    console.log(`   新钱包数: ${result.newWallets}`);
    console.log(`   可疑钱包数: ${result.suspiciousWallets}`);
    console.log(`   高胜率钱包数: ${result.highWinRateWallets}`);
    console.log(`   跳过钱包数: ${result.skippedWallets}`);
    console.log(`   错误数: ${result.errors}`);
    console.log(`   耗时: ${duration}ms`);
    
    // 打印可疑钱包列表
    if (result.details.suspiciousWallets.length > 0) {
      console.log(`\n⚠️  可疑钱包列表 (${result.suspiciousWallets} 个):`);
      result.details.suspiciousWallets.forEach((addr, index) => {
        console.log(`   ${index + 1}. ${addr}`);
      });
    }
    
    // 打印高胜率钱包列表
    if (result.details.highWinRateWallets.length > 0) {
      console.log(`\n🎯 高胜率钱包列表 (${result.highWinRateWallets} 个):`);
      result.details.highWinRateWallets.forEach((addr, index) => {
        console.log(`   ${index + 1}. ${addr}`);
      });
    }

    // 更新扫描日志（使用北京时间）
    if (scanLogId) {
      await supabase
        .from(TABLES.SCAN_LOGS)
        .update({
          completed_at: getBeijingTime(),
          duration_ms: duration,
          total_trades: result.totalTrades,
          processed_wallets: result.processedWallets,
          new_wallets: result.newWallets,
          suspicious_wallets: result.suspiciousWallets,
          skipped_wallets: result.skippedWallets,
          errors: result.errors,
          success: true,
          // 注意：scan_logs 表可能没有 high_win_rate_wallets 字段，如果报错可以忽略或添加字段
        })
        .eq('id', scanLogId);
    }

    return NextResponse.json({
      success: true,
      message: '扫描完成',
      result,
      duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    console.error('扫描过程中出错:', errorMessage);

    // 更新扫描日志（失败，使用北京时间）
    if (scanLogId) {
      await supabase
        .from(TABLES.SCAN_LOGS)
        .update({
          completed_at: getBeijingTime(),
          duration_ms: duration,
          total_trades: result.totalTrades,
          processed_wallets: result.processedWallets,
          new_wallets: result.newWallets,
          suspicious_wallets: result.suspiciousWallets,
          skipped_wallets: result.skippedWallets,
          errors: result.errors,
          success: false,
          error_message: errorMessage,
        })
        .eq('id', scanLogId);
    }

    return NextResponse.json(
      {
        success: false,
        message: '扫描失败',
        error: errorMessage,
        result,
        duration,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/scan
 * 支持 POST 请求（用于定时任务）
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

