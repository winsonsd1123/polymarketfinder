import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';

/**
 * GET /api/cron/cleanup
 * 清理 3 天前的分析历史记录
 * 
 * 支持 Vercel Cron Jobs 自动调用
 * 配置在 vercel.json 中：每天运行一次
 */
export async function GET(request: NextRequest) {
  // 检查是否是 Vercel Cron 调用（可选的安全检查）
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');
  
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
    if (process.env.NODE_ENV === 'production' && !isVercelCron) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    // 计算 3 天前的时间
    // 数据库中 created_at 使用 CURRENT_TIMESTAMP（数据库服务器时区，通常是 UTC）
    // 但我们存储 analyzed_at 时使用了北京时间（UTC+8）
    // 为了统一，我们使用 analyzed_at 字段来判断（因为它是我们显式设置的北京时间）
    const now = new Date();
    const threeDaysAgoMs = now.getTime() - 3 * 24 * 60 * 60 * 1000;
    // 转换为北京时间存储格式（UTC + 8小时）
    const threeDaysAgoBeijing = new Date(threeDaysAgoMs + 8 * 60 * 60 * 1000).toISOString();

    const threeDaysAgoDisplay = new Date(threeDaysAgoMs).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    console.log(`🧹 开始清理 3 天前的分析历史记录（北京时间 ${threeDaysAgoDisplay} 之前）...`);

    // 删除 3 天前的记录（使用 analyzed_at 字段，它是我们设置的北京时间）
    const { data, error } = await supabase
      .from(TABLES.WALLET_ANALYSIS_HISTORY)
      .delete()
      .lt('analyzed_at', threeDaysAgoBeijing)
      .select();

    if (error) {
      throw error;
    }

    const deletedCount = data?.length || 0;

    console.log(`✅ 清理完成，删除了 ${deletedCount} 条记录`);

    return NextResponse.json({
      success: true,
      message: '清理完成',
      deletedCount,
      cutoffTime: threeDaysAgoBeijing,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('清理过程中出错:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        message: '清理失败',
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/cleanup
 * 支持 POST 请求（用于定时任务）
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

