import 'dotenv/config';
import { analyzeWallet } from '../lib/analyzer';

/**
 * 测试钱包分析功能
 */
async function testAnalyzer() {
  console.log('🔍 开始测试钱包分析功能...\n');

  // 测试地址（可以使用真实的 Polygon 地址进行测试）
  const testAddresses = [
    // 示例：可以替换为真实的 Polygon 地址
    process.env.TEST_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
  ];

  for (const address of testAddresses) {
    if (address === '0x0000000000000000000000000000000000000000') {
      console.log('⚠️  请设置 TEST_WALLET_ADDRESS 环境变量来测试真实地址\n');
      console.log('示例: TEST_WALLET_ADDRESS=0x... npm run test:analyzer\n');
      continue;
    }

    console.log(`📋 分析钱包: ${address}\n`);

    try {
      const result = await analyzeWallet(address);

      console.log('📊 分析结果:');
      console.log(`  是否可疑: ${result.isSuspicious ? '✅ 是' : '❌ 否'}`);
      console.log(`  风险评分: ${result.score}/100\n`);

      console.log('📝 详细信息:');
      console.log(`  ${result.details}\n`);

      console.log('🔎 检查详情:');
      console.log('  1. 钱包年龄检查:');
      if (result.checks.walletAge.firstTxTime) {
        const ageHours = result.checks.walletAge.ageHours || 0;
        console.log(`     - 钱包年龄: ${ageHours.toFixed(2)} 小时`);
        console.log(`     - 第一笔交易时间: ${result.checks.walletAge.firstTxTime.toISOString()}`);
        console.log(`     - 是否通过: ${result.checks.walletAge.passed ? '✅' : '❌'}`);
        console.log(`     - 得分: +${result.checks.walletAge.score}`);
      } else {
        console.log('     - 无法确定钱包创建时间');
      }

      console.log('\n  2. 交易次数检查:');
      if (result.checks.transactionCount.nonce !== null) {
        console.log(`     - 交易次数 (nonce): ${result.checks.transactionCount.nonce}`);
        console.log(`     - 是否通过: ${result.checks.transactionCount.passed ? '✅' : '❌'}`);
        console.log(`     - 得分: +${result.checks.transactionCount.score}`);
      } else {
        console.log('     - 无法获取交易次数');
      }

      console.log('\n  3. 市场参与度检查:');
      console.log(`     - 参与市场数量: ${result.checks.marketParticipation.marketCount}`);
      console.log(`     - 是否通过: ${result.checks.marketParticipation.passed ? '✅' : '❌'}`);
      console.log(`     - 得分: +${result.checks.marketParticipation.score}`);

      if (result.checks.fundingSource) {
        console.log('\n  4. 资金来源检查:');
        console.log(`     - 资金来源地址: ${result.checks.fundingSource.sourceAddress || '未知'}`);
      }

      console.log('\n' + '='.repeat(60) + '\n');
    } catch (error) {
      console.error(`❌ 分析钱包 ${address} 时出错:`, error);
      if (error instanceof Error) {
        console.error('错误详情:', error.message);
        console.error('错误堆栈:', error.stack);
      }
    }
  }
}

// 运行测试
testAnalyzer()
  .then(() => {
    console.log('✨ 测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 测试异常:', error);
    process.exit(1);
  });

