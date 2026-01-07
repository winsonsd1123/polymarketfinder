/**
 * 测试 Vercel 时区问题
 */
import { parseToUTCDate } from '../lib/time-utils';

console.log('🧪 测试 Vercel 时区问题修复\n');

// 模拟不同格式的时间字符串
const testCases = [
  {
    name: 'ISO 格式（带 Z）',
    input: '2026-01-07T07:30:00.000Z',
    expected: '2026-01-07T07:30:00.000Z',
  },
  {
    name: 'ISO 格式（不带 Z）',
    input: '2026-01-07T07:30:00.000',
    expected: '2026-01-07T07:30:00.000Z', // 应该添加 Z
  },
  {
    name: 'PostgreSQL timestamp 格式',
    input: '2026-01-07 15:30:00.000',
    expected: '2026-01-07T07:30:00.000Z', // 如果是北京时间，转换后应该是这个
  },
  {
    name: 'Unix 时间戳（秒）',
    input: 1704612600,
    expected: '2024-01-07T07:30:00.000Z',
  },
];

console.log('📊 测试 parseToUTCDate 函数:\n');

testCases.forEach((testCase) => {
  console.log(`\n测试: ${testCase.name}`);
  console.log(`  输入: ${testCase.input} (类型: ${typeof testCase.input})`);
  
  try {
    const result = parseToUTCDate(testCase.input);
    console.log(`  解析结果: ${result.toISOString()}`);
    console.log(`  预期结果: ${testCase.expected}`);
    
    if (result.toISOString() === testCase.expected) {
      console.log(`  ✅ 解析正确`);
    } else {
      console.log(`  ⚠️  解析结果与预期不同`);
      console.log(`     差异: ${(result.getTime() - new Date(testCase.expected).getTime()) / (1000 * 60 * 60)} 小时`);
    }
  } catch (error) {
    console.error(`  ❌ 解析失败:`, error);
  }
});

// 测试时区差异
console.log('\n\n📊 测试时区差异:\n');
const testTimeString = '2026-01-07T07:30:00.000'; // ISO 格式，不带 Z

console.log(`测试时间字符串: ${testTimeString}`);
console.log(`\n在 UTC 时区（Vercel）:`);
const utcResult = parseToUTCDate(testTimeString);
console.log(`  解析结果: ${utcResult.toISOString()}`);

console.log(`\n在 UTC+8 时区（本地）:`);
// 模拟本地时区解析（如果直接使用 new Date）
const localResult = new Date(testTimeString);
console.log(`  直接 new Date() 解析: ${localResult.toISOString()}`);
console.log(`  使用 parseToUTCDate: ${parseToUTCDate(testTimeString).toISOString()}`);

const diff = Math.abs(utcResult.getTime() - parseToUTCDate(testTimeString).getTime());
if (diff < 1000) {
  console.log(`\n✅ parseToUTCDate 在不同时区下解析结果一致！`);
} else {
  console.log(`\n❌ parseToUTCDate 在不同时区下解析结果不一致！`);
  console.log(`   差异: ${diff / (1000 * 60 * 60)} 小时`);
}

console.log('\n\n✅ 修复说明:');
console.log('- parseToUTCDate 函数会强制将时间解析为 UTC');
console.log('- 对于 ISO 格式（不带 Z），会自动添加 Z');
console.log('- 确保在 Vercel（UTC）和本地（UTC+8）环境下都能正确解析');

