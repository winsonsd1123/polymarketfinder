/**
 * 测试实际的时间戳流程
 */
import { toBeijingTime, fromBeijingTime } from '../lib/time-utils';

console.log('🧪 测试实际的时间戳流程\n');

// 模拟完整流程
console.log('📊 流程1: Polymarket API -> 存储 -> 分析\n');

// 步骤1: Polymarket API 返回时间（假设是 UTC）
const polymarketTimeUTC = new Date('2026-01-07T07:30:00.000Z');
console.log(`1. Polymarket API 返回（UTC）: ${polymarketTimeUTC.toISOString()}`);

// 步骤2: 转换为北京时间存储（代码中：toBeijingTime(new Date(trade.timestamp))）
const storedBeijingTime = toBeijingTime(polymarketTimeUTC);
console.log(`2. 存储到数据库（北京时间）: ${storedBeijingTime}`);

// 步骤3: 数据库返回格式（PostgreSQL timestamp without time zone）
const dbFormat = storedBeijingTime.replace('T', ' ').replace('Z', '').substring(0, 23);
console.log(`3. 数据库返回格式: ${dbFormat}`);

// 步骤4: 分析时使用（代码中：new Date(trade.timestamp)）
// ⚠️ 问题：如果 trade.timestamp 是数据库格式（"2026-01-07 15:30:00.000"），new Date() 会按本地时间解析
const parsedTradeTime = new Date(dbFormat);
console.log(`4. new Date("${dbFormat}") 解析为: ${parsedTradeTime.toISOString()}`);
console.log(`   预期 UTC: ${polymarketTimeUTC.toISOString()}`);

const diffMs = Math.abs(parsedTradeTime.getTime() - polymarketTimeUTC.getTime());
const diffHours = diffMs / (1000 * 60 * 60);
if (diffHours > 0.1) {
  console.log(`   ❌ 时间解析错误！差异 ${diffHours.toFixed(2)} 小时`);
  console.log(`   问题：数据库返回的是北京时间格式，但 new Date() 按本地时间解析`);
} else {
  console.log(`   ✅ 时间解析正确`);
}

// 检查实际代码中的处理
console.log('\n\n📊 检查实际代码:\n');
console.log('app/api/cron/scan/route.ts:53');
console.log('const currentTradeTime = new Date(trade.timestamp);');
console.log('\n⚠️  问题：');
console.log('   - trade.timestamp 来自 PolymarketTrade 接口');
console.log('   - polymarket.ts 返回的是 ISO 格式字符串（带 Z）');
console.log('   - 但如果 trade.timestamp 是数据库格式，new Date() 会错误解析\n');

// 检查 WC/TX gap 计算
console.log('📊 WC/TX Gap 计算验证:\n');
const walletCreatedUTC = new Date('2026-01-07T06:00:00.000Z'); // Alchemy 返回（UTC）
const tradeTimeCorrect = new Date('2026-01-07T07:30:00.000Z'); // 正确的交易时间（UTC）
const tradeTimeWrong = parsedTradeTime; // 错误解析的交易时间

console.log('使用正确的交易时间:');
const gapCorrect = tradeTimeCorrect.getTime() - walletCreatedUTC.getTime();
const ageCorrect = Date.now() - walletCreatedUTC.getTime();
const gapPercentCorrect = (gapCorrect / ageCorrect) * 100;
console.log(`  Gap: ${(gapCorrect / (1000 * 60 * 60)).toFixed(2)} 小时`);
console.log(`  Gap%: ${gapPercentCorrect.toFixed(2)}%`);

console.log('\n使用错误的交易时间:');
const gapWrong = tradeTimeWrong.getTime() - walletCreatedUTC.getTime();
const gapPercentWrong = (gapWrong / ageCorrect) * 100;
console.log(`  Gap: ${(gapWrong / (1000 * 60 * 60)).toFixed(2)} 小时`);
console.log(`  Gap%: ${gapPercentWrong.toFixed(2)}%`);
console.log(`  差异: ${Math.abs(gapPercentCorrect - gapPercentWrong).toFixed(2)}%`);

if (Math.abs(gapPercentCorrect - gapPercentWrong) > 1) {
  console.log(`  ❌ WC/TX gap 计算可能错误！`);
} else {
  console.log(`  ✅ WC/TX gap 计算正确`);
}

// 检查 trade.timestamp 的实际来源
console.log('\n\n📊 检查 trade.timestamp 的实际来源:\n');
console.log('1. lib/polymarket.ts 返回 PolymarketTrade 对象');
console.log('2. timestamp 字段是 ISO 格式字符串（通过 toISOString()）');
console.log('3. 应该包含 Z，表示 UTC 时间');
console.log('4. new Date(trade.timestamp) 应该能正确解析\n');

console.log('✅ 结论：');
console.log('   - 如果 trade.timestamp 是 ISO 格式（带 Z），时间转换是正确的');
console.log('   - 如果 trade.timestamp 是数据库格式（不带 Z），时间转换可能错误');
console.log('   - 需要确认 trade.timestamp 的实际格式');


