/**
 * 测试胜率 API 功能
 * 这个脚本测试胜率计算和数据库操作的逻辑
 */

// 模拟 Closed Position 数据
const mockClosedPositions = [
  { realizedPnl: 100, outcome: 'Yes' },
  { realizedPnl: 50, outcome: 'Yes' },
  { realizedPnl: -30, outcome: 'No' },
  { realizedPnl: 80, outcome: 'Yes' },
  { realizedPnl: -20, outcome: 'No' },
  { realizedPnl: 60, outcome: 'Yes' },
  { realizedPnl: 40, outcome: 'Yes' },
];

// 测试胜率计算逻辑
function testWinRateCalculation() {
  console.log('🧪 测试胜率计算逻辑...\n');

  let winningPositions = 0;
  let losingPositions = 0;
  let totalProfit = 0;

  for (const position of mockClosedPositions) {
    const pnl = position.realizedPnl;
    totalProfit += pnl;
    
    if (pnl > 0) {
      winningPositions++;
    } else if (pnl < 0) {
      losingPositions++;
    }
  }

  const totalPositions = winningPositions + losingPositions;
  const winRate = totalPositions > 0 ? (winningPositions / totalPositions) * 100 : 0;
  const avgProfit = totalPositions > 0 ? totalProfit / totalPositions : 0;

  console.log(`✅ 测试数据统计:`);
  console.log(`   总持仓数: ${totalPositions}`);
  console.log(`   盈利次数: ${winningPositions}`);
  console.log(`   亏损次数: ${losingPositions}`);
  console.log(`   胜率: ${winRate.toFixed(2)}%`);
  console.log(`   总盈亏: $${totalProfit.toFixed(2)}`);
  console.log(`   平均盈亏: $${avgProfit.toFixed(2)}`);

  // 测试阈值判断
  const threshold = 60;
  const isHighWinRate = winRate >= threshold;
  console.log(`\n✅ 阈值判断 (${threshold}%):`);
  console.log(`   是否高胜率: ${isHighWinRate ? '✅ 是' : '❌ 否'}`);

  // 验证结果
  const expectedWinRate = (5 / 7) * 100; // 5 盈利 / 7 总持仓
  const expectedTotalProfit = 100 + 50 - 30 + 80 - 20 + 60 + 40; // 280
  
  if (Math.abs(winRate - expectedWinRate) < 0.01 && totalProfit === expectedTotalProfit) {
    console.log('\n✅ 胜率计算逻辑正确！');
  } else {
    console.log('\n❌ 胜率计算逻辑有误！');
    console.log(`   期望胜率: ${expectedWinRate.toFixed(2)}%`);
    console.log(`   期望总盈亏: $${expectedTotalProfit}`);
  }

  return { winRate, totalProfit, isHighWinRate };
}

// 测试钱包类型更新逻辑
function testWalletTypeUpdate() {
  console.log('\n🧪 测试钱包类型更新逻辑...\n');

  // 测试场景1：新钱包，只有可疑类型
  const scenario1 = {
    currentTypes: ['suspicious'],
    shouldAdd: true,
    expected: ['suspicious', 'high_win_rate'],
  };

  // 测试场景2：已有高胜率类型
  const scenario2 = {
    currentTypes: ['high_win_rate'],
    shouldAdd: false,
    expected: ['high_win_rate'],
  };

  // 测试场景3：两者都有
  const scenario3 = {
    currentTypes: ['suspicious', 'high_win_rate'],
    shouldAdd: false,
    expected: ['suspicious', 'high_win_rate'],
  };

  const scenarios = [scenario1, scenario2, scenario3];

  scenarios.forEach((scenario, index) => {
    const hasHighWinRate = scenario.currentTypes.includes('high_win_rate');
    let updatedTypes = scenario.currentTypes;
    
    if (!hasHighWinRate && scenario.shouldAdd) {
      updatedTypes = [...scenario.currentTypes, 'high_win_rate'];
    }

    const passed = JSON.stringify(updatedTypes.sort()) === JSON.stringify(scenario.expected.sort());
    console.log(`场景 ${index + 1}: ${passed ? '✅' : '❌'}`);
    console.log(`   当前类型: [${scenario.currentTypes.join(', ')}]`);
    console.log(`   更新后: [${updatedTypes.join(', ')}]`);
    console.log(`   期望: [${scenario.expected.join(', ')}]`);
  });
}

// 运行所有测试
console.log('='.repeat(50));
console.log('高胜率钱包功能测试');
console.log('='.repeat(50));

const result = testWinRateCalculation();
testWalletTypeUpdate();

console.log('\n' + '='.repeat(50));
console.log('✅ 所有测试完成！');
console.log('='.repeat(50));
