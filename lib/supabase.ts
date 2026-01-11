import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 客户端单例
 * 用于服务端数据库操作
 */
// Supabase 配置（从环境变量读取）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable.');
}

if (!supabaseAnonKey && !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

// 使用 service_role key（如果有）用于服务端操作，否则使用 anon key
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey!;

/**
 * Supabase 客户端（服务端使用）
 * 使用 service_role key 可以绕过 RLS（Row Level Security）
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    // 增加超时时间到 30 秒
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30秒超时
      });
    },
  },
});

/**
 * 数据库表名常量
 */
export const TABLES = {
  MONITORED_WALLETS: 'monitored_wallets',
  TRADE_EVENTS: 'trade_events',
  MARKETS: 'markets',
  SCAN_LOGS: 'scan_logs',
  WALLET_ANALYSIS_HISTORY: 'wallet_analysis_history',
  WALLET_WIN_RATES: 'wallet_win_rates',
  HIGH_WIN_RATE_ALERTS: 'high_win_rate_alerts',
} as const;

/**
 * 类型定义（基于数据库表结构）
 */
export type WalletType = 'suspicious' | 'high_win_rate';

export interface MonitoredWallet {
  id: number; // bigint，自增 ID
  address: string;
  riskScore: number;
  fundingSource: string | null;
  lastActiveAt: string | null;
  walletCreatedAt: string | null; // 钱包在链上的创建时间（UTC时间，从 Alchemy API 获取）
  createdAt: string; // 记录创建时间（北京时间）
  updatedAt: string; // 记录更新时间（北京时间）
  isStarred: boolean; // 是否关注
  walletType: string[]; // 钱包类型数组：['suspicious']、['high_win_rate']、['suspicious', 'high_win_rate']
  winRate: number | null; // 胜率百分比（0-100）
  totalProfit: number | null; // 总盈亏（USDC）
  winRateUpdatedAt: string | null; // 胜率最后更新时间（北京时间）
}

export interface Market {
  id: string;
  title: string;
  volume: number;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeEvent {
  id: number; // bigint，自增 ID
  marketId: string;
  walletId: number; // bigint，关联到 monitored_wallets.id
  amount: number;
  isBuy: boolean;
  outcome: string | null; // YES 或 NO
  timestamp: string;
  createdAt: string;
}

export interface ScanLog {
  id: number; // bigint，自增 ID
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

export interface WalletAnalysisHistory {
  id: number; // bigint，自增 ID
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

export interface WalletWinRate {
  walletAddress: string; // PK
  totalPositions: number; // 总已结算持仓数
  winningPositions: number; // 盈利次数（realizedPnl > 0）
  losingPositions: number; // 亏损次数（realizedPnl < 0）
  winRate: number; // 胜率百分比（0-100）
  totalProfit: number; // 总盈亏（USDC）
  avgProfit: number; // 平均盈亏（USDC）
  lastUpdatedAt: string; // 最后更新时间（北京时间）
  createdAt: string; // 创建时间（北京时间）
}

export interface HighWinRateAlert {
  id: number; // bigint，自增 ID
  walletAddress: string;
  scanLogId: number | null; // 关联扫描日志ID
  tradeCount: number; // 本次扫描的交易数量
  winRate: number; // 当前胜率
  detectedAt: string; // 检测时间（北京时间）
  createdAt: string; // 创建时间（北京时间）
}
