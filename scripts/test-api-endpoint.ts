/**
 * 测试实际 API 端点返回的数据
 * 模拟前端调用 /api/wallets 的完整流程
 */
import { fromBeijingTime } from '../lib/time-utils';
import { formatRelativeTime } from '../lib/formatters';

console.log('🧪 测试实际 API 端点数据\n');

// 模拟从 /api/wallets 返回的实际数据格式
const mockApiResponse = {
  success: true,
  data: [
    {
      id: 34,
      address: '0xd3398fb000080c5542f531fcb8c5dbea190d2535',
      riskScore: 85,
      createdAt: '2026-01-07 14:58:30.756', // 数据库返回的格式
      lastActiveAt: '2026-01-07 14:58:30.756',
      updatedAt: '2026-01-07 14:58:30.756',
      firstTradeTime: '2026-01-07 14:57:03.000',
      markets: [],
      tradeCount: 1,
    }
  ],
  count: 1,
};

console.log('1. API 返回的原始数据:');
console.log(JSON.stringify(mockApiResponse, null, 2));
console.log('');

// 模拟前端处理
const wallet = mockApiResponse.data[0];
console.log('2. 前端接收到的钱包数据:');
console.log(`   地址: ${wallet.address}`);
console.log(`   createdAt: ${wallet.createdAt} (类型: ${typeof wallet.createdAt})`);
console.log('');

// 模拟前端显示（实际调用 formatRelativeTime）
console.log('3. 前端调用 formatRelativeTime(wallet.createdAt):');
const displayTime = formatRelativeTime(wallet.createdAt);
console.log(`   显示结果: ${displayTime}`);
console.log('');

// 验证转换过程
console.log('4. 验证转换过程:');
const converted = fromBeijingTime(wallet.createdAt);
const now = new Date();
const diffMs = now.getTime() - converted.getTime();
const diffHours = diffMs / (1000 * 60 * 60);
const diffMinutes = diffMs / (1000 * 60);

console.log(`   数据库时间（北京时间）: ${wallet.createdAt}`);
console.log(`   转换后 UTC: ${converted.toISOString()}`);
console.log(`   当前 UTC: ${now.toISOString()}`);
console.log(`   时间差: ${diffHours.toFixed(2)} 小时 (${diffMinutes.toFixed(0)} 分钟)`);
console.log('');

// 检查显示是否正确
console.log('5. 验证显示是否正确:');
if (diffMinutes < 60) {
  const expected = `${Math.round(diffMinutes)} 分钟前`;
  console.log(`   预期: ${expected}`);
  if (displayTime.includes('分钟')) {
    console.log(`   ✅ 显示正确（显示为分钟）`);
  } else if (displayTime.includes('小时') && diffHours < 1.5) {
    console.log(`   ✅ 显示基本正确（date-fns 四舍五入为小时）`);
  } else {
    console.log(`   ⚠️  显示可能有问题`);
  }
} else if (diffHours < 24) {
  const expectedHours = Math.round(diffHours);
  console.log(`   预期: 大约 ${expectedHours} 小时前`);
  if (displayTime.includes(`${expectedHours} 小时`) || 
      displayTime.includes(`${expectedHours - 1} 小时`) ||
      displayTime.includes(`${expectedHours + 1} 小时`)) {
    console.log(`   ✅ 显示正确`);
  } else {
    console.log(`   ❌ 显示不正确！`);
    console.log(`      实际显示: ${displayTime}`);
    console.log(`      预期显示: 大约 ${expectedHours} 小时前`);
  }
}

// 测试如果显示"9小时前"的情况
console.log('\n6. 如果显示"大约 9 小时前"的情况分析:');
if (displayTime.includes('9 小时')) {
  console.log(`   ⚠️  检测到显示"9 小时前"`);
  console.log(`   但实际时间差是 ${diffHours.toFixed(2)} 小时`);
  
  if (Math.abs(diffHours - 9) > 1) {
    console.log(`   ❌ 时间显示错误！`);
    console.log(`   可能原因:`);
    console.log(`     1. 页面缓存了旧数据`);
    console.log(`     2. 数据库时间被错误更新`);
    console.log(`     3. 前端状态没有刷新`);
    console.log(`   解决方案:`);
    console.log(`     - 硬刷新页面 (Ctrl+Shift+R)`);
    console.log(`     - 清除浏览器缓存`);
    console.log(`     - 检查数据库实际时间`);
  }
} else {
  console.log(`   ✅ 没有显示"9 小时前"，显示为: ${displayTime}`);
}

// 检查是否有其他钱包
console.log('\n7. 检查是否有其他钱包可能显示"9 小时前":');
console.log('   如果数据库中有其他钱包创建于9小时前，它们会显示"大约 9 小时前"');
console.log('   这是正常的，只要时间转换正确即可');

console.log('\n✅ 测试完成！');

