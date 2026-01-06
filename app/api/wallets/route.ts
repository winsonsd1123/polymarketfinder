import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/wallets
 * 获取所有监控钱包列表，按创建时间倒序排列
 */
export async function GET() {
  try {
    const wallets = await prisma.monitoredWallet.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        tradeEvents: {
          include: {
            market: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            timestamp: 'asc', // 按时间升序
          },
        },
        _count: {
          select: {
            tradeEvents: true,
          },
        },
      },
    });

    // 格式化数据
    type WalletType = typeof wallets[0];
    type TradeEventType = WalletType['tradeEvents'][0];
    const formattedWallets = wallets.map((wallet: WalletType) => {
      const firstTrade = wallet.tradeEvents.length > 0 ? wallet.tradeEvents[0] : null;
      const allMarkets = wallet.tradeEvents.map((te: TradeEventType) => te.market);

      // 获取所有关联的市场（去重）
      type MarketType = TradeEventType['market'];
      const uniqueMarkets = Array.from(
        new Map(allMarkets.map((m: MarketType) => [m.id, m])).values()
      );

      return {
        id: wallet.id,
        address: wallet.address,
        riskScore: wallet.riskScore,
        fundingSource: wallet.fundingSource,
        createdAt: wallet.createdAt.toISOString(),
        lastActiveAt: wallet.lastActiveAt?.toISOString() || null,
        updatedAt: wallet.updatedAt.toISOString(),
        firstTradeTime: firstTrade?.timestamp.toISOString() || null,
        markets: uniqueMarkets,
        tradeCount: wallet._count.tradeEvents,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedWallets,
      count: formattedWallets.length,
    });
  } catch (error) {
    console.error('获取钱包列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

