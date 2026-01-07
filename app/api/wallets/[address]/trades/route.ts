import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';

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
    const { data: wallet, error: walletError } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .select('*')
      .eq('address', address)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        {
          success: false,
          error: '钱包未找到',
        },
        { status: 404 }
      );
    }

    // 获取该钱包的所有交易事件
    const { data: tradeEvents, error: tradesError } = await supabase
      .from(TABLES.TRADE_EVENTS)
      .select(`
        *,
        markets:marketId (
          id,
          title,
          volume
        )
      `)
      .eq('walletId', wallet.id)
      .order('timestamp', { ascending: false });

    if (tradesError) {
      throw tradesError;
    }

    // 格式化交易数据
    const trades = (tradeEvents || []).map((trade: any) => ({
      id: trade.id,
      marketId: trade.marketId,
      marketTitle: trade.markets?.title || 'Unknown Market',
      amount: trade.amount,
      amountUsdc: trade.amount,
      isBuy: trade.isBuy,
      direction: trade.isBuy ? '买入' : '卖出',
      outcome: trade.outcome || null, // YES 或 NO
      timestamp: trade.timestamp,
      createdAt: trade.createdAt,
    }));

    // 统计信息
    const marketsMap = new Map();
    (tradeEvents || []).forEach((trade: any) => {
      if (trade.markets && !marketsMap.has(trade.markets.id)) {
        marketsMap.set(trade.markets.id, {
          id: trade.markets.id,
          title: trade.markets.title,
          volume: trade.markets.volume,
        });
      }
    });

    const stats = {
      totalTrades: trades.length,
      totalAmount: trades.reduce((sum, t) => sum + t.amount, 0),
      buyCount: trades.filter((t) => t.isBuy).length,
      sellCount: trades.filter((t) => !t.isBuy).length,
      uniqueMarkets: marketsMap.size,
      markets: Array.from(marketsMap.values()),
    };

    return NextResponse.json({
      success: true,
      wallet: {
        address: wallet.address,
        riskScore: wallet.riskScore,
        fundingSource: wallet.fundingSource,
        createdAt: wallet.createdAt,
        lastActiveAt: wallet.lastActiveAt || null,
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

