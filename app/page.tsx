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
  calculateWcTxGap,
  getRiskScoreColor,
  copyToClipboard,
} from '@/lib/formatters';

interface Wallet {
  id: string;
  address: string;
  riskScore: number;
  fundingSource: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  firstTradeTime: string | null;
  markets: Array<{ id: string; title: string }>;
  tradeCount: number;
}

interface Trade {
  id: string;
  marketId: string;
  marketTitle: string;
  amount: number;
  amountUsdc: number;
  isBuy: boolean;
  direction: string;
  timestamp: string;
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

  // 获取钱包列表
  const fetchWallets = async () => {
    try {
      const response = await fetch('/api/wallets');
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

  // 刷新数据（触发扫描并重新获取）
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // 先触发扫描
      const scanResponse = await fetch('/api/cron/scan?mock=true', {
        method: 'GET',
      });
      const scanData = await scanResponse.json();
      console.log('扫描结果:', scanData);

      // 等待一下再获取最新数据
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 重新获取钱包列表
      await fetchWallets();
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
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">内幕钱包监控</h1>
          <p className="mt-2 text-muted-foreground">
            共监控 {wallets.length} 个可疑钱包
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? '扫描中...' : '刷新'}
        </Button>
      </div>

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
                    {wallet.firstTradeTime
                      ? calculateWcTxGap(wallet.createdAt, wallet.firstTradeTime)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">钱包详情</h2>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
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

            <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-sm text-muted-foreground">风险评分</p>
                <p className={`text-2xl font-bold ${getRiskScoreColor(selectedWallet.riskScore)}`}>
                  {selectedWallet.riskScore.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">交易总数</p>
                <p className="text-2xl font-bold">{selectedWallet.tradeCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">发现时间</p>
                <p className="text-lg">{formatRelativeTime(selectedWallet.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">参与市场数</p>
                <p className="text-lg">{selectedWallet.markets.length}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-xl font-semibold">下注记录</h3>
              {loadingTrades ? (
                <div className="py-8 text-center">加载中...</div>
              ) : walletTrades.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">暂无交易记录</div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        <TableHead>市场</TableHead>
                        <TableHead>方向</TableHead>
                        <TableHead>金额 (USDC)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {walletTrades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="text-muted-foreground">
                            {formatRelativeTime(trade.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md">
                              <p className="text-sm" title={trade.marketTitle}>
                                {trade.marketTitle.length > 50
                                  ? `${trade.marketTitle.slice(0, 50)}...`
                                  : trade.marketTitle}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                trade.isBuy
                                  ? 'text-green-600 font-semibold'
                                  : 'text-red-600 font-semibold'
                              }
                            >
                              {trade.direction}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono">
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
