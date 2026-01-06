import { fetchRecentTrades, clearProcessedTrades, getProcessedCount } from '../lib/polymarket';

/**
 * 测试获取 Polymarket 交易数据
 */
async function testFetch() {
  console.log('🚀 开始测试 Polymarket 交易数据获取...\n');

  try {
    // 清除之前的处理记录（可选，用于测试去重功能）
    // clearProcessedTrades();

    // 获取最近的交易数据
    console.log('📡 正在获取最近的交易数据（limit: 50）...');
    // 如果 API 不可用，可以设置第二个参数为 true 使用模拟数据
    const useMockData = process.env.USE_MOCK_DATA === 'true';
    const trades = await fetchRecentTrades(50, useMockData);

    console.log(`\n✅ 成功获取 ${trades.length} 条交易记录\n`);
    console.log(`📊 已处理的交易总数: ${getProcessedCount()}\n`);

    if (trades.length === 0) {
      console.log('⚠️  未获取到交易数据，可能是：');
      console.log('   1. API 端点需要调整');
      console.log('   2. 网络连接问题');
      console.log('   3. API 响应格式与预期不符\n');
      return;
    }

    // 打印前 5 条交易记录作为示例
    console.log('📋 前 5 条交易记录示例：\n');
    trades.slice(0, 5).forEach((trade, index) => {
      console.log(`交易 ${index + 1}:`);
      console.log(`  钱包地址: ${trade.maker_address}`);
      console.log(`  资产ID: ${trade.asset_id}`);
      console.log(`  交易金额: ${trade.amount_usdc} USDC`);
      console.log(`  时间戳: ${trade.timestamp}`);
      console.log('');
    });

    // 统计信息
    const totalAmount = trades.reduce((sum, trade) => sum + trade.amount_usdc, 0);
    const uniqueWallets = new Set(trades.map((t) => t.maker_address)).size;
    const uniqueAssets = new Set(trades.map((t) => t.asset_id)).size;

    console.log('📈 统计信息：');
    console.log(`  总交易金额: ${totalAmount.toFixed(2)} USDC`);
    console.log(`  唯一钱包数: ${uniqueWallets}`);
    console.log(`  唯一资产数: ${uniqueAssets}`);
    console.log('');

    // 测试去重功能（仅在使用真实 API 时有效）
    if (!useMockData) {
      console.log('🔄 测试去重功能（再次获取相同数据）...');
      const trades2 = await fetchRecentTrades(50, false);
      console.log(`   第二次获取: ${trades2.length} 条（应该为 0，因为已去重）\n`);

      if (trades2.length === 0) {
        console.log('✅ 去重功能正常工作！\n');
      } else {
        console.log('⚠️  去重功能可能存在问题，返回了重复数据\n');
      }
    } else {
      console.log('ℹ️  模拟数据模式下跳过去重测试（每次生成随机数据）\n');
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
testFetch()
  .then(() => {
    console.log('✨ 测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 测试异常:', error);
    process.exit(1);
  });

