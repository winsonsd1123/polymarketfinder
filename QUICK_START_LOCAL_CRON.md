# 🚀 本地 Cron Job 快速开始指南（Ubuntu）

## 方式一：使用自动化脚本（推荐）

最简单的方式是使用我们提供的设置脚本：

```bash
# 1. 进入项目目录
cd /path/to/polymarketfinder

# 2. 运行设置脚本
bash scripts/setup-local-cron.sh
```

脚本会引导你完成：
- ✅ 创建 `.env` 文件
- ✅ 测试配置
- ✅ 设置 cron job（默认每小时整点执行）
- ✅ 创建日志文件

## 方式二：手动设置

### 步骤 1: 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
cd /path/to/polymarketfinder
nano .env
```

添加以下内容（替换为你的实际值）：

```bash
SCAN_API_URL=https://your-app.vercel.app/api/cron/scan
CRON_SECRET=your-secret-key-here
```

**重要**：
- `SCAN_API_URL` 是你的 Vercel 部署地址
- `CRON_SECRET` 必须与 Vercel 环境变量中的 `CRON_SECRET` 完全一致
- 设置文件权限：`chmod 600 .env`

### 步骤 2: 安装依赖

```bash
npm install
```

### 步骤 3: 测试配置

```bash
npm run auto-scan
```

如果看到 "✅ 扫描完成"，说明配置正确。

### 步骤 4: 设置 Cron Job（整点执行）

编辑 crontab：

```bash
crontab -e
# 如果第一次使用，选择编辑器（推荐 nano）
```

添加以下行（每小时整点执行）：

```bash
# Polymarket 扫描任务 - 每小时整点执行（例如：1:00, 2:00, 3:00...）
0 * * * * cd /path/to/polymarketfinder && /usr/bin/npm run auto-scan >> /var/log/polymarket-scan.log 2>&1
```

**其他时间选项**：
- `0 */2 * * *` - 每2小时整点（例如：0:00, 2:00, 4:00...）
- `0 */6 * * *` - 每6小时整点（例如：0:00, 6:00, 12:00, 18:00）
- `0 9,15,21 * * *` - 每天 9点、15点、21点

保存并退出（nano: Ctrl+X, 然后 Y, 然后 Enter）。

### 步骤 5: 创建日志文件并验证

```bash
# 创建日志文件（需要 sudo 权限）
sudo touch /var/log/polymarket-scan.log
sudo chmod 666 /var/log/polymarket-scan.log

# 查看 cron jobs
crontab -l

# 查看日志
tail -f /var/log/polymarket-scan.log

# 查看 cron 服务状态（Ubuntu）
sudo systemctl status cron
```

## 📋 在 Vercel 上设置 CRON_SECRET

1. 登录 Vercel 控制台
2. 进入项目设置 → Environment Variables
3. 添加环境变量：
   - Key: `CRON_SECRET`
   - Value: 生成一个随机字符串（例如：`openssl rand -hex 32`）
   - Environment: Production（或所有环境）
4. 保存后，在本地 `.env` 文件中使用相同的值

## 🔍 常见问题

### Q: 如何修改执行频率？

编辑 crontab，修改时间表达式（推荐整点执行）：
- `0 * * * *` - 每小时整点（例如：1:00, 2:00, 3:00...）
- `0 */2 * * *` - 每2小时整点（例如：0:00, 2:00, 4:00...）
- `0 */6 * * *` - 每6小时整点（例如：0:00, 6:00, 12:00, 18:00）
- `0 9,15,21 * * *` - 每天 9点、15点、21点

### Q: 如何查看日志？

```bash
tail -f /var/log/polymarket-scan.log
```

### Q: 如何停止 cron job？

```bash
crontab -e
# 删除或注释掉相关行
```

### Q: 认证失败怎么办？

1. 确认 `.env` 中的 `CRON_SECRET` 与 Vercel 环境变量一致
2. 确认 Vercel 环境变量已部署（可能需要重新部署）

## 📚 详细文档

- **Ubuntu 专用指南**：[UBUNTU_SETUP.md](./UBUNTU_SETUP.md) - 针对 Ubuntu 系统的详细说明
- **通用部署指南**：[LOCAL_CRON_SETUP.md](./LOCAL_CRON_SETUP.md) - 通用部署说明
