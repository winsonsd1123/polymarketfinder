#!/usr/bin/env tsx
/**
 * 检查钱包的所有交易类型，包括跨链交易和其他类型
 */

import 'dotenv/config';

async function checkAllTransactionTypes(address: string) {
  const alchemyUrl = process.env.ALCHEMY_POLYGON_URL;
  
  if (!alchemyUrl || alchemyUrl.includes('demo')) {
    console.error('❌ 错误: ALCHEMY_POLYGON_URL 未配置或无效');
    process.exit(1);
  }

  console.log(`🔍 正在查询钱包 ${address} 的所有交易类型...\n`);

  // Alchemy API 支持的所有交易类型
  const allCategories = ['external', 'internal', 'erc20', 'erc721', 'erc1155', 'specialnft'];
  
  console.log('📋 Alchemy API 支持的交易类型:');
  allCategories.forEach(cat => console.log(`   - ${cat}`));
  console.log('');

  try {
    // 查询发送的交易
    console.log('📤 查询发送的交易（所有类型）...');
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
          category: allCategories,
          maxCount: '0x3e8', // 1000条
          order: 'desc',
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

    // 查询接收的交易
    console.log('📥 查询接收的交易（所有类型）...');
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
          category: allCategories,
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
    const categoryStats: Record<string, { sent: number; received: number; examples: any[] }> = {};
    
    fromTransfers.forEach((transfer: any) => {
      const category = transfer.category || 'unknown';
      if (!categoryStats[category]) {
        categoryStats[category] = { sent: 0, received: 0, examples: [] };
      }
      categoryStats[category].sent++;
      if (categoryStats[category].examples.length < 3) {
        categoryStats[category].examples.push(transfer);
      }
    });

    toTransfers.forEach((transfer: any) => {
      const category = transfer.category || 'unknown';
      if (!categoryStats[category]) {
        categoryStats[category] = { sent: 0, received: 0, examples: [] };
      }
      categoryStats[category].received++;
      if (categoryStats[category].examples.length < 3) {
        categoryStats[category].examples.push(transfer);
      }
    });

    // 打印统计结果
    console.log('📊 交易统计（按类型）:\n');
    console.log(`   总发送交易: ${fromTransfers.length} 笔`);
    console.log(`   总接收交易: ${toTransfers.length} 笔`);
    console.log(`   总计: ${fromTransfers.length + toTransfers.length} 笔\n`);

    console.log('📋 详细分类:\n');
    Object.entries(categoryStats).sort((a, b) => {
      const totalA = a[1].sent + a[1].received;
      const totalB = b[1].sent + b[1].received;
      return totalB - totalA;
    }).forEach(([category, stats]) => {
      const total = stats.sent + stats.received;
      console.log(`   ${category.toUpperCase()}:`);
      console.log(`     发送: ${stats.sent} 笔`);
      console.log(`     接收: ${stats.received} 笔`);
      console.log(`     总计: ${total} 笔`);
      
      // 显示示例
      if (stats.examples.length > 0) {
        console.log(`     示例:`);
        stats.examples.slice(0, 2).forEach((example: any, idx: number) => {
          const time = example.metadata?.blockTimestamp 
            ? new Date(parseInt(example.metadata.blockTimestamp) * 1000).toISOString()
            : '未知时间';
          const hash = example.hash || '未知';
          const from = example.from || '未知';
          const to = example.to || '未知';
          const value = example.value || 0;
          const asset = example.asset || '未知';
          
          console.log(`       ${idx + 1}. ${time}`);
          console.log(`          哈希: ${hash.substring(0, 20)}...`);
          console.log(`          从: ${from.substring(0, 10)}...${from.substring(38)}`);
          console.log(`          到: ${to.substring(0, 10)}...${to.substring(38)}`);
          if (value > 0) {
            console.log(`          金额: ${value} ${asset}`);
          }
        });
      }
      console.log('');
    });

    // 检查是否有跨链交易（通过检查是否有其他链的数据）
    console.log('🌐 跨链交易检查:\n');
    console.log('   注意: Alchemy getAssetTransfers 主要查询当前链（Polygon）的交易');
    console.log('   跨链交易可能显示为普通转账，但实际涉及跨链桥接\n');
    
    // 检查是否有特殊的合约交互（可能是跨链桥）
    const bridgeContracts = [
      '0x4bfb41d5', // 可能是跨链桥合约
      '0xc5d563a3', // 可能是跨链桥合约
    ];
    
    const bridgeTransfers = [...fromTransfers, ...toTransfers].filter((t: any) => {
      return bridgeContracts.some(bridge => 
        t.to?.toLowerCase().startsWith(bridge.toLowerCase()) ||
        t.from?.toLowerCase().startsWith(bridge.toLowerCase())
      );
    });
    
    if (bridgeTransfers.length > 0) {
      console.log(`   ⚠️  发现 ${bridgeTransfers.length} 笔可能与跨链桥相关的交易\n`);
    }

    // 检查是否有其他链的交易（通过检查metadata）
    const uniqueChains = new Set<string>();
    [...fromTransfers, ...toTransfers].forEach((t: any) => {
      if (t.metadata?.network) {
        uniqueChains.add(t.metadata.network);
      }
    });
    
    if (uniqueChains.size > 0) {
      console.log(`   📍 发现的链: ${Array.from(uniqueChains).join(', ')}\n`);
    } else {
      console.log('   ℹ️  所有交易都在 Polygon 链上\n');
    }

    console.log('💡 说明:\n');
    console.log('   - external: 外部交易（会增加 nonce）');
    console.log('   - internal: 内部交易（合约调用产生的，不增加 nonce）');
    console.log('   - erc20: ERC-20 代币转账（不增加 nonce）');
    console.log('   - erc721: ERC-721 NFT 转账（不增加 nonce）');
    console.log('   - erc1155: ERC-1155 多代币转账（不增加 nonce）');
    console.log('   - specialnft: 特殊 NFT 交易（不增加 nonce）');
    console.log('   - 跨链交易可能显示为普通转账，但实际涉及跨链桥接\n');

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

checkAllTransactionTypes(address)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
