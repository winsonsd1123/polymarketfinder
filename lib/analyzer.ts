import { createPublicClient, http, Address, PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import { supabase, TABLES } from './supabase';

/**
 * 钱包分析结果
 */
export interface WalletAnalysisResult {
  isSuspicious: boolean; // 是否可疑
  score: number; // 风险评分 (0-100)
  details: string; // 详细信息
  checks: {
    walletAge: {
      passed: boolean;
      score: number;
      ageHours: number | null;
      firstTxTime: Date | null;
    };
    transactionCount: {
      passed: boolean;
      score: number;
      nonce: number | null;
    };
    marketParticipation: {
      passed: boolean;
      score: number;
      marketCount: number;
    };
    transactionAmount?: {
      passed: boolean;
      score: number;
      amount: number;
    };
    wcTxGap?: {
      passed: boolean;
      score: number;
      gapHours: number | null;
      gapPercentage: number | null;
    };
    transactionRecency?: {
      passed: boolean;
      score: number;
      hoursSinceTransaction: number | null;
    };
    fundingSource?: {
      passed: boolean;
      sourceAddress: string | null;
    };
  };
}

/**
 * 获取 Polygon RPC URL
 */
function getPolygonRpcUrl(): string {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  if (!rpcUrl) {
    // 使用公共 RPC 端点作为备选
    return 'https://polygon-rpc.com';
  }
  return rpcUrl;
}

/**
 * 创建 Polygon 公共客户端
 */
function createPolygonClient(): PublicClient {
  return createPublicClient({
    chain: polygon,
    transport: http(getPolygonRpcUrl(), {
      timeout: 30000,
    }),
  });
}

/**
 * 获取钱包的第一笔交易时间
 * 使用基于 nonce 的启发式方法，不依赖外部 API（如 Polygonscan）
 */
async function getFirstTransactionTime(
  client: PublicClient,
  address: Address
): Promise<Date | null> {
  try {
    // 优先方法：使用 nonce 推断钱包年龄（不依赖外部 API）
    const nonce = await client.getTransactionCount({ address });
    
    if (nonce === 0) {
      // nonce = 0 表示钱包从未发送过交易，可能是全新钱包
      // 返回当前时间，表示"刚刚创建"
      console.log(`[Analyzer] 钱包 ${address} nonce=0，推断为新钱包（刚创建）`);
      return new Date();
    }

    // 如果 nonce 很小（< 10），使用启发式方法估算钱包年龄
    if (nonce < 10) {
      // 启发式规则：
      // - nonce = 1: 假设钱包创建于 12 小时前（保守估计）
      // - nonce = 2-5: 假设每笔交易间隔 12-24 小时
      // - nonce = 6-9: 假设每笔交易间隔 24-48 小时
      let estimatedAgeHours: number;
      if (nonce === 1) {
        estimatedAgeHours = 12; // 保守估计：12小时
      } else if (nonce <= 5) {
        estimatedAgeHours = nonce * 12; // 每笔交易间隔12小时
      } else {
        estimatedAgeHours = 5 * 12 + (nonce - 5) * 24; // 前5笔每12小时，之后每24小时
      }
      
      const estimatedCreationTime = new Date(Date.now() - estimatedAgeHours * 60 * 60 * 1000);
      console.log(`[Analyzer] 钱包 ${address} nonce=${nonce}，估算创建时间: ${estimatedCreationTime.toISOString()} (约 ${estimatedAgeHours.toFixed(1)} 小时前)`);
      return estimatedCreationTime;
    }

    // 对于交易较多的钱包（nonce >= 10），无法准确判断创建时间
    // 返回 null，让调用者知道无法确定
    console.log(`[Analyzer] 钱包 ${address} nonce=${nonce}，交易较多，无法准确判断创建时间`);
    return null;
  } catch (error) {
    console.error('[Analyzer] 查询 nonce 失败:', error);
    return null;
  }
}

/**
 * 获取钱包的交易计数（nonce）
 */
async function getTransactionCount(client: PublicClient, address: Address): Promise<number> {
  try {
    const nonce = await client.getTransactionCount({ address });
    return nonce;
  } catch (error) {
    console.error('获取交易计数失败:', error);
    return 0;
  }
}

/**
 * 获取钱包参与的市场数量
 */
async function getMarketParticipationCount(address: string): Promise<number> {
  try {
    // 查询数据库中该钱包参与的不同市场数量
    const { data: wallet, error: walletError } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .select('id')
      .eq('address', address.toLowerCase())
      .single();

    if (walletError || !wallet) {
      return 0;
    }

    // 获取该钱包的所有交易事件的市场ID
    const { data: tradeEvents, error: tradesError } = await supabase
      .from(TABLES.TRADE_EVENTS)
      .select('marketId')
      .eq('walletId', wallet.id);

    if (tradesError || !tradeEvents || tradeEvents.length === 0) {
      return 0;
    }

    // 统计不同的市场ID
    const uniqueMarkets = new Set(tradeEvents.map((event: { marketId: string }) => event.marketId));
    return uniqueMarkets.size;
  } catch (error) {
    console.error('查询市场参与度失败:', error);
    return 0;
  }
}

/**
 * 获取资金来源（第一笔入金交易的发送地址）
 * 注意：由于 Polygonscan API 不稳定，此功能暂时禁用
 * 未来可以通过其他方式实现（如 Alchemy、The Graph 等）
 */
async function getFundingSource(
  client: PublicClient,
  address: Address
): Promise<string | null> {
  // 暂时禁用，因为 Polygonscan API 不稳定
  // 未来可以考虑使用其他数据源（Alchemy、The Graph 等）
  return null;
  
  /* 原实现（已禁用）
  try {
    const polygonscanApiKey = process.env.POLYGONSCAN_API_KEY;
    if (polygonscanApiKey) {
      const response = await fetch(
        `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${polygonscanApiKey}`
      );
      const data = await response.json();
      if (data.status === '1' && data.result && data.result.length > 0) {
        const firstTx = data.result[0];
        // 如果是入金交易（to 地址是当前地址）
        if (firstTx.to?.toLowerCase() === address.toLowerCase()) {
          return firstTx.from;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('获取资金来源失败:', error);
    return null;
  }
  */
}

/**
 * 分析钱包是否为可疑钱包
 * @param address 钱包地址
 * @param currentTradeAmount 当前交易的金额（USDC），用于检查单笔交易规模
 * @param currentTradeTime 当前交易的时间戳，用于检查交易发生时间
 * @returns 分析结果
 */
export async function analyzeWallet(
  address: string,
  currentTradeAmount?: number,
  currentTradeTime?: Date
): Promise<WalletAnalysisResult> {
  let score = 0;
  const details: string[] = [];
  const checks: WalletAnalysisResult['checks'] = {
    walletAge: {
      passed: false,
      score: 0,
      ageHours: null,
      firstTxTime: null,
    },
    transactionCount: {
      passed: false,
      score: 0,
      nonce: null,
    },
    marketParticipation: {
      passed: false,
      score: 0,
      marketCount: 0,
    },
  };

  try {
    // 验证地址格式
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return {
        isSuspicious: false,
        score: 0,
        details: '无效的钱包地址格式',
        checks,
      };
    }

    const walletAddress = address as Address;
    const client = createPolygonClient();

    // 1. 检查钱包年龄（< 24小时，+50分）
    const firstTxTime = await getFirstTransactionTime(client, walletAddress);
    if (firstTxTime) {
      const now = new Date();
      const ageMs = now.getTime() - firstTxTime.getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      checks.walletAge.ageHours = ageHours;
      checks.walletAge.firstTxTime = firstTxTime;

      if (ageHours < 24) {
        score += 50;
        checks.walletAge.score = 50;
        checks.walletAge.passed = true;
        details.push(`钱包创建时间小于 24 小时（${ageHours.toFixed(2)} 小时），风险分 +50`);
      } else {
        details.push(`钱包创建时间: ${ageHours.toFixed(2)} 小时前`);
      }
    } else {
      // 无法确定钱包创建时间（nonce >= 10 的情况）
      // 这种情况下，钱包年龄检查不给予分数
      details.push(`无法确定钱包创建时间（交易次数较多，nonce >= 10）`);
    }

    // 2. 检查交易次数（nonce < 10，+30分）
    const nonce = await getTransactionCount(client, walletAddress);
    checks.transactionCount.nonce = nonce;

    if (nonce < 10) {
      score += 30;
      checks.transactionCount.score = 30;
      checks.transactionCount.passed = true;
      details.push(`交易次数少于 10 次（${nonce} 次），风险分 +30`);
    }

    // 3. 检查市场参与度（< 3个市场，+20分）
    const marketCount = await getMarketParticipationCount(address);
    checks.marketParticipation.marketCount = marketCount;

    if (marketCount > 0 && marketCount < 3) {
      score += 20;
      checks.marketParticipation.score = 20;
      checks.marketParticipation.passed = true;
      details.push(`参与市场数量少于 3 个（${marketCount} 个），风险分 +20`);
    } else if (marketCount === 0) {
      details.push('该钱包在数据库中暂无交易记录');
    }

    // 4. 检查单笔交易规模（> $10,000，+10分）- 截图规则
    if (currentTradeAmount !== undefined && currentTradeAmount > 10000) {
      score += 10;
      checks.transactionAmount = {
        passed: true,
        score: 10,
        amount: currentTradeAmount,
      };
      details.push(`单笔交易规模超过 1 万美元（$${currentTradeAmount.toFixed(2)}），风险分 +10`);
    } else if (currentTradeAmount !== undefined) {
      checks.transactionAmount = {
        passed: false,
        score: 0,
        amount: currentTradeAmount,
      };
    }

    // 5. 检查 wc/tx 时间（钱包创建到第一次交易的时间 < 20%，+15分）- 截图规则
    if (firstTxTime && currentTradeTime) {
      const walletCreationToFirstTx = currentTradeTime.getTime() - firstTxTime.getTime();
      const walletAge = new Date().getTime() - firstTxTime.getTime();
      const gapPercentage = (walletCreationToFirstTx / walletAge) * 100;
      const gapHours = walletCreationToFirstTx / (1000 * 60 * 60);

      checks.wcTxGap = {
        passed: false,
        score: 0,
        gapHours,
        gapPercentage,
      };

      if (gapPercentage < 20) {
        score += 15;
        checks.wcTxGap.score = 15;
        checks.wcTxGap.passed = true;
        details.push(`wc/tx 低于 20%（${gapPercentage.toFixed(2)}%），风险分 +15`);
      }
    }

    // 6. 检查交易发生时间（距离现在 < 5小时，+10分）- 截图规则
    if (currentTradeTime) {
      const now = new Date();
      const hoursSinceTransaction = (now.getTime() - currentTradeTime.getTime()) / (1000 * 60 * 60);
      
      checks.transactionRecency = {
        passed: false,
        score: 0,
        hoursSinceTransaction,
      };

      if (hoursSinceTransaction < 5) {
        score += 10;
        checks.transactionRecency.score = 10;
        checks.transactionRecency.passed = true;
        details.push(`距离交易发生时间不超过 5 小时（${hoursSinceTransaction.toFixed(2)} 小时），风险分 +10`);
      }
    }

    // 7. 检查资金来源（可选）
    const fundingSource = await getFundingSource(client, walletAddress);
    if (fundingSource) {
      checks.fundingSource = {
        passed: true,
        sourceAddress: fundingSource,
      };
      details.push(`资金来源地址: ${fundingSource}`);
    }

    // 判断是否可疑（总分 >= 50 视为可疑）
    const isSuspicious = score >= 50;

    return {
      isSuspicious,
      score,
      details: details.join('; '),
      checks,
    };
  } catch (error) {
    console.error('分析钱包时出错:', error);
    return {
      isSuspicious: false,
      score: 0,
      details: `分析失败: ${error instanceof Error ? error.message : String(error)}`,
      checks,
    };
  }
}

