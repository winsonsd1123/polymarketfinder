'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  formatAddress,
  formatRelativeTime,
  formatTimeWithRelative,
  calculateWcTxGap,
  getRiskScoreColor,
  copyToClipboard,
} from '@/lib/formatters';

interface Wallet {
  id: number; // bigint
  address: string;
  riskScore: number;
  fundingSource: string | null;
  createdAt: string; // 记录创建时间（北京时间）
  walletCreatedAt: string | null; // 钱包在链上的创建时间（北京时间）
  lastActiveAt: string | null;
  firstTradeTime: string | null;
  markets: Array<{ id: string; title: string }>;
  tradeCount: number;
}

interface Trade {
  id: number; // bigint
  marketId: string;
  marketTitle: string;
  amount: number;
  amountUsdc: number;
  isBuy: boolean;
  direction: string;
  outcome: string | null; // YES 或 NO
  timestamp: string;
  createdAt: string;
}

interface ScanLog {
  id: number; // bigint
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  totalTrades: number;
  processedWallets: number;
  newWallets: number;
  suspiciousWallets: number;
  skippedWallets: number;
  errors: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface AnalysisHistory {
  id: number; // bigint
  walletAddress: string;
  totalScore: number;
  isSuspicious: boolean;
  analysisDetails: string | null;
  walletAgeScore: number;
  walletAgeHours: number | null;
  walletCreatedAt: string | null; // 钱包在链上的创建时间（北京时间）
  transactionCountScore: number;
  transactionCountNonce: number | null;
  marketParticipationScore: number;
  marketParticipationCount: number;
  transactionAmountScore: number;
  transactionAmount: number | null;
  wcTxGapScore: number;
  wcTxGapPercentage: number | null;
  transactionRecencyScore: number;
  transactionRecencyHours: number | null;
  fundingSource: string | null;
  analyzedAt: string;
  createdAt: string;
}

export default function Home() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [walletTrades, setWalletTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [loadingScanLogs, setLoadingScanLogs] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchAddress, setHistorySearchAddress] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // 获取钱包列表
  const fetchWallets = async () => {
    try {
      const response = await fetch('/api/wallets', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setWallets(data.data);
      }
    } catch (error) {
      console.error('获取钱包列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取扫描日志
  const fetchScanLogs = async () => {
    setLoadingScanLogs(true);
    try {
      const response = await fetch('/api/scan-logs?limit=5');
      const data = await response.json();
      if (data.success) {
        setScanLogs(data.data);
      }
    } catch (error) {
      console.error('获取扫描日志失败:', error);
    } finally {
      setLoadingScanLogs(false);
    }
  };

  // 获取分析历史
  const fetchAnalysisHistory = async (address?: string) => {
    setLoadingHistory(true);
    try {
      const url = address 
        ? `/api/analysis-history?address=${encodeURIComponent(address)}&limit=100`
        : '/api/analysis-history?limit=100';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setAnalysisHistory(data.data);
      }
    } catch (error) {
      console.error('获取分析历史失败:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 搜索分析历史
  const handleSearchHistory = () => {
    if (historySearchAddress.trim()) {
      fetchAnalysisHistory(historySearchAddress.trim());
    } else {
      fetchAnalysisHistory();
    }
  };

  // 刷新数据（触发扫描并重新获取）
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // 先触发扫描
      const scanResponse = await fetch('/api/cron/scan', {
        method: 'GET',
      });
      const scanData = await scanResponse.json();
      console.log('扫描结果:', scanData);

      // 等待一下再获取最新数据
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 重新获取钱包列表和扫描日志
      await Promise.all([fetchWallets(), fetchScanLogs()]);
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 复制地址
  const handleCopyAddress = async (address: string) => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    }
  };

  // 查看钱包详情（下注记录）
  const handleViewWalletDetails = async (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setLoadingTrades(true);
    try {
      const response = await fetch(`/api/wallets/${wallet.address}/trades`);
      const data = await response.json();
      if (data.success) {
        setWalletTrades(data.trades);
      }
    } catch (error) {
      console.error('获取钱包交易记录失败:', error);
    } finally {
      setLoadingTrades(false);
    }
  };

  useEffect(() => {
    fetchWallets();
    fetchScanLogs();
    if (showHistory) {
      fetchAnalysisHistory();
    }
  }, [showHistory]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  const latestScan = scanLogs[0];
  const lastScanTime = latestScan?.completedAt || latestScan?.startedAt;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">内幕钱包监控</h1>
          <p className="mt-2 text-muted-foreground">
            共监控 {wallets.length} 个可疑钱包
            {lastScanTime && (
              <span className="ml-4">
                · 上次扫描: {formatRelativeTime(lastScanTime)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showHistory ? "default" : "outline"}
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? '隐藏分析历史' : '查看分析历史'}
          </Button>
          <Button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? '扫描中...' : '刷新'}
          </Button>
        </div>
      </div>

      {/* 扫描统计信息 */}
      {latestScan && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">最新扫描统计</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">总交易数</div>
              <div className="text-2xl font-bold">{latestScan.totalTrades}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">处理钱包数</div>
              <div className="text-2xl font-bold">{latestScan.processedWallets}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">新发现钱包</div>
              <div className="text-2xl font-bold text-blue-600">{latestScan.newWallets}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">可疑钱包</div>
              <div className="text-2xl font-bold text-red-600">{latestScan.suspiciousWallets}</div>
            </div>
          </div>
          {latestScan.durationMs && (
            <div className="mt-3 text-sm text-muted-foreground">
              扫描耗时: {(latestScan.durationMs / 1000).toFixed(2)} 秒
              {latestScan.success === false && latestScan.errorMessage && (
                <span className="ml-4 text-red-600">
                  错误: {latestScan.errorMessage}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 扫描历史记录 */}
      {scanLogs.length > 1 && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">扫描历史</h2>
          <div className="space-y-2">
            {scanLogs.slice(1, 6).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
              >
                <div>
                  <span className="font-medium">
                    {formatTimeWithRelative(log.completedAt || log.startedAt)}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    · {log.totalTrades} 交易 · {log.processedWallets} 钱包
                  </span>
                  {log.suspiciousWallets > 0 && (
                    <span className="ml-2 text-red-600">
                      · {log.suspiciousWallets} 可疑
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {log.success ? (
                    <span className="text-green-600">✓ 成功</span>
                  ) : (
                    <span className="text-red-600">✗ 失败</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 分析历史记录 */}
      {showHistory && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">钱包分析历史</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="输入钱包地址搜索..."
                value={historySearchAddress}
                onChange={(e) => setHistorySearchAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchHistory()}
                className="rounded border px-3 py-1 text-sm"
              />
              <Button onClick={handleSearchHistory} size="sm" disabled={loadingHistory}>
                {loadingHistory ? '查询中...' : '搜索'}
              </Button>
            </div>
          </div>
          
          {loadingHistory ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : analysisHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">暂无分析历史</div>
          ) : (
            <div className="space-y-3">
              {analysisHistory.map((history) => (
                <div
                  key={history.id}
                  className="rounded border p-4 hover:bg-muted/50"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{formatAddress(history.walletAddress)}</span>
                      <button
                        onClick={() => handleCopyAddress(history.walletAddress)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        复制
                      </button>
                      {history.isSuspicious && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-600">
                          可疑
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getRiskScoreColor(history.totalScore)}`}>
                        {history.totalScore} 分
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeWithRelative(history.analyzedAt)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                    {history.walletAgeScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">钱包年龄: </span>
                        <span className="font-medium">{history.walletAgeScore} 分</span>
                        {history.walletAgeHours !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({history.walletAgeHours.toFixed(1)}h)
                          </span>
                        )}
                      </div>
                    )}
                    {history.walletCreatedAt && (
                      <div>
                        <span className="text-muted-foreground">钱包创建: </span>
                        <span className="font-medium text-xs">
                          {formatTimeWithRelative(history.walletCreatedAt)}
                        </span>
                      </div>
                    )}
                    {history.transactionCountScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">交易次数: </span>
                        <span className="font-medium">{history.transactionCountScore} 分</span>
                        {history.transactionCountNonce !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (nonce: {history.transactionCountNonce})
                          </span>
                        )}
                      </div>
                    )}
                    {history.marketParticipationScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">市场参与: </span>
                        <span className="font-medium">{history.marketParticipationScore} 分</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({history.marketParticipationCount} 个)
                        </span>
                      </div>
                    )}
                    {history.transactionAmountScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">交易规模: </span>
                        <span className="font-medium">{history.transactionAmountScore} 分</span>
                        {history.transactionAmount !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (${history.transactionAmount.toFixed(2)})
                          </span>
                        )}
                      </div>
                    )}
                    {history.wcTxGapScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">WC/TX: </span>
                        <span className="font-medium">{history.wcTxGapScore} 分</span>
                        {history.wcTxGapPercentage !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({history.wcTxGapPercentage.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    )}
                    {history.transactionRecencyScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">交易时间: </span>
                        <span className="font-medium">{history.transactionRecencyScore} 分</span>
                        {history.transactionRecencyHours !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({history.transactionRecencyHours.toFixed(1)}h前)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {history.analysisDetails && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {history.analysisDetails}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {wallets.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">暂无监控钱包</p>
          <p className="mt-2 text-sm text-muted-foreground">
            点击"刷新"按钮开始扫描
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>钱包地址</TableHead>
                <TableHead>发现时间</TableHead>
                <TableHead>风险评分</TableHead>
                <TableHead>WC/TX Gap</TableHead>
                <TableHead>关联市场</TableHead>
                <TableHead>交易数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((wallet) => (
                <TableRow key={wallet.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyAddress(wallet.address)}
                        className="font-mono hover:underline"
                        title="点击复制完整地址"
                      >
                        {formatAddress(wallet.address)}
                        {copiedAddress === wallet.address && (
                          <span className="ml-2 text-xs text-green-600">✓ 已复制</span>
                        )}
                      </button>
                      {wallet.tradeCount > 0 && (
                        <button
                          onClick={() => handleViewWalletDetails(wallet)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          title="查看下注详情"
                        >
                          查看详情
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(wallet.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className={getRiskScoreColor(wallet.riskScore)}>
                      {wallet.riskScore.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {wallet.walletCreatedAt && wallet.firstTradeTime
                      ? calculateWcTxGap(wallet.walletCreatedAt, wallet.firstTradeTime)
                      : wallet.firstTradeTime
                      ? '钱包创建时间未知'
                      : '无交易'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {wallet.markets.length > 0 ? (
                        wallet.markets.slice(0, 2).map((market) => (
                          <span
                            key={market.id}
                            className="text-sm"
                            title={market.title}
                          >
                            {market.title.length > 30
                              ? `${market.title.slice(0, 30)}...`
                              : market.title}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">无市场</span>
                      )}
                      {wallet.markets.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{wallet.markets.length - 2} 更多
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {wallet.tradeCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 钱包详情弹窗 */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border-2 border-gray-300 bg-white shadow-2xl p-8">
            <div className="mb-6 flex items-center justify-between border-b-2 border-gray-200 pb-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">钱包详情</h2>
                <p className="mt-2 font-mono text-base text-gray-600 break-all">
                  {selectedWallet.address}
                </p>
              </div>
              <Button
                variant="outline"
                className="border-2 border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  setSelectedWallet(null);
                  setWalletTrades([]);
                }}
              >
                关闭
              </Button>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-6 rounded-xl border-2 border-gray-200 bg-gray-50 p-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-2">风险评分</p>
                <p className={`text-4xl font-bold ${getRiskScoreColor(selectedWallet.riskScore)}`}>
                  {selectedWallet.riskScore.toFixed(1)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-2">交易总数</p>
                <p className="text-4xl font-bold text-gray-900">{selectedWallet.tradeCount}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-2">发现时间</p>
                <p className="text-xl font-semibold text-gray-900">{formatTimeWithRelative(selectedWallet.createdAt)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-2">钱包创建时间</p>
                <p className="text-xl font-semibold text-gray-900">
                  {selectedWallet.walletCreatedAt
                    ? formatTimeWithRelative(selectedWallet.walletCreatedAt)
                    : '未知'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-2">参与市场数</p>
                <p className="text-xl font-semibold text-gray-900">{selectedWallet.markets.length}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-2xl font-bold text-gray-900 border-b-2 border-gray-200 pb-2">下注记录</h3>
              {loadingTrades ? (
                <div className="py-12 text-center text-lg text-gray-600">加载中...</div>
              ) : walletTrades.length === 0 ? (
                <div className="py-12 text-center text-lg text-gray-500">暂无交易记录</div>
              ) : (
                <div className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead className="font-bold text-gray-900 text-base">时间</TableHead>
                        <TableHead className="font-bold text-gray-900 text-base">市场</TableHead>
                        <TableHead className="font-bold text-gray-900 text-base">方向</TableHead>
                        <TableHead className="font-bold text-gray-900 text-base">结果</TableHead>
                        <TableHead className="font-bold text-gray-900 text-base">金额 (USDC)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTrades.map((trade) => (
                        <TableRow key={trade.id} className="hover:bg-gray-50">
                          <TableCell className="text-base font-medium text-gray-700">
                            {formatTimeWithRelative(trade.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-lg">
                              <p className="text-base text-gray-900 font-medium" title={trade.marketTitle}>
                                {trade.marketTitle.length > 60
                                  ? `${trade.marketTitle.slice(0, 60)}...`
                                  : trade.marketTitle}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-base font-bold px-3 py-1 rounded ${
                                trade.isBuy
                                  ? 'text-green-700 bg-green-100'
                                  : 'text-red-700 bg-red-100'
                              }`}
                            >
                              {trade.direction}
                            </span>
                          </TableCell>
                          <TableCell>
                            {trade.outcome ? (
                              <span
                                className={`text-base font-bold px-3 py-1 rounded ${
                                  trade.outcome === 'YES'
                                    ? 'text-blue-700 bg-blue-100'
                                    : 'text-purple-700 bg-purple-100'
                                }`}
                              >
                                {trade.outcome}
                              </span>
                            ) : (
                              <span className="text-base text-gray-400">未知</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-base font-semibold text-gray-900">
                            ${trade.amountUsdc.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
