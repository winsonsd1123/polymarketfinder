/**
 * 测试扫描 API
 * 可以直接运行或通过 HTTP 请求测试
 */

async function testScan() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const useMockData = process.env.USE_MOCK_DATA === 'true';
  const limit = parseInt(process.env.LIMIT || '50', 10);
  const concurrency = parseInt(process.env.CONCURRENCY || '3', 10);

  const url = new URL('/api/cron/scan', baseUrl);
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('concurrency', concurrency.toString());
  if (useMockData) {
    url.searchParams.set('mock', 'true');
  }

  console.log('🚀 开始测试扫描 API...');
  console.log(`📡 请求 URL: ${url.toString()}\n`);

  try {
    const startTime = Date.now();
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API 请求失败:');
      console.error(`   状态码: ${response.status}`);
      console.error(`   错误信息: ${data.error || data.message}`);
      process.exit(1);
    }

    console.log('✅ API 请求成功\n');
    console.log('📊 扫描结果:');
    console.log(`   总交易数: ${data.result.totalTrades}`);
    console.log(`   处理钱包数: ${data.result.processedWallets}`);
    console.log(`   新钱包数: ${data.result.newWallets}`);
    console.log(`   可疑钱包数: ${data.result.suspiciousWallets}`);
    console.log(`   跳过钱包数: ${data.result.skippedWallets}`);
    console.log(`   错误数: ${data.result.errors}`);
    console.log(`   总耗时: ${data.duration}ms\n`);

    if (data.result.details.newWallets.length > 0) {
      console.log('🆕 新钱包地址:');
      data.result.details.newWallets.forEach((addr: string, index: number) => {
        console.log(`   ${index + 1}. ${addr}`);
      });
      console.log('');
    }

    if (data.result.details.suspiciousWallets.length > 0) {
      console.log('⚠️  可疑钱包地址:');
      data.result.details.suspiciousWallets.forEach((addr: string, index: number) => {
        console.log(`   ${index + 1}. ${addr}`);
      });
      console.log('');
    }

    if (data.result.details.errors.length > 0) {
      console.log('❌ 错误详情:');
      data.result.details.errors.forEach((error: string, index: number) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log('');
    }

    console.log(`⏱️  客户端总耗时: ${duration}ms`);
    console.log('✨ 测试完成');
  } catch (error) {
    console.error('💥 测试异常:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
testScan()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 测试失败:', error);
    process.exit(1);
  });

