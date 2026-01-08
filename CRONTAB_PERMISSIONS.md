# Crontab 权限问题指南

## ✅ 好消息：crontab 本身没有权限问题

**用户级别的 crontab 不需要 sudo 权限！**

- 每个用户（包括 `imi_user`）都可以编辑自己的 crontab
- 使用 `crontab -e` 编辑，`crontab -l` 查看
- 不需要 root 权限

## ⚠️ 唯一可能的权限问题：日志文件

如果使用 `/var/log/polymarket-scan.log`，这个目录通常需要 root 权限写入。

## 🎯 解决方案

### 方案一：使用用户目录日志（推荐，无需 sudo）

**优点**：
- ✅ 不需要 sudo 权限
- ✅ 更安全（日志在用户目录）
- ✅ 便于管理

**设置步骤**：

1. **创建用户日志目录**：

```bash
# 在用户目录下创建日志目录
mkdir -p ~/polymarket-scanner/logs
```

2. **设置 crontab**：

```bash
crontab -e
```

添加：

```bash
# 每小时整点执行，日志保存到用户目录
0 * * * * cd ~/polymarket-scanner && node scripts/auto-scan.js >> ~/polymarket-scanner/logs/scan.log 2>&1
```

3. **查看日志**：

```bash
tail -f ~/polymarket-scanner/logs/scan.log
```

### 方案二：使用系统日志目录（需要 sudo 一次）

**优点**：
- ✅ 日志在标准位置
- ✅ 便于系统级监控

**缺点**：
- ⚠️ 需要 sudo 权限创建日志文件（只需一次）

**设置步骤**：

1. **创建日志文件（需要 sudo，只需一次）**：

```bash
sudo touch /var/log/polymarket-scan.log
sudo chmod 666 /var/log/polymarket-scan.log
# 或者更安全的方式：设置所有者为 imi_user
sudo chown imi_user:imi_user /var/log/polymarket-scan.log
sudo chmod 644 /var/log/polymarket-scan.log
```

2. **设置 crontab**（不需要 sudo）：

```bash
crontab -e
```

添加：

```bash
# 每小时整点执行
0 * * * * cd ~/polymarket-scanner && node scripts/auto-scan.js >> /var/log/polymarket-scan.log 2>&1
```

## 📋 完整配置示例（用户目录日志）

### 1. 创建目录结构

```bash
cd ~
mkdir -p polymarket-scanner/scripts
mkdir -p polymarket-scanner/logs
cd polymarket-scanner
```

### 2. 上传文件

```bash
# 上传脚本文件到 ~/polymarket-scanner/scripts/
```

### 3. 创建 .env 文件

```bash
nano .env
```

内容：

```bash
SCAN_API_URL=https://your-app.vercel.app/api/cron/scan
CRON_SECRET=your-secret-key-here
```

设置权限：

```bash
chmod 600 .env
```

### 4. 设置 crontab（无需 sudo）

```bash
crontab -e
```

添加：

```bash
# Polymarket 扫描任务 - 每小时整点执行
0 * * * * cd ~/polymarket-scanner && node scripts/auto-scan.js >> ~/polymarket-scanner/logs/scan.log 2>&1
```

### 5. 验证

```bash
# 查看 crontab
crontab -l

# 查看日志
tail -f ~/polymarket-scanner/logs/scan.log

# 手动测试
cd ~/polymarket-scanner
node scripts/auto-scan.js
```

## 🔍 权限检查清单

### 检查 crontab 权限

```bash
# 查看当前用户的 crontab（应该可以正常查看）
crontab -l

# 如果提示权限错误，检查：
ls -la /var/spool/cron/crontabs/
# 应该能看到 imi_user 的文件
```

### 检查日志文件权限

**如果使用用户目录日志**：

```bash
# 检查日志目录权限
ls -ld ~/polymarket-scanner/logs

# 应该显示：drwxr-xr-x imi_user imi_user
```

**如果使用系统日志**：

```bash
# 检查日志文件权限
ls -la /var/log/polymarket-scan.log

# 应该显示：-rw-rw-rw- 或 -rw-r--r-- imi_user imi_user
```

## 🚨 常见权限问题

### 问题 1: 无法编辑 crontab

**症状**：`crontab -e` 提示权限错误

**解决**：

```bash
# 检查 crontab 目录权限
ls -la /var/spool/cron/crontabs/

# 如果 imi_user 的文件不存在或权限不对，联系管理员
# 或者检查用户是否在允许使用 crontab 的组中
groups imi_user
```

### 问题 2: 无法写入日志文件

**症状**：cron job 执行但日志文件为空或报错

**解决**：

**方案 A：使用用户目录日志**（推荐）

```bash
# 修改 crontab，使用用户目录
crontab -e
# 改为：>> ~/polymarket-scanner/logs/scan.log 2>&1
```

**方案 B：修复系统日志权限**

```bash
# 需要 sudo 权限
sudo chown imi_user:imi_user /var/log/polymarket-scan.log
sudo chmod 644 /var/log/polymarket-scan.log
```

### 问题 3: 脚本无法执行

**症状**：cron job 执行但脚本报错

**解决**：

```bash
# 确保脚本有执行权限
chmod +x ~/polymarket-scanner/scripts/auto-scan.js

# 在 crontab 中使用完整路径
which node  # 例如：/usr/bin/node
# crontab 中使用：/usr/bin/node scripts/auto-scan.js
```

## ✅ 推荐配置（imi_user）

对于 `imi_user`，推荐使用**用户目录日志**方案：

```bash
# crontab 配置
0 * * * * cd ~/polymarket-scanner && /usr/bin/node scripts/auto-scan.js >> ~/polymarket-scanner/logs/scan.log 2>&1
```

**优点**：
- ✅ 完全不需要 sudo
- ✅ 所有文件都在用户目录
- ✅ 便于备份和管理
- ✅ 避免权限问题

## 📝 快速设置脚本（用户目录日志）

```bash
#!/bin/bash
# 快速设置脚本（无需 sudo）

# 创建目录
mkdir -p ~/polymarket-scanner/{scripts,logs}

# 设置脚本权限
chmod +x ~/polymarket-scanner/scripts/auto-scan.js

# 设置 .env 权限
chmod 600 ~/polymarket-scanner/.env

# 添加 crontab（每小时整点）
(crontab -l 2>/dev/null; echo "0 * * * * cd ~/polymarket-scanner && /usr/bin/node scripts/auto-scan.js >> ~/polymarket-scanner/logs/scan.log 2>&1") | crontab -

echo "✅ 设置完成！"
echo "日志位置: ~/polymarket-scanner/logs/scan.log"
echo "查看日志: tail -f ~/polymarket-scanner/logs/scan.log"
```

## 🎯 总结

1. **crontab 本身**：用户 `imi_user` 可以正常使用，无需 sudo
2. **日志文件**：推荐使用 `~/polymarket-scanner/logs/scan.log`，避免权限问题
3. **脚本执行**：确保脚本有执行权限，使用完整路径
4. **环境变量**：`.env` 文件在用户目录，权限设置为 600

**推荐配置**：

```bash
# crontab 条目
0 * * * * cd ~/polymarket-scanner && /usr/bin/node scripts/auto-scan.js >> ~/polymarket-scanner/logs/scan.log 2>&1
```

这样配置完全不需要 sudo 权限！
