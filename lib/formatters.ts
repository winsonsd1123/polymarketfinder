import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { fromBeijingTime } from './time-utils';

/**
 * 格式化钱包地址（显示前6位+后4位）
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * 格式化相对时间（如 "2 mins ago"）
 * 注意：数据库中存储的是北京时间（UTC+8），需要转换后显示
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    // 如果是从数据库读取的字符串，需要从北京时间转换
    const dateObj = typeof date === 'string' 
      ? fromBeijingTime(date) 
      : date;
    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: zhCN,
    });
  } catch (error) {
    return '未知时间';
  }
}

/**
 * 格式化具体时间（如 "2026-01-07 15:30:00"）
 * 注意：数据库中存储的是北京时间（UTC+8），需要转换后显示
 */
export function formatDateTime(date: string | Date): string {
  try {
    // 如果是从数据库读取的字符串，需要从北京时间转换
    const dateObj = typeof date === 'string' 
      ? fromBeijingTime(date) 
      : date;
    return format(dateObj, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
  } catch (error) {
    return '未知时间';
  }
}

/**
 * 格式化时间和相对时间（同时显示具体时间和相对时间）
 * 格式：2026-01-07 15:30:00 (2小时前)
 * 注意：数据库中存储的是北京时间（UTC+8），需要转换后显示
 */
export function formatTimeWithRelative(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' 
      ? fromBeijingTime(date) 
      : date;
    const dateTimeStr = format(dateObj, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    const relativeStr = formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: zhCN,
    });
    return `${dateTimeStr} (${relativeStr})`;
  } catch (error) {
    return '未知时间';
  }
}

/**
 * 计算 WC/TX gap（钱包创建时间到首次交易的时间差）
 * 返回格式化的时间差字符串
 */
export function calculateWcTxGap(
  walletCreatedAt: string | Date,
  firstTradeTime: string | Date | null
): string {
  if (!firstTradeTime) {
    return '无交易';
  }

  try {
    // 从数据库读取的时间是北京时间，需要转换
    const walletTime = typeof walletCreatedAt === 'string' 
      ? fromBeijingTime(walletCreatedAt) 
      : walletCreatedAt;
    const tradeTime = typeof firstTradeTime === 'string' 
      ? fromBeijingTime(firstTradeTime) 
      : firstTradeTime;

    const diffMs = tradeTime.getTime() - walletTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMinutes = diffMs / (1000 * 60);

    if (diffHours < 1) {
      return `${Math.round(diffMinutes)} 分钟`;
    } else if (diffHours < 24) {
      return `${Math.round(diffHours * 10) / 10} 小时`;
    } else {
      const diffDays = diffHours / 24;
      return `${Math.round(diffDays * 10) / 10} 天`;
    }
  } catch (error) {
    return '计算失败';
  }
}

/**
 * 获取风险评分的颜色类名
 */
export function getRiskScoreColor(score: number): string {
  if (score > 80) {
    return 'text-red-600 font-bold';
  } else if (score > 50) {
    return 'text-yellow-600 font-semibold';
  }
  return 'text-gray-600';
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('复制失败:', error);
    return false;
  }
}

