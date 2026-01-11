/**
 * 测试胜率计算功能
 */
import { calculateWinRate, isHighWinRate, getWinRateThreshold } from '../lib/win-rate';

async function testWinRate() {
  console.log('🧪 开始测试胜率计算功能...\n');

  // 测试配置
  const threshold = getWinRateThreshold();
  console.log(`📊 胜率阈值配置: ${threshold}%\n`);

  // 测试一个已知的钱包地址（如果有的话）
  // 这里使用一个示例地址，实际测试时需要替换为真实地址
  const testAddress = '0x56687bf447db6ffa42ffe2204a05edaa20f55839'; // 从文档中看到的示例地址

  console.log(`🔍 测试钱包地址: ${testAddress}\n`);

  try {
    // 测试计算胜率
    console.log('1️⃣ 测试 calculateWinRate 函数...');
    const winRateResult = await calculateWinRate(testAddress);

    if (winRateResult) {
      console.log('✅ 胜率计算成功！');
      console.log(`   总持仓数: ${winRateResult.totalPositions}`);
      console.log(`   盈利次数: ${winRateResult.winningPositions}`);
      console.log(`   亏损次数: ${winRateResult.losingPositions}`);
      console.log(`   胜率: ${winRateResult.winRate.toFixed(2)}%`);
      console.log(`   总盈亏: $${winRateResult.totalProfit.toFixed(2)}`);
      console.log(`   平均盈亏: $${winRateResult.avgProfit.toFixed(2)}`);

      // 测试判断是否高胜率
      console.log('\n2️⃣ 测试 isHighWinRate 函数...');
      const isHigh = isHighWinRate(winRateResult.winRate);
      console.log(`   是否高胜率: ${isHigh ? '✅ 是' : '❌ 否'} (${winRateResult.winRate.toFixed(2)}% >= ${threshold}%)`);

      // 测试边界情况
      console.log('\n3️⃣ 测试边界情况...');
      console.log(`   测试 59%: ${isHighWinRate(59) ? '✅ 是' : '❌ 否'}`);
      console.log(`   测试 60%: ${isHighWinRate(60) ? '✅ 是' : '❌ 否'}`);
      console.log(`   测试 61%: ${isHighWinRate(61) ? '✅ 是' : '❌ 否'}`);
      console.log(`   测试 70%: ${isHighWinRate(70) ? '✅ 是' : '❌ 否'}`);
    } else {
      console.log('⚠️  该钱包没有足够的已结算持仓（需要 >= 5 笔）');
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('   错误信息:', error.message);
      console.error('   错误堆栈:', error.stack);
    }
  }

  console.log('\n✅ 测试完成！');
}

// 运行测试
testWinRate().catch(console.error);
