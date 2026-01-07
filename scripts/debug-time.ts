/**
 * 调试时间转换问题
 */
import { fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

// 实际数据库中的时间
const testCases = [
  {
    name: 'completed_at (使用 getBeijingTime)',
    time: '2026-01-07 15:31:15.745',
    expected: '应该是几分钟前'
  },
  {
    name: 'created_at (数据库默认值 CURRENT_TIMESTAMP)',
    time: '2026-01-07 07:29:52.282024',
    expected: '应该是几分钟前（如果刚创建）'
  },
  {
    name: 'started_at (使用 getBeijingTime)',
    time: '2026-01-07 15:29:52.199',
    expected: '应该是几分钟前'
  }
];

console.log('🔍 调试时间转换问题\n');
console.log('当前 UTC 时间:', new Date().toISOString());
console.log('当前本地时间:', new Date().toString());
console.log('');

testCases.forEach((testCase) => {
  console.log(`\n测试: ${testCase.name}`);
  console.log(`  数据库时间: ${testCase.time}`);
  console.log(`  预期: ${testCase.expected}`);
  
  try {
    const converted = fromBeijingTime(testCase.time);
    const relative = formatRelativeTime(testCase.time);
    const diffMinutes = (Date.now() - converted.getTime()) / 1000 / 60;
    
    console.log(`  转换后 UTC: ${converted.toISOString()}`);
    console.log(`  显示结果: ${relative}`);
    console.log(`  实际时间差: ${diffMinutes.toFixed(1)} 分钟前`);
    
    if (diffMinutes > 60) {
      console.log(`  ⚠️  警告: 时间差超过1小时，可能有问题！`);
    }
  } catch (error) {
    console.error(`  ❌ 错误:`, error);
  }
});

// 检查问题：created_at 使用了数据库默认值，可能是 UTC 时间
console.log('\n\n📊 问题分析:');
console.log('如果 created_at 使用了数据库的 CURRENT_TIMESTAMP，它返回的是 UTC 时间');
console.log('但 fromBeijingTime 会减去8小时，导致时间显示错误');
console.log('解决方案: 确保所有时间字段都使用 getBeijingTime() 存储');

