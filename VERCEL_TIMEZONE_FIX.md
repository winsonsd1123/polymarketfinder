# Vercel 时区问题修复说明

## 问题描述

在 Vercel 部署后，时间显示不正确。原因是：
- **Vercel 服务器时区**：UTC
- **本地开发环境时区**：可能是 UTC+8（北京时间）
- **问题**：`new Date(trade.timestamp)` 在解析没有时区信息的时间字符串时，会按服务器本地时区解析，导致时间不一致

## 问题根源

在 `app/api/cron/scan/route.ts:53` 中：
```typescript
const currentTradeTime = new Date(trade.timestamp);
```

如果 `trade.timestamp` 是 ISO 格式但没有 `Z`（如 `"2026-01-07T07:30:00.000"`）：
- **在 UTC 环境（Vercel）**：`new Date()` 会按 UTC 解析
- **在 UTC+8 环境（本地）**：`new Date()` 会按 UTC+8 解析
- **结果**：时间差 8 小时！

## 修复方案

### 1. 添加 `parseToUTCDate` 函数

在 `lib/time-utils.ts` 中添加了新函数，确保时间始终解析为 UTC：

```typescript
export function parseToUTCDate(timeString: string | number | Date): Date {
  // 如果已经是 Date 对象，直接返回
  if (timeString instanceof Date) {
    return timeString;
  }
  
  // 如果是数字，当作 Unix 时间戳处理
  if (typeof timeString === 'number') {
    return timeString < 10000000000
      ? new Date(timeString * 1000)
      : new Date(timeString);
  }
  
  // 如果是字符串，确保解析为 UTC 时间
  let dateString = timeString;
  
  // 如果已经是 ISO 格式且带 Z，直接解析
  if (dateString.includes('T') && dateString.includes('Z')) {
    return new Date(dateString);
  }
  
  // 如果是 ISO 格式但没有 Z，添加 Z 确保解析为 UTC
  if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
    dateString = dateString + 'Z';
    return new Date(dateString);
  }
  
  // 如果是 PostgreSQL timestamp 格式，转换为 ISO 格式
  if (dateString.includes(' ') && !dateString.includes('T')) {
    dateString = dateString.replace(' ', 'T') + 'Z';
    return new Date(dateString);
  }
  
  // 其他格式，尝试直接解析
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) {
    throw new Error(`无法解析时间字符串: ${timeString}`);
  }
  
  return parsed;
}
```

### 2. 更新代码使用 `parseToUTCDate`

**修改位置1：** `app/api/cron/scan/route.ts:53`
```typescript
// 修复前
const currentTradeTime = new Date(trade.timestamp);

// 修复后
const currentTradeTime = parseToUTCDate(trade.timestamp);
```

**修改位置2：** `app/api/cron/scan/route.ts:192`
```typescript
// 修复前
const tradeBeijingTime = toBeijingTime(new Date(trade.timestamp));

// 修复后
const tradeBeijingTime = toBeijingTime(parseToUTCDate(trade.timestamp));
```

## 修复效果

### 修复前
- **本地（UTC+8）**：`new Date("2026-01-07T07:30:00.000")` → `2026-01-06T23:30:00.000Z`（错误）
- **Vercel（UTC）**：`new Date("2026-01-07T07:30:00.000")` → `2026-01-07T07:30:00.000Z`（正确）
- **结果**：时间不一致，相差 8 小时

### 修复后
- **本地（UTC+8）**：`parseToUTCDate("2026-01-07T07:30:00.000")` → `2026-01-07T07:30:00.000Z`（正确）
- **Vercel（UTC）**：`parseToUTCDate("2026-01-07T07:30:00.000")` → `2026-01-07T07:30:00.000Z`（正确）
- **结果**：时间一致，无论服务器时区如何

## 测试验证

运行测试脚本验证：
```bash
npx tsx scripts/test-vercel-timezone.ts
```

**测试结果：**
- ✅ ISO 格式（带 Z）：解析正确
- ✅ ISO 格式（不带 Z）：自动添加 Z，解析正确
- ✅ Unix 时间戳：解析正确
- ✅ 不同时区下解析结果一致

## 影响范围

### 修复的功能
1. ✅ **钱包年龄计算**：确保 `currentTradeTime` 是 UTC 时间
2. ✅ **WC/TX Gap 计算**：确保时间差计算正确
3. ✅ **交易时间检查**：确保交易时间判断正确
4. ✅ **交易时间存储**：确保存储的时间正确

### 不受影响的功能
- ✅ 钱包创建时间（Alchemy API 返回的是 UTC 时间戳）
- ✅ 数据库存储（使用 `toBeijingTime()` 统一转换）
- ✅ 前端显示（使用 `fromBeijingTime()` 统一转换）

## 部署建议

1. ✅ **代码已修复**：使用 `parseToUTCDate` 确保时间解析一致
2. ✅ **构建成功**：代码已通过 TypeScript 编译
3. ⚠️  **部署后验证**：部署到 Vercel 后，检查时间显示是否正确

## 总结

✅ **问题已修复！**

- 添加了 `parseToUTCDate` 函数，确保时间始终解析为 UTC
- 更新了所有使用 `new Date(trade.timestamp)` 的地方
- 确保在 Vercel（UTC）和本地（UTC+8）环境下都能正确解析
- 时间计算和显示现在应该一致了

