# CRON_SECRET 设置指南

`CRON_SECRET` 是一个认证密钥，用于保护你的扫描 API，防止未授权的访问。

## 🔑 CRON_SECRET 是什么？

`CRON_SECRET` 是一个随机生成的字符串，用作 API 认证密码。当你的本地服务器调用 Vercel 上的扫描 API 时，需要在请求头中携带这个密钥进行身份验证。

## 📝 步骤 1: 生成 CRON_SECRET

你可以使用以下任一方法生成一个安全的随机字符串：

### 方法 1: 使用 openssl（推荐）

```bash
# 生成 32 字节的十六进制字符串（64 个字符）
openssl rand -hex 32

# 输出示例：
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 方法 2: 使用 Node.js

```bash
# 在 Node.js 中生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 方法 3: 使用 Python

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 方法 4: 在线生成器

你也可以使用在线工具生成，例如：
- https://www.random.org/strings/
- 设置长度：64 字符，字符集：十六进制（0-9, a-f）

**建议**：使用 `openssl rand -hex 32` 生成，这是最安全和常用的方法。

## 📝 步骤 2: 在 Vercel 上设置 CRON_SECRET

### 2.1 登录 Vercel

1. 访问 https://vercel.com
2. 登录你的账户

### 2.2 进入项目设置

1. 在 Dashboard 中找到你的项目（polymarketfinder）
2. 点击项目进入详情页
3. 点击顶部菜单的 **Settings**（设置）

### 2.3 添加环境变量

1. 在左侧菜单中找到 **Environment Variables**（环境变量）
2. 点击进入环境变量页面
3. 点击 **Add New**（添加新变量）按钮

### 2.4 填写环境变量信息

填写以下信息：

- **Key（键）**: `CRON_SECRET`
- **Value（值）**: 粘贴你刚才生成的随机字符串（例如：`a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`）
- **Environment（环境）**: 
  - ✅ Production（生产环境）- **必须选择**
  - ✅ Preview（预览环境）- 可选
  - ✅ Development（开发环境）- 可选

**重要**：至少选择 **Production**，因为你的 API 运行在生产环境。

### 2.5 保存并部署

1. 点击 **Save**（保存）
2. **重要**：环境变量修改后，需要重新部署才能生效
3. 进入 **Deployments**（部署）页面
4. 点击最新部署右侧的 **...** 菜单
5. 选择 **Redeploy**（重新部署）

或者直接推送代码触发自动部署：

```bash
git commit --allow-empty -m "Trigger redeploy for CRON_SECRET"
git push
```

## 📝 步骤 3: 在本地服务器上使用 CRON_SECRET

### 3.1 创建 .env 文件

在你的本地服务器上，创建 `.env` 文件：

```bash
cd ~/polymarket-scanner
nano .env
```

### 3.2 添加环境变量

在 `.env` 文件中添加：

```bash
SCAN_API_URL=https://your-app.vercel.app/api/cron/scan
CRON_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**重要**：
- `CRON_SECRET` 的值必须与 Vercel 环境变量中的值**完全一致**
- 不要有多余的空格或换行
- 确保使用相同的密钥

### 3.3 设置文件权限

```bash
chmod 600 .env
```

这样可以确保只有文件所有者可以读写，保护你的密钥安全。

## ✅ 验证设置

### 测试连接

在本地服务器上运行：

```bash
node scripts/auto-scan.js
```

如果看到 "✅ 扫描完成"，说明 `CRON_SECRET` 配置正确。

如果看到 "❌ HTTP 错误 401: Unauthorized"，说明：
1. `CRON_SECRET` 值不匹配
2. Vercel 环境变量未正确部署（需要重新部署）

## 🔍 常见问题

### Q: 我已经设置了 CRON_SECRET，但还是返回 401？

**A:** 检查以下几点：

1. **确认 Vercel 环境变量已部署**
   - 环境变量修改后需要重新部署
   - 进入 Vercel Dashboard → Deployments → 重新部署

2. **确认值完全一致**
   - 检查是否有空格、换行或特殊字符
   - 复制粘贴时注意不要多复制或少复制字符

3. **确认环境匹配**
   - 如果 API 运行在 Production，确保 Vercel 环境变量选择了 Production

4. **检查 .env 文件格式**
   ```bash
   # 正确格式
   CRON_SECRET=your-secret-here
   
   # 错误格式（不要有引号）
   CRON_SECRET="your-secret-here"
   CRON_SECRET='your-secret-here'
   ```

### Q: 我可以使用简单的密码吗？

**A:** 不推荐。`CRON_SECRET` 应该是一个强随机字符串，至少 32 字节（64 个十六进制字符）。使用简单密码容易被破解。

### Q: 如果 CRON_SECRET 泄露了怎么办？

**A:** 立即执行以下步骤：

1. 在 Vercel 上生成新的 `CRON_SECRET`
2. 更新 Vercel 环境变量
3. 重新部署应用
4. 更新本地服务器的 `.env` 文件
5. 删除旧的密钥

### Q: 我需要为每个环境设置不同的 CRON_SECRET 吗？

**A:** 可以相同也可以不同。建议：
- **相同**：便于管理，本地服务器只需要一个密钥
- **不同**：更安全，但需要管理多个密钥

### Q: Vercel Cron Jobs 需要 CRON_SECRET 吗？

**A:** 不需要。Vercel 自己的 Cron Jobs 会自动通过，代码中有特殊处理：

```typescript
const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');
if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
  // Vercel Cron 会被允许通过
}
```

## 📋 快速检查清单

- [ ] 已生成 `CRON_SECRET`（使用 `openssl rand -hex 32`）
- [ ] 已在 Vercel 上设置环境变量 `CRON_SECRET`
- [ ] 已选择 Production 环境
- [ ] 已重新部署 Vercel 应用
- [ ] 已在本地服务器创建 `.env` 文件
- [ ] `.env` 文件中的 `CRON_SECRET` 与 Vercel 完全一致
- [ ] 已设置 `.env` 文件权限为 600
- [ ] 已测试连接成功

## 🎯 总结

1. **生成密钥**：`openssl rand -hex 32`
2. **Vercel 设置**：Settings → Environment Variables → 添加 `CRON_SECRET`
3. **重新部署**：确保环境变量生效
4. **本地配置**：在 `.env` 文件中添加相同的 `CRON_SECRET`
5. **测试验证**：运行脚本确认连接成功

完成以上步骤后，你的本地服务器就可以安全地调用 Vercel 上的扫描 API 了！
