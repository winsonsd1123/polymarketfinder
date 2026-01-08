/**
 * 集成测试：模拟实际 API 调用，验证时间转换
 */
import { toBeijingTime, fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🧪 集成测试：实际 API 时间转换\n');

// ========== 测试 1: Polymarket 交易时间（实际格式） ==========
console.log('📊 测试 1: Polymarket 交易时间（模拟实际 API 响应）\n');

// 模拟 Polymarket Data API 返回的交易数据
const mockPolymarketTrade = {
  maker_address: '0x1234567890123456789012345678901234567890',
  asset_id: '0xabc123',
  amount_usdc: 1000,
  timestamp: '2026-01-07T07:30:00.000Z', // ISO 格式
  side: 'BUY',
  title: 'Test Market'
};

console.log('模拟 Polymarket API 返回:');
console.log(JSON.stringify(mockPolymarketTrade, null, 2));
console.log('');

// 步骤 1: 解析时间
const tradeDate = new Date(mockPolymarketTrade.timestamp);
console.log(`步骤 1 - 解析时间: ${tradeDate.toISOString()}`);

// 步骤 2: 转换为北京时间存储（代码中：toBeijingTime(new Date(trade.timestamp))）
const storedTime = toBeijingTime(tradeDate);
console.log(`步骤 2 - 存储（北京时间）: ${storedTime}`);

// 步骤 3: 模拟数据库存储和返回
const dbStored = storedTime.replace('T', ' ').replace('Z', '').substring(0, 23);
console.log(`步骤 3 - 数据库存储格式: ${dbStored}`);

// 步骤 4: 前端读取并转换（formatRelativeTime 内部调用 fromBeijingTime）
const displayDate = fromBeijingTime(dbStored);
console.log(`步骤 4 - 转换后显示: ${displayDate.toISOString()}`);

// 验证
const diffMs = Math.abs(tradeDate.getTime() - displayDate.getTime());
console.log(`步骤 5 - 验证: 误差 ${diffMs}ms`);
if (diffMs < 1000) {
  console.log(`   ✅ Polymarket 交易时间转换准确！`);
} else {
  console.log(`   ❌ Polymarket 交易时间转换有误差！`);
}

const relative = formatRelativeTime(dbStored);
console.log(`步骤 6 - 显示结果: ${relative}\n`);

// ========== 测试 2: Alchemy 钱包创建时间（实际格式） ==========
console.log('📊 测试 2: Alchemy 钱包创建时间（模拟实际 API 响应）\n');

// 模拟 Alchemy API 返回的第一笔交易数据
const mockAlchemyResponse = {
  result: {
    transfers: [{
      hash: '0xdef456',
      blockNum: '0x1234567',
      metadata: {
        blockTimestamp: '1704612600' // Unix 秒级时间戳
      }
    }]
  }
};

console.log('模拟 Alchemy API 返回:');
console.log(JSON.stringify(mockAlchemyResponse, null, 2));
console.log('');

// 步骤 1: 解析时间戳（代码中：parseInt(firstTransfer.metadata.blockTimestamp)）
const alchemyTimestamp = parseInt(mockAlchemyResponse.result.transfers[0].metadata.blockTimestamp);
console.log(`步骤 1 - 解析时间戳: ${alchemyTimestamp}`);

// 步骤 2: 转换为 Date（代码中：new Date(timestamp * 1000)）
const walletCreatedDate = new Date(alchemyTimestamp * 1000);
console.log(`步骤 2 - 转换为 Date: ${walletCreatedDate.toISOString()}`);

// 步骤 3: 计算钱包年龄（代码中：now.getTime() - firstTxTime.getTime()）
const now = new Date();
const ageMs = now.getTime() - walletCreatedDate.getTime();
const ageHours = ageMs / (1000 * 60 * 60);
console.log(`步骤 3 - 计算钱包年龄: ${ageHours.toFixed(2)} 小时`);

// 注意：钱包创建时间用于计算年龄，应该保持 UTC 时间
// 但如果需要存储到数据库（比如 wallet_analysis_history），也应该转换
console.log(`步骤 4 - 注意: 钱包创建时间用于计算年龄，保持 UTC`);
console.log(`   如果需要存储，转换为北京时间: ${toBeijingTime(walletCreatedDate)}`);

// 验证年龄计算是否正确
if (ageHours < 24) {
  console.log(`步骤 5 - ✅ 钱包年龄 < 24 小时，应该标记为可疑`);
} else {
  console.log(`步骤 5 - ❌ 钱包年龄 >= 24 小时，不标记为可疑`);
}

// 如果存储了，读取时也要转换回来
const storedWalletTime = toBeijingTime(walletCreatedDate);
const dbWalletTime = storedWalletTime.replace('T', ' ').replace('Z', '').substring(0, 23);
const displayWalletDate = fromBeijingTime(dbWalletTime);
const diffWalletMs = Math.abs(walletCreatedDate.getTime() - displayWalletDate.getTime());
console.log(`步骤 6 - 如果存储后读取，验证: 误差 ${diffWalletMs}ms`);
if (diffWalletMs < 1000) {
  console.log(`   ✅ Alchemy 钱包创建时间转换准确！`);
} else {
  console.log(`   ❌ Alchemy 钱包创建时间转换有误差！`);
}

console.log('\n');

// ========== 测试 3: 完整流程验证 ==========
console.log('📊 测试 3: 完整流程验证\n');

// 模拟一个完整的扫描流程
const testCases = [
  {
    name: 'Polymarket 交易时间',
    apiTime: '2026-01-07T07:30:00.000Z',
    expectedStored: '2026-01-07T15:30:00.000Z',
    expectedDisplay: '2026-01-07T07:30:00.000Z'
  },
  {
    name: 'Alchemy 钱包创建时间',
    apiTime: new Date(1704612600 * 1000).toISOString(), // 2024-01-07T07:30:00.000Z
    expectedStored: new Date(1704612600 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
    expectedDisplay: new Date(1704612600 * 1000).toISOString()
  }
];

testCases.forEach((testCase) => {
  console.log(`\n测试: ${testCase.name}`);
  
  const apiDate = new Date(testCase.apiTime);
  const stored = toBeijingTime(apiDate);
  const dbFormat = stored.replace('T', ' ').replace('Z', '').substring(0, 23);
  const display = fromBeijingTime(dbFormat);
  
  console.log(`  API 时间: ${apiDate.toISOString()}`);
  console.log(`  存储时间: ${stored}`);
  console.log(`  显示时间: ${display.toISOString()}`);
  
  const storedMatch = stored === testCase.expectedStored;
  const displayMatch = display.toISOString() === testCase.expectedDisplay;
  
  if (storedMatch && displayMatch) {
    console.log(`  ✅ 完整流程转换准确！`);
  } else {
    console.log(`  ❌ 完整流程转换有误差！`);
    if (!storedMatch) console.log(`    存储时间不匹配: 期望 ${testCase.expectedStored}, 实际 ${stored}`);
    if (!displayMatch) console.log(`    显示时间不匹配: 期望 ${testCase.expectedDisplay}, 实际 ${display.toISOString()}`);
  }
});

console.log('\n✅ 所有集成测试完成！');


