import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';
import { fromBeijingTime } from '@/lib/time-utils';

/**
 * GET /api/scan-logs
 * 获取扫描历史记录
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // 获取最新的扫描记录（带重试机制）
    let scanLogs = null;
    let error = null;
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await supabase
          .from(TABLES.SCAN_LOGS)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        scanLogs = result.data;
        error = result.error;

        if (!error) {
          break; // 成功，退出重试循环
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          throw error;
        }

        // 等待后重试
        console.warn(`[扫描日志] 查询失败，${retryDelay}ms 后重试 (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      } catch (err) {
        error = err;
        if (attempt === maxRetries) {
          throw err;
        }
        console.warn(`[扫描日志] 查询异常，${retryDelay}ms 后重试 (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    if (error) {
      throw error;
    }

    // 格式化数据
    // 注意：数据库中的时间字段存储的是加了8小时偏移的"北京时间"
    // 前端 formatRelativeTime 函数会自动调用 fromBeijingTime 进行转换
    // 所以这里直接返回原始时间字符串即可
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
    
    // 检查是否是连接超时错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeoutError = errorMessage.includes('timeout') || 
                          errorMessage.includes('Timeout') ||
                          errorMessage.includes('UND_ERR_CONNECT_TIMEOUT');
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: isTimeoutError 
          ? 'Supabase 连接超时，请检查网络连接或稍后重试'
          : undefined,
      },
      { status: isTimeoutError ? 504 : 500 } // 504 Gateway Timeout for timeout errors
    );
  }
}

