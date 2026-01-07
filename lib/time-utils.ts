/**
 * 时间工具函数
 * 统一使用北京时间（UTC+8）存储和显示
 * 
 * 实现方式：
 * - 存储时：将 UTC 时间加上 8 小时偏移量后存储
 * - 读取时：减去 8 小时偏移量得到正确的 UTC 时间
 * - 显示时：使用 date-fns 等库会自动转换为用户本地时间
 */

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000; // 8 小时的毫秒数

/**
 * 获取当前北京时间（UTC+8）
 * @returns ISO 8601 格式的时间字符串（存储时已加上 8 小时偏移）
 */
export function getBeijingTime(): string {
  const now = new Date();
  // UTC 时间 + 8 小时 = 北京时间
  const beijingTime = new Date(now.getTime() + BEIJING_OFFSET_MS);
  return beijingTime.toISOString();
}

/**
 * 将任意时间转换为北京时间（UTC+8）并存储
 * @param date 日期对象或 ISO 字符串（假设是 UTC 时间）
 * @returns ISO 8601 格式的时间字符串（存储时已加上 8 小时偏移）
 */
export function toBeijingTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // UTC 时间 + 8 小时 = 北京时间
  const beijingTime = new Date(dateObj.getTime() + BEIJING_OFFSET_MS);
  return beijingTime.toISOString();
}

/**
 * 将存储的北京时间字符串转换为 Date 对象（用于显示和计算）
 * @param beijingTimeString 存储的北京时间 ISO 字符串（已包含 8 小时偏移）
 * @returns Date 对象（已减去偏移量，可以正确显示）
 */
export function fromBeijingTime(beijingTimeString: string): Date {
  // 存储的时间字符串包含了 8 小时的偏移量
  // 需要减去这个偏移量来得到正确的 UTC 时间
  const storedDate = new Date(beijingTimeString);
  const utcTime = storedDate.getTime() - BEIJING_OFFSET_MS;
  return new Date(utcTime);
}

