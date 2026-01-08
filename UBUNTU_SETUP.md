# Ubuntu 服务器部署指南

专门针对 Ubuntu 系统的部署指南，包含整点执行配置。

## 🚀 快速开始（Ubuntu）

### 1. 安装 Node.js（如果未安装）

```bash
# 使用 NodeSource 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 安装项目依赖

```bash
cd /path/to/polymarketfinder
npm install
```

### 3. 配置环境变量

```bash
# 创建 .env 文件
nano .env
```

添加以下内容：

```bash
SCAN_API_URL=https://your-app.vercel.app/api/cron/scan
CRON_SECRET=your-secret-key-here
```

设置文件权限：

```bash
chmod 600 .env
```

### 4. 测试配置

```bash
npm run auto-scan
```

如果看到 "✅ 扫描完成"，说明配置正确。

### 5. 设置 Cron Job（整点执行）

#### 方式 A: 使用 crontab（推荐）

```bash
# 编辑 crontab
crontab -e

# 选择编辑器（推荐选择 nano）
```

添加以下行（每小时整点执行）：

```bash
# Polymarket 扫描任务 - 每小时整点执行
0 * * * * cd /path/to/polymarketfinder && /usr/bin/npm run auto-scan >> /var/log/polymarket-scan.log 2>&1
```

**时间表达式说明**：
- `0 * * * *` - 每小时整点（例如：1:00, 2:00, 3:00...）
- `0 */2 * * *` - 每2小时整点（例如：0:00, 2:00, 4:00...）
- `0 */6 * * *` - 每6小时整点（例如：0:00, 6:00, 12:00, 18:00）
- `0 9,15,21 * * *` - 每天 9点、15点、21点

保存并退出（nano: Ctrl+X, 然后 Y, 然后 Enter）。

#### 方式 B: 使用 systemd（更高级）

1. 创建服务文件：

```bash
sudo nano /etc/systemd/system/polymarket-scanner.service
```

内容：

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
ExecStart=/usr/bin/tsx /path/to/polymarketfinder/scripts/auto-scan.ts
StandardOutput=append:/var/log/polymarket-scan.log
StandardError=append:/var/log/polymarket-scan.log
```

2. 创建定时器文件：

```bash
sudo nano /etc/systemd/system/polymarket-scanner.timer
```

内容：

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

3. 启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable polymarket-scanner.timer
sudo systemctl start polymarket-scanner.timer
sudo systemctl status polymarket-scanner.timer
```

### 6. 创建日志文件

```bash
sudo touch /var/log/polymarket-scan.log
sudo chmod 666 /var/log/polymarket-scan.log
```

### 7. 验证设置

```bash
# 查看 cron jobs
crontab -l

# 查看日志
tail -f /var/log/polymarket-scan.log

# 如果使用 systemd，查看定时器状态
sudo systemctl list-timers polymarket-scanner.timer
```

## 📋 Ubuntu 特定注意事项

### 1. 时区设置

确保服务器时区正确：

```bash
# 查看当前时区
timedatectl

# 设置时区（如果需要）
sudo timedatectl set-timezone Asia/Shanghai
```

### 2. Cron 服务

确保 cron 服务正在运行：

```bash
sudo systemctl status cron
sudo systemctl enable cron
sudo systemctl start cron
```

### 3. 日志轮转

设置日志轮转，避免日志文件过大：

```bash
sudo nano /etc/logrotate.d/polymarket-scan
```

内容：

```
/var/log/polymarket-scan.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

### 4. 防火墙（如果需要）

如果服务器有防火墙，确保可以访问 Vercel：

```bash
# 检查防火墙状态
sudo ufw status

# 如果需要，允许出站 HTTPS
sudo ufw allow out 443/tcp
```

## 🔍 故障排查（Ubuntu）

### 问题 1: Cron 不执行

```bash
# 检查 cron 服务状态
sudo systemctl status cron

# 查看 cron 日志
sudo tail -f /var/log/syslog | grep CRON

# 检查 cron 权限
ls -la /var/spool/cron/crontabs/
```

### 问题 2: 找不到 npm 或 node

```bash
# 查找 npm 路径
which npm
which node

# 在 crontab 中使用完整路径
which npm  # 输出: /usr/bin/npm
which node # 输出: /usr/bin/node
```

### 问题 3: 权限问题

```bash
# 确保脚本有执行权限
chmod +x scripts/auto-scan.ts

# 确保 .env 文件权限正确
chmod 600 .env

# 检查日志文件权限
ls -la /var/log/polymarket-scan.log
```

### 问题 4: 环境变量未加载

在 crontab 中显式设置环境变量：

```bash
0 * * * * cd /path/to/polymarketfinder && SCAN_API_URL=xxx CRON_SECRET=xxx /usr/bin/npm run auto-scan >> /var/log/polymarket-scan.log 2>&1
```

## 📊 监控和维护

### 查看执行历史

```bash
# 查看最近的 cron 执行记录
sudo grep CRON /var/log/syslog | grep polymarket

# 查看扫描日志
tail -n 50 /var/log/polymarket-scan.log
```

### 手动测试

```bash
# 手动运行一次
cd /path/to/polymarketfinder
npm run auto-scan

# 或者直接使用 tsx
npx tsx scripts/auto-scan.ts
```

### 检查下次执行时间

```bash
# 如果使用 systemd timer
sudo systemctl list-timers polymarket-scanner.timer

# 如果使用 crontab，查看 crontab
crontab -l
```

## 🎯 最佳实践

1. **使用整点执行**：减少服务器负载，便于监控
2. **日志轮转**：避免日志文件过大
3. **监控告警**：设置监控，扫描失败时发送通知
4. **定期检查**：每周检查一次日志，确保正常运行
5. **备份配置**：定期备份 `.env` 和 crontab 配置

## 📞 获取帮助

如果遇到问题：
1. 查看日志：`tail -f /var/log/polymarket-scan.log`
2. 检查 cron 日志：`sudo grep CRON /var/log/syslog | tail -20`
3. 验证配置：手动运行 `npm run auto-scan`
