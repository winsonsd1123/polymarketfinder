/**
 * 测试 trade.timestamp 的实际格式和时间转换
 */
console.log('🧪 测试 trade.timestamp 格式和时间转换\n');

// 模拟 Polymarket API 返回的不同格式
const testFormats = [
  {
    name: 'ISO 格式（带 Z）',
    timestamp: '2026-01-07T07:30:00.000Z',
    expectedUTC: '2026-01-07T07:30:00.000Z',
  },
  {
    name: 'ISO 格式（不带 Z）',
    timestamp: '2026-01-07T07:30:00.000',
    expectedUTC: '2026-01-07T07:30:00.000Z', // 会被解析为本地时间，然后转换为 UTC
  },
  {
    name: 'Unix 时间戳（秒）',
    timestamp: 1704612600,
    expectedUTC: '2024-01-07T07:30:00.000Z',
  },
];

testFormats.forEach((testCase) => {
  console.log(`\n测试: ${testCase.name}`);
  console.log(`  原始值: ${testCase.timestamp} (类型: ${typeof testCase.timestamp})`);
  
  // 模拟代码中的处理：new Date(trade.timestamp)
  let dateObj: Date;
  if (typeof testCase.timestamp === 'number') {
    // 判断是秒级还是毫秒级时间戳
    dateObj = testCase.timestamp < 10000000000
      ? new Date(testCase.timestamp * 1000)
      : new Date(testCase.timestamp);
  } else {
    dateObj = new Date(testCase.timestamp);
  }
  
  console.log(`  解析为 Date: ${dateObj.toISOString()}`);
  console.log(`  预期 UTC: ${testCase.expectedUTC}`);
  
  if (dateObj.toISOString() === testCase.expectedUTC) {
    console.log(`  ✅ 解析正确`);
  } else {
    console.log(`  ⚠️  解析可能有问题`);
    console.log(`     注意：如果 timestamp 没有时区信息，new Date() 会按本地时间解析`);
  }
});

// 检查实际代码中的处理
console.log('\n\n📊 检查实际代码处理:\n');
console.log('1. lib/polymarket.ts:265-276');
console.log('   - 如果 timestamp 是数字，转换为 ISO 格式');
console.log('   - 如果 timestamp 是字符串，直接使用 new Date()');
console.log('   - 最终返回 ISO 格式字符串\n');

console.log('2. app/api/cron/scan/route.ts:53');
console.log('   const currentTradeTime = new Date(trade.timestamp);');
console.log('   - trade.timestamp 应该是 ISO 格式字符串（从 polymarket.ts 返回）');
console.log('   - new Date() 应该能正确解析为 UTC 时间\n');

console.log('3. lib/analyzer.ts:557-559');
console.log('   const walletCreationToFirstTx = currentTradeTime.getTime() - firstTxTime.getTime()');
console.log('   - currentTradeTime: 从 trade.timestamp 解析（应该是 UTC）');
console.log('   - firstTxTime: 从 Alchemy 获取（UTC）');
console.log('   - 两者都是 UTC，计算差值应该正确\n');

// 验证 WC/TX gap 计算
console.log('\n\n📊 验证 WC/TX Gap 计算:\n');
const walletCreatedUTC = new Date('2026-01-07T06:00:00.000Z');
const tradeTimeUTC = new Date('2026-01-07T07:30:00.000Z');
const nowUTC = new Date('2026-01-07T08:00:00.000Z');

const walletCreationToFirstTx = tradeTimeUTC.getTime() - walletCreatedUTC.getTime();
const walletAge = nowUTC.getTime() - walletCreatedUTC.getTime();
const gapPercentage = (walletCreationToFirstTx / walletAge) * 100;
const gapHours = walletCreationToFirstTx / (1000 * 60 * 60);

console.log(`钱包创建时间（UTC）: ${walletCreatedUTC.toISOString()}`);
console.log(`首次交易时间（UTC）: ${tradeTimeUTC.toISOString()}`);
console.log(`当前时间（UTC）: ${nowUTC.toISOString()}`);
console.log(`钱包创建到首次交易: ${gapHours.toFixed(2)} 小时`);
console.log(`钱包年龄: ${(walletAge / (1000 * 60 * 60)).toFixed(2)} 小时`);
console.log(`Gap 百分比: ${gapPercentage.toFixed(2)}%`);
console.log(`是否 < 20%: ${gapPercentage < 20 ? '是' : '否'}`);

if (gapPercentage < 20) {
  console.log(`✅ 应该加分 +15 分`);
} else {
  console.log(`❌ 不应该加分`);
}

// 检查潜在问题
console.log('\n\n⚠️  潜在问题检查:\n');
console.log('如果 trade.timestamp 是北京时间（已加8小时），但被当作 UTC 解析：');
const beijingTimeString = '2026-01-07T15:30:00.000'; // 北京时间（已加8小时）
const parsedAsUTC = new Date(beijingTimeString);
console.log(`  北京时间字符串: ${beijingTimeString}`);
console.log(`  解析为 Date: ${parsedAsUTC.toISOString()}`);
console.log(`  如果这是北京时间，实际 UTC 应该是: 2026-01-07T07:30:00.000Z`);
console.log(`  但解析后是: ${parsedAsUTC.toISOString()}`);
console.log(`  差异: ${(parsedAsUTC.getTime() - new Date('2026-01-07T07:30:00.000Z').getTime()) / (1000 * 60 * 60)} 小时`);


