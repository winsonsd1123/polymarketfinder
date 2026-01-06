#!/usr/bin/env tsx
/**
 * 测试真实的 Polymarket API 端点
 * 用于诊断 API 连接问题
 */

import { fetchRecentTrades } from '../lib/polymarket';

async function testRealAPI() {
  console.log('🔍 开始测试真实的 Polymarket API...\n');

  try {
    const trades = await fetchRecentTrades(10, false); // 不使用模拟数据
    console.log('\n✅ 成功获取交易数据:');
    console.log(`   数量: ${trades.length}`);
    if (trades.length > 0) {
      console.log('\n前3条交易示例:');
      trades.slice(0, 3).forEach((trade, index) => {
        console.log(`\n交易 ${index + 1}:`);
        console.log(`  钱包地址: ${trade.maker_address}`);
        console.log(`  资产ID: ${trade.asset_id}`);
        console.log(`  金额: ${trade.amount_usdc} USDC`);
        console.log(`  时间: ${trade.timestamp}`);
      });
    }
  } catch (error: any) {
    console.error('\n❌ API 调用失败:');
    console.error(`   错误信息: ${error.message}`);
    console.error('\n📋 可能的原因:');
    console.error('   1. API 端点不正确或已变更');
    console.error('   2. 需要 API 密钥或认证');
    console.error('   3. 网络连接问题');
    console.error('   4. API 速率限制');
    console.error('   5. Polymarket API 可能需要特定的请求头或参数');
    console.error('\n💡 建议:');
    console.error('   1. 查看服务器日志中的详细错误信息');
    console.error('   2. 访问 https://docs.polymarket.com/ 查看最新 API 文档');
    console.error('   3. 检查是否需要申请 API 访问权限');
    console.error('   4. 考虑使用 WebSocket 连接获取实时数据');
    process.exit(1);
  }
}

testRealAPI();

