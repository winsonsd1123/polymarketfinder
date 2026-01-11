import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';

/**
 * GET /api/high-win-rate-alerts
 * 获取高胜率钱包的实时交易提醒
 * 
 * 查询参数：
 * - limit: 返回数量限制（默认 20）
 * - hours: 最近多少小时内的提醒（默认 24）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // 计算时间范围（北京时间）
    const now = new Date();
    const hoursAgo = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    // 查询最近的高胜率钱包交易提醒
    const { data: alerts, error } = await supabase
      .from(TABLES.HIGH_WIN_RATE_ALERTS)
      .select('*')
      .gte('detected_at', hoursAgo.toISOString())
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // 获取钱包信息和交易记录
    const alertsWithDetails = await Promise.all(
      (alerts || []).map(async (alert: any) => {
        // 查询钱包信息
        const { data: wallet } = await supabase
          .from(TABLES.MONITORED_WALLETS)
          .select('id, address, win_rate, total_profit, wallet_type')
          .eq('address', alert.wallet_address)
          .single();

        // 查询该钱包在当次扫描中的交易记录（仅当次扫描检测到的交易）
        // 注意：胜率分析基于钱包的所有历史已结算持仓，但交易提醒只显示当次扫描的交易
        let trades: any[] = [];
        if (wallet && alert.scan_log_id) {
          // 通过 scan_log_id 查询扫描日志的时间范围
          const { data: scanLog } = await supabase
            .from(TABLES.SCAN_LOGS)
            .select('started_at, completed_at')
            .eq('id', alert.scan_log_id)
            .single();

          if (scanLog) {
            // 确定扫描的时间范围：从扫描开始到检测时间（或扫描完成时间）
            const scanStartTime = scanLog.started_at;
            const scanEndTime = scanLog.completed_at || alert.detected_at;
            
            // 查询该钱包在这个时间范围内的交易（当次扫描的交易）
            const { data: tradeEvents } = await supabase
              .from(TABLES.TRADE_EVENTS)
              .select(`
                id,
                marketId,
                amount,
                isBuy,
                outcome,
                timestamp,
                markets:marketId (
                  id,
                  title
                )
              `)
              .eq('walletId', wallet.id)
              .gte('timestamp', scanStartTime)
              .lte('timestamp', scanEndTime)
              .order('timestamp', { ascending: false })
              .limit(alert.trade_count || 10); // 限制为当次扫描的交易数量

            trades = (tradeEvents || []).map((trade: any) => ({
              id: trade.id,
              marketId: trade.marketId,
              marketTitle: trade.markets?.title || 'Unknown Market',
              amount: trade.amount,
              isBuy: trade.isBuy,
              outcome: trade.outcome,
              timestamp: trade.timestamp,
            }));
          }
        }

        return {
          id: alert.id,
          walletAddress: alert.wallet_address,
          winRate: alert.win_rate,
          tradeCount: alert.trade_count,
          detectedAt: alert.detected_at,
          wallet: wallet ? {
            id: wallet.id,
            address: wallet.address,
            winRate: wallet.win_rate,
            totalProfit: wallet.total_profit,
            walletType: wallet.wallet_type || [],
          } : null,
          trades: trades,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: alertsWithDetails,
      count: alertsWithDetails.length,
    });
  } catch (error) {
    console.error('获取高胜率钱包交易提醒失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
