# 自动扫描功能

## 当前状态

**⚠️ 系统不会自动轮询**，需要手动触发或设置定时任务。

## 实现自动轮询的方法

### 方法 1: 使用独立的 Node.js 脚本（推荐）

#### 运行一次扫描
```bash
npm run auto-scan
```

#### 循环运行（每5分钟）
```bash
npm run auto-scan:loop
```

#### 设置为系统 Cron Job（Linux/Mac）

编辑 crontab：
```bash
crontab -e
```

添加以下行（每5分钟运行一次）：
```bash
*/5 * * * * cd /Users/wenyujun/dev/project/polymarketfinder && npm run auto-scan >> /tmp/polymarket-scan.log 2>&1
```

或者每1分钟运行一次：
```bash
* * * * * cd /Users/wenyujun/dev/project/polymarketfinder && npm run auto-scan >> /tmp/polymarket-scan.log 2>&1
```

### 方法 2: 使用 Vercel Cron Jobs（如果部署在 Vercel）

创建 `vercel.json`：
```json
{
  "crons": [
    {
      "path": "/api/cron/scan",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### 方法 3: 使用外部 Cron 服务

使用 [cron-job.org](https://cron-job.org/) 或类似服务，定期调用：
```
GET https://your-domain.com/api/cron/scan
```

### 方法 4: 使用 PM2（生产环境推荐）

安装 PM2：
```bash
npm install -g pm2
```

创建 `ecosystem.config.js`：
```javascript
module.exports = {
  apps: [
    {
      name: 'polymarket-scanner',
      script: 'npm',
      args: 'run auto-scan',
      cron_restart: '*/5 * * * *', // 每5分钟
      autorestart: false,
      watch: false,
    },
  ],
};
```

运行：
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 环境变量配置

在 `.env` 文件中可以配置：

```bash
# 扫描 API URL（如果部署在不同地址）
SCAN_API_URL=http://localhost:3000/api/cron/scan

# 扫描间隔（毫秒，仅在 loop 模式下使用）
SCAN_INTERVAL_MS=300000  # 5分钟
```

## 注意事项

1. **开发环境**：使用 `npm run auto-scan:loop` 在后台运行
2. **生产环境**：使用系统 cron 或 PM2，确保服务器重启后自动恢复
3. **日志**：建议将输出重定向到日志文件，方便排查问题
4. **API 速率限制**：注意 Polymarket API 的速率限制（每10秒50次请求）

