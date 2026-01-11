import { fetchClosedPositions, type ClosedPosition } from './polymarket';
import { supabase, TABLES } from './supabase';
import { getBeijingTime } from './time-utils';

/**
 * 最小样本量：至少需要 5 笔已结算交易才计算胜率
 */
export const MIN_POSITIONS_FOR_WIN_RATE = 5;

/**
 * 获取胜率阈值（从环境变量读取，默认 60）
 */
export function getWinRateThreshold(): number {
  const threshold = process.env.WIN_RATE_THRESHOLD;
  return threshold ? parseInt(threshold, 10) : 60;
}

/**
 * 获取最大持仓数量（从环境变量读取，默认 200）
 */
export function getMaxPositionsForWinRate(): number {
  const maxPositions = process.env.MAX_POSITIONS_FOR_WIN_RATE;
  return maxPositions ? parseInt(maxPositions, 10) : 200;
}

/**
 * 胜率计算结果
 */
export interface WinRateResult {
  totalPositions: number; // 总已结算持仓数
  winningPositions: number; // 盈利次数（realizedPnl > 0）
  losingPositions: number; // 亏损次数（realizedPnl < 0）
  winRate: number; // 胜率百分比（0-100）
  totalProfit: number; // 总盈亏（USDC）
  avgProfit: number; // 平均盈亏（USDC）
  // 不再保存 positions 数组，减少内存占用
}

/**
 * 计算钱包胜率
 * @param walletAddress 钱包地址
 * @returns 胜率计算结果，如果数据不足则返回 null
 */
export async function calculateWinRate(walletAddress: string): Promise<WinRateResult | null> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    
    // 获取已结算持仓（优化：只获取最近200条，有100条有效数据就停止）
    const maxPositions = getMaxPositionsForWinRate();
    const minValidPositions = Math.max(50, Math.floor(maxPositions / 2)); // 至少50条，或maxPositions的一半
    
    const positions = await fetchClosedPositions(normalizedAddress, {
      maxPositions,
      minValidPositions,
    });
    
    if (positions.length === 0) {
      console.log(`[胜率计算] 钱包 ${normalizedAddress} 没有已结算持仓`);
      return null;
    }

    // 统计盈利和亏损
    let winningPositions = 0;
    let losingPositions = 0;
    let totalProfit = 0;

    for (const position of positions) {
      const pnl = position.realizedPnl;
      totalProfit += pnl;
      
      if (pnl > 0) {
        winningPositions++;
      } else if (pnl < 0) {
        losingPositions++;
      }
      // pnl === 0 的情况不计入盈利也不计入亏损
    }

    const totalPositions = winningPositions + losingPositions;
    
    // 如果总持仓数不足最小样本量，返回 null
    if (totalPositions < MIN_POSITIONS_FOR_WIN_RATE) {
      console.log(`[胜率计算] 钱包 ${normalizedAddress} 已结算持仓数不足（${totalPositions} < ${MIN_POSITIONS_FOR_WIN_RATE}）`);
      return null;
    }

    // 计算胜率
    const winRate = totalPositions > 0 ? (winningPositions / totalPositions) * 100 : 0;
    const avgProfit = totalPositions > 0 ? totalProfit / totalPositions : 0;

    const result: WinRateResult = {
      totalPositions,
      winningPositions,
      losingPositions,
      winRate,
      totalProfit,
      avgProfit,
      // 不再保存 positions 数组，减少内存占用
    };

    console.log(`[胜率计算] 钱包 ${normalizedAddress} 胜率: ${winRate.toFixed(2)}% (${winningPositions}/${totalPositions}), 总盈亏: $${totalProfit.toFixed(2)}`);
    
    return result;
  } catch (error) {
    console.error(`[胜率计算] 计算钱包 ${walletAddress} 胜率失败:`, error);
    // 不抛出错误，返回 null，避免影响主流程
    return null;
  }
}

/**
 * 判断是否高胜率钱包
 * @param winRate 胜率百分比
 * @param threshold 阈值（可选，默认使用配置值）
 * @returns 是否高胜率
 */
export function isHighWinRate(winRate: number, threshold?: number): boolean {
  const winRateThreshold = threshold ?? getWinRateThreshold();
  return winRate >= winRateThreshold;
}

/**
 * 保存或更新钱包胜率统计到数据库
 * @param walletAddress 钱包地址
 * @param winRateResult 胜率计算结果
 */
export async function saveWinRateToDatabase(
  walletAddress: string,
  winRateResult: WinRateResult
): Promise<void> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    const beijingNow = getBeijingTime();

    // 使用 upsert 更新或创建记录
    const { error } = await supabase
      .from(TABLES.WALLET_WIN_RATES)
      .upsert({
        wallet_address: normalizedAddress,
        total_positions: winRateResult.totalPositions,
        winning_positions: winRateResult.winningPositions,
        losing_positions: winRateResult.losingPositions,
        win_rate: winRateResult.winRate,
        total_profit: winRateResult.totalProfit,
        avg_profit: winRateResult.avgProfit,
        last_updated_at: beijingNow,
        created_at: beijingNow,
      }, {
        onConflict: 'wallet_address',
      });

    if (error) {
      console.error(`[胜率计算] 保存胜率统计失败:`, error);
      throw error;
    }

    console.log(`[胜率计算] ✅ 已保存钱包 ${normalizedAddress} 的胜率统计`);
  } catch (error) {
    console.error(`[胜率计算] 保存胜率统计到数据库失败:`, error);
    // 不抛出错误，避免影响主流程
  }
}
