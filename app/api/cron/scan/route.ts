import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { fetchRecentTrades, fetchRecentTradesBatch, type PolymarketTrade } from '@/lib/polymarket';
import { analyzeWallet, type WalletAnalysisResult } from '@/lib/analyzer';
import { supabase, TABLES } from '@/lib/supabase';
import { getBeijingTime, toBeijingTime } from '@/lib/time-utils';

/**
 * 扫描结果统计
 */
interface ScanResult {
  totalTrades: number;
  processedWallets: number;
  newWallets: number;
  suspiciousWallets: number;
  skippedWallets: number;
  errors: number;
  details: {
    newWallets: string[];
    suspiciousWallets: string[];
    errors: string[];
  };
}

/**
 * 处理单个钱包的分析和入库
 */
async function processWallet(
  address: string,
  trade: PolymarketTrade
): Promise<{ success: boolean; isNew: boolean; isSuspicious: boolean; error?: string; shouldStop?: boolean }> {
  try {
    const normalizedAddress = address.toLowerCase();

    // 检查钱包是否已存在
    const { data: existingWallet, error: findError } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .select('id, lastActiveAt')
      .eq('address', normalizedAddress)
      .single();

    if (existingWallet && !findError) {
      // 更新最后活跃时间（使用北京时间）
      await supabase
        .from(TABLES.MONITORED_WALLETS)
        .update({ lastActiveAt: getBeijingTime() })
        .eq('id', existingWallet.id);
      return { success: true, isNew: false, isSuspicious: false };
    }

    // 新钱包，进行分析（传入当前交易信息）
    // 【验证模式】如果 Alchemy API 查不到钱包创建时间，会抛出错误
    const currentTradeTime = new Date(trade.timestamp);
    let analysis;
    try {
      analysis = await analyzeWallet(
        normalizedAddress,
        trade.amount_usdc,
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
      await supabase
        .from(TABLES.WALLET_ANALYSIS_HISTORY)
        .insert({
          wallet_address: normalizedAddress,
          total_score: analysis.score,
          is_suspicious: analysis.isSuspicious,
          analysis_details: analysis.details,
          wallet_age_score: analysis.checks.walletAge.score,
          wallet_age_hours: analysis.checks.walletAge.ageHours,
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
      // 确保市场存在（使用 asset_id 作为 market id）
      const marketId = trade.asset_id;
      
      // 检查市场是否存在
      const { data: existingMarket } = await supabase
        .from(TABLES.MARKETS)
        .select('id, volume')
        .eq('id', marketId)
        .single();

      if (!existingMarket) {
        // 创建新市场（使用 API 返回的标题，如果没有则使用 ID，使用北京时间）
        const marketTitle = (trade as any).title || `Market ${marketId.substring(0, 20)}...`;
        const beijingNow = getBeijingTime();
        const { error: marketError } = await supabase
          .from(TABLES.MARKETS)
          .insert({
            id: marketId,
            title: marketTitle,
            volume: trade.amount_usdc,
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
            volume: existingMarket.volume + trade.amount_usdc,
            updatedAt: getBeijingTime(), // 显式设置更新时间为北京时间
          })
          .eq('id', marketId);
      }

      // 创建监控钱包（使用北京时间）
      const beijingNow = getBeijingTime();
      const { data: wallet, error: walletError } = await supabase
        .from(TABLES.MONITORED_WALLETS)
        .insert({
          address: normalizedAddress,
          riskScore: analysis.score,
          fundingSource: analysis.checks.fundingSource?.sourceAddress || null,
          lastActiveAt: beijingNow,
          createdAt: beijingNow, // 显式设置创建时间为北京时间
          updatedAt: beijingNow, // 显式设置更新时间为北京时间
        })
        .select()
        .single();

      if (walletError || !wallet) {
        console.error('创建钱包失败:', walletError);
        return { success: false, isNew: true, isSuspicious: true, error: walletError?.message };
      }

      // 从交易数据中获取方向（Data API 返回 side 字段：BUY 或 SELL）
      const isBuy = (trade as any).side === 'BUY' || (trade as any).side !== 'SELL';

      // 创建交易事件（交易时间转换为北京时间）
      const tradeBeijingTime = toBeijingTime(new Date(trade.timestamp));
      const { error: tradeError } = await supabase
        .from(TABLES.TRADE_EVENTS)
        .insert({
          marketId: marketId,
          walletId: wallet.id,
          amount: trade.amount_usdc,
          isBuy: isBuy,
          timestamp: tradeBeijingTime,
          createdAt: getBeijingTime(), // 显式设置创建时间为北京时间
        });

      if (tradeError) {
        console.error('创建交易事件失败:', tradeError);
      }

      return { success: true, isNew: true, isSuspicious: true };
    }

    return { success: true, isNew: true, isSuspicious: false };
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
    errors: 0,
    details: {
      newWallets: [],
      suspiciousWallets: [],
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

    // 2. 去重钱包地址（同一地址可能有多笔交易）
    const uniqueWallets = new Map<string, PolymarketTrade>();
    for (const trade of trades) {
      const address = trade.maker_address.toLowerCase();
      if (!uniqueWallets.has(address)) {
        uniqueWallets.set(address, trade);
      }
    }

    console.log(`📊 发现 ${uniqueWallets.size} 个唯一钱包地址`);

    // 3. 使用 p-limit 控制并发处理钱包
    const limitConcurrency = pLimit(concurrency);
    const processPromises = Array.from(uniqueWallets.entries()).map(([address, trade]) =>
      limitConcurrency(async () => {
        const processResult = await processWallet(address, trade);
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
        } else {
          result.skippedWallets++;
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

