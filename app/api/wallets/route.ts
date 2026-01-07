import { NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';

/**
 * GET /api/wallets
 * 获取所有监控钱包列表，按创建时间倒序排列
 */
export async function GET() {
  try {
    // 获取所有钱包，按创建时间倒序
    const { data: wallets, error: walletsError } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .select('*')
      .order('createdAt', { ascending: false });

    if (walletsError) {
      throw walletsError;
    }

    if (!wallets || wallets.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
      });
    }

    // 获取所有钱包的交易事件和市场信息
    const walletIds = wallets.map(w => w.id);
    const { data: tradeEvents, error: tradesError } = await supabase
      .from(TABLES.TRADE_EVENTS)
      .select(`
        id,
        walletId,
        marketId,
        amount,
        isBuy,
        timestamp,
        createdAt,
        markets:marketId (
          id,
          title
        )
      `)
      .in('walletId', walletIds)
      .order('timestamp', { ascending: true });

    if (tradesError) {
      throw tradesError;
    }

    // 按钱包分组交易事件
    const tradesByWallet = new Map<string, any[]>();
    tradeEvents?.forEach((trade: any) => {
      if (!tradesByWallet.has(trade.walletId)) {
        tradesByWallet.set(trade.walletId, []);
      }
      tradesByWallet.get(trade.walletId)!.push(trade);
    });

    // 格式化数据
    const formattedWallets = wallets.map((wallet) => {
      const walletTrades = tradesByWallet.get(wallet.id) || [];
      const firstTrade = walletTrades.length > 0 ? walletTrades[0] : null;
      
      // 获取所有关联的市场（去重）
      const marketsMap = new Map();
      walletTrades.forEach((trade: any) => {
        if (trade.markets && !marketsMap.has(trade.markets.id)) {
          marketsMap.set(trade.markets.id, trade.markets);
        }
      });
      const uniqueMarkets = Array.from(marketsMap.values());

      return {
        id: wallet.id,
        address: wallet.address,
        riskScore: wallet.riskScore,
        fundingSource: wallet.fundingSource,
        createdAt: wallet.createdAt,
        walletCreatedAt: wallet.walletCreatedAt || null, // 钱包在链上的创建时间
        lastActiveAt: wallet.lastActiveAt || null,
        updatedAt: wallet.updatedAt,
        firstTradeTime: firstTrade?.timestamp || null,
        markets: uniqueMarkets,
        tradeCount: walletTrades.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedWallets,
      count: formattedWallets.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
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

