#!/usr/bin/env tsx
/**
 * 测试新的交易统计功能
 * 验证使用 Alchemy API 统计所有类型的发送交易
 */

import 'dotenv/config';
import { createPublicClient, http, Address } from 'viem';
import { polygon } from 'viem/chains';

function getPolygonRpcUrl(): string {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  if (!rpcUrl) {
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

/**
 * 获取钱包的交易计数（使用 Alchemy API 统计所有类型的发送交易）
 * 只统计发送的交易（fromAddress），不统计接收的交易
 */
async function getTransactionCount(client: any, address: Address): Promise<number> {
  const alchemyUrl = process.env.ALCHEMY_POLYGON_URL;
  
  // 如果配置了 Alchemy API，使用它来统计所有类型的发送交易
  if (alchemyUrl && !alchemyUrl.includes('demo')) {
    try {
      console.log(`[交易统计] 🔍 正在通过 Alchemy API 统计钱包 ${address} 的发送交易...`);
      
      const response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            fromAddress: address,
            category: ['external', 'internal', 'erc20', 'erc721', 'erc1155', 'specialnft'],
            maxCount: '0x3e8', // 最多查询1000条，用于统计
            order: 'desc',
          }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json();
      
      if (data.error) {
        console.warn(`[交易统计] ⚠️  Alchemy API 错误，回退到 nonce:`, data.error);
        // 回退到 nonce
        return await client.getTransactionCount({ address });
      }

      const transfers = data.result?.transfers || [];
      const totalCount = transfers.length;
      
      console.log(`[交易统计] ✅ 钱包 ${address} 的发送交易总数: ${totalCount} 笔（包括所有类型）`);
      
      // 统计各类型
      const categoryCounts: Record<string, number> = {};
      transfers.forEach((transfer: any) => {
        const category = transfer.category || 'unknown';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      
      console.log(`[交易统计] 📊 各类型统计:`);
      Object.entries(categoryCounts).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} 笔`);
      });
      
      // 如果查询到的数量达到1000，说明可能还有更多，但至少是1000+
      if (totalCount >= 1000) {
        console.log(`[交易统计] ⚠️  交易数量达到查询上限（1000），实际数量可能更多`);
      }
      
      return totalCount;
    } catch (error) {
      console.warn(`[交易统计] ⚠️  Alchemy API 调用失败，回退到 nonce:`, error);
      // 如果 Alchemy API 失败，回退到使用 nonce
    }
  }
  
  // 回退方案：使用 nonce（只统计外部交易）
  try {
    const nonce = await client.getTransactionCount({ address });
    console.log(`[交易统计] 📊 钱包 ${address} 的 nonce: ${nonce}（仅外部交易）`);
    return nonce;
  } catch (error) {
    console.error('获取交易计数失败:', error);
    return 0;
  }
}

async function testTransactionCount() {
  const testAddress = process.argv[2] || '0xf4a4eab0af4fa0c94ffcc05b9df184edb4193117';
  
  if (!testAddress.startsWith('0x') || testAddress.length !== 42) {
    console.error('❌ 无效的钱包地址格式');
    process.exit(1);
  }

  console.log('🧪 测试新的交易统计功能\n');
  console.log(`📋 测试钱包: ${testAddress}\n`);

  const client = createPolygonClient();
  const address = testAddress as Address;

  try {
    const transactionCount = await getTransactionCount(client, address);
    
    console.log(`\n✅ 测试完成！\n`);
    console.log(`📊 结果:`);
    console.log(`   发送交易总数: ${transactionCount} 笔`);
    console.log(`   风险评分: ${transactionCount < 10 ? '⚠️  风险分 +30（交易次数 < 10）' : '✅ 正常（交易次数 >= 10）'}`);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error(`   错误信息: ${error.message}`);
    }
    process.exit(1);
  }
}

testTransactionCount()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
