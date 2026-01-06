# GitHub 仓库设置指南

## 步骤 1: 在 GitHub 创建新仓库

1. 访问 https://github.com/new
2. 填写仓库信息：
   - **Repository name**: `polymarketfinder`（或你喜欢的名字）
   - **Description**: `Polymarket 可疑钱包监控系统 - 自动检测内幕交易钱包`
   - **Visibility**: 
     - ✅ Public（公开，免费）
     - ⬜ Private（私有，需要付费）
   - **不要**勾选以下选项：
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
3. 点击 "Create repository"

## 步骤 2: 复制仓库 URL

创建后，GitHub 会显示仓库 URL，类似：
```
https://github.com/你的用户名/polymarketfinder.git
```

## 步骤 3: 添加远程仓库并推送

在终端运行以下命令（替换为你的实际 URL）：

```bash
cd /Users/wenyujun/dev/project/polymarketfinder
git remote add origin https://github.com/你的用户名/polymarketfinder.git
git branch -M main
git push -u origin main
```

## 完成！

推送成功后，你的代码就会在 GitHub 上了！

## 后续步骤

1. **连接 Vercel**：
   - 在 Vercel Dashboard 中导入 GitHub 仓库
   - Vercel 会自动检测并部署

2. **配置环境变量**：
   - 在 Vercel Dashboard → Settings → Environment Variables
   - 添加必要的环境变量（如 `DATABASE_URL`）

3. **设置数据库**：
   - 使用 Vercel Postgres 或 Supabase
   - 更新 Prisma schema 为 PostgreSQL

