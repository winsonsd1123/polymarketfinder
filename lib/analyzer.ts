import { createPublicClient, http, Address, PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import { supabase, TABLES } from './supabase';
import type { PolymarketTrade } from './polymarket';

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
 * 通过 Alchemy API 获取钱包第一笔交易时间
 */
async function getFirstTxTimeFromAlchemy(address: Address): Promise<Date | null> {
  const alchemyUrl = process.env.ALCHEMY_POLYGON_URL;
  if (!alchemyUrl || alchemyUrl.includes('demo')) {
    console.error(`[验证模式] ALCHEMY_POLYGON_URL 未配置或无效: ${alchemyUrl || '未设置'}`);
    return null; // 没有配置有效的 Alchemy URL
  }

  try {
    console.log(`[验证模式] 🔍 正在通过 Alchemy API 查询钱包 ${address} 的第一笔交易...`);
    
    // 方法1: 先查询 fromAddress（钱包发送的交易）- 查询所有类型的交易
    let response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: address,
          category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'], // 查询所有类型的交易
          maxCount: '0x1', // 使用十六进制字符串格式
          order: 'asc', // 按时间升序，获取第一笔
        }],
      }),
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    let data = await response.json();
    let firstTransfer = null;

    // 如果 fromAddress 没有找到，尝试查询 toAddress（钱包接收的交易）
    if (!data.result?.transfers || data.result.transfers.length === 0) {
      console.log(`[验证模式] 📤 钱包 ${address} 没有发送交易，尝试查询接收交易...`);
      
      response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            toAddress: address,
            category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'], // 查询所有类型的交易
            maxCount: '0x1', // 使用十六进制字符串格式
            order: 'asc',
          }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      data = await response.json();
    }

    // 如果还是没有找到，说明钱包确实没有任何交易记录
    // 这种情况下，我们需要通过其他方式判断（比如查询 nonce）

    if (!response.ok) {
      console.error(`[验证模式] ❌ Alchemy API HTTP 错误: ${response.status} ${response.statusText}`);
      return null;
    }
    
    // 检查 API 错误
    if (data.error) {
      console.error(`[验证模式] ❌ Alchemy API 返回错误:`, JSON.stringify(data.error, null, 2));
      return null;
    }

    // 调试：打印完整响应
    if (!data.result) {
      console.error(`[验证模式] ❌ Alchemy API 响应中没有 result 字段:`, JSON.stringify(data, null, 2));
      return null;
    }

    if (!data.result.transfers || data.result.transfers.length === 0) {
      console.warn(`[验证模式] ⚠️  钱包 ${address} 在 Alchemy API 中没有找到任何交易记录`);
      console.warn(`[验证模式]   完整响应:`, JSON.stringify(data, null, 2));
      
      // 关键思考：钱包在 Polymarket 有交易，但 Alchemy 查不到，可能的原因：
      // 1. Polymarket 交易是链下撮合，只有结算上链（钱包可能不是直接参与者）
      // 2. 交易是通过合约调用完成的，Alchemy 的 getAssetTransfers 可能不包含所有合约调用
      // 3. 钱包可能只接收了代币，从未主动发送过交易
      // 4. 钱包可能是 Polymarket 的内部钱包或代理钱包地址
      
      // 尝试通过 RPC 查询 nonce 来验证钱包是否真的没有任何主动交易
      try {
        const client = createPolygonClient();
        const nonce = await client.getTransactionCount({ address });
        console.log(`[验证模式] 📊 钱包 ${address} 的 nonce: ${nonce}`);
        
        if (nonce === 0) {
          console.warn(`[验证模式] ⚠️  钱包 nonce=0，说明从未主动发送过交易`);
          console.warn(`[验证模式] 💡 钱包在 Polymarket 有交易，可能是通过其他方式（如被合约调用）完成的`);
          
          // 查询钱包余额，看看是否有资金
          try {
            const balance = await client.getBalance({ address });
            const balanceEth = Number(balance) / 1e18;
            console.log(`[验证模式] 💰 钱包余额: ${balanceEth.toFixed(6)} MATIC`);
            
            if (balance > BigInt(0)) {
              console.warn(`[验证模式] 💡 钱包有余额，说明确实有资金流入，但无法确定资金来源和创建时间`);
              console.warn(`[验证模式] 💡 可能是 Polymarket 的内部钱包或代理钱包`);
            } else {
              console.warn(`[验证模式] 💡 钱包余额为 0，可能是临时钱包或已清空`);
            }
          } catch (balanceError) {
            console.warn(`[验证模式] ⚠️  查询余额失败:`, balanceError);
          }
          
          console.warn(`[验证模式] 💡 这种情况下，钱包创建时间无法准确确定，返回当前时间作为保守估计`);
          // 对于这种情况，返回当前时间作为创建时间（保守估计）
          return new Date();
        } else {
          console.warn(`[验证模式] ⚠️  钱包 nonce=${nonce}，说明有 ${nonce} 笔主动交易`);
          console.warn(`[验证模式] ⚠️  但 Alchemy API 查询不到，可能是：`);
          console.warn(`[验证模式]    1. API 数据同步延迟`);
          console.warn(`[验证模式]    2. API 查询范围限制（某些交易类型未包含）`);
          console.warn(`[验证模式]    3. 交易是通过特殊合约完成的，不在标准交易类型中`);
          // nonce > 0 但查询不到交易，说明 Alchemy API 可能有问题
          throw new Error(`[验证模式] 钱包 nonce=${nonce}（有 ${nonce} 笔主动交易）但 Alchemy API 查询不到交易记录。钱包在 Polymarket 有交易，说明交易确实存在，但 Alchemy API 可能无法查询到这些交易。`);
        }
      } catch (rpcError) {
        console.error(`[验证模式] ❌ RPC 查询 nonce 失败:`, rpcError);
        // RPC 查询失败，返回 null
        return null;
      }
    }

    firstTransfer = data.result.transfers[0];
    console.log(`[验证模式] 📦 找到第一笔交易:`, JSON.stringify({
      hash: firstTransfer.hash,
      blockNum: firstTransfer.blockNum,
      metadata: firstTransfer.metadata,
    }, null, 2));

    // 方法1: 尝试从 metadata.blockTimestamp 获取
    if (firstTransfer.metadata?.blockTimestamp) {
      const timestamp = parseInt(firstTransfer.metadata.blockTimestamp);
      const date = new Date(timestamp * 1000);
      console.log(`[验证模式] ✅ 从 metadata.blockTimestamp 解析到时间戳: ${timestamp} -> ${date.toISOString()}`);
      return date;
    }

    // 方法2: 如果没有 blockTimestamp，通过 blockNum 查询区块时间戳
    if (firstTransfer.blockNum) {
      try {
        console.log(`[验证模式] 🔍 metadata 中没有 blockTimestamp，尝试通过区块号 ${firstTransfer.blockNum} 查询...`);
        const client = createPolygonClient();
        const blockNumber = BigInt(firstTransfer.blockNum);
        const block = await client.getBlock({ blockNumber });
        
        if (block && block.timestamp) {
          const date = new Date(Number(block.timestamp) * 1000);
          console.log(`[验证模式] ✅ 通过区块号查询到时间戳: ${block.timestamp} -> ${date.toISOString()}`);
          return date;
        }
      } catch (blockError) {
        console.error(`[验证模式] ❌ 通过区块号查询时间戳失败:`, blockError);
      }
    }

    // 方法3: 如果都失败了，尝试通过 Alchemy API 查询区块信息
    if (firstTransfer.blockNum) {
      try {
        console.log(`[验证模式] 🔍 尝试通过 Alchemy API 查询区块 ${firstTransfer.blockNum} 的时间戳...`);
        const blockResponse = await fetch(alchemyUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 999,
            method: 'eth_getBlockByNumber',
            params: [firstTransfer.blockNum, false], // false 表示不返回完整交易数据
          }),
          signal: AbortSignal.timeout(10000),
        });

        const blockData = await blockResponse.json();
        if (blockData.result && blockData.result.timestamp) {
          const timestamp = parseInt(blockData.result.timestamp, 16); // 十六进制转十进制
          const date = new Date(timestamp * 1000);
          console.log(`[验证模式] ✅ 通过 Alchemy API 查询到区块时间戳: ${timestamp} -> ${date.toISOString()}`);
          return date;
        }
      } catch (alchemyBlockError) {
        console.error(`[验证模式] ❌ 通过 Alchemy API 查询区块时间戳失败:`, alchemyBlockError);
      }
    }

    console.error(`[验证模式] ❌ 无法获取第一笔交易的时间戳:`, JSON.stringify(firstTransfer, null, 2));
    return null;
  } catch (error) {
    console.error(`[验证模式] ❌ Alchemy API 调用异常:`, error);
    if (error instanceof Error) {
      console.error(`[验证模式]   错误信息: ${error.message}`);
      console.error(`[验证模式]   错误堆栈: ${error.stack}`);
    }
    return null;
  }
}

/**
 * 获取钱包的第一笔交易时间
 * 【验证模式】仅使用 Alchemy API，如果查不到则抛出错误
 */
async function getFirstTransactionTime(
  client: PublicClient,
  address: Address
): Promise<Date> {
  const alchemyUrl = process.env.ALCHEMY_POLYGON_URL;
  
  if (!alchemyUrl || alchemyUrl.includes('demo')) {
    throw new Error(`[验证模式] ALCHEMY_POLYGON_URL 未配置或无效: ${alchemyUrl || '未设置'}`);
  }

  try {
    // 仅使用 Alchemy API
    const alchemyTime = await getFirstTxTimeFromAlchemy(address);
    
    if (!alchemyTime) {
      throw new Error(`[验证模式] 无法通过 Alchemy API 获取钱包 ${address} 的第一笔交易时间`);
    }

    console.log(`[验证模式] ✅ 通过 Alchemy API 获取到钱包 ${address} 的第一笔交易时间: ${alchemyTime.toISOString()}`);
    return alchemyTime;
  } catch (error) {
    // 如果是我们抛出的错误，直接重新抛出
    if (error instanceof Error && error.message.includes('[验证模式]')) {
      throw error;
    }
    // 其他错误也抛出，停止扫描
    throw new Error(`[验证模式] Alchemy API 调用失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取钱包的交易计数（使用 Alchemy API 统计所有类型的发送交易）
 * 只统计发送的交易（fromAddress），不统计接收的交易
 */
async function getTransactionCount(client: PublicClient, address: Address): Promise<number> {
  const alchemyUrl = process.env.ALCHEMY_POLYGON_URL;
  
  // 如果配置了 Alchemy API，使用它来统计所有类型的发送交易
  if (alchemyUrl && !alchemyUrl.includes('demo')) {
    try {
      console.log(`[交易统计] 🔍 正在通过 Alchemy API 统计钱包 ${address} 的发送交易...`);
      
      const response = await fetch(alchemyUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            fromAddress: address,
            category: ['external', 'internal', 'erc20', 'erc721', 'erc1155', 'specialnft'],
            maxCount: '0x3e8', // 最多查询1000条，用于统计
            order: 'desc',
          }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await response.json();
      
      if (data.error) {
        console.warn(`[交易统计] ⚠️  Alchemy API 错误，回退到 nonce:`, data.error);
        // 回退到 nonce
        return await client.getTransactionCount({ address });
      }

      const transfers = data.result?.transfers || [];
      const totalCount = transfers.length;
      
      console.log(`[交易统计] ✅ 钱包 ${address} 的发送交易总数: ${totalCount} 笔（包括所有类型）`);
      
      // 如果查询到的数量达到1000，说明可能还有更多，但至少是1000+
      if (totalCount >= 1000) {
        console.log(`[交易统计] ⚠️  交易数量达到查询上限（1000），实际数量可能更多`);
      }
      
      return totalCount;
    } catch (error) {
      console.warn(`[交易统计] ⚠️  Alchemy API 调用失败，回退到 nonce:`, error);
      // 如果 Alchemy API 失败，回退到使用 nonce
    }
  }
  
  // 回退方案：使用 nonce（只统计外部交易）
  try {
    const nonce = await client.getTransactionCount({ address });
    console.log(`[交易统计] 📊 钱包 ${address} 的 nonce: ${nonce}（仅外部交易）`);
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
 * 获取最小交易金额阈值（从环境变量读取，默认 5000）
 * 只有交易金额超过此阈值才会进行可疑钱包分析
 */
function getMinTradeAmountForAnalysis(): number {
  const minAmount = process.env.MIN_TRADE_AMOUNT_FOR_ANALYSIS;
  return minAmount ? parseFloat(minAmount) : 5000;
}

/**
 * 分析钱包是否为可疑钱包
 * @param address 钱包地址
 * @param currentTrades 本次扫描中该钱包的所有交易记录
 * @param currentTradeAmount 当前交易的金额（USDC），用于检查单笔交易规模（使用第一笔交易的金额）
 * @param currentTradeTime 当前交易的时间戳，用于检查交易发生时间（使用第一笔交易的时间）
 * @returns 分析结果
 */
export async function analyzeWallet(
  address: string,
  currentTrades: PolymarketTrade[],
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

    // 【优化】先检查交易金额阈值，如果金额不足，直接返回0分，避免不必要的API调用
    const minTradeAmount = getMinTradeAmountForAnalysis();
    const maxTradeAmount = currentTrades.length > 0 
      ? Math.max(...currentTrades.map(t => t.amount_usdc))
      : (currentTradeAmount || 0);
    
    if (maxTradeAmount < minTradeAmount) {
      details.push(`交易金额过小（$${maxTradeAmount.toFixed(2)} < $${minTradeAmount}），跳过分析，直接判定为0分`);
      return {
        isSuspicious: false,
        score: 0,
        details: details.join('; '),
        checks,
      };
    }

    const walletAddress = address as Address;
    const client = createPolygonClient();

    // 1. 检查钱包年龄（< 24小时，+50分）
    // 【验证模式】必须通过 Alchemy API 获取，失败则抛出错误
    const firstTxTime = await getFirstTransactionTime(client, walletAddress);
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

    // 2. 检查交易次数（发送交易 < 10，+30分）
    // 使用 Alchemy API 统计所有类型的发送交易（包括 ERC-20、ERC-1155 等）
    const transactionCount = await getTransactionCount(client, walletAddress);
    checks.transactionCount.nonce = transactionCount;

    if (transactionCount < 10) {
      score += 30;
      checks.transactionCount.score = 30;
      checks.transactionCount.passed = true;
      details.push(`发送交易次数少于 10 次（${transactionCount} 次，包括所有类型），风险分 +30`);
    } else {
      details.push(`发送交易次数: ${transactionCount} 次（包括所有类型）`);
    }

    // 3. 检查市场参与度（< 3个市场，+20分）
    // 需要合并数据库中的历史记录和本次扫描的交易记录
    const dbMarketCount = await getMarketParticipationCount(address);
    
    // 统计本次扫描中该钱包参与的不同市场
    const currentScanMarkets = new Set<string>();
    for (const trade of currentTrades) {
      if (trade.asset_id) {
        currentScanMarkets.add(trade.asset_id);
      }
    }
    
    // 如果钱包已存在于数据库中，需要检查本次扫描的市场是否已经在数据库中记录过
    const { data: existingWallet } = await supabase
      .from(TABLES.MONITORED_WALLETS)
      .select('id')
      .eq('address', address.toLowerCase())
      .single();
    
    let newMarketsFromScan = 0;
    if (existingWallet) {
      // 钱包已存在，检查本次扫描的市场中哪些是新的
      for (const marketId of currentScanMarkets) {
        const { data: existingTrade } = await supabase
          .from(TABLES.TRADE_EVENTS)
          .select('marketId')
          .eq('walletId', existingWallet.id)
          .eq('marketId', marketId)
          .limit(1)
          .single();
        
        // 如果这个市场在数据库中不存在，说明是本次扫描新增的
        if (!existingTrade) {
          newMarketsFromScan++;
        }
      }
    } else {
      // 钱包不存在于数据库中，本次扫描的所有市场都是新的
      newMarketsFromScan = currentScanMarkets.size;
    }
    
    // 总市场数 = 数据库中的市场数 + 本次扫描新增的市场数
    const totalMarketCount = dbMarketCount + newMarketsFromScan;
    
    checks.marketParticipation.marketCount = totalMarketCount;

    // 修复：totalMarketCount = 0 或 1 或 2 都应该加分（< 3个市场）
    if (totalMarketCount < 3) {
      score += 20;
      checks.marketParticipation.score = 20;
      checks.marketParticipation.passed = true;
      if (totalMarketCount === 0) {
        details.push(`参与市场数量为 0（新钱包，仅当前交易），风险分 +20`);
      } else {
        const detailMsg = dbMarketCount > 0 
          ? `参与市场数量少于 3 个（总计 ${totalMarketCount} 个：数据库 ${dbMarketCount} 个 + 本次扫描 ${newMarketsFromScan} 个），风险分 +20`
          : `参与市场数量少于 3 个（${totalMarketCount} 个），风险分 +20`;
        details.push(detailMsg);
      }
    } else {
      const detailMsg = dbMarketCount > 0
        ? `参与市场数量 >= 3 个（总计 ${totalMarketCount} 个：数据库 ${dbMarketCount} 个 + 本次扫描 ${newMarketsFromScan} 个）`
        : `参与市场数量 >= 3 个（${totalMarketCount} 个）`;
      details.push(detailMsg);
    }

    // 4. 检查单笔交易规模（> $10,000，+10分）- 截图规则
    // 使用本次扫描中最大单笔交易金额（已在函数开头计算）
    if (maxTradeAmount > 10000) {
      score += 10;
      checks.transactionAmount = {
        passed: true,
        score: 10,
        amount: maxTradeAmount,
      };
      details.push(`单笔交易规模超过 1 万美元（$${maxTradeAmount.toFixed(2)}），风险分 +10`);
    } else if (maxTradeAmount > 0) {
      checks.transactionAmount = {
        passed: false,
        score: 0,
        amount: maxTradeAmount,
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
    // 注意：金额阈值检查已在函数开头完成，这里不需要再次检查
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

