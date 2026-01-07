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
 * @param beijingTimeString 存储的北京时间字符串（可能是 ISO 格式或 PostgreSQL timestamp 格式，已包含 8 小时偏移）
 * @returns Date 对象（已减去偏移量，可以正确显示）
 */
export function fromBeijingTime(beijingTimeString: string): Date {
  // 存储的时间字符串包含了 8 小时的偏移量
  // 需要减去这个偏移量来得到正确的 UTC 时间
  
  // 处理不同的时间格式
  let dateString = beijingTimeString;
  
  // 情况1: PostgreSQL timestamp 格式（如 "2026-01-07 14:57:43.177"）
  if (dateString.includes(' ') && !dateString.includes('T')) {
    // 添加 'T' 和 'Z' 使其成为有效的 ISO 字符串
    dateString = dateString.replace(' ', 'T') + 'Z';
  }
  // 情况2: ISO 格式但没有 Z（如 "2026-01-07T14:58:30.756"）
  else if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
    // 添加 'Z' 表示 UTC 时间
    dateString = dateString + 'Z';
  }
  
  const storedDate = new Date(dateString);
  
  // 如果解析失败，尝试直接使用原始字符串
  if (isNaN(storedDate.getTime())) {
    console.warn(`无法解析时间字符串: ${beijingTimeString}，尝试直接使用`);
    return new Date(beijingTimeString);
  }
  
  // 减去 8 小时偏移量得到正确的 UTC 时间
  const utcTime = storedDate.getTime() - BEIJING_OFFSET_MS;
  return new Date(utcTime);
}

/**
 * 安全地将时间字符串解析为 UTC 时间的 Date 对象
 * 确保在 Vercel（UTC）和本地（可能 UTC+8）环境下都能正确解析
 * @param timeString 时间字符串（ISO 格式、Unix 时间戳、或其他格式）
 * @returns Date 对象（UTC 时间）
 */
export function parseToUTCDate(timeString: string | number | Date): Date {
  // 如果已经是 Date 对象，直接返回
  if (timeString instanceof Date) {
    return timeString;
  }
  
  // 如果是数字，当作 Unix 时间戳处理
  if (typeof timeString === 'number') {
    // 判断是秒级还是毫秒级时间戳
    return timeString < 10000000000
      ? new Date(timeString * 1000)
      : new Date(timeString);
  }
  
  // 如果是字符串，确保解析为 UTC 时间
  let dateString = timeString;
  
  // 如果已经是 ISO 格式且带 Z，直接解析
  if (dateString.includes('T') && dateString.includes('Z')) {
    return new Date(dateString);
  }
  
  // 如果是 ISO 格式但没有 Z，添加 Z 确保解析为 UTC
  if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
    dateString = dateString + 'Z';
    return new Date(dateString);
  }
  
  // 如果是 PostgreSQL timestamp 格式，转换为 ISO 格式
  if (dateString.includes(' ') && !dateString.includes('T')) {
    dateString = dateString.replace(' ', 'T') + 'Z';
    return new Date(dateString);
  }
  
  // 其他格式，尝试直接解析（但可能受时区影响）
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) {
    throw new Error(`无法解析时间字符串: ${timeString}`);
  }
  
  // 如果解析后的时间看起来不对（可能是按本地时区解析了），尝试添加 Z
  // 这是一个启发式检查：如果原始字符串看起来像 UTC 时间但没有时区信息
  if (dateString.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/) && !dateString.includes('Z') && !dateString.includes('+')) {
    // 重新解析，强制添加 Z
    const withZ = dateString.replace(' ', 'T').replace(/T(?!Z)/, 'T') + 'Z';
    return new Date(withZ);
  }
  
  return parsed;
}
