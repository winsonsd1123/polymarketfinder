import axios, { AxiosInstance } from 'axios';

/**
 * Polymarket 交易数据接口
 */
export interface PolymarketTrade {
  maker_address: string; // 钱包地址
  asset_id: string; // 市场/资产ID
  amount_usdc: number; // 交易金额（USDC）
  timestamp: string; // 时间戳（ISO 8601 格式）
  side?: 'BUY' | 'SELL'; // 交易方向（从 Data API 获取）
  title?: string; // 市场标题（从 Data API 获取）
  conditionId?: string; // 条件ID
}

/**
 * 交易唯一标识（用于去重）
 */
type TradeKey = string;

/**
 * 生成交易的唯一标识键
 */
function getTradeKey(trade: PolymarketTrade): TradeKey {
  return `${trade.timestamp}_${trade.maker_address}_${trade.asset_id}`;
}

/**
 * Polymarket API 客户端
 */
class PolymarketClient {
  private client: AxiosInstance;
  private processedTrades: Set<TradeKey> = new Set();

  constructor() {
    this.client = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }

  /**
   * 使用 The Graph 子图获取最近的交易（链上数据）
   */
  private async fetchTradesFromTheGraph(limit: number): Promise<PolymarketTrade[]> {
    // The Graph 的 Polymarket 子图端点
    const endpoints = [
      'https://api.thegraph.com/subgraphs/name/polymarket/polymarket',
      'https://api.studio.thegraph.com/query/polymarket/polymarket/version/latest',
      'https://gateway.thegraph.com/api/subgraphs/id/polymarket',
    ];

    const query = `
      query GetRecentTrades($limit: Int!) {
        fills(
          first: $limit
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          maker
          taker
          amount
          price
          timestamp
          market {
            id
            question
          }
        }
      }
    `;

    for (const endpoint of endpoints) {
      try {
        console.log(`[Polymarket API] 尝试 The Graph 端点: ${endpoint}`);
        const response = await axios.post(
          endpoint,
          {
            query,
            variables: { limit },
          },
          {
            timeout: 15000,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.errors) {
          console.warn(`[Polymarket API] The Graph 错误 from ${endpoint}:`, JSON.stringify(response.data.errors, null, 2));
          continue;
        }

        const fills = response.data.data?.fills || [];
        if (fills.length > 0) {
          console.log(`[Polymarket API] ✅ 从 The Graph 获取到 ${fills.length} 条交易`);
          // 转换 The Graph 的数据格式到我们的格式
          return fills.map((fill: any) => ({
            maker_address: fill.maker || fill.taker || '',
            asset_id: fill.market?.id || fill.id || '',
            amount_usdc: parseFloat(fill.amount || fill.price || '0') * parseFloat(fill.price || '1'),
            timestamp: new Date(parseInt(fill.timestamp) * 1000).toISOString(),
          })).filter((trade: PolymarketTrade) => trade.maker_address && trade.asset_id);
        }
      } catch (error: any) {
        console.warn(`[Polymarket API] The Graph 端点 ${endpoint} 失败:`, error.message);
        continue;
      }
    }

    throw new Error('All The Graph endpoints failed');
  }

  /**
   * 使用 CLOB API 获取最近的交易
   */
  private async fetchTradesFromCLOB(limit: number): Promise<PolymarketTrade[]> {
    // CLOB API 可能的端点
    const endpoints = [
      'https://clob.polymarket.com/fills',
      'https://clob.polymarket.com/v1/fills',
      'https://clob.polymarket.com/api/fills',
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`[Polymarket API] 尝试 CLOB 端点: ${endpoint}`);
        const response = await axios.get(endpoint, {
          params: {
            limit,
            offset: 0,
          },
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        const fills = response.data.fills || response.data.data || response.data || [];
        if (Array.isArray(fills) && fills.length > 0) {
          console.log(`[Polymarket API] ✅ 从 CLOB API 获取到 ${fills.length} 条交易`);
          return fills
            .map((fill: any) => ({
              maker_address: fill.maker || fill.makerAddress || fill.user || '',
              asset_id: fill.assetId || fill.marketId || fill.market_id || '',
              amount_usdc: parseFloat(fill.amount || fill.amountUsdc || fill.amount_usdc || '0'),
              timestamp: fill.timestamp || fill.createdAt || fill.created_at || new Date().toISOString(),
            }))
            .filter((trade: PolymarketTrade) => trade.maker_address && trade.asset_id && trade.timestamp);
        }
      } catch (error: any) {
        console.warn(`[Polymarket API] CLOB 端点 ${endpoint} 失败:`, error.message);
        continue;
      }
    }

    throw new Error('All CLOB API endpoints failed');
  }

  /**
   * 使用 Data API 获取最近的交易
   */
  private async fetchTradesFromDataAPI(limit: number): Promise<PolymarketTrade[]> {
    const endpoints = [
      'https://data-api.polymarket.com/trades',
      'https://data-api.polymarket.com/v1/trades',
      'https://data-api.polymarket.com/api/trades',
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`[Polymarket API] 尝试 Data API 端点: ${endpoint}`);
        const response = await axios.get(endpoint, {
          params: {
            limit,
            offset: 0,
          },
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
          },
        });

        // Data API 返回的是数组，不是嵌套对象
        const trades = Array.isArray(response.data) ? response.data : (response.data.trades || response.data.data || []);
        if (Array.isArray(trades) && trades.length > 0) {
          console.log(`[Polymarket API] ✅ 从 Data API 获取到 ${trades.length} 条交易`);
          return trades
            .map((trade: any) => {
              // Data API 格式: proxyWallet, asset, size, price, timestamp
              const makerAddress = trade.proxyWallet || trade.maker_address || trade.maker || trade.user || trade.userAddress || '';
              const assetId = trade.asset || trade.asset_id || trade.assetId || trade.market_id || trade.marketId || trade.conditionId || '';
              // 计算金额: size * price
              const amount = trade.size && trade.price 
                ? parseFloat(trade.size) * parseFloat(trade.price)
                : parseFloat(trade.amount_usdc || trade.amount || trade.amountUsdc || trade.value || '0');
              // timestamp 可能是秒级时间戳
              const timestamp = trade.timestamp 
                ? (typeof trade.timestamp === 'number' && trade.timestamp < 10000000000
                    ? new Date(trade.timestamp * 1000).toISOString()
                    : new Date(trade.timestamp).toISOString())
                : (trade.created_at || trade.time || trade.createdAt || new Date().toISOString());
              
              return {
                maker_address: makerAddress,
                asset_id: assetId,
                amount_usdc: amount,
                timestamp: timestamp,
                side: (trade.side === 'BUY' || trade.side === 'SELL') ? trade.side : undefined,
                title: trade.title || trade.slug || undefined,
                conditionId: trade.conditionId || undefined,
              };
            })
            .filter((trade: PolymarketTrade) => trade.maker_address && trade.asset_id && trade.timestamp);
        }
      } catch (error: any) {
        console.warn(`[Polymarket API] Data API 端点 ${endpoint} 失败:`, error.message);
        continue;
      }
    }

    throw new Error('All Data API endpoints failed');
  }


  /**
   * 生成模拟数据用于测试（当 API 不可用时）
   */
  private generateMockTrades(limit: number): PolymarketTrade[] {
    const mockTrades: PolymarketTrade[] = [];
    const now = new Date();

    for (let i = 0; i < limit; i++) {
      const timestamp = new Date(now.getTime() - i * 60000); // 每分钟一条
      mockTrades.push({
        maker_address: `0x${Math.random().toString(16).substring(2, 42)}`,
        asset_id: `asset_${Math.floor(Math.random() * 100)}`,
        amount_usdc: Math.random() * 1000 + 10,
        timestamp: timestamp.toISOString(),
      });
    }

    return mockTrades;
  }

  /**
   * 获取最近的交易数据
   * @param limit 获取的交易数量，默认 50
   * @param useMockData 是否使用模拟数据（用于测试），默认 false
   * @returns 交易列表
   */
  async fetchRecentTrades(limit: number = 50, useMockData: boolean = false): Promise<PolymarketTrade[]> {
    // 如果启用模拟数据，直接返回
    if (useMockData) {
      console.log('⚠️  [Polymarket API] 使用模拟数据模式');
      return this.generateMockTrades(limit);
    }

    console.log(`[Polymarket API] 开始获取最近 ${limit} 条交易...`);

    // 按优先级尝试不同的 API
    const errors: string[] = [];

    // 1. 优先尝试 The Graph（链上数据，最可靠）
    try {
      const trades = await this.fetchTradesFromTheGraph(limit);
      if (trades && trades.length > 0) {
        return this.processTrades(trades, limit);
      }
    } catch (error: any) {
      errors.push(`The Graph: ${error.message}`);
      console.warn(`[Polymarket API] The Graph 失败: ${error.message}`);
    }

    // 2. 尝试 Data API（通常最可靠）
    try {
      const trades = await this.fetchTradesFromDataAPI(limit);
      if (trades && trades.length > 0) {
        return this.processTrades(trades, limit);
      }
    } catch (error: any) {
      errors.push(`Data API: ${error.message}`);
      console.warn(`[Polymarket API] Data API 失败: ${error.message}`);
    }

    // 3. 尝试 CLOB API
    try {
      const trades = await this.fetchTradesFromCLOB(limit);
      if (trades && trades.length > 0) {
        return this.processTrades(trades, limit);
      }
    } catch (error: any) {
      errors.push(`CLOB API: ${error.message}`);
      console.warn(`[Polymarket API] CLOB API 失败: ${error.message}`);
    }

    // 所有 API 都失败，抛出详细错误
    const errorMessage = `所有 Polymarket API 端点都失败:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n请检查:\n1. 网络连接\n2. API 端点是否正确\n3. 是否需要 API 密钥\n4. 查看 Polymarket 官方文档: https://docs.polymarket.com/`;
    console.error(`[Polymarket API] ❌ ${errorMessage}`);
    throw new Error(errorMessage);
  }

  /**
   * 处理和验证交易数据
   */
  private processTrades(trades: PolymarketTrade[], limit: number): PolymarketTrade[] {
    // 数据验证和清理
    const validTrades = trades
      .filter((trade) => {
        // 验证必需字段
        return (
          trade.maker_address &&
          trade.asset_id &&
          trade.amount_usdc > 0 &&
          trade.timestamp
        );
      })
      .map((trade) => ({
        ...trade,
        amount_usdc: parseFloat(String(trade.amount_usdc)),
        maker_address: trade.maker_address.toLowerCase(), // 标准化地址
      }));

    // 去重处理
    const uniqueTrades = validTrades.filter((trade) => {
      const key = getTradeKey(trade);
      if (this.processedTrades.has(key)) {
        return false; // 已处理过，跳过
      }
      this.processedTrades.add(key);
      return true;
    });

    console.log(`[Polymarket API] ✅ 处理完成: ${validTrades.length} 条有效交易, ${uniqueTrades.length} 条去重后交易`);

    // 限制返回数量
    return uniqueTrades.slice(0, limit);
  }

  /**
   * 清除已处理的交易记录（用于重置去重状态）
   */
  clearProcessedTrades(): void {
    this.processedTrades.clear();
  }

  /**
   * 获取已处理的交易数量
   */
  getProcessedCount(): number {
    return this.processedTrades.size;
  }
}

// 导出单例实例
const polymarketClient = new PolymarketClient();

/**
 * 获取最近的交易数据
 * @param limit 获取的交易数量，默认 50
 * @param useMockData 是否使用模拟数据（用于测试），默认 false
 * @returns 交易列表
 */
export async function fetchRecentTrades(limit: number = 50, useMockData: boolean = false): Promise<PolymarketTrade[]> {
  return polymarketClient.fetchRecentTrades(limit, useMockData);
}

/**
 * 清除已处理的交易记录
 */
export function clearProcessedTrades(): void {
  polymarketClient.clearProcessedTrades();
}

/**
 * 获取已处理的交易数量
 */
export function getProcessedCount(): number {
  return polymarketClient.getProcessedCount();
}

