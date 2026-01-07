/**
 * 测试钱包创建时间的评估逻辑
 */
console.log('🧪 测试钱包创建时间评估逻辑\n');

// 模拟场景
const walletAgeScenarios = [
  {
    name: '场景1: Alchemy 返回 Unix 时间戳',
    alchemyTimestamp: 1704612600, // Unix 秒级时间戳
    currentTime: new Date('2026-01-07T07:50:00.000Z'), // 当前 UTC 时间
    tradeTime: new Date('2026-01-07T07:30:00.000Z'), // 交易时间（UTC）
  },
  {
    name: '场景2: 钱包刚创建（1小时前）',
    alchemyTimestamp: Math.floor((Date.now() - 1 * 60 * 60 * 1000) / 1000), // 1小时前
    currentTime: new Date(),
    tradeTime: new Date(Date.now() - 30 * 60 * 1000), // 30分钟前
  },
];

walletAgeScenarios.forEach((scenario, index) => {
  console.log(`\n${scenario.name}:`);
  
  // 步骤1: Alchemy 返回时间戳，转换为 Date
  const walletCreatedDate = new Date(scenario.alchemyTimestamp * 1000);
  console.log(`1. Alchemy 时间戳: ${scenario.alchemyTimestamp}`);
  console.log(`   转换为 Date: ${walletCreatedDate.toISOString()}`);
  
  // 步骤2: 计算钱包年龄（当前时间 - 钱包创建时间）
  const now = scenario.currentTime;
  const ageMs = now.getTime() - walletCreatedDate.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  console.log(`2. 当前时间: ${now.toISOString()}`);
  console.log(`   钱包年龄: ${ageHours.toFixed(2)} 小时`);
  
  // 步骤3: 判断是否 < 24 小时
  const isNewWallet = ageHours < 24;
  console.log(`3. 是否 < 24 小时: ${isNewWallet ? '是' : '否'}`);
  console.log(`   应该加分: ${isNewWallet ? '+50 分' : '+0 分'}`);
  
  // 步骤4: 计算 WC/TX gap（钱包创建到首次交易的时间）
  if (scenario.tradeTime) {
    const walletCreationToFirstTx = scenario.tradeTime.getTime() - walletCreatedDate.getTime();
    const walletAge = now.getTime() - walletCreatedDate.getTime();
    const gapPercentage = (walletCreationToFirstTx / walletAge) * 100;
    const gapHours = walletCreationToFirstTx / (1000 * 60 * 60);
    
    console.log(`4. WC/TX Gap 计算:`);
    console.log(`   钱包创建时间: ${walletCreatedDate.toISOString()}`);
    console.log(`   首次交易时间: ${scenario.tradeTime.toISOString()}`);
    console.log(`   时间差: ${gapHours.toFixed(2)} 小时`);
    console.log(`   钱包年龄: ${(walletAge / (1000 * 60 * 60)).toFixed(2)} 小时`);
    console.log(`   Gap 百分比: ${gapPercentage.toFixed(2)}%`);
    console.log(`   是否 < 20%: ${gapPercentage < 20 ? '是' : '否'}`);
    console.log(`   应该加分: ${gapPercentage < 20 ? '+15 分' : '+0 分'}`);
  }
  
  // 验证时间转换
  console.log(`\n5. 时间转换验证:`);
  console.log(`   Alchemy 返回的是 UTC 时间戳: ${scenario.alchemyTimestamp}`);
  console.log(`   转换为 Date 后: ${walletCreatedDate.toISOString()} (UTC)`);
  console.log(`   计算年龄时使用 UTC 时间: ✅ 正确`);
  console.log(`   不需要转换为北京时间: ✅ 正确（因为年龄是时间差，与时区无关）`);
});

// 检查代码中的实际逻辑
console.log('\n\n📊 检查代码中的实际逻辑:\n');
console.log('代码位置: lib/analyzer.ts:463-477');
console.log('1. getFirstTransactionTime() 返回 Date 对象（UTC 时间）');
console.log('2. const ageMs = now.getTime() - firstTxTime.getTime()');
console.log('3. const ageHours = ageMs / (1000 * 60 * 60)');
console.log('4. if (ageHours < 24) { score += 50 }');
console.log('\n✅ 这个逻辑是正确的！因为：');
console.log('   - 时间差计算不依赖时区');
console.log('   - Date.getTime() 返回的是 UTC 毫秒数');
console.log('   - 两个 UTC 时间的差值就是实际的时间差');

// 检查 WC/TX gap 计算
console.log('\n\n📊 检查 WC/TX Gap 计算:\n');
console.log('代码位置: lib/analyzer.ts:521-539');
console.log('1. const walletCreationToFirstTx = currentTradeTime.getTime() - firstTxTime.getTime()');
console.log('2. const walletAge = new Date().getTime() - firstTxTime.getTime()');
console.log('3. const gapPercentage = (walletCreationToFirstTx / walletAge) * 100');
console.log('\n⚠️  潜在问题：');
console.log('   - currentTradeTime 是从 trade.timestamp 解析的（可能是 UTC）');
console.log('   - firstTxTime 是从 Alchemy 获取的（UTC）');
console.log('   - 如果 trade.timestamp 是北京时间，需要转换！');

// 检查 trade.timestamp 的处理
console.log('\n\n📊 检查 trade.timestamp 的处理:\n');
console.log('代码位置: app/api/cron/scan/route.ts:53');
console.log('const currentTradeTime = new Date(trade.timestamp);');
console.log('\n⚠️  需要检查：');
console.log('   - trade.timestamp 是什么格式？');
console.log('   - 如果是 ISO 格式（如 "2026-01-07T07:30:00.000Z"），new Date() 会正确解析为 UTC');
console.log('   - 如果是其他格式，可能需要转换');

