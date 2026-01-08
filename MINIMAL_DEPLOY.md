# 最小化部署指南

如果你只想在服务器上运行扫描脚本，而不需要整个项目，可以使用最小化部署方案。

## 📦 方案一：只上传必要文件（推荐）

### 需要上传的文件

只需要上传以下文件到服务器：

```
polymarket-scanner/
├── scripts/
│   ├── auto-scan.js          # JavaScript 版本（无需 TypeScript）
│   └── setup-local-cron.sh   # 设置脚本（可选）
└── .env                      # 环境变量文件（在服务器上创建）
```

### 部署步骤

1. **在服务器上创建目录**：

```bash
mkdir -p ~/polymarket-scanner/scripts
mkdir -p ~/polymarket-scanner/logs  # 创建日志目录
cd ~/polymarket-scanner
```

2. **上传文件**：

使用 `scp` 或其他方式上传：
```bash
# 从本地机器上传
scp scripts/auto-scan.js user@your-server:~/polymarket-scanner/scripts/
scp scripts/setup-local-cron.sh user@your-server:~/polymarket-scanner/scripts/
```

3. **创建 .env 文件**：

```bash
cd ~/polymarket-scanner
nano .env
```

添加：
```bash
SCAN_API_URL=https://your-app.vercel.app/api/cron/scan
CRON_SECRET=your-secret-key-here
```

**如何获取 CRON_SECRET？**
1. 生成随机字符串：`openssl rand -hex 32`
2. 在 Vercel 上设置：Settings → Environment Variables → 添加 `CRON_SECRET`
3. 重新部署 Vercel 应用
4. 在本地 `.env` 文件中使用相同的值

详细步骤请查看：[CRON_SECRET_SETUP.md](./CRON_SECRET_SETUP.md)

设置权限：
```bash
chmod 600 .env
```

4. **设置脚本权限**：

```bash
chmod +x scripts/auto-scan.js
chmod +x scripts/setup-local-cron.sh
```

5. **测试运行**：

```bash
# 确保 Node.js 已安装（需要 Node.js 18+）
node --version

# 测试脚本
node scripts/auto-scan.js
```

6. **设置 Cron Job**：

```bash
crontab -e
```

**推荐：使用用户目录日志（无需 sudo）**：

```bash
# 每小时整点执行，日志保存到用户目录
0 * * * * cd ~/polymarket-scanner && /usr/bin/node scripts/auto-scan.js >> ~/polymarket-scanner/logs/scan.log 2>&1
```

**或者：使用系统日志（需要 sudo 创建一次）**：

```bash
# 先创建日志文件（需要 sudo，只需一次）
sudo touch /var/log/polymarket-scan.log
sudo chown imi_user:imi_user /var/log/polymarket-scan.log
sudo chmod 644 /var/log/polymarket-scan.log

# 然后在 crontab 中使用
0 * * * * cd ~/polymarket-scanner && /usr/bin/node scripts/auto-scan.js >> /var/log/polymarket-scan.log 2>&1
```

**权限问题？** 查看 [CRONTAB_PERMISSIONS.md](./CRONTAB_PERMISSIONS.md)

## 📦 方案二：使用 TypeScript 版本（需要安装依赖）

如果你更喜欢使用 TypeScript 版本，需要安装依赖：

### 需要上传的文件

```
polymarket-scanner/
├── scripts/
│   ├── auto-scan.ts          # TypeScript 版本
│   └── setup-local-cron.sh   # 设置脚本（可选）
├── package.json               # 最小化的 package.json
└── .env                       # 环境变量文件
```

### 创建最小化的 package.json

```json
{
  "name": "polymarket-scanner",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "auto-scan": "tsx scripts/auto-scan.ts"
  },
  "dependencies": {
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "tsx": "^4.21.0",
    "typescript": "^5"
  }
}
```

### 部署步骤

1. **上传文件**（同上）

2. **安装依赖**：

```bash
cd ~/polymarket-scanner
npm install
```

3. **创建 .env 文件**（同上）

4. **测试运行**：

```bash
npm run auto-scan
# 或
npx tsx scripts/auto-scan.ts
```

5. **设置 Cron Job**：

```bash
crontab -e
```

添加：
```bash
# 每小时整点执行
0 * * * * cd ~/polymarket-scanner && npm run auto-scan >> /var/log/polymarket-scan.log 2>&1
```

## 🎯 推荐方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **方案一（JS版本）** | ✅ 无需安装依赖<br>✅ 文件最少<br>✅ 运行最快 | ❌ 需要 Node.js 18+（支持 fetch） | ⭐⭐⭐⭐⭐ |
| **方案二（TS版本）** | ✅ 与项目代码一致<br>✅ 类型安全 | ❌ 需要安装 npm 依赖<br>❌ 需要更多文件 | ⭐⭐⭐ |

## 📝 快速部署脚本

创建一个快速部署脚本 `deploy-minimal.sh`：

```bash
#!/bin/bash
# 最小化部署脚本

SERVER_USER="your-username"
SERVER_HOST="your-server-ip"
REMOTE_DIR="~/polymarket-scanner"

echo "开始部署..."

# 创建远程目录
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_DIR}/scripts"

# 上传文件
scp scripts/auto-scan.js ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/scripts/
scp scripts/setup-local-cron.sh ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/scripts/

# 设置权限
ssh ${SERVER_USER}@${SERVER_HOST} "chmod +x ${REMOTE_DIR}/scripts/*.js ${REMOTE_DIR}/scripts/*.sh"

echo "部署完成！"
echo "下一步："
echo "1. SSH 到服务器: ssh ${SERVER_USER}@${SERVER_HOST}"
echo "2. 创建 .env 文件: cd ${REMOTE_DIR} && nano .env"
echo "3. 测试运行: node scripts/auto-scan.js"
echo "4. 设置 cron job: crontab -e"
```

## ✅ 验证清单

部署后，确认以下事项：

- [ ] Node.js 已安装（`node --version`）
- [ ] `.env` 文件已创建并配置
- [ ] 脚本有执行权限（`chmod +x scripts/auto-scan.js`）
- [ ] 手动测试成功（`node scripts/auto-scan.js`）
- [ ] Cron job 已设置（`crontab -l`）
- [ ] 日志文件已创建（`/var/log/polymarket-scan.log`）

## 🔍 故障排查

### 问题：找不到 node 命令

```bash
# 检查 Node.js 是否安装
which node

# 如果未安装，安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 问题：fetch is not defined（Node.js < 18）

JavaScript 版本的 `auto-scan.js` 需要 Node.js 18+（内置 fetch）。

如果使用 Node.js 16 或更早版本，需要：
1. 升级 Node.js，或
2. 使用 TypeScript 版本（方案二），或
3. 安装 node-fetch 包

## 📚 相关文档

- **完整部署指南**：[UBUNTU_SETUP.md](./UBUNTU_SETUP.md)
- **快速开始**：[QUICK_START_LOCAL_CRON.md](./QUICK_START_LOCAL_CRON.md)
