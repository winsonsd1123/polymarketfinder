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
} as const;

/**
 * 类型定义（基于数据库表结构）
 */
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
