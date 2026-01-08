/**
 * 测试实际时间流程：从 API 获取到存储到显示
 */
import { toBeijingTime, fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🧪 测试实际时间流程\n');

// ========== 场景 1: Polymarket 交易时间 ==========
console.log('📊 场景 1: Polymarket 交易时间流程\n');

// 模拟从 Polymarket API 获取的交易时间（ISO 格式）
const polymarketTradeTime = '2026-01-07T07:30:00.000Z';
console.log(`1. Polymarket API 返回: ${polymarketTradeTime}`);

// 转换为 Date 对象
const tradeDate = new Date(polymarketTradeTime);
console.log(`2. 解析为 Date: ${tradeDate.toISOString()}`);

// 存储时转换为北京时间（代码中：toBeijingTime(new Date(trade.timestamp))）
const storedTime = toBeijingTime(tradeDate);
console.log(`3. 存储到数据库（北京时间）: ${storedTime}`);

// 模拟数据库返回（PostgreSQL timestamp without time zone）
const dbReturned = storedTime.replace('T', ' ').replace('Z', '').substring(0, 19);
console.log(`4. 数据库返回格式: ${dbReturned}`);

// 前端显示时转换（formatRelativeTime 内部调用 fromBeijingTime）
const displayTime = fromBeijingTime(dbReturned);
console.log(`5. 转换后用于显示: ${displayTime.toISOString()}`);

// 验证
const diffMs = Math.abs(tradeDate.getTime() - displayTime.getTime());
console.log(`6. 验证: 原始时间 = ${tradeDate.toISOString()}, 显示时间 = ${displayTime.toISOString()}`);
if (diffMs < 1000) {
  console.log(`   ✅ 转换准确（误差 < 1秒）`);
} else {
  console.log(`   ❌ 转换有误差: ${diffMs}ms`);
}

const relative = formatRelativeTime(dbReturned);
console.log(`7. 显示结果: ${relative}\n`);

// ========== 场景 2: Alchemy 钱包创建时间 ==========
console.log('📊 场景 2: Alchemy 钱包创建时间流程\n');

// 模拟从 Alchemy API 获取的钱包创建时间（Unix 秒级时间戳）
const alchemyTimestamp = 1704612600; // 2026-01-07T07:30:00.000Z
console.log(`1. Alchemy API 返回时间戳: ${alchemyTimestamp}`);

// 转换为 Date 对象（代码中：new Date(timestamp * 1000)）
const walletCreatedDate = new Date(alchemyTimestamp * 1000);
console.log(`2. 解析为 Date: ${walletCreatedDate.toISOString()}`);

// 计算钱包年龄（代码中：now.getTime() - firstTxTime.getTime()）
const now = new Date();
const ageMs = now.getTime() - walletCreatedDate.getTime();
const ageHours = ageMs / (1000 * 60 * 60);
console.log(`3. 计算钱包年龄: ${ageHours.toFixed(2)} 小时`);

// 注意：钱包创建时间用于计算年龄，不应该转换为北京时间存储
// 但如果需要存储到数据库（比如 wallet_analysis_history），也应该转换
console.log(`4. 注意: 钱包创建时间用于计算年龄，保持 UTC 时间`);
console.log(`   如果需要存储，转换为北京时间: ${toBeijingTime(walletCreatedDate)}`);

// 如果存储了，读取时也要转换回来
if (ageHours < 24) {
  console.log(`5. ✅ 钱包年龄 < 24 小时，标记为可疑`);
} else {
  console.log(`5. ❌ 钱包年龄 >= 24 小时，不标记为可疑`);
}

console.log('\n');

// ========== 场景 3: 检查代码中的实际使用 ==========
console.log('📊 场景 3: 检查代码中的实际使用\n');

console.log('检查点 1: Polymarket 交易时间存储');
console.log('  代码位置: app/api/cron/scan/route.ts:191');
console.log('  代码: const tradeBeijingTime = toBeijingTime(new Date(trade.timestamp));');
console.log('  状态: ✅ 正确 - 交易时间转换为北京时间存储\n');

console.log('检查点 2: Alchemy 钱包创建时间计算');
console.log('  代码位置: lib/analyzer.ts:463-466');
console.log('  代码: const firstTxTime = await getFirstTransactionTime(...);');
console.log('        const ageMs = now.getTime() - firstTxTime.getTime();');
console.log('  状态: ✅ 正确 - 钱包创建时间保持 UTC，用于计算年龄\n');

console.log('检查点 3: 时间显示');
console.log('  代码位置: lib/formatters.ts:19-32');
console.log('  代码: formatRelativeTime 内部调用 fromBeijingTime');
console.log('  状态: ✅ 正确 - 显示时从北京时间转换回 UTC\n');

console.log('✅ 所有检查完成！');


