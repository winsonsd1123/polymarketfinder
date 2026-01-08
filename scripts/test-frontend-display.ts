/**
 * 测试前端实际显示逻辑
 * 模拟完整的从数据库到前端显示的流程
 */
import { fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🧪 测试前端实际显示逻辑\n');

// 模拟从数据库查询到的实际数据
const mockDatabaseWallets = [
  {
    id: 34,
    address: '0xd3398fb000080c5542f531fcb8c5dbea190d2535',
    createdAt: '2026-01-07 14:58:30.756', // PostgreSQL timestamp 格式（北京时间）
    riskScore: 85,
  },
  // 模拟一个9小时前的钱包（如果存在）
  {
    id: 33,
    address: '0x1234567890123456789012345678901234567890',
    createdAt: '2026-01-07 06:30:00.000', // 9小时前（北京时间）
    riskScore: 70,
  },
];

// 模拟当前时间（UTC）
const now = new Date();
console.log(`当前 UTC 时间: ${now.toISOString()}`);
console.log(`当前北京时间: ${new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString()}\n`);

console.log('📊 测试钱包发现时间显示:\n');

mockDatabaseWallets.forEach((wallet, index) => {
  console.log(`\n钱包 ${index + 1}: ${wallet.address.substring(0, 10)}...`);
  console.log(`数据库 createdAt: ${wallet.createdAt}`);
  
  // 步骤1: 前端接收到数据（字符串格式）
  const receivedTime = wallet.createdAt;
  console.log(`  1. API 返回: ${receivedTime} (类型: ${typeof receivedTime})`);
  
  // 步骤2: 调用 formatRelativeTime（前端实际调用的函数）
  const displayResult = formatRelativeTime(receivedTime);
  console.log(`  2. formatRelativeTime 显示: ${displayResult}`);
  
  // 步骤3: 验证转换过程
  const converted = fromBeijingTime(receivedTime);
  const diffMs = now.getTime() - converted.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffMinutes = diffMs / (1000 * 60);
  
  console.log(`  3. 转换后 UTC: ${converted.toISOString()}`);
  console.log(`  4. 实际时间差: ${diffHours.toFixed(2)} 小时 (${diffMinutes.toFixed(0)} 分钟)`);
  
  // 步骤4: 验证显示是否正确
  let expectedDisplay = '';
  if (diffMinutes < 1) {
    expectedDisplay = '刚刚';
  } else if (diffMinutes < 60) {
    expectedDisplay = `${Math.round(diffMinutes)} 分钟前`;
  } else if (diffHours < 24) {
    expectedDisplay = `大约 ${Math.round(diffHours)} 小时前`;
  } else {
    const days = Math.floor(diffHours / 24);
    expectedDisplay = `大约 ${days} 天前`;
  }
  
  console.log(`  5. 预期显示: ${expectedDisplay}`);
  
  // 验证
  const isCorrect = displayResult.includes(expectedDisplay.split(' ')[0]) || 
                    (diffHours < 1 && displayResult.includes('分钟')) ||
                    (diffHours >= 1 && diffHours < 24 && displayResult.includes('小时'));
  
  if (isCorrect || Math.abs(diffHours - parseFloat(displayResult.match(/\d+/)?.[0] || '0')) < 1) {
    console.log(`  ✅ 显示正确！`);
  } else {
    console.log(`  ❌ 显示可能有问题！`);
    console.log(`     实际显示: ${displayResult}`);
    console.log(`     预期显示: ${expectedDisplay}`);
  }
});

// 测试边界情况
console.log('\n\n📊 测试边界情况:\n');

const edgeCases = [
  { name: '刚刚创建（1分钟前）', time: new Date(now.getTime() - 1 * 60 * 1000) },
  { name: '5分钟前', time: new Date(now.getTime() - 5 * 60 * 1000) },
  { name: '1小时前', time: new Date(now.getTime() - 1 * 60 * 60 * 1000) },
  { name: '9小时前', time: new Date(now.getTime() - 9 * 60 * 60 * 1000) },
  { name: '1天前', time: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
];

edgeCases.forEach((testCase) => {
  // 转换为北京时间存储格式
  const beijingTime = new Date(testCase.time.getTime() + 8 * 60 * 60 * 1000);
  const dbFormat = beijingTime.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
  
  const display = formatRelativeTime(dbFormat);
  const actualDiff = (now.getTime() - testCase.time.getTime()) / (1000 * 60 * 60);
  
  console.log(`${testCase.name}:`);
  console.log(`  数据库时间: ${dbFormat}`);
  console.log(`  显示结果: ${display}`);
  console.log(`  实际时间差: ${actualDiff.toFixed(2)} 小时`);
  console.log('');
});

// 检查是否有问题
console.log('\n📋 总结:\n');
console.log('如果看到"大约 9 小时前"，但实际钱包是47分钟前创建的，可能原因：');
console.log('1. 页面缓存了旧数据（已添加 no-cache 头）');
console.log('2. 数据库时间被错误更新');
console.log('3. 前端状态没有刷新');

// 验证实际数据库数据
console.log('\n🔍 建议检查实际数据库:\n');
console.log('运行以下 SQL 查询：');
console.log(`
SELECT 
  address,
  "createdAt",
  EXTRACT(EPOCH FROM (NOW() - ("createdAt"::timestamp - INTERVAL '8 hours'))) / 3600 as hours_ago
FROM monitored_wallets
WHERE address = '0xd3398fb000080c5542f531fcb8c5dbea190d2535';
`);


