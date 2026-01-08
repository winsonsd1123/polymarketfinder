/**
 * 测试从 Polymarket 和 Alchemy 获取的时间转换是否准确
 */
import { toBeijingTime, fromBeijingTime, getBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🧪 测试时间源转换\n');

// ========== 测试 1: Polymarket API 返回的时间 ==========
console.log('📊 测试 1: Polymarket API 返回的时间\n');

// Polymarket API 可能返回的时间格式：
const polymarketTimes = [
  {
    name: 'ISO 8601 格式',
    time: '2026-01-07T07:30:00.000Z',
    source: 'Polymarket Data API (ISO)'
  },
  {
    name: 'Unix 时间戳（秒）',
    time: 1704612600, // 2026-01-07T07:30:00.000Z
    source: 'Polymarket The Graph (timestamp)'
  },
  {
    name: 'Unix 时间戳（毫秒）',
    time: 1704612600000, // 2026-01-07T07:30:00.000Z
    source: 'Polymarket CLOB API (timestamp)'
  }
];

polymarketTimes.forEach((testCase) => {
  console.log(`\n测试: ${testCase.name} (${testCase.source})`);
  
  try {
    // 转换为 Date 对象
    let dateObj: Date;
    if (typeof testCase.time === 'number') {
      // 判断是秒级还是毫秒级时间戳
      dateObj = testCase.time < 10000000000
        ? new Date(testCase.time * 1000)
        : new Date(testCase.time);
    } else {
      dateObj = new Date(testCase.time);
    }
    
    console.log(`  原始值: ${testCase.time}`);
    console.log(`  解析为 UTC: ${dateObj.toISOString()}`);
    
    // 转换为北京时间存储
    const beijingStored = toBeijingTime(dateObj);
    console.log(`  存储（北京时间）: ${beijingStored}`);
    
    // 从数据库读取并转换回来
    const convertedBack = fromBeijingTime(beijingStored);
    console.log(`  读取后转换: ${convertedBack.toISOString()}`);
    
    // 验证是否一致
    const diffMs = Math.abs(dateObj.getTime() - convertedBack.getTime());
    if (diffMs < 1000) {
      console.log(`  ✅ 转换准确（误差 < 1秒）`);
    } else {
      console.log(`  ❌ 转换有误差: ${diffMs}ms`);
    }
    
    // 测试显示
    const relative = formatRelativeTime(beijingStored);
    console.log(`  显示: ${relative}`);
  } catch (error) {
    console.error(`  ❌ 错误:`, error);
  }
});

// ========== 测试 2: Alchemy API 返回的时间 ==========
console.log('\n\n📊 测试 2: Alchemy API 返回的时间\n');

// Alchemy API 可能返回的时间格式：
const alchemyTimes = [
  {
    name: 'metadata.blockTimestamp (Unix 秒级时间戳)',
    time: 1704612600, // 2026-01-07T07:30:00.000Z
    source: 'Alchemy getAssetTransfers (metadata.blockTimestamp)'
  },
  {
    name: '区块时间戳（通过 getBlock）',
    time: 1704612600, // 2026-01-07T07:30:00.000Z
    source: 'viem getBlock (block.timestamp)'
  }
];

alchemyTimes.forEach((testCase) => {
  console.log(`\n测试: ${testCase.name} (${testCase.source})`);
  
  try {
    // Alchemy 返回的是 Unix 秒级时间戳
    const dateObj = new Date(testCase.time * 1000);
    
    console.log(`  原始时间戳: ${testCase.time}`);
    console.log(`  解析为 UTC: ${dateObj.toISOString()}`);
    
    // 注意：Alchemy 返回的时间是钱包创建时间，不需要转换为北京时间存储
    // 因为它用于计算钱包年龄，应该保持 UTC
    // 但如果需要存储，也应该转换为北京时间
    const beijingStored = toBeijingTime(dateObj);
    console.log(`  存储（北京时间）: ${beijingStored}`);
    
    // 从数据库读取并转换回来
    const convertedBack = fromBeijingTime(beijingStored);
    console.log(`  读取后转换: ${convertedBack.toISOString()}`);
    
    // 验证是否一致
    const diffMs = Math.abs(dateObj.getTime() - convertedBack.getTime());
    if (diffMs < 1000) {
      console.log(`  ✅ 转换准确（误差 < 1秒）`);
    } else {
      console.log(`  ❌ 转换有误差: ${diffMs}ms`);
    }
    
    // 测试显示
    const relative = formatRelativeTime(beijingStored);
    console.log(`  显示: ${relative}`);
  } catch (error) {
    console.error(`  ❌ 错误:`, error);
  }
});

// ========== 测试 3: 实际存储和读取流程 ==========
console.log('\n\n📊 测试 3: 实际存储和读取流程\n');

// 模拟一个交易时间（从 Polymarket 获取）
const tradeTimeUTC = new Date('2026-01-07T07:30:00.000Z');
console.log(`\n模拟交易时间（UTC）: ${tradeTimeUTC.toISOString()}`);

// 存储时转换为北京时间
const tradeTimeBeijing = toBeijingTime(tradeTimeUTC);
console.log(`存储到数据库（北京时间）: ${tradeTimeBeijing}`);

// 从数据库读取（模拟 PostgreSQL 返回的格式）
const dbTimeString = tradeTimeBeijing.replace('T', ' ').replace('Z', '').replace(/\.\d{3}/, '');
console.log(`数据库返回格式: ${dbTimeString}`);

// 转换回来显示
const convertedForDisplay = fromBeijingTime(dbTimeString);
console.log(`转换后用于显示: ${convertedForDisplay.toISOString()}`);

// 验证
const diffMs = Math.abs(tradeTimeUTC.getTime() - convertedForDisplay.getTime());
if (diffMs < 1000) {
  console.log(`✅ 完整流程转换准确（误差 < 1秒）`);
} else {
  console.log(`❌ 完整流程转换有误差: ${diffMs}ms`);
}

// 显示相对时间
const relative = formatRelativeTime(dbTimeString);
console.log(`显示结果: ${relative}`);

// ========== 测试 4: 钱包创建时间（Alchemy）的计算 ==========
console.log('\n\n📊 测试 4: 钱包创建时间计算\n');

// 模拟从 Alchemy 获取的钱包创建时间
const walletCreatedUTC = new Date('2026-01-07T07:00:00.000Z'); // 30分钟前创建
const nowUTC = new Date('2026-01-07T07:30:00.000Z');

console.log(`钱包创建时间（UTC）: ${walletCreatedUTC.toISOString()}`);
console.log(`当前时间（UTC）: ${nowUTC.toISOString()}`);

// 计算钱包年龄（应该保持 UTC 时间计算）
const ageMs = nowUTC.getTime() - walletCreatedUTC.getTime();
const ageHours = ageMs / (1000 * 60 * 60);
console.log(`钱包年龄: ${ageHours.toFixed(2)} 小时`);

// 如果年龄 < 24 小时，应该标记为可疑
if (ageHours < 24) {
  console.log(`✅ 钱包年龄 < 24 小时，应该标记为可疑`);
} else {
  console.log(`❌ 钱包年龄 >= 24 小时，不应该标记为可疑`);
}

console.log('\n✅ 所有测试完成！');


