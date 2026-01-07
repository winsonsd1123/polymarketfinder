/**
 * 调试前端显示时间
 */
import { fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🔍 调试前端显示时间\n');

// 模拟前端接收到的数据（从 API）
const apiResponse = {
  createdAt: '2026-01-07 14:58:30.756' // 数据库返回的格式
};

console.log('1. API 返回的数据:');
console.log(`   createdAt: ${apiResponse.createdAt}`);
console.log(`   类型: ${typeof apiResponse.createdAt}`);
console.log('');

// 前端调用 formatRelativeTime
console.log('2. 前端调用 formatRelativeTime:');
const displayResult = formatRelativeTime(apiResponse.createdAt);
console.log(`   显示结果: ${displayResult}`);
console.log('');

// 检查转换过程
console.log('3. 转换过程:');
const converted = fromBeijingTime(apiResponse.createdAt);
const now = new Date();
const diffMs = now.getTime() - converted.getTime();
const diffHours = diffMs / (1000 * 60 * 60);
const diffMinutes = diffMs / (1000 * 60);

console.log(`   数据库时间（北京时间）: ${apiResponse.createdAt}`);
console.log(`   转换后 UTC: ${converted.toISOString()}`);
console.log(`   当前 UTC: ${now.toISOString()}`);
console.log(`   时间差: ${diffHours.toFixed(2)} 小时 (${diffMinutes.toFixed(0)} 分钟)`);
console.log('');

// 如果显示"9小时前"，检查可能的原因
console.log('4. 如果显示"大约 9 小时前"，可能的原因:');

// 原因1: 时间没有转换，直接当作 UTC 处理
const wrongConversion = new Date(apiResponse.createdAt);
const wrongDiffMs = now.getTime() - wrongConversion.getTime();
const wrongDiffHours = wrongDiffMs / (1000 * 60 * 60);
console.log(`   原因1 - 没有转换（直接 new Date）: ${wrongDiffHours.toFixed(2)} 小时`);
if (Math.abs(wrongDiffHours - 9) < 1) {
  console.log(`     ⚠️  这可能是问题所在！`);
}

// 原因2: 时间被当作 UTC 存储，但显示时又减了8小时
const doubleSubtract = fromBeijingTime(apiResponse.createdAt);
const doubleSubtractDiffMs = now.getTime() - doubleSubtract.getTime();
const doubleSubtractDiffHours = doubleSubtractDiffMs / (1000 * 60 * 60);
console.log(`   原因2 - 正确转换: ${doubleSubtractDiffHours.toFixed(2)} 小时`);

// 原因3: 页面缓存
console.log(`   原因3 - 页面缓存: 可能显示的是旧数据`);

console.log('\n5. 验证 formatRelativeTime 函数:');
console.log(`   输入: ${apiResponse.createdAt}`);
console.log(`   输出: ${displayResult}`);
console.log(`   预期: 应该显示"${diffMinutes.toFixed(0)} 分钟前" 或 "大约 1 小时前"`);

if (displayResult.includes('9 小时')) {
  console.log(`\n   ❌ 显示不正确！`);
  console.log(`   可能的问题:`);
  console.log(`     1. formatRelativeTime 函数没有正确调用 fromBeijingTime`);
  console.log(`     2. 页面缓存了旧数据`);
  console.log(`     3. 数据库时间存储不正确`);
} else {
  console.log(`\n   ✅ 显示正确！`);
}

