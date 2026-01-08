#!/usr/bin/env node
/**
 * 自动扫描脚本（JavaScript 版本，无需 TypeScript）
 * 可以设置为定时任务（cron job）来定期扫描可疑钱包
 * 
 * 使用方法：
 * 1. 直接运行：node scripts/auto-scan.js
 * 2. 设置为 cron job（每小时整点执行）：
 *    0 * * * * cd /path/to/project && node scripts/auto-scan.js >> /var/log/polymarket-scan.log 2>&1
 * 
 * 环境变量：
 * - SCAN_API_URL: Vercel 部署的 API 地址（必需）
 * - CRON_SECRET: 认证密钥，需与 Vercel 环境变量中的 CRON_SECRET 一致（必需）
 */

// 简单的 dotenv 实现（如果不想安装 dotenv 包）
function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
}

// 加载环境变量
loadEnv();

const SCAN_API_URL = process.env.SCAN_API_URL || 'http://localhost:3000/api/cron/scan';
const CRON_SECRET = process.env.CRON_SECRET;

async function runScan() {
  try {
    console.log(`[${new Date().toISOString()}] 开始扫描...`);
    console.log(`API URL: ${SCAN_API_URL}`);
    
    // 构建请求头
    const headers = {
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
        data.result.details.suspiciousWallets.forEach((addr) => {
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

// 验证必需的环境变量
if (!SCAN_API_URL || SCAN_API_URL === 'http://localhost:3000/api/cron/scan') {
  console.error('❌ 错误: 请设置 SCAN_API_URL 环境变量');
  console.error('   在 .env 文件中添加: SCAN_API_URL=https://your-app.vercel.app/api/cron/scan');
  process.exit(1);
}

// 运行扫描
runScan().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});
