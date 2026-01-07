/**
 * 测试时间转换函数
 */
import { fromBeijingTime, getBeijingTime, toBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

// 测试数据：从数据库查询的实际时间格式
const testTimes = [
  '2026-01-07 14:57:43.177', // PostgreSQL timestamp 格式
  '2026-01-07T14:57:43.177Z', // ISO 格式
  new Date().toISOString(), // 当前时间 ISO
];

console.log('🧪 测试时间转换函数\n');
console.log('当前 UTC 时间:', new Date().toISOString());
console.log('当前北京时间 (getBeijingTime):', getBeijingTime());
console.log('');

testTimes.forEach((timeStr, index) => {
  console.log(`\n测试 ${index + 1}: ${timeStr}`);
  try {
    const converted = fromBeijingTime(timeStr);
    const relative = formatRelativeTime(timeStr);
    console.log(`  转换后: ${converted.toISOString()}`);
    console.log(`  相对时间: ${relative}`);
    console.log(`  时间差: ${(Date.now() - converted.getTime()) / 1000 / 60} 分钟前`);
  } catch (error) {
    console.error(`  错误:`, error);
  }
});

// 测试实际数据库时间
console.log('\n\n📊 测试实际数据库时间格式:');
const dbTimes = [
  '2026-01-07 14:57:43.177',
  '2026-01-07 14:59:01.68',
  '2026-01-07 06:57:43.234182',
];

dbTimes.forEach((timeStr, index) => {
  console.log(`\n数据库时间 ${index + 1}: ${timeStr}`);
  try {
    const converted = fromBeijingTime(timeStr);
    const relative = formatRelativeTime(timeStr);
    console.log(`  转换后 UTC: ${converted.toISOString()}`);
    console.log(`  显示: ${relative}`);
    const minutesAgo = (Date.now() - converted.getTime()) / 1000 / 60;
    console.log(`  实际时间差: ${minutesAgo.toFixed(1)} 分钟前`);
  } catch (error) {
    console.error(`  错误:`, error);
  }
});

