#!/usr/bin/env tsx
/**
 * 查询钱包的交易次数（nonce）
 */

import { createPublicClient, http, Address } from 'viem';
import { polygon } from 'viem/chains';

function getPolygonRpcUrl(): string {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  if (!rpcUrl) {
    // 使用公共 RPC 端点作为备选
    return 'https://polygon-rpc.com';
  }
  return rpcUrl;
}

function createPolygonClient() {
  return createPublicClient({
    chain: polygon,
    transport: http(getPolygonRpcUrl(), {
      timeout: 30000,
    }),
  });
}

async function getTransactionCount(address: Address): Promise<number> {
  try {
    const client = createPolygonClient();
    const nonce = await client.getTransactionCount({ address });
    return nonce;
  } catch (error) {
    console.error('获取交易计数失败:', error);
    throw error;
  }
}

async function checkWalletNonce() {
  const address = process.argv[2] || '0xf4a4eab0af4fa0c94ffcc05b9df184edb4193117';
  
  if (!address.startsWith('0x') || address.length !== 42) {
    console.error('❌ 无效的钱包地址格式');
    process.exit(1);
  }

  console.log(`🔍 正在查询钱包 ${address} 的交易次数（nonce）...\n`);
  console.log(`📡 RPC 端点: ${getPolygonRpcUrl()}\n`);

  try {
    const nonce = await getTransactionCount(address as Address);
    
    console.log(`✅ 查询成功！\n`);
    console.log(`📊 钱包地址: ${address}`);
    console.log(`📈 交易次数 (nonce): ${nonce}`);
    console.log(`\n💡 说明:`);
    console.log(`   - nonce 表示该钱包主动发送的交易数量`);
    console.log(`   - nonce < 10 会被标记为可疑（风险分 +30）`);
    console.log(`   - 当前 nonce: ${nonce} ${nonce < 10 ? '⚠️  (小于10，可疑)' : '✅ (正常)'}`);
    
  } catch (error) {
    console.error('\n❌ 查询失败:', error);
    if (error instanceof Error) {
      console.error(`   错误信息: ${error.message}`);
    }
    process.exit(1);
  }
}

checkWalletNonce()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
