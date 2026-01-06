import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/wallets/[address]/trades
 * 获取指定钱包的所有交易记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address: addressParam } = await params;
    const address = addressParam.toLowerCase();

    // 查找钱包
    const wallet = await prisma.monitoredWallet.findUnique({
      where: { address },
      include: {
        tradeEvents: {
          include: {
            market: true,
          },
          orderBy: {
            timestamp: 'desc', // 最新的交易在前
          },
        },
      },
    });

    if (!wallet) {
      return NextResponse.json(
        {
          success: false,
          error: '钱包未找到',
        },
        { status: 404 }
      );
    }

    // 格式化交易数据
    const trades = wallet.tradeEvents.map((trade) => ({
      id: trade.id,
      marketId: trade.marketId,
      marketTitle: trade.market.title,
      amount: trade.amount,
      amountUsdc: trade.amount,
      isBuy: trade.isBuy,
      direction: trade.isBuy ? '买入' : '卖出',
      timestamp: trade.timestamp.toISOString(),
      createdAt: trade.createdAt.toISOString(),
    }));

    // 统计信息
    const stats = {
      totalTrades: trades.length,
      totalAmount: trades.reduce((sum, t) => sum + t.amount, 0),
      buyCount: trades.filter((t) => t.isBuy).length,
      sellCount: trades.filter((t) => !t.isBuy).length,
      uniqueMarkets: new Set(trades.map((t) => t.marketId)).size,
      markets: Array.from(
        new Map(
          wallet.tradeEvents.map((te) => [
            te.market.id,
            {
              id: te.market.id,
              title: te.market.title,
              volume: te.market.volume,
            },
          ])
        ).values()
      ),
    };

    return NextResponse.json({
      success: true,
      wallet: {
        address: wallet.address,
        riskScore: wallet.riskScore,
        fundingSource: wallet.fundingSource,
        createdAt: wallet.createdAt.toISOString(),
        lastActiveAt: wallet.lastActiveAt?.toISOString() || null,
      },
      trades,
      stats,
    });
  } catch (error) {
    console.error('获取钱包交易记录失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

