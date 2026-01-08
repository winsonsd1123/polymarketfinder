/**
 * 检查特定钱包的发现时间
 */
import { fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🔍 检查钱包发现时间\n');

// 从数据库查询结果
const walletAddress = '0xd3398fb000080c5542f531fcb8c5dbea190d2535';
const dbCreatedAt = '2026-01-07 14:58:30.756'; // 数据库存储的北京时间
const currentUTC = new Date('2026-01-07T07:45:06.088Z'); // 当前 UTC 时间（从数据库 NOW() 获取）

console.log(`钱包地址: ${walletAddress}`);
console.log(`数据库存储时间（北京时间）: ${dbCreatedAt}`);
console.log(`当前 UTC 时间: ${currentUTC.toISOString()}`);
console.log('');

// 转换数据库时间
const convertedCreatedAt = fromBeijingTime(dbCreatedAt);
console.log(`转换后 UTC: ${convertedCreatedAt.toISOString()}`);

// 计算实际时间差
const diffMs = currentUTC.getTime() - convertedCreatedAt.getTime();
const diffHours = diffMs / (1000 * 60 * 60);
const diffMinutes = diffMs / (1000 * 60);

console.log(`\n实际时间差:`);
console.log(`  ${diffHours.toFixed(2)} 小时`);
console.log(`  ${diffMinutes.toFixed(0)} 分钟`);

// 显示结果
const relative = formatRelativeTime(dbCreatedAt);
console.log(`\n显示结果: ${relative}`);

// 验证
console.log('\n📊 验证:');
if (diffHours < 1) {
  console.log(`  ✅ 应该显示为"${diffMinutes.toFixed(0)} 分钟前"`);
} else if (diffHours < 24) {
  console.log(`  ✅ 应该显示为"大约 ${Math.round(diffHours)} 小时前"`);
} else {
  const days = Math.floor(diffHours / 24);
  console.log(`  ✅ 应该显示为"大约 ${days} 天前"`);
}

// 如果显示"大约 9 小时前"，检查是否有问题
if (relative.includes('9 小时')) {
  const expectedDiff = 9;
  const actualDiff = diffHours;
  const error = Math.abs(actualDiff - expectedDiff);
  
  console.log(`\n⚠️  显示为"大约 9 小时前"，但实际时间差是 ${actualDiff.toFixed(2)} 小时`);
  if (error > 1) {
    console.log(`  ❌ 时间显示有误差（误差 ${error.toFixed(2)} 小时）`);
    console.log(`  可能原因:`);
    console.log(`    1. 数据库时间存储不正确`);
    console.log(`    2. 时间转换函数有问题`);
    console.log(`    3. 页面缓存了旧数据`);
  } else {
    console.log(`  ✅ 时间显示基本正确（误差 < 1小时，可能是四舍五入）`);
  }
} else {
  console.log(`\n✅ 显示结果与实际时间差匹配`);
}


