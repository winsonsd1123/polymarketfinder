/**
 * 测试风险评分逻辑
 */
console.log('🧪 测试风险评分逻辑\n');

// 从数据库查询结果分析
const testCases = [
  {
    name: '案例1: 新钱包，交易少，金额小',
    walletAgeHours: 10, // < 24 小时
    nonce: 1, // < 10
    marketCount: 0, // 新钱包，还没有交易记录
    tradeAmount: 500, // < $1000
    wcTxGapPercentage: 5, // < 20%
    hoursSinceTransaction: 2, // < 5 小时
    expectedScore: 50 + 30 + 20 + 0 + 15 + 10, // 125 分
    expectedSuspicious: false, // 因为金额 < $1000
  },
  {
    name: '案例2: 新钱包，交易少，金额大',
    walletAgeHours: 10,
    nonce: 1,
    marketCount: 0,
    tradeAmount: 15000, // > $10,000
    wcTxGapPercentage: 5,
    hoursSinceTransaction: 2,
    expectedScore: 50 + 30 + 20 + 10 + 15 + 10, // 135 分
    expectedSuspicious: true, // 金额 >= $1000
  },
  {
    name: '案例3: 老钱包，交易少，金额大',
    walletAgeHours: 100, // >= 24 小时
    nonce: 1,
    marketCount: 0,
    tradeAmount: 15000,
    wcTxGapPercentage: 5,
    hoursSinceTransaction: 2,
    expectedScore: 0 + 30 + 20 + 10 + 15 + 10, // 85 分
    expectedSuspicious: true,
  },
  {
    name: '案例4: 新钱包，交易多，金额小',
    walletAgeHours: 10,
    nonce: 20, // >= 10
    marketCount: 5, // >= 3
    tradeAmount: 500,
    wcTxGapPercentage: 5,
    hoursSinceTransaction: 2,
    expectedScore: 50 + 0 + 0 + 0 + 15 + 10, // 75 分
    expectedSuspicious: false, // 因为金额 < $1000
  },
];

console.log('📊 评分规则:\n');
console.log('1. 钱包年龄 < 24 小时: +50 分');
console.log('2. 交易次数 (nonce) < 10: +30 分');
console.log('3. 市场参与度 < 3 个: +20 分');
console.log('4. 交易金额 > $10,000: +10 分');
console.log('5. WC/TX gap < 20%: +15 分');
console.log('6. 交易时间 < 5 小时: +10 分');
console.log('7. 总分 >= 50 且交易金额 >= $1000 才标记为可疑\n');

testCases.forEach((testCase, index) => {
  console.log(`\n测试 ${index + 1}: ${testCase.name}`);
  
  let score = 0;
  const details: string[] = [];
  
  // 1. 钱包年龄
  if (testCase.walletAgeHours < 24) {
    score += 50;
    details.push(`钱包年龄 < 24 小时: +50`);
  } else {
    details.push(`钱包年龄 >= 24 小时: +0`);
  }
  
  // 2. 交易次数
  if (testCase.nonce < 10) {
    score += 30;
    details.push(`交易次数 < 10: +30`);
  } else {
    details.push(`交易次数 >= 10: +0`);
  }
  
  // 3. 市场参与度
  // ⚠️ 问题：代码中是 `if (marketCount > 0 && marketCount < 3)`
  // 这意味着 marketCount = 0 时不会加分！
  if (testCase.marketCount > 0 && testCase.marketCount < 3) {
    score += 20;
    details.push(`市场参与度 < 3: +20`);
  } else if (testCase.marketCount === 0) {
    details.push(`市场参与度 = 0（新钱包，无交易记录）: +0`);
  } else {
    details.push(`市场参与度 >= 3: +0`);
  }
  
  // 4. 交易金额
  if (testCase.tradeAmount > 10000) {
    score += 10;
    details.push(`交易金额 > $10,000: +10`);
  } else {
    details.push(`交易金额 <= $10,000: +0`);
  }
  
  // 5. WC/TX gap
  if (testCase.wcTxGapPercentage < 20) {
    score += 15;
    details.push(`WC/TX gap < 20%: +15`);
  } else {
    details.push(`WC/TX gap >= 20%: +0`);
  }
  
  // 6. 交易时间
  if (testCase.hoursSinceTransaction < 5) {
    score += 10;
    details.push(`交易时间 < 5 小时: +10`);
  } else {
    details.push(`交易时间 >= 5 小时: +0`);
  }
  
  // 判断是否可疑
  let isSuspicious = score >= 50;
  if (testCase.tradeAmount < 1000) {
    isSuspicious = false;
    details.push(`交易金额 < $1000，解除可疑标记`);
  }
  
  console.log(`  计算得分: ${score} 分`);
  console.log(`  预期得分: ${testCase.expectedScore} 分`);
  console.log(`  是否可疑: ${isSuspicious ? '是' : '否'}`);
  console.log(`  预期可疑: ${testCase.expectedSuspicious ? '是' : '否'}`);
  console.log(`  详情: ${details.join('; ')}`);
  
  if (score !== testCase.expectedScore) {
    console.log(`  ❌ 得分不匹配！`);
  } else if (isSuspicious !== testCase.expectedSuspicious) {
    console.log(`  ❌ 可疑标记不匹配！`);
  } else {
    console.log(`  ✅ 测试通过`);
  }
});

// 检查实际数据库中的问题
console.log('\n\n🔍 检查实际数据库中的问题:\n');
console.log('从数据库查询结果看：');
console.log('- 所有钱包的 market_participation_count = 0');
console.log('- 所有钱包的 market_participation_score = 0');
console.log('- 这说明新钱包在分析时还没有交易记录');
console.log('- 但代码中 `if (marketCount > 0 && marketCount < 3)` 不会给 marketCount = 0 加分');
console.log('- 这可能导致新钱包的风险评分偏低！\n');

console.log('💡 建议修复：');
console.log('1. 对于新钱包（marketCount = 0），也应该给予市场参与度分数');
console.log('2. 或者，在分析时应该考虑当前交易的市场，而不是只查询数据库历史');


