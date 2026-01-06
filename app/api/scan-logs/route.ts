import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';

/**
 * GET /api/scan-logs
 * 获取扫描历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // 获取最新的扫描记录
    const { data: scanLogs, error } = await supabase
      .from(TABLES.SCAN_LOGS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // 格式化数据
    const formattedLogs = (scanLogs || []).map((log: any) => ({
      id: log.id,
      startedAt: log.started_at,
      completedAt: log.completed_at,
      durationMs: log.duration_ms,
      totalTrades: log.total_trades,
      processedWallets: log.processed_wallets,
      newWallets: log.new_wallets,
      suspiciousWallets: log.suspicious_wallets,
      skippedWallets: log.skipped_wallets,
      errors: log.errors,
      success: log.success,
      errorMessage: log.error_message,
      createdAt: log.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      count: formattedLogs.length,
    });
  } catch (error) {
    console.error('获取扫描日志失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

