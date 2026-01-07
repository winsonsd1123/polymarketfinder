/**
 * 测试 API 返回的时间数据
 */
async function testAPIResponse() {
  try {
    console.log('🧪 测试 API 返回的时间数据\n');
    
    // 模拟 API 返回的数据（从 scan-logs API）
    const response = await fetch('http://localhost:3000/api/scan-logs?limit=1');
    const data = await response.json();
    
    if (data.success && data.data.length > 0) {
      const log = data.data[0];
      console.log('API 返回的原始数据:');
      console.log(JSON.stringify(log, null, 2));
      console.log('');
      
      console.log('时间字段:');
      console.log(`  startedAt: ${log.startedAt} (类型: ${typeof log.startedAt})`);
      console.log(`  completedAt: ${log.completedAt} (类型: ${typeof log.completedAt})`);
      console.log(`  createdAt: ${log.createdAt} (类型: ${typeof log.createdAt})`);
      console.log('');
      
      // 测试转换
      const { fromBeijingTime } = await import('../lib/time-utils');
      const { formatRelativeTime } = await import('../lib/formatters');
      
      if (log.completedAt) {
        const converted = fromBeijingTime(log.completedAt);
        const relative = formatRelativeTime(log.completedAt);
        console.log('转换结果:');
        console.log(`  转换后 UTC: ${converted.toISOString()}`);
        console.log(`  相对时间: ${relative}`);
        console.log(`  当前时间: ${new Date().toISOString()}`);
        const diffMinutes = (Date.now() - converted.getTime()) / 1000 / 60;
        console.log(`  实际时间差: ${diffMinutes.toFixed(1)} 分钟前`);
      }
    } else {
      console.log('API 返回失败或无数据');
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testAPIResponse();

