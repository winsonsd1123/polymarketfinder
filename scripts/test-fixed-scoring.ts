/**
 * 测试修复后的风险评分逻辑
 */
console.log('🧪 测试修复后的风险评分逻辑\n');

// 模拟修复后的逻辑
function calculateScore(
  walletAgeHours: number,
  nonce: number,
  marketCount: number, // 修复后：包含当前交易的市场
  tradeAmount: number,
  wcTxGapPercentage: number,
  hoursSinceTransaction: number
): { score: number; details: string[]; isSuspicious: boolean } {
  let score = 0;
  const details: string[] = [];
  
  // 1. 钱包年龄
  if (walletAgeHours < 24) {
    score += 50;
    details.push(`钱包年龄 < 24 小时: +50`);
  } else {
    details.push(`钱包年龄 >= 24 小时: +0`);
  }
  
  // 2. 交易次数
  if (nonce < 10) {
    score += 30;
    details.push(`交易次数 < 10: +30`);
  } else {
    details.push(`交易次数 >= 10: +0`);
  }
  
  // 3. 市场参与度（修复后：marketCount < 3 就加分，包括 marketCount = 0 或 1）
  if (marketCount < 3) {
    score += 20;
    details.push(`市场参与度 < 3（${marketCount} 个）: +20`);
  } else {
    details.push(`市场参与度 >= 3（${marketCount} 个）: +0`);
  }
  
  // 4. 交易金额
  if (tradeAmount > 10000) {
    score += 10;
    details.push(`交易金额 > $10,000: +10`);
  } else {
    details.push(`交易金额 <= $10,000: +0`);
  }
  
  // 5. WC/TX gap
  if (wcTxGapPercentage < 20) {
    score += 15;
    details.push(`WC/TX gap < 20%: +15`);
  } else {
    details.push(`WC/TX gap >= 20%: +0`);
  }
  
  // 6. 交易时间
  if (hoursSinceTransaction < 5) {
    score += 10;
    details.push(`交易时间 < 5 小时: +10`);
  } else {
    details.push(`交易时间 >= 5 小时: +0`);
  }
  
  // 判断是否可疑
  let isSuspicious = score >= 50;
  if (tradeAmount < 1000) {
    isSuspicious = false;
    details.push(`交易金额 < $1000，解除可疑标记`);
  }
  
  return { score, details, isSuspicious };
}

const fixedTestCases = [
  {
    name: '案例1: 新钱包，交易少，金额小（修复后）',
    walletAgeHours: 10,
    nonce: 1,
    marketCount: 1, // 修复后：包含当前交易的市场
    tradeAmount: 500,
    wcTxGapPercentage: 5,
    hoursSinceTransaction: 2,
    expectedScore: 50 + 30 + 20 + 0 + 15 + 10, // 125 分
    expectedSuspicious: false,
  },
  {
    name: '案例2: 新钱包，交易少，金额大（修复后）',
    walletAgeHours: 10,
    nonce: 1,
    marketCount: 1,
    tradeAmount: 15000,
    wcTxGapPercentage: 5,
    hoursSinceTransaction: 2,
    expectedScore: 50 + 30 + 20 + 10 + 15 + 10, // 135 分
    expectedSuspicious: true,
  },
];

console.log('📊 修复后的评分规则:\n');
console.log('1. 钱包年龄 < 24 小时: +50 分');
console.log('2. 交易次数 (nonce) < 10: +30 分');
console.log('3. 市场参与度 < 3 个（包括 0、1、2）: +20 分 ✅ 修复');
console.log('4. 交易金额 > $10,000: +10 分');
console.log('5. WC/TX gap < 20%: +15 分');
console.log('6. 交易时间 < 5 小时: +10 分');
console.log('7. 总分 >= 50 且交易金额 >= $1000 才标记为可疑\n');

fixedTestCases.forEach((testCase, index) => {
  console.log(`\n测试 ${index + 1}: ${testCase.name}`);
  
  const result = calculateScore(
    testCase.walletAgeHours,
    testCase.nonce,
    testCase.marketCount,
    testCase.tradeAmount,
    testCase.wcTxGapPercentage,
    testCase.hoursSinceTransaction
  );
  
  console.log(`  计算得分: ${result.score} 分`);
  console.log(`  预期得分: ${testCase.expectedScore} 分`);
  console.log(`  是否可疑: ${result.isSuspicious ? '是' : '否'}`);
  console.log(`  预期可疑: ${testCase.expectedSuspicious ? '是' : '否'}`);
  console.log(`  详情: ${result.details.join('; ')}`);
  
  if (result.score === testCase.expectedScore && result.isSuspicious === testCase.expectedSuspicious) {
    console.log(`  ✅ 测试通过！`);
  } else {
    console.log(`  ❌ 测试失败！`);
  }
});

console.log('\n\n✅ 修复说明:');
console.log('- 修复前：marketCount = 0 时不会加分（条件：marketCount > 0 && marketCount < 3）');
console.log('- 修复后：marketCount < 3 时都会加分（包括 marketCount = 0、1、2）');
console.log('- 修复后：在分析时会考虑当前交易的市场，确保新钱包也能正确评分');

