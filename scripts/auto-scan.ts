#!/usr/bin/env tsx
/**
 * 自动扫描脚本
 * 可以设置为定时任务（cron job）来定期扫描可疑钱包
 * 
 * 使用方法：
 * 1. 直接运行：npm run auto-scan
 * 2. 设置为 cron job（每5分钟运行一次）：
 *    */5 * * * * cd /path/to/project && npm run auto-scan
 * 
 * 环境变量：
 * - SCAN_API_URL: Vercel 部署的 API 地址（必需）
 * - CRON_SECRET: 认证密钥，需与 Vercel 环境变量中的 CRON_SECRET 一致（必需）
 * - SCAN_INTERVAL_MS: 仅在 loop 模式下使用，循环运行的间隔时间（毫秒，默认 5 分钟）
 */

import 'dotenv/config';

const SCAN_API_URL = process.env.SCAN_API_URL || 'http://localhost:3000/api/cron/scan';
const CRON_SECRET = process.env.CRON_SECRET;
// SCAN_INTERVAL_MS 仅在 loop 模式下使用
const SCAN_INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS || '300000', 10); // 默认5分钟

async function runScan(): Promise<boolean> {
  try {
    console.log(`[${new Date().toISOString()}] 开始扫描...`);
    console.log(`API URL: ${SCAN_API_URL}`);
    
    // 构建请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // 如果设置了 CRON_SECRET，添加到请求头
    if (CRON_SECRET) {
      headers['Authorization'] = `Bearer ${CRON_SECRET}`;
    } else {
      console.warn('⚠️  警告: 未设置 CRON_SECRET，如果 Vercel 生产环境要求认证，扫描可能失败');
    }
    
    const response = await fetch(SCAN_API_URL, {
      method: 'GET',
      headers,
    });

    // 检查 HTTP 状态码
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${new Date().toISOString()}] ❌ HTTP 错误 ${response.status}: ${errorText}`);
      return false;
    }

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
      return true;
    } else {
      console.error(`[${new Date().toISOString()}] ❌ 扫描失败:`, data.error || '未知错误');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] ❌ 扫描出错:`, errorMessage);
    return false;
  }
}

// 如果作为脚本直接运行
if (require.main === module) {
  const mode = process.argv[2] || 'once';
  
  // 验证必需的环境变量
  if (!SCAN_API_URL || SCAN_API_URL === 'http://localhost:3000/api/cron/scan') {
    console.error('❌ 错误: 请设置 SCAN_API_URL 环境变量');
    console.error('   在 .env 文件中添加: SCAN_API_URL=https://your-app.vercel.app/api/cron/scan');
    process.exit(1);
  }
  
  if (mode === 'once') {
    // 只运行一次（适用于 cron job）
    runScan().then((success) => {
      process.exit(success ? 0 : 1);
    }).catch((error) => {
      console.error('未捕获的错误:', error);
      process.exit(1);
    });
  } else if (mode === 'loop') {
    // 循环运行（适用于长期运行的进程）
    console.log(`自动扫描已启动，每 ${SCAN_INTERVAL_MS / 1000} 秒运行一次`);
    console.log(`API URL: ${SCAN_API_URL}`);
    console.log('按 Ctrl+C 停止\n');
    
    // 立即运行一次
    runScan();
    
    // 然后定时运行
    const intervalId = setInterval(() => {
      runScan();
    }, SCAN_INTERVAL_MS);
    
    // 优雅退出
    process.on('SIGINT', () => {
      console.log('\n正在停止扫描...');
      clearInterval(intervalId);
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n正在停止扫描...');
      clearInterval(intervalId);
      process.exit(0);
    });
  } else {
    console.log('使用方法:');
    console.log('  npm run auto-scan          # 运行一次（推荐用于 cron job）');
    console.log('  npm run auto-scan loop     # 循环运行（适用于长期运行的进程）');
    console.log('\n必需的环境变量:');
    console.log('  SCAN_API_URL - Vercel 部署的 API 地址');
    console.log('  CRON_SECRET - 认证密钥（需与 Vercel 环境变量一致）');
    process.exit(1);
  }
}

export { runScan };

