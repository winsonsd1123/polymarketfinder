import { NextRequest, NextResponse } from 'next/server';
import { supabase, TABLES } from '@/lib/supabase';
import { getBeijingTime } from '@/lib/time-utils';

/**
 * PATCH /api/wallets/[address]/star
 * 切换钱包的关注状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const normalizedAddress = address.toLowerCase();
    
    const body = await request.json();
    const { isStarred } = body;

    if (typeof isStarred !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isStarred must be a boolean' },
        { status: 400 }
      );
    }

    // 更新关注状态（数据库表中可能没有 updated_at 列，所以只更新 is_starred）
    const { data, error } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .update({ 
        is_starred: isStarred,
        // 注意：如果数据库表中有 updated_at 列，可以取消下面的注释
        // updated_at: getBeijingTime(),
      })
      .eq('address', normalizedAddress)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // 转换返回数据为 camelCase 格式（is_starred 是 snake_case，其他字段是 camelCase）
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        isStarred: data.is_starred || false,
      },
    });
  } catch (error) {
    console.error('更新关注状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
