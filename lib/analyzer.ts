import { createPublicClient, http, Address, PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import { prisma } from './prisma';

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
 * 使用多种方法尝试获取，包括多个区块链浏览器 API
 */
async function getFirstTransactionTime(
  client: PublicClient,
  address: Address
): Promise<Date | null> {
  try {
    // 方法1: 尝试使用 Polygonscan API（如果可用）
    const polygonscanApiKey = process.env.POLYGONSCAN_API_KEY;
    if (polygonscanApiKey) {
      try {
        const response = await fetch(
          `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${polygonscanApiKey}`
        );
        const data = await response.json();
        if (data.status === '1' && data.result && data.result.length > 0) {
          const firstTx = data.result[0];
          return new Date(parseInt(firstTx.timeStamp) * 1000);
        }
      } catch (error) {
        console.warn('[Analyzer] Polygonscan API 失败，尝试其他方法:', error);
      }
    }

    // 方法2: 尝试使用 Alchemy API（免费，无需 API Key 的基础查询）
    try {
      const alchemyUrl = process.env.ALCHEMY_POLYGON_URL || 'https://polygon-mainnet.g.alchemy.com/v2/demo';
      const response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionCount',
          params: [address, 'earliest'],
        }),
      });
      const data = await response.json();
      if (data.result && data.result !== '0x0') {
        // 有交易，但无法直接获取时间，继续尝试其他方法
      }
    } catch (error) {
      // Alchemy 失败，继续
    }

    // 方法3: 使用 QuickNode 或其他公共 RPC（如果配置了）
    try {
      const quicknodeUrl = process.env.QUICKNODE_POLYGON_URL;
      if (quicknodeUrl) {
        const response = await fetch(quicknodeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionCount',
            params: [address, 'earliest'],
          }),
        });
        const data = await response.json();
        // QuickNode 通常也提供交易历史查询
      }
    } catch (error) {
      // QuickNode 失败，继续
    }

    // 方法4: 使用 nonce 推断（如果 nonce = 0，说明是新钱包）
    try {
      const nonce = await client.getTransactionCount({ address });
      if (nonce === 0) {
        // 新钱包，返回当前时间（这是一个近似值）
        console.log(`[Analyzer] 钱包 ${address} nonce=0，推断为新钱包`);
        return new Date();
      }

      // 方法5: 尝试通过查询最近的区块来估算钱包年龄
      // 这是一个启发式方法：如果 nonce 很小，可能是新钱包
      if (nonce < 5) {
        // 假设钱包创建时间在最近几天内
        const estimatedAge = nonce * 24; // 假设每笔交易间隔24小时
        const estimatedCreationTime = new Date(Date.now() - estimatedAge * 60 * 60 * 1000);
        console.log(`[Analyzer] 钱包 ${address} nonce=${nonce}，估算创建时间: ${estimatedCreationTime.toISOString()}`);
        return estimatedCreationTime;
      }

      // 对于交易较多的钱包，无法准确判断创建时间
      // 返回 null，让调用者知道无法确定
      console.log(`[Analyzer] 钱包 ${address} nonce=${nonce}，无法准确判断创建时间`);
      return null;
    } catch (error) {
      console.error('[Analyzer] 查询 nonce 失败:', error);
      return null;
    }
  } catch (error) {
    console.error('[Analyzer] 获取第一笔交易时间失败:', error);
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
    const wallet = await prisma.monitoredWallet.findUnique({
      where: { address: address.toLowerCase() },
      include: {
        tradeEvents: {
          select: {
            marketId: true,
          },
        },
      },
    });

    if (!wallet || wallet.tradeEvents.length === 0) {
      return 0;
    }

    // 统计不同的市场ID
    const uniqueMarkets = new Set(wallet.tradeEvents.map((event: { marketId: string }) => event.marketId));
    return uniqueMarkets.size;
  } catch (error) {
    console.error('查询市场参与度失败:', error);
    return 0;
  }
}

/**
 * 获取资金来源（第一笔入金交易的发送地址）
 */
async function getFundingSource(
  client: PublicClient,
  address: Address
): Promise<string | null> {
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
      // 无法确定钱包创建时间时，使用启发式方法
      // 如果 nonce 很小（< 5），仍然给予部分分数
      const nonce = await getTransactionCount(client, walletAddress);
      if (nonce < 5) {
        // 给予部分分数（30分），因为很可能是新钱包
        score += 30;
        checks.walletAge.score = 30;
        checks.walletAge.passed = true;
        details.push(`无法准确确定钱包创建时间，但交易次数很少（${nonce}次），推断可能为新钱包，风险分 +30`);
      } else {
        details.push('无法确定钱包创建时间（建议配置 Polygonscan API Key 或 Alchemy 以获得更准确的结果）');
      }
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

