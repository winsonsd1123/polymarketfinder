#!/usr/bin/env tsx
/**
 * 自动扫描脚本
 * 可以设置为定时任务（cron job）来定期扫描可疑钱包
 * 
 * 使用方法：
 * 1. 直接运行：npm run auto-scan
 * 2. 设置为 cron job（每5分钟运行一次）：
 *    */5 * * * * cd /path/to/project && npm run auto-scan
 */

import 'dotenv/config';

const SCAN_API_URL = process.env.SCAN_API_URL || 'http://localhost:3000/api/cron/scan';
const SCAN_INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS || '300000', 10); // 默认5分钟

async function runScan() {
  try {
    console.log(`[${new Date().toISOString()}] 开始扫描...`);
    const response = await fetch(SCAN_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`[${new Date().toISOString()}] ✅ 扫描完成:`);
      console.log(`   总交易数: ${data.result.totalTrades}`);
      console.log(`   处理钱包数: ${data.result.processedWallets}`);
      console.log(`   新钱包数: ${data.result.newWallets}`);
      console.log(`   可疑钱包数: ${data.result.suspiciousWallets}`);
      console.log(`   耗时: ${data.duration}ms`);
      
      if (data.result.suspiciousWallets > 0) {
        console.log(`\n⚠️  发现 ${data.result.suspiciousWallets} 个可疑钱包！`);
        data.result.details.suspiciousWallets.forEach((addr: string) => {
          console.log(`   - ${addr}`);
        });
      }
    } else {
      console.error(`[${new Date().toISOString()}] ❌ 扫描失败:`, data.error);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ 扫描出错:`, error);
  }
}

// 如果作为脚本直接运行
if (require.main === module) {
  const mode = process.argv[2] || 'once';
  
  if (mode === 'once') {
    // 只运行一次
    runScan().then(() => {
      process.exit(0);
    });
  } else if (mode === 'loop') {
    // 循环运行
    console.log(`自动扫描已启动，每 ${SCAN_INTERVAL_MS / 1000} 秒运行一次`);
    console.log(`API URL: ${SCAN_API_URL}`);
    console.log('按 Ctrl+C 停止\n');
    
    // 立即运行一次
    runScan();
    
    // 然后定时运行
    setInterval(() => {
      runScan();
    }, SCAN_INTERVAL_MS);
  } else {
    console.log('使用方法:');
    console.log('  npm run auto-scan          # 运行一次');
    console.log('  npm run auto-scan loop     # 循环运行');
    process.exit(1);
  }
}

export { runScan };

