# 本地服务器 Cron Job 部署指南（Ubuntu）

本指南将帮助你在 Ubuntu 服务器上设置定时任务，定期触发 Vercel 上的扫描 API。

## 📋 前置要求

1. **Ubuntu 服务器**：Ubuntu 18.04+，可以访问互联网
2. **Node.js**：已安装 Node.js 和 npm
3. **项目代码**：已克隆或下载项目代码到服务器
4. **Vercel 部署**：应用已部署到 Vercel，并配置了 `CRON_SECRET` 环境变量

## 🔧 步骤 1: 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
cd /path/to/polymarketfinder
nano .env
```

添加以下内容：

```bash
# Vercel 部署的 API 地址（必需）
SCAN_API_URL=https://your-app.vercel.app/api/cron/scan

# 认证密钥，需与 Vercel 环境变量中的 CRON_SECRET 一致（必需）
CRON_SECRET=your-secret-key-here

# 仅在 loop 模式下使用，循环运行的间隔时间（毫秒，默认 5 分钟）
# 如果使用 cron job，可以忽略此变量
SCAN_INTERVAL_MS=300000
```

**重要提示**：
- `SCAN_API_URL` 必须是你的 Vercel 部署地址
- `CRON_SECRET` 必须与 Vercel 环境变量中的 `CRON_SECRET` 完全一致
- 确保 `.env` 文件权限安全：`chmod 600 .env`

## 🔧 步骤 2: 安装依赖

```bash
cd /path/to/polymarketfinder
npm install
```

## 🔧 步骤 3: 测试脚本

在设置 cron job 之前，先手动测试脚本是否正常工作：

```bash
# 测试运行一次
npm run auto-scan

# 或者直接使用 tsx
npx tsx scripts/auto-scan.ts
```

如果看到 "✅ 扫描完成" 的输出，说明配置正确。

## 🔧 步骤 4: 设置 Cron Job

### 方法 A: 使用 crontab（推荐）

1. 编辑 crontab：
```bash
crontab -e
```

2. 添加以下行（每小时整点执行）：
```bash
# Polymarket 扫描任务 - 每小时整点执行（例如：1:00, 2:00, 3:00...）
0 * * * * cd /path/to/polymarketfinder && /usr/bin/npm run auto-scan >> /var/log/polymarket-scan.log 2>&1
```

或者使用 tsx 直接运行（如果 npm 路径有问题）：
```bash
0 * * * * cd /path/to/polymarketfinder && /usr/local/bin/tsx scripts/auto-scan.ts >> /var/log/polymarket-scan.log 2>&1
```

**时间表达式说明（整点执行）**：
- `0 * * * *` - 每小时整点（例如：1:00, 2:00, 3:00...）
- `0 */2 * * *` - 每2小时整点（例如：0:00, 2:00, 4:00...）
- `0 */6 * * *` - 每6小时整点（例如：0:00, 6:00, 12:00, 18:00）
- `0 0 * * *` - 每天 0点
- `0 9,15,21 * * *` - 每天 9点、15点、21点

3. 保存并退出编辑器

4. 验证 crontab：
```bash
crontab -l
```

5. 创建日志目录（如果不存在）：
```bash
sudo mkdir -p /var/log
sudo touch /var/log/polymarket-scan.log
sudo chmod 666 /var/log/polymarket-scan.log
```

### 方法 B: 使用 systemd（更高级，Ubuntu 推荐）

1. 创建服务文件 `/etc/systemd/system/polymarket-scanner.service`：

```ini
[Unit]
Description=Polymarket Scanner Service
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/polymarketfinder
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/polymarketfinder/.env
ExecStart=/usr/local/bin/tsx /path/to/polymarketfinder/scripts/auto-scan.ts
StandardOutput=append:/var/log/polymarket-scan.log
StandardError=append:/var/log/polymarket-scan.log

[Install]
WantedBy=multi-user.target
```

2. 创建定时器文件 `/etc/systemd/system/polymarket-scanner.timer`：

```ini
[Unit]
Description=Polymarket Scanner Timer
Requires=polymarket-scanner.service

[Timer]
# 每小时整点执行
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

**其他时间选项**：
- `OnCalendar=hourly` - 每小时整点
- `OnCalendar=*-*-* 00:00:00` - 每天 0点
- `OnCalendar=*-*-* 09,15,21:00:00` - 每天 9点、15点、21点
- `OnCalendar=*-*-* */2:00:00` - 每2小时整点

3. 启用并启动定时器：
```bash
sudo systemctl daemon-reload
sudo systemctl enable polymarket-scanner.timer
sudo systemctl start polymarket-scanner.timer
sudo systemctl status polymarket-scanner.timer
```

4. 查看定时器状态：
```bash
sudo systemctl list-timers polymarket-scanner.timer
```

## 📊 步骤 5: 监控和日志

### 查看日志

```bash
# 查看扫描日志
tail -f /var/log/polymarket-scan.log

# 查看最近的日志
tail -n 100 /var/log/polymarket-scan.log

# 查看 systemd 日志（如果使用 systemd）
sudo journalctl -u polymarket-scanner.service -f
```

### 验证 Cron Job 是否运行（Ubuntu）

```bash
# 检查 crontab 是否执行（Ubuntu 使用 syslog）
sudo grep CRON /var/log/syslog | tail -20

# 或者查看 cron 日志
sudo tail -f /var/log/cron.log

# 查看当前用户的 cron jobs
crontab -l

# 查看 cron 服务状态
sudo systemctl status cron
```

## 🔍 故障排查

### 问题 1: 脚本无法执行

**症状**：cron job 没有输出或失败

**解决方案**：
1. 检查脚本路径是否正确
2. 检查 Node.js/npm 路径：`which node`、`which npm`
3. 在 crontab 中使用绝对路径
4. 检查文件权限：`chmod +x scripts/auto-scan.ts`

### 问题 2: 认证失败

**症状**：返回 401 Unauthorized

**解决方案**：
1. 确认 `.env` 文件中的 `CRON_SECRET` 与 Vercel 环境变量一致
2. 检查 Vercel 环境变量是否已设置
3. 确认 `SCAN_API_URL` 是正确的 HTTPS 地址

### 问题 3: 网络连接问题

**症状**：无法连接到 Vercel API

**解决方案**：
1. 测试网络连接：`curl https://your-app.vercel.app/api/cron/scan`
2. 检查防火墙设置
3. 确认服务器可以访问互联网

### 问题 4: 环境变量未加载

**症状**：脚本找不到环境变量

**解决方案**：
1. 确认 `.env` 文件在项目根目录
2. 在 crontab 中显式设置环境变量：
```bash
*/5 * * * * cd /path/to/polymarketfinder && SCAN_API_URL=xxx CRON_SECRET=xxx npm run auto-scan
```

## 📝 最佳实践

1. **日志轮转**：设置日志轮转，避免日志文件过大
   ```bash
   # 创建 logrotate 配置
   sudo nano /etc/logrotate.d/polymarket-scan
   ```
   内容：
   ```
   /var/log/polymarket-scan.log {
       daily
       rotate 7
       compress
       missingok
       notifempty
   }
   ```

2. **监控告警**：设置监控，当扫描失败时发送通知（可选）

3. **备份配置**：定期备份 `.env` 和 crontab 配置

4. **安全**：确保 `.env` 文件权限安全，不要提交到版本控制

## 🔄 与 Vercel Cron 的配合

你可以同时使用两种方案：
- **Vercel Cron**：作为主要调度（每天几次，作为备份）
- **本地 Cron**：作为高频补充（每5分钟，主要使用）

这样即使本地服务器故障，Vercel Cron 仍能保证基本运行。

## 📞 支持

如果遇到问题，请检查：
1. 日志文件：`/var/log/polymarket-scan.log`
2. Vercel 部署日志
3. 网络连接状态
