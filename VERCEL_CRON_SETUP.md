# Vercel Cron Jobs 配置指南

## ✅ 已完成的配置

1. ✅ 创建了 `vercel.json` 配置文件
2. ✅ 配置了自动扫描任务（每5分钟运行一次）
3. ✅ API route 已支持 Vercel Cron 调用

## 📋 部署步骤

### 1. 确保 vercel.json 已提交到 Git

```bash
git add vercel.json
git commit -m "Add Vercel cron job configuration"
git push
```

### 2. 在 Vercel 部署

如果你使用 Vercel CLI：
```bash
vercel --prod
```

或者通过 GitHub 自动部署（推荐）：
- 推送代码到 GitHub
- Vercel 会自动检测并部署

### 3. 验证 Cron Job

部署后，在 Vercel Dashboard 中：
1. 进入你的项目
2. 点击 "Settings" → "Cron Jobs"
3. 你应该能看到 "Scan Polymarket Trades" 任务
4. 状态应该是 "Active"

## ⚙️ Cron 时间表配置

当前配置：每5分钟运行一次 (`*/5 * * * *`)

你可以修改 `vercel.json` 中的 `schedule` 字段：

```json
{
  "crons": [
    {
      "path": "/api/cron/scan",
      "schedule": "*/5 * * * *"  // 每5分钟
    }
  ]
}
```

### 常用时间表：

- `*/1 * * * *` - 每1分钟
- `*/5 * * * *` - 每5分钟（当前配置）
- `*/10 * * * *` - 每10分钟
- `0 * * * *` - 每小时
- `0 */6 * * *` - 每6小时
- `0 0 * * *` - 每天午夜

## 🔒 安全配置（可选）

### 设置 CRON_SECRET（推荐）

在 Vercel Dashboard 中设置环境变量：

1. 进入项目 Settings → Environment Variables
2. 添加：
   - Key: `CRON_SECRET`
   - Value: 生成一个随机字符串（例如：`openssl rand -hex 32`）
   - Environment: Production, Preview, Development（根据需要）

3. 更新 `vercel.json`：
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

API route 已经配置为验证 CRON_SECRET（如果设置了的话）。

## 📊 监控 Cron Jobs

### 在 Vercel Dashboard 中查看：

1. 进入项目
2. 点击 "Functions" 标签
3. 找到 `/api/cron/scan`
4. 查看调用日志和统计

### 查看日志：

```bash
vercel logs --follow
```

或者：
```bash
vercel logs [deployment-url]
```

## 🧪 测试 Cron Job

### 手动触发（用于测试）：

```bash
curl https://your-app.vercel.app/api/cron/scan
```

### 在 Vercel Dashboard 中：

1. 进入项目 → Settings → Cron Jobs
2. 找到你的 cron job
3. 点击 "Run Now" 按钮（如果有的话）

## ⚠️ 注意事项

1. **Vercel Cron 限制**：
   - Hobby 计划：每月 1000 次调用
   - Pro 计划：每月 100,000 次调用
   - 每5分钟运行一次 = 每天 288 次 = 每月约 8,640 次（Hobby 计划足够）

2. **API 速率限制**：
   - Polymarket Data API：每10秒50次请求
   - 当前配置（每5分钟）远低于限制

3. **函数超时**：
   - Hobby 计划：10秒超时
   - Pro 计划：60秒超时
   - 如果扫描时间过长，考虑：
     - 减少 `limit` 参数
     - 减少 `concurrency` 参数
     - 升级到 Pro 计划

4. **数据库连接**：
   - 确保 `DATABASE_URL` 环境变量已配置
   - SQLite 文件需要存储在持久化存储中（Vercel 不支持）
   - **建议**：使用 Vercel Postgres 或其他云数据库

## 🔧 故障排查

### Cron Job 没有运行？

1. 检查 `vercel.json` 是否正确提交
2. 检查 Vercel Dashboard 中的 Cron Jobs 状态
3. 查看函数日志：`vercel logs`
4. 确认环境变量已正确配置

### 函数超时？

1. 减少扫描的交易数量：`/api/cron/scan?limit=20`
2. 减少并发数：`/api/cron/scan?concurrency=2`
3. 检查网络连接和 API 响应时间

### 数据库错误？

1. 确认 `DATABASE_URL` 已配置
2. 如果使用 SQLite，需要迁移到云数据库（Vercel Postgres、Supabase 等）

## 📝 示例：使用 Vercel Postgres

如果你使用 Vercel Postgres：

1. 在 Vercel Dashboard 中创建 Postgres 数据库
2. 更新 `prisma/schema.prisma`：
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("POSTGRES_PRISMA_URL")
   }
   ```
3. 运行迁移：`npx prisma migrate deploy`
4. 更新环境变量：`DATABASE_URL` 会自动设置

## 🎉 完成！

部署后，系统会每5分钟自动扫描一次，无需你手动操作！

