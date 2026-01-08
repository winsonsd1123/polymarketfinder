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

    // 更新关注状态和更新时间
    const { data, error } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .update({ 
        isStarred,
        updatedAt: getBeijingTime(), // 更新修改时间
      })
      .eq('address', normalizedAddress)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
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
