#!/usr/bin/env tsx
/**
 * 查询钱包的所有类型交易（包括ERC-20转账、内部交易等）
 * 使用 Alchemy API 的 getAssetTransfers 方法
 */

import 'dotenv/config';

async function getAllTransactions(address: string) {
  const alchemyUrl = process.env.ALCHEMY_POLYGON_URL;
  
  if (!alchemyUrl || alchemyUrl.includes('demo')) {
    console.error('❌ 错误: ALCHEMY_POLYGON_URL 未配置或无效');
    console.error('   请在 .env 文件中设置有效的 Alchemy Polygon URL');
    process.exit(1);
  }

  console.log(`🔍 正在查询钱包 ${address} 的所有交易...\n`);
  console.log(`📡 Alchemy API: ${alchemyUrl.replace(/\/[^\/]*$/, '/***')}\n`);

  try {
    // 查询发送的交易（fromAddress）
    console.log('📤 查询发送的交易...');
    const fromResponse = await fetch(alchemyUrl, {
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
          category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
          maxCount: '0x3e8', // 1000条
          order: 'desc', // 最新的在前
        }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    const fromData = await fromResponse.json();
    
    if (fromData.error) {
      console.error('❌ Alchemy API 错误:', JSON.stringify(fromData.error, null, 2));
      process.exit(1);
    }

    const fromTransfers = fromData.result?.transfers || [];
    console.log(`   ✅ 找到 ${fromTransfers.length} 笔发送的交易\n`);

    // 查询接收的交易（toAddress）
    console.log('📥 查询接收的交易...');
    const toResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: '0x0',
          toBlock: 'latest',
          toAddress: address,
          category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
          maxCount: '0x3e8', // 1000条
          order: 'desc',
        }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    const toData = await toResponse.json();
    
    if (toData.error) {
      console.error('❌ Alchemy API 错误:', JSON.stringify(toData.error, null, 2));
      process.exit(1);
    }

    const toTransfers = toData.result?.transfers || [];
    console.log(`   ✅ 找到 ${toTransfers.length} 笔接收的交易\n`);

    // 统计各类型交易
    const categoryStats: Record<string, { sent: number; received: number }> = {};
    
    fromTransfers.forEach((transfer: any) => {
      const category = transfer.category || 'unknown';
      if (!categoryStats[category]) {
        categoryStats[category] = { sent: 0, received: 0 };
      }
      categoryStats[category].sent++;
    });

    toTransfers.forEach((transfer: any) => {
      const category = transfer.category || 'unknown';
      if (!categoryStats[category]) {
        categoryStats[category] = { sent: 0, received: 0 };
      }
      categoryStats[category].received++;
    });

    // 打印统计结果
    console.log('📊 交易统计:\n');
    console.log(`   总发送交易: ${fromTransfers.length} 笔`);
    console.log(`   总接收交易: ${toTransfers.length} 笔`);
    console.log(`   总计: ${fromTransfers.length + toTransfers.length} 笔\n`);

    console.log('📋 按类型分类:\n');
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const total = stats.sent + stats.received;
      console.log(`   ${category.toUpperCase()}:`);
      console.log(`     发送: ${stats.sent} 笔`);
      console.log(`     接收: ${stats.received} 笔`);
      console.log(`     总计: ${total} 笔\n`);
    });

    // 打印最近的ERC-20转账示例
    const erc20Transfers = [...fromTransfers, ...toTransfers]
      .filter((t: any) => t.category === 'erc20')
      .sort((a: any, b: any) => {
        const timeA = parseInt(a.metadata?.blockTimestamp || '0');
        const timeB = parseInt(b.metadata?.blockTimestamp || '0');
        return timeB - timeA; // 最新的在前
      })
      .slice(0, 10);

    if (erc20Transfers.length > 0) {
      console.log('💸 最近的 ERC-20 转账示例（前10笔）:\n');
      erc20Transfers.forEach((transfer: any, index: number) => {
        const time = transfer.metadata?.blockTimestamp 
          ? new Date(parseInt(transfer.metadata.blockTimestamp) * 1000).toISOString()
          : '未知时间';
        const from = transfer.from || '未知';
        const to = transfer.to || '未知';
        const value = transfer.value || 0;
        const token = transfer.asset || '未知代币';
        
        console.log(`   ${index + 1}. ${time}`);
        console.log(`      从: ${from.substring(0, 10)}...${from.substring(38)}`);
        console.log(`      到: ${to.substring(0, 10)}...${to.substring(38)}`);
        console.log(`      金额: ${value} ${token}\n`);
      });
    }

    // 对比 nonce
    console.log('💡 说明:\n');
    console.log('   - nonce 只统计外部交易（external transactions）');
    console.log('   - ERC-20 转账不计入 nonce');
    console.log('   - 内部交易（internal）不计入 nonce');
    console.log('   - 这就是为什么 nonce 可能很小，但实际交易很多的原因\n');

  } catch (error) {
    console.error('\n❌ 查询失败:', error);
    if (error instanceof Error) {
      console.error(`   错误信息: ${error.message}`);
    }
    process.exit(1);
  }
}

const address = process.argv[2] || '0xf4a4eab0af4fa0c94ffcc05b9df184edb4193117';

if (!address.startsWith('0x') || address.length !== 42) {
  console.error('❌ 无效的钱包地址格式');
  process.exit(1);
}

getAllTransactions(address)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
