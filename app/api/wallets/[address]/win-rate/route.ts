import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';

/**
 * GET /api/wallets/[address]/win-rate
 * 获取单个钱包的胜率详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address: addressParam } = await params;
    const address = addressParam.toLowerCase();

    // 获取钱包基本信息
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

    // 获取详细胜率统计
    const { data: winRate, error: winRateError } = await supabase
      .from(TABLES.WALLET_WIN_RATES)
      .select('*')
      .eq('wallet_address', address)
      .single();

    return NextResponse.json({
      success: true,
      wallet: {
        address: wallet.address,
        walletType: wallet.wallet_type || [],
        winRate: wallet.win_rate,
        totalProfit: wallet.total_profit,
        riskScore: wallet.risk_score,
        lastActiveAt: wallet.last_active_at,
        winRateUpdatedAt: wallet.win_rate_updated_at,
      },
      winRateDetail: winRate ? {
        totalPositions: winRate.total_positions,
        winningPositions: winRate.winning_positions,
        losingPositions: winRate.losing_positions,
        winRate: winRate.win_rate,
        totalProfit: winRate.total_profit,
        avgProfit: winRate.avg_profit,
        lastUpdatedAt: winRate.last_updated_at,
      } : null,
    });
  } catch (error) {
    console.error('获取钱包胜率详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
