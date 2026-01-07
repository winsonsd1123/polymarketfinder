/**
 * 验证钱包发现时间显示是否正确
 */
import { fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🔍 验证钱包发现时间显示\n');

// 模拟数据库返回的时间（北京时间，已加8小时）
const testCases = [
  {
    name: '9小时前的钱包',
    dbTime: '2026-01-07 06:30:00.000', // 假设当前是 15:30，9小时前是 06:30（北京时间）
    expectedHours: 9
  },
  {
    name: '刚创建的钱包（几分钟前）',
    dbTime: '2026-01-07 15:25:00.000', // 假设当前是 15:30，5分钟前
    expectedHours: 0.08 // 约5分钟
  },
  {
    name: '1小时前的钱包',
    dbTime: '2026-01-07 14:30:00.000', // 假设当前是 15:30，1小时前
    expectedHours: 1
  }
];

const now = new Date();
console.log(`当前 UTC 时间: ${now.toISOString()}`);
console.log(`当前北京时间: ${new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString()}\n`);

testCases.forEach((testCase) => {
  console.log(`\n测试: ${testCase.name}`);
  console.log(`数据库时间（北京时间）: ${testCase.dbTime}`);
  
  try {
    // 转换数据库时间
    const converted = fromBeijingTime(testCase.dbTime);
    console.log(`转换后 UTC: ${converted.toISOString()}`);
    
    // 计算实际时间差
    const diffMs = now.getTime() - converted.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMinutes = diffMs / (1000 * 60);
    
    console.log(`实际时间差: ${diffHours.toFixed(2)} 小时 (${diffMinutes.toFixed(0)} 分钟)`);
    
    // 显示结果
    const relative = formatRelativeTime(testCase.dbTime);
    console.log(`显示结果: ${relative}`);
    
    // 验证
    const expectedDiffHours = Math.abs(diffHours - testCase.expectedHours);
    if (expectedDiffHours < 0.5) {
      console.log(`✅ 时间显示正确（误差 < 0.5小时）`);
    } else {
      console.log(`⚠️  时间显示可能有误差（期望约 ${testCase.expectedHours} 小时，实际 ${diffHours.toFixed(2)} 小时）`);
    }
  } catch (error) {
    console.error(`❌ 错误:`, error);
  }
});

// 检查实际数据库中的钱包
console.log('\n\n📊 检查实际数据库中的钱包时间\n');
console.log('请运行以下 SQL 查询来检查：');
console.log(`
SELECT 
  address,
  "createdAt",
  NOW() as current_time,
  EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600 as hours_ago
FROM monitored_wallets
ORDER BY "createdAt" DESC
LIMIT 5;
`);

