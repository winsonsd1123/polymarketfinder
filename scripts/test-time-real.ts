/**
 * 测试实际数据库时间转换
 */
import { fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

// 从数据库查询的实际时间
const dbTime = '2026-01-07 15:31:15.745'; // completed_at
const currentUTC = new Date('2026-01-07T07:33:08.018Z'); // 当前 UTC 时间

console.log('🧪 测试实际数据库时间转换\n');
console.log('数据库存储的时间:', dbTime);
console.log('当前 UTC 时间:', currentUTC.toISOString());
console.log('');

// 测试转换
const converted = fromBeijingTime(dbTime);
console.log('转换后的 UTC 时间:', converted.toISOString());
console.log('');

// 计算时间差
const diffMs = currentUTC.getTime() - converted.getTime();
const diffMinutes = diffMs / 1000 / 60;
const diffHours = diffMs / 1000 / 60 / 60;

console.log('时间差:');
console.log(`  ${diffMinutes.toFixed(2)} 分钟`);
console.log(`  ${diffHours.toFixed(2)} 小时`);
console.log('');

// 测试显示
const relative = formatRelativeTime(dbTime);
console.log('formatRelativeTime 显示:', relative);
console.log('');

// 分析问题
console.log('📊 问题分析:');
console.log(`数据库存储: ${dbTime} (PostgreSQL timestamp without time zone)`);
console.log(`这应该是加了8小时的"北京时间"`);
console.log(`转换后: ${converted.toISOString()} (减去8小时后)`);
console.log(`当前 UTC: ${currentUTC.toISOString()}`);
console.log(`实际时间差应该是: ${diffMinutes.toFixed(1)} 分钟前`);

