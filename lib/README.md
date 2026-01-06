# Polymarket 数据获取模块

## 功能说明

`lib/polymarket.ts` 提供了从 Polymarket 获取实时交易数据的功能。

## 主要功能

- ✅ 获取最近的交易数据（支持 GraphQL 和 REST API）
- ✅ 自动去重机制（基于 timestamp + maker_address + asset_id）
- ✅ 多端点容错（自动尝试多个 API 端点）
- ✅ 模拟数据模式（用于测试和开发）

## 使用方法

### 基本用法

```typescript
import { fetchRecentTrades } from '@/lib/polymarket';

// 获取最近 50 条交易
const trades = await fetchRecentTrades(50);

// 使用模拟数据（用于测试）
const mockTrades = await fetchRecentTrades(50, true);
```

### 测试脚本

```bash
# 使用真实 API（如果可用）
npm run test:fetch

# 使用模拟数据
USE_MOCK_DATA=true npm run test:fetch
```

## API 端点配置

当前代码尝试以下端点（按优先级）：

### GraphQL 端点
1. `https://clob.polymarket.com/graphql`
2. `https://api.polymarket.com/graphql`
3. `https://polymarket.com/graphql`

### REST 端点（备选）
1. `https://api.polymarket.com/trades`
2. `https://clob.polymarket.com/trades`
3. `https://polymarket.com/api/v1/trades`
4. `https://polymarket.com/api/trades`

## 注意事项

⚠️ **API 端点可能需要更新**：Polymarket 的 API 端点可能会变化，如果所有端点都失败，代码会自动使用模拟数据。

📝 **去重机制**：使用内存 Set 存储已处理的交易，基于 `timestamp_maker_address_asset_id` 组合作为唯一键。

🔄 **重置去重状态**：如果需要重置去重状态，可以调用：

```typescript
import { clearProcessedTrades } from '@/lib/polymarket';
clearProcessedTrades();
```

## 数据结构

```typescript
interface PolymarketTrade {
  maker_address: string;  // 钱包地址
  asset_id: string;        // 市场/资产ID
  amount_usdc: number;     // 交易金额（USDC）
  timestamp: string;       // 时间戳（ISO 8601 格式）
}
```

## 下一步

1. 确认正确的 Polymarket API 端点
2. 更新 `lib/polymarket.ts` 中的端点配置
3. 如果需要认证，添加 API Key 配置
4. 实现持久化去重（使用数据库而非内存）

