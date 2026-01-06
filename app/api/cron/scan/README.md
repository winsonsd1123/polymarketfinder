# 自动化扫描 API

## 功能说明

`/api/cron/scan` 是一个自动化 ETL（Extract, Transform, Load）端点，用于：
1. 从 Polymarket 获取最新的交易数据
2. 分析每个交易的钱包地址
3. 识别可疑钱包（风险评分 > 60）
4. 将可疑钱包和交易存入数据库

## API 端点

### GET/POST `/api/cron/scan`

扫描最新的交易并分析可疑钱包。

#### 查询参数

- `limit` (可选): 获取的交易数量，默认 `50`
- `mock` (可选): 是否使用模拟数据，默认 `false`。设置为 `true` 时使用模拟数据
- `concurrency` (可选): 并发处理钱包的数量，默认 `3`。建议值：3-5

#### 示例请求

```bash
# 使用真实数据，默认参数
curl http://localhost:3000/api/cron/scan

# 使用模拟数据，限制 20 笔交易
curl "http://localhost:3000/api/cron/scan?limit=20&mock=true"

# 自定义并发数
curl "http://localhost:3000/api/cron/scan?concurrency=5"
```

#### 响应格式

```json
{
  "success": true,
  "message": "扫描完成",
  "result": {
    "totalTrades": 50,
    "processedWallets": 45,
    "newWallets": 10,
    "suspiciousWallets": 3,
    "skippedWallets": 35,
    "errors": 0,
    "details": {
      "newWallets": ["0x123...", "0x456..."],
      "suspiciousWallets": ["0x789..."],
      "errors": []
    }
  },
  "duration": 1234
}
```

## 工作流程

1. **获取交易数据**: 调用 `fetchRecentTrades(limit)` 获取最新的交易
2. **去重钱包**: 对交易中的钱包地址进行去重
3. **并发处理**: 使用 `p-limit` 控制并发数，避免 API Rate Limit
4. **检查钱包**:
   - 如果钱包已存在于数据库，更新 `lastActiveAt` 字段
   - 如果是新钱包，调用 `analyzeWallet` 进行分析
5. **入库可疑钱包**:
   - 如果 `isSuspicious === true` 且 `score > 60`，存入 `MonitoredWallet`
   - 创建或更新 `Market`（如果不存在）
   - 创建 `TradeEvent` 记录

## 数据库操作

### MonitoredWallet

- **已存在**: 更新 `lastActiveAt` 为当前时间
- **新钱包且可疑**: 创建新记录，包含：
  - `address`: 钱包地址（小写）
  - `riskScore`: 风险评分
  - `fundingSource`: 资金来源（如果有）
  - `lastActiveAt`: 当前时间

### Market

- **不存在**: 创建新市场，使用 `asset_id` 作为 `id`
- **已存在**: 更新 `volume`（累加交易金额）

### TradeEvent

- 为每个可疑钱包的交易创建记录，关联到 `MonitoredWallet` 和 `Market`

## 并发控制

使用 `p-limit` 库控制并发数，默认 3 个并发任务。这有助于：
- 避免 API Rate Limit
- 控制数据库连接数
- 平衡性能和稳定性

可以通过 `concurrency` 参数调整并发数。

## 错误处理

- 单个钱包处理失败不会影响整体流程
- 错误信息会记录在响应的 `details.errors` 中
- 失败的交易会被跳过，继续处理下一个

## 测试

### 使用测试脚本

```bash
# 使用模拟数据测试
USE_MOCK_DATA=true npm run test:scan

# 使用真实数据测试（需要先启动 Next.js 服务器）
npm run dev
# 在另一个终端
npm run test:scan
```

### 手动测试

1. 启动开发服务器：
```bash
npm run dev
```

2. 访问 API：
```bash
curl http://localhost:3000/api/cron/scan?mock=true
```

## 定时任务集成

### Vercel Cron Jobs

在 `vercel.json` 中配置：

```json
{
  "crons": [
    {
      "path": "/api/cron/scan",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### 其他平台

可以使用任何支持 HTTP 请求的定时任务服务：
- GitHub Actions
- AWS Lambda + EventBridge
- Google Cloud Scheduler
- 自建 cron 服务

## 注意事项

⚠️ **API Rate Limit**: 
- Polymarket API 可能有速率限制
- Polygon RPC 也可能有速率限制
- 建议并发数设置为 3-5

⚠️ **数据库性能**:
- 大量交易时可能需要优化数据库查询
- 考虑添加索引优化查询性能

⚠️ **错误处理**:
- 网络错误会自动重试（如果实现了重试逻辑）
- 数据库错误会记录但不会中断流程

## 下一步优化

1. 添加重试机制（网络错误时）
2. 添加缓存机制（避免重复分析）
3. 添加监控和告警
4. 优化数据库查询性能
5. 添加批量处理优化

