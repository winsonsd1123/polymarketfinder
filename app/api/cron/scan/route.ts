import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { fetchRecentTrades, type PolymarketTrade } from '@/lib/polymarket';
import { analyzeWallet, type WalletAnalysisResult } from '@/lib/analyzer';
import { prisma } from '@/lib/prisma';

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
): Promise<{ success: boolean; isNew: boolean; isSuspicious: boolean; error?: string }> {
  try {
    const normalizedAddress = address.toLowerCase();

    // 检查钱包是否已存在
    const existingWallet = await prisma.monitoredWallet.findUnique({
      where: { address: normalizedAddress },
    });

    if (existingWallet) {
      // 更新最后活跃时间
      await prisma.monitoredWallet.update({
        where: { id: existingWallet.id },
        data: { lastActiveAt: new Date() },
      });
      return { success: true, isNew: false, isSuspicious: false };
    }

    // 新钱包，进行分析（传入当前交易信息）
    const currentTradeTime = new Date(trade.timestamp);
    const analysis = await analyzeWallet(
      normalizedAddress,
      trade.amount_usdc,
      currentTradeTime
    );

    // 如果可疑（score >= 50），存入数据库（按照截图规则，重点关注新钱包和市场参与度）
    if (analysis.isSuspicious && analysis.score >= 50) {
      // 确保市场存在（使用 asset_id 作为 market id）
      const marketId = trade.asset_id;
      let market = await prisma.market.findUnique({
        where: { id: marketId },
      });

      if (!market) {
        // 创建新市场（使用 API 返回的标题，如果没有则使用 ID）
        const marketTitle = (trade as any).title || `Market ${marketId.substring(0, 20)}...`;
        market = await prisma.market.create({
          data: {
            id: marketId,
            title: marketTitle,
            volume: trade.amount_usdc,
          },
        });
      } else {
        // 更新市场交易量
        await prisma.market.update({
          where: { id: marketId },
          data: {
            volume: market.volume + trade.amount_usdc,
          },
        });
      }

      // 创建监控钱包
      const wallet = await prisma.monitoredWallet.create({
        data: {
          address: normalizedAddress,
          riskScore: analysis.score,
          fundingSource: analysis.checks.fundingSource?.sourceAddress || null,
          lastActiveAt: new Date(),
        },
      });

      // 从交易数据中获取方向（Data API 返回 side 字段：BUY 或 SELL）
      const isBuy = (trade as any).side === 'BUY' || (trade as any).side !== 'SELL';

      // 创建交易事件
      await prisma.tradeEvent.create({
        data: {
          marketId: market.id,
          walletId: wallet.id,
          amount: trade.amount_usdc,
          isBuy: isBuy,
          timestamp: new Date(trade.timestamp),
        },
      });

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

  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const useMockData = searchParams.get('mock') === 'true';
    const concurrency = parseInt(searchParams.get('concurrency') || '3', 10);

    console.log(`🚀 开始扫描交易 (limit: ${limit}, mock: ${useMockData}, concurrency: ${concurrency})`);

    // 1. 获取最近的交易
    const trades = await fetchRecentTrades(limit, useMockData);
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

    console.log(`✅ 扫描完成:`);
    console.log(`   总交易数: ${result.totalTrades}`);
    console.log(`   处理钱包数: ${result.processedWallets}`);
    console.log(`   新钱包数: ${result.newWallets}`);
    console.log(`   可疑钱包数: ${result.suspiciousWallets}`);
    console.log(`   跳过钱包数: ${result.skippedWallets}`);
    console.log(`   错误数: ${result.errors}`);
    console.log(`   耗时: ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: '扫描完成',
      result,
      duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('扫描过程中出错:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: '扫描失败',
        error: errorMessage,
        result,
        duration: Date.now() - startTime,
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

