import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';

/**
 * GET /api/analysis-history
 * 获取钱包分析历史记录
 * 
 * 查询参数：
 * - address: 钱包地址（可选，不传则查询所有）
 * - limit: 返回数量限制（默认 50）
 * - offset: 偏移量（默认 0）
 * - suspicious: 是否只查询可疑钱包（true/false，默认 false）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address')?.toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const suspiciousOnly = searchParams.get('suspicious') === 'true';

    let query = supabase
      .from(TABLES.WALLET_ANALYSIS_HISTORY)
      .select('*')
      .order('analyzed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 如果指定了钱包地址
    if (address) {
      query = query.eq('wallet_address', address);
    }

    // 如果只查询可疑钱包
    if (suspiciousOnly) {
      query = query.eq('is_suspicious', true);
    }

    const { data: history, error } = await query;

    if (error) {
      throw error;
    }

    // 格式化数据
    const formattedHistory = (history || []).map((item: any) => ({
      id: item.id,
      walletAddress: item.wallet_address,
      totalScore: item.total_score,
      isSuspicious: item.is_suspicious,
      analysisDetails: item.analysis_details,
      walletAgeScore: item.wallet_age_score,
      walletAgeHours: item.wallet_age_hours,
      walletCreatedAt: item.wallet_created_at || null, // 钱包在链上的创建时间（北京时间）
      transactionCountScore: item.transaction_count_score,
      transactionCountNonce: item.transaction_count_nonce,
      marketParticipationScore: item.market_participation_score,
      marketParticipationCount: item.market_participation_count,
      transactionAmountScore: item.transaction_amount_score,
      transactionAmount: item.transaction_amount,
      wcTxGapScore: item.wc_tx_gap_score,
      wcTxGapPercentage: item.wc_tx_gap_percentage,
      transactionRecencyScore: item.transaction_recency_score,
      transactionRecencyHours: item.transaction_recency_hours,
      fundingSource: item.funding_source,
      analyzedAt: item.analyzed_at,
      createdAt: item.created_at,
    }));

    // 获取总数（用于分页）
    let countQuery = supabase
      .from(TABLES.WALLET_ANALYSIS_HISTORY)
      .select('id', { count: 'exact', head: true });

    if (address) {
      countQuery = countQuery.eq('wallet_address', address);
    }
    if (suspiciousOnly) {
      countQuery = countQuery.eq('is_suspicious', true);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      data: formattedHistory,
      count: formattedHistory.length,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('获取分析历史失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

