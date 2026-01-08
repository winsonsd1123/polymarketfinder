/**
 * 验证钱包创建时间评估逻辑
 */
console.log('🔍 验证钱包创建时间评估逻辑\n');

// 模拟实际场景
const scenarios = [
  {
    name: '场景1: 新钱包（1小时前创建），30分钟前交易',
    walletCreatedUTC: new Date('2026-01-07T06:00:00.000Z'),
    tradeTimeUTC: new Date('2026-01-07T07:30:00.000Z'), // ISO 格式（带 Z）
    currentTimeUTC: new Date('2026-01-07T08:00:00.000Z'),
  },
  {
    name: '场景2: 新钱包（1小时前创建），但 trade.timestamp 是数据库格式',
    walletCreatedUTC: new Date('2026-01-07T06:00:00.000Z'),
    tradeTimeString: '2026-01-07 15:30:00.000', // 数据库格式（北京时间，不带 Z）
    currentTimeUTC: new Date('2026-01-07T08:00:00.000Z'),
  },
];

scenarios.forEach((scenario, index) => {
  console.log(`\n${scenario.name}:`);
  
  // 钱包创建时间（Alchemy 返回，UTC）
  const firstTxTime = scenario.walletCreatedUTC;
  console.log(`1. 钱包创建时间（UTC）: ${firstTxTime.toISOString()}`);
  
  // 交易时间
  let currentTradeTime: Date;
  if (scenario.tradeTimeUTC) {
    currentTradeTime = scenario.tradeTimeUTC;
    console.log(`2. 交易时间（UTC，ISO 格式）: ${currentTradeTime.toISOString()}`);
  } else if (scenario.tradeTimeString) {
    // 模拟：如果 trade.timestamp 是数据库格式
    currentTradeTime = new Date(scenario.tradeTimeString);
    console.log(`2. 交易时间（数据库格式）: ${scenario.tradeTimeString}`);
    console.log(`   解析为: ${currentTradeTime.toISOString()}`);
    console.log(`   ⚠️  注意：如果这是北京时间，实际 UTC 应该是: 2026-01-07T07:30:00.000Z`);
  }
  
  const now = scenario.currentTimeUTC;
  console.log(`3. 当前时间（UTC）: ${now.toISOString()}`);
  
  // 计算钱包年龄
  const ageMs = now.getTime() - firstTxTime.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  console.log(`4. 钱包年龄: ${ageHours.toFixed(2)} 小时`);
  console.log(`   是否 < 24 小时: ${ageHours < 24 ? '是（+50分）' : '否（+0分）'}`);
  
  // 计算 WC/TX gap
  const walletCreationToFirstTx = currentTradeTime.getTime() - firstTxTime.getTime();
  const walletAge = now.getTime() - firstTxTime.getTime();
  const gapPercentage = (walletCreationToFirstTx / walletAge) * 100;
  const gapHours = walletCreationToFirstTx / (1000 * 60 * 60);
  
  console.log(`5. WC/TX Gap:`);
  console.log(`   钱包创建到首次交易: ${gapHours.toFixed(2)} 小时`);
  console.log(`   Gap 百分比: ${gapPercentage.toFixed(2)}%`);
  console.log(`   是否 < 20%: ${gapPercentage < 20 ? '是（+15分）' : '否（+0分）'}`);
  
  // 验证时间转换
  if (scenario.tradeTimeString) {
    const expectedUTC = new Date('2026-01-07T07:30:00.000Z');
    const diffMs = Math.abs(currentTradeTime.getTime() - expectedUTC.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    
    console.log(`\n6. 时间转换验证:`);
    console.log(`   如果数据库时间是北京时间: 2026-01-07 15:30:00.000`);
    console.log(`   实际 UTC 应该是: ${expectedUTC.toISOString()}`);
    console.log(`   解析后是: ${currentTradeTime.toISOString()}`);
    console.log(`   差异: ${diffHours.toFixed(2)} 小时`);
    
    if (diffHours > 0.1) {
      console.log(`   ❌ 时间转换错误！`);
      console.log(`   问题：数据库返回的是北京时间，但 new Date() 按本地时间解析`);
      console.log(`   解决方案：需要从北京时间转换回 UTC`);
    } else {
      console.log(`   ✅ 时间转换正确（巧合，因为本地时间正好是 UTC+8）`);
    }
  }
});

// 检查代码中的实际处理
console.log('\n\n📊 代码检查:\n');
console.log('1. lib/analyzer.ts:465');
console.log('   const firstTxTime = await getFirstTransactionTime(...)');
console.log('   ✅ 返回 UTC 时间的 Date 对象\n');

console.log('2. app/api/cron/scan/route.ts:53');
console.log('   const currentTradeTime = new Date(trade.timestamp);');
console.log('   trade.timestamp 来自 PolymarketTrade 接口');
console.log('   ✅ 应该是 ISO 格式字符串（带 Z），new Date() 能正确解析\n');

console.log('3. lib/analyzer.ts:559');
console.log('   const walletCreationToFirstTx = currentTradeTime.getTime() - firstTxTime.getTime()');
console.log('   ✅ 两者都是 UTC，计算差值正确\n');

console.log('⚠️  潜在问题：');
console.log('   如果 trade.timestamp 不是 ISO 格式（不带 Z），new Date() 会按本地时间解析');
console.log('   这会导致时间转换错误');
console.log('   需要确认 trade.timestamp 的实际格式');


