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
import { Progress } from '@/components/ui/progress';

interface Wallet {
  id: number;
  address: string;
  riskScore: number;
  fundingSource: string | null;
  createdAt: string;
  walletCreatedAt: string | null;
  lastActiveAt: string | null;
  firstTradeTime: string | null;
  markets: Array<{ id: string; title: string }>;
  tradeCount: number;
  isStarred: boolean;
  walletType?: string[];
  winRate?: number | null;
  totalProfit?: number | null;
}

interface Trade {
  id: number;
  marketId: string;
  marketTitle: string;
  amount: number;
  amountUsdc: number;
  isBuy: boolean;
  direction: string;
  outcome: string | null;
  timestamp: string;
  createdAt: string;
}

interface ScanLog {
  id: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  totalTrades: number;
  processedWallets: number;
  newWallets: number;
  suspiciousWallets: number;
  skippedWallets: number;
  highWinRateWallets?: number;
  errors: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface AnalysisHistory {
  id: number;
  walletAddress: string;
  totalScore: number;
  isSuspicious: boolean;
  analysisDetails: string | null;
  walletAgeScore: number;
  walletAgeHours: number | null;
  walletCreatedAt: string | null;
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

type TabType = 'wallets' | 'alerts' | 'history' | 'analysis';

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
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState<string>('');
  const [updatingStar, setUpdatingStar] = useState<string | null>(null);
  const [walletFilter, setWalletFilter] = useState<'all' | 'suspicious' | 'high_win_rate'>('all');
  const [highWinRateWallets, setHighWinRateWallets] = useState<Wallet[]>([]);
  const [loadingHighWinRate, setLoadingHighWinRate] = useState(false);
  const [highWinRateAlerts, setHighWinRateAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertTimeRange, setAlertTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [activeTab, setActiveTab] = useState<TabType>('wallets');
  const [showScanStats, setShowScanStats] = useState(true);

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
        const sortedWallets = data.data.sort((a: Wallet, b: Wallet) => {
          if (a.isStarred !== b.isStarred) {
            return a.isStarred ? -1 : 1;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setWallets(sortedWallets);
      }
    } catch (error) {
      console.error('获取钱包列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取高胜率钱包列表
  const fetchHighWinRateWallets = async () => {
    setLoadingHighWinRate(true);
    try {
      const response = await fetch('/api/wallets/win-rate?limit=100');
      const data = await response.json();
      if (data.success) {
        setHighWinRateWallets(data.data);
      }
    } catch (error) {
      console.error('获取高胜率钱包列表失败:', error);
    } finally {
      setLoadingHighWinRate(false);
    }
  };

  // 获取高胜率钱包实时交易提醒
  const fetchHighWinRateAlerts = async (timeRange: '24h' | '7d' | '30d' | 'all' = alertTimeRange) => {
    setLoadingAlerts(true);
    try {
      const hoursMap = {
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30,
        'all': 24 * 365,
      };
      const hours = hoursMap[timeRange];
      const limit = timeRange === 'all' ? 100 : 50;
      
      const response = await fetch(`/api/high-win-rate-alerts?limit=${limit}&hours=${hours}`);
      const data = await response.json();
      if (data.success) {
        setHighWinRateAlerts(data.data);
      }
    } catch (error) {
      console.error('获取高胜率钱包交易提醒失败:', error);
    } finally {
      setLoadingAlerts(false);
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

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshProgress(0);
    setRefreshStatus('正在启动扫描...');
    
    let pollInterval: NodeJS.Timeout | null = null;
    let scanCompleted = false;
    
    try {
      const scanStartTime = Date.now();
      const scanPromise = fetch('/api/cron/scan', {
        method: 'GET',
      });

      pollInterval = setInterval(async () => {
        if (scanCompleted) return;
        
        try {
          const logsResponse = await fetch('/api/scan-logs?limit=1');
          const logsData = await logsResponse.json();
          
          if (logsData.success && logsData.data && logsData.data.length > 0) {
            const latestLog = logsData.data[0];
            
            // 检查扫描是否完成
            if (latestLog.completedAt) {
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              scanCompleted = true;
              
              setRefreshProgress(100);
              setRefreshStatus('扫描完成，正在更新数据...');
              
              await new Promise((resolve) => setTimeout(resolve, 500));
              await Promise.all([fetchWallets(), fetchScanLogs(), fetchHighWinRateWallets(), fetchHighWinRateAlerts()]);
              
              setRefreshStatus('完成');
              setTimeout(() => {
                setRefreshProgress(0);
                setRefreshStatus('');
                setRefreshing(false);
              }, 1000);
            } else {
              // 扫描进行中，计算进度
              const elapsed = Date.now() - scanStartTime;
              
              // 如果有实际进度数据，使用实际进度；否则使用时间估算
              let progress = 0;
              let statusText = '正在扫描...';
              
              if (latestLog.totalTrades > 0) {
                // 基于已处理钱包数和总交易数估算进度
                // 假设：获取交易数据占20%，处理钱包占80%
                const dataFetchProgress = Math.min(20, (elapsed / 5000) * 20); // 前5秒获取数据
                
                if (latestLog.processedWallets > 0 && latestLog.totalTrades > 0) {
                  // 使用实际处理进度
                  // 估算：每个钱包平均处理时间，基于总交易数
                  const avgTimePerWallet = Math.max(1000, latestLog.totalTrades * 50); // 每笔交易约50ms
                  const estimatedTotalWallets = Math.max(latestLog.processedWallets, latestLog.totalTrades / 10); // 估算总钱包数
                  const walletProgress = Math.min(80, (latestLog.processedWallets / estimatedTotalWallets) * 80);
                  progress = Math.min(95, dataFetchProgress + walletProgress);
                  
                  statusText = `已处理 ${latestLog.processedWallets} 个钱包，${latestLog.totalTrades} 笔交易`;
                } else {
                  // 只有交易数，没有钱包数，使用时间估算
                  const estimatedDuration = Math.max(30000, latestLog.totalTrades * 20); // 根据交易数动态估算
                  progress = Math.min(90, Math.floor((elapsed / estimatedDuration) * 90));
                  statusText = `正在处理 ${latestLog.totalTrades} 笔交易...`;
                }
              } else {
                // 还没有交易数据，使用时间估算
                const estimatedDuration = 10000; // 获取数据预计10秒
                progress = Math.min(20, Math.floor((elapsed / estimatedDuration) * 20));
                statusText = '正在获取交易数据...';
              }
              
              setRefreshProgress(progress);
              setRefreshStatus(statusText);
            }
          }
        } catch (error) {
          console.error('轮询扫描日志失败:', error);
        }
      }, 1000);

      try {
        const scanResponse = await scanPromise;
        const scanData = await scanResponse.json();
        console.log('扫描结果:', scanData);

        if (!scanCompleted) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          scanCompleted = true;
          
          setRefreshProgress(100);
          setRefreshStatus('扫描完成，正在更新数据...');
          await new Promise((resolve) => setTimeout(resolve, 500));
          await Promise.all([fetchWallets(), fetchScanLogs(), fetchHighWinRateWallets()]);
          
          setRefreshStatus('完成');
          setTimeout(() => {
            setRefreshProgress(0);
            setRefreshStatus('');
            setRefreshing(false);
          }, 1000);
        }
      } catch (scanError) {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        throw scanError;
      }
    } catch (error) {
      console.error('刷新失败:', error);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      setRefreshStatus('扫描失败');
      setTimeout(() => {
        setRefreshProgress(0);
        setRefreshStatus('');
        setRefreshing(false);
      }, 2000);
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

  // 切换关注状态
  const handleToggleStar = async (wallet: Wallet) => {
    setUpdatingStar(wallet.address);
    try {
      const response = await fetch(`/api/wallets/${wallet.address}/star`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isStarred: !wallet.isStarred }),
      });

      const data = await response.json();
      if (data.success) {
        const updatedWallets = wallets.map(w => 
          w.id === wallet.id 
            ? { ...w, isStarred: !w.isStarred }
            : w
        ).sort((a, b) => {
          if (a.isStarred !== b.isStarred) {
            return a.isStarred ? -1 : 1;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setWallets(updatedWallets);
      }
    } catch (error) {
      console.error('切换关注状态失败:', error);
    } finally {
      setUpdatingStar(null);
    }
  };

  // 查看钱包详情
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
    fetchHighWinRateWallets();
    fetchHighWinRateAlerts();
  }, []);

  useEffect(() => {
    if (activeTab === 'analysis') {
      fetchAnalysisHistory();
    }
  }, [activeTab]);

  // 根据筛选器获取显示的钱包列表
  const getDisplayedWallets = () => {
    if (walletFilter === 'high_win_rate') {
      return highWinRateWallets;
    } else if (walletFilter === 'suspicious') {
      return wallets.filter(w => 
        w.walletType?.includes('suspicious') || (!w.walletType && w.riskScore >= 50)
      );
    }
    return wallets;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  const latestScan = scanLogs[0];
  const lastScanTime = latestScan?.completedAt || latestScan?.startedAt;
  const suspiciousCount = wallets.filter(w => w.walletType?.includes('suspicious') || (!w.walletType && w.riskScore >= 50)).length;

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 顶部标题栏 */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">内幕钱包监控</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            监控 {wallets.length} 个钱包 · 可疑 {suspiciousCount} 个 · 高胜率 {highWinRateWallets.length} 个
            {lastScanTime && (
              <span className="ml-2">· {formatRelativeTime(lastScanTime)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} size="sm">
            {refreshing ? '扫描中...' : '刷新扫描'}
          </Button>
        </div>
      </div>

      {/* 刷新进度条 */}
      {refreshing && (
        <div className="mb-4 rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{refreshStatus || '正在扫描...'}</span>
            <span className="text-muted-foreground">{refreshProgress}%</span>
          </div>
          <Progress value={refreshProgress} className="h-1.5" />
        </div>
      )}

      {/* 扫描统计 - 可折叠 */}
      {latestScan && showScanStats && (
        <div className="mb-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">最新扫描</h2>
            <button
              onClick={() => setShowScanStats(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              收起
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">总交易</div>
              <div className="text-xl font-bold">{latestScan.totalTrades}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">处理钱包</div>
              <div className="text-xl font-bold">{latestScan.processedWallets}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">新发现</div>
              <div className="text-xl font-bold text-blue-600">{latestScan.newWallets}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">可疑</div>
              <div className="text-xl font-bold text-red-600">{latestScan.suspiciousWallets}</div>
            </div>
            {latestScan.highWinRateWallets !== undefined && (
              <div>
                <div className="text-xs text-muted-foreground">高胜率</div>
                <div className="text-xl font-bold text-green-600">{latestScan.highWinRateWallets}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {!showScanStats && latestScan && (
        <div className="mb-4 text-center">
          <button
            onClick={() => setShowScanStats(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            显示扫描统计
          </button>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="mb-4 border-b">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('wallets')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'wallets'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            钱包列表
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'alerts'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            交易提醒
            {highWinRateAlerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                {highWinRateAlerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            扫描历史
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            分析历史
          </button>
        </div>
      </div>

      {/* 标签页内容 */}
      {activeTab === 'wallets' && (
        <div>
          {/* 钱包筛选 */}
          <div className="mb-4 flex gap-2 flex-wrap">
            <Button
              variant={walletFilter === 'all' ? "default" : "outline"}
              onClick={() => setWalletFilter('all')}
              size="sm"
            >
              全部 ({wallets.length})
            </Button>
            <Button
              variant={walletFilter === 'suspicious' ? "default" : "outline"}
              onClick={() => setWalletFilter('suspicious')}
              size="sm"
            >
              可疑 ({suspiciousCount})
            </Button>
            <Button
              variant={walletFilter === 'high_win_rate' ? "default" : "outline"}
              onClick={() => setWalletFilter('high_win_rate')}
              size="sm"
            >
              高胜率 ({highWinRateWallets.length})
            </Button>
          </div>

          {/* 钱包表格 - 简化版 */}
          {getDisplayedWallets().length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">
                {walletFilter === 'high_win_rate' ? '暂无高胜率钱包' : '暂无监控钱包'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">★</TableHead>
                    <TableHead>钱包地址</TableHead>
                    <TableHead className="w-20">类型</TableHead>
                    <TableHead className="w-24">风险评分</TableHead>
                    {walletFilter === 'high_win_rate' && (
                      <>
                        <TableHead className="w-20">胜率</TableHead>
                        <TableHead className="w-24">总盈亏</TableHead>
                      </>
                    )}
                    <TableHead className="w-20">交易数</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getDisplayedWallets().map((wallet) => (
                    <TableRow key={wallet.id}>
                      <TableCell>
                        <button
                          onClick={() => handleToggleStar(wallet)}
                          disabled={updatingStar === wallet.address}
                          className={`text-lg transition-colors ${
                            wallet.isStarred
                              ? 'text-yellow-500 hover:text-yellow-600'
                              : 'text-gray-300 hover:text-yellow-400'
                          } ${updatingStar === wallet.address ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={wallet.isStarred ? '取消关注' : '关注'}
                        >
                          {wallet.isStarred ? '★' : '☆'}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyAddress(wallet.address)}
                            className="font-mono text-sm hover:underline"
                            title="点击复制"
                          >
                            {formatAddress(wallet.address)}
                            {copiedAddress === wallet.address && (
                              <span className="ml-2 text-xs text-green-600">✓</span>
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {wallet.walletType?.includes('suspicious') && (
                            <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                              可疑
                            </span>
                          )}
                          {wallet.walletType?.includes('high_win_rate') && (
                            <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                              高胜率
                            </span>
                          )}
                          {(!wallet.walletType || wallet.walletType.length === 0) && wallet.riskScore >= 50 && (
                            <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                              可疑
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold ${getRiskScoreColor(wallet.riskScore)}`}>
                          {wallet.riskScore.toFixed(1)}
                        </span>
                      </TableCell>
                      {walletFilter === 'high_win_rate' && (
                        <>
                          <TableCell>
                            {wallet.winRate !== null && wallet.winRate !== undefined ? (
                              <span className="font-medium text-green-600">
                                {wallet.winRate.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {wallet.totalProfit !== null && wallet.totalProfit !== undefined ? (
                              <span className={wallet.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ${wallet.totalProfit.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-muted-foreground text-sm">
                        {wallet.tradeCount}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleViewWalletDetails(wallet)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          详情
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">高胜率钱包交易提醒</h2>
            <div className="flex gap-2">
              {(['24h', '7d', '30d', 'all'] as const).map((range) => (
                <Button
                  key={range}
                  variant={alertTimeRange === range ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAlertTimeRange(range);
                    fetchHighWinRateAlerts(range);
                  }}
                >
                  {range === 'all' ? '全部' : range}
                </Button>
              ))}
            </div>
          </div>
          {loadingAlerts ? (
            <div className="py-12 text-center text-muted-foreground">加载中...</div>
          ) : highWinRateAlerts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">暂无提醒</div>
          ) : (
            <div className="space-y-3">
              {highWinRateAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-green-200 bg-green-50/50 p-4 hover:bg-green-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-mono text-sm font-medium break-all">{alert.walletAddress}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAddress(alert.walletAddress);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer whitespace-nowrap"
                          title="复制地址"
                        >
                          {copiedAddress === alert.walletAddress ? '已复制' : '复制'}
                        </button>
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          胜率 {alert.winRate.toFixed(1)}%
                        </span>
                        {alert.wallet?.totalProfit !== null && alert.wallet?.totalProfit !== undefined && (
                          <span className={`text-xs font-semibold ${alert.wallet.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${alert.wallet.totalProfit.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {alert.trades && alert.trades.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {alert.trades.map((trade: any) => (
                            <div key={trade.id} className="flex flex-col gap-1.5 rounded bg-white px-3 py-2 text-sm border border-gray-200">
                              <div className="flex items-start justify-between gap-2">
                                <span className="flex-1 font-medium break-words">
                                  {trade.marketTitle || '未知市场'}
                                </span>
                                <span className={`font-semibold whitespace-nowrap ${trade.isBuy ? 'text-green-600' : 'text-red-600'}`}>
                                  {trade.isBuy ? '买入' : '卖出'} ${trade.amount?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                {trade.outcome ? (
                                  <div className="text-muted-foreground">
                                    选项: <span className="font-medium text-foreground">{trade.outcome === 'YES' ? '是' : trade.outcome === 'NO' ? '否' : trade.outcome}</span>
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground italic">
                                    选项: 未指定
                                  </div>
                                )}
                                <div className="text-muted-foreground">
                                  时间: {formatTimeWithRelative(trade.timestamp)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : alert.tradeCount > 0 ? (
                        <div className="mt-2 text-xs text-muted-foreground italic">
                          本次扫描有 {alert.tradeCount} 笔交易，但交易详情暂未加载
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-4 text-right text-xs text-muted-foreground">
                      <div>{formatTimeWithRelative(alert.detectedAt)}</div>
                      <div>已结算持仓: {alert.totalPositions || '-'} 笔</div>
                      {alert.tradeCount > 0 && (
                        <div className="text-xs">本次扫描: {alert.tradeCount} 笔</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">扫描历史</h2>
          {loadingScanLogs ? (
            <div className="py-12 text-center text-muted-foreground">加载中...</div>
          ) : scanLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">暂无扫描历史</div>
          ) : (
            <div className="space-y-2">
              {scanLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{formatTimeWithRelative(log.completedAt || log.startedAt)}</span>
                    <span className="ml-2 text-muted-foreground">
                      {log.totalTrades} 交易 · {log.processedWallets} 钱包
                    </span>
                    {log.suspiciousWallets > 0 && (
                      <span className="ml-2 text-red-600">· {log.suspiciousWallets} 可疑</span>
                    )}
                    {log.highWinRateWallets !== undefined && log.highWinRateWallets > 0 && (
                      <span className="ml-2 text-green-600">· {log.highWinRateWallets} 高胜率</span>
                    )}
                  </div>
                  <div className={log.success ? 'text-green-600' : 'text-red-600'}>
                    {log.success ? '✓' : '✗'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analysis' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">钱包分析历史</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="搜索钱包地址..."
                value={historySearchAddress}
                onChange={(e) => setHistorySearchAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchHistory()}
                className="rounded border px-3 py-1 text-sm w-48"
              />
              <Button onClick={handleSearchHistory} size="sm" disabled={loadingHistory}>
                {loadingHistory ? '查询中...' : '搜索'}
              </Button>
            </div>
          </div>
          {loadingHistory ? (
            <div className="py-12 text-center text-muted-foreground">加载中...</div>
          ) : analysisHistory.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">暂无分析历史</div>
          ) : (
            <div className="space-y-3">
              {analysisHistory.map((history) => (
                <div
                  key={history.id}
                  className="rounded-lg border p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between mb-2">
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
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    {history.walletAgeScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">钱包年龄: </span>
                        <span className="font-medium">{history.walletAgeScore}分</span>
                      </div>
                    )}
                    {history.transactionCountScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">交易次数: </span>
                        <span className="font-medium">{history.transactionCountScore}分</span>
                      </div>
                    )}
                    {history.marketParticipationScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">市场参与: </span>
                        <span className="font-medium">{history.marketParticipationScore}分</span>
                      </div>
                    )}
                    {history.transactionAmountScore > 0 && (
                      <div>
                        <span className="text-muted-foreground">交易规模: </span>
                        <span className="font-medium">{history.transactionAmountScore}分</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 钱包详情弹窗 */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border bg-white shadow-2xl p-6">
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold">钱包详情</h2>
                <p className="mt-1 font-mono text-sm text-gray-600 break-all">
                  {selectedWallet.address}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedWallet(null);
                  setWalletTrades([]);
                }}
              >
                关闭
              </Button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border bg-gray-50 p-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">风险评分</p>
                <p className={`text-2xl font-bold ${getRiskScoreColor(selectedWallet.riskScore)}`}>
                  {selectedWallet.riskScore.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">交易总数</p>
                <p className="text-2xl font-bold">{selectedWallet.tradeCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">发现时间</p>
                <p className="text-sm font-semibold">{formatTimeWithRelative(selectedWallet.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">参与市场</p>
                <p className="text-sm font-semibold">{selectedWallet.markets.length} 个</p>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-xl font-bold border-b pb-2">交易记录</h3>
              {loadingTrades ? (
                <div className="py-12 text-center text-muted-foreground">加载中...</div>
              ) : walletTrades.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">暂无交易记录</div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        <TableHead>市场</TableHead>
                        <TableHead>方向</TableHead>
                        <TableHead>结果</TableHead>
                        <TableHead>金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTrades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="text-sm">
                            {formatTimeWithRelative(trade.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-2xl">
                              <p className="text-sm break-words">
                                {trade.marketTitle}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-semibold px-2 py-1 rounded ${
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
                                className={`text-sm font-semibold px-2 py-1 rounded ${
                                  trade.outcome === 'YES'
                                    ? 'text-blue-700 bg-blue-100'
                                    : 'text-purple-700 bg-purple-100'
                                }`}
                              >
                                {trade.outcome}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold">
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
