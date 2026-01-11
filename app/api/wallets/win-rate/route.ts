import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';
import { getWinRateThreshold } from '@/lib/win-rate';

/**
 * GET /api/wallets/win-rate
 * 获取高胜率钱包列表
 * 
 * 查询参数：
 * - threshold: 胜率阈值（可选，默认使用配置值）
 * - limit: 返回数量限制（默认 50）
 * - offset: 偏移量（默认 0）
 * - sortBy: 排序字段（win_rate/total_profit/total_positions，默认 win_rate）
 * - sortDirection: 排序方向（asc/desc，默认 desc）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const threshold = searchParams.get('threshold') 
      ? parseFloat(searchParams.get('threshold')!) 
      : getWinRateThreshold();
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'win_rate';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // 验证排序字段
    const validSortFields = ['win_rate', 'total_profit', 'total_positions', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'win_rate';
    const sortAsc = sortDirection === 'asc';

    // 查询高胜率钱包（wallet_type 包含 'high_win_rate'）
    // 使用 PostgREST 的数组包含操作符 @>
    // 由于 Supabase JS 客户端对数组查询支持有限，我们使用 RPC 或直接 SQL
    // 这里先查询所有符合条件的钱包，然后在应用层过滤和排序
    const { data: allWallets, error: queryError } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .select('*')
      .gte('win_rate', threshold)
      .not('win_rate', 'is', null);
    
    if (queryError) {
      throw queryError;
    }
    
    // 在应用层过滤包含 'high_win_rate' 的钱包
    const wallets = (allWallets || []).filter((wallet: any) => {
      const walletType = wallet.wallet_type || [];
      return Array.isArray(walletType) && walletType.includes('high_win_rate');
    });
    
    // 排序
    wallets.sort((a: any, b: any) => {
      const aValue = a[sortField] || 0;
      const bValue = b[sortField] || 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortAsc ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortAsc ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
    });
    
    // 分页
    const paginatedWallets = wallets.slice(offset, offset + limit);
    const totalCount = wallets.length;

    // 格式化数据，并查询每个钱包的交易记录和市场信息
    const formattedWallets = await Promise.all(
      paginatedWallets.map(async (wallet: any) => {
        // 查询该钱包的交易事件和市场信息
        const { data: tradeEvents, error: tradesError } = await supabase
          .from(TABLES.TRADE_EVENTS)
          .select('id, marketId, timestamp, markets(id, title)')
          .eq('walletId', wallet.id)
          .order('timestamp', { ascending: true });

        // 统计不同的市场
        const marketsMap = new Map();
        if (tradeEvents && !tradesError) {
          tradeEvents.forEach((trade: any) => {
            if (trade.markets && !marketsMap.has(trade.markets.id)) {
              marketsMap.set(trade.markets.id, trade.markets);
            }
          });
        }
        const uniqueMarkets = Array.from(marketsMap.values());

        return {
          id: wallet.id,
          address: wallet.address,
          walletType: wallet.wallet_type || [],
          winRate: wallet.win_rate,
          totalProfit: wallet.total_profit,
          riskScore: wallet.riskScore || wallet.risk_score || 0,
          lastActiveAt: wallet.lastActiveAt || wallet.last_active_at,
          winRateUpdatedAt: wallet.win_rate_updated_at,
          createdAt: wallet.createdAt || wallet.created_at,
          isStarred: wallet.is_starred || false,
          markets: uniqueMarkets,
          tradeCount: tradeEvents?.length || 0,
          firstTradeTime: tradeEvents && tradeEvents.length > 0 
            ? tradeEvents[tradeEvents.length - 1]?.timestamp || null 
            : null,
          walletCreatedAt: wallet.wallet_created_at || null,
        };
      })
    );

    // 获取总数（已过滤的钱包数量）
    const count = wallets.length;

    return NextResponse.json({
      success: true,
      data: formattedWallets,
      count: totalCount,
      threshold,
      limit,
      offset,
    });
  } catch (error) {
    console.error('获取高胜率钱包列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
