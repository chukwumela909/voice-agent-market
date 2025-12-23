// ============================================
// Database Types
// ============================================

export interface UserProfile {
  id: string;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  preferred_markets: ('crypto' | 'stocks' | 'forex')[];
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  voice: boolean;
}

export interface Portfolio {
  id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  market_type: 'crypto' | 'stock' | 'forex';
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  user_message: string;
  agent_response: string;
  context: ConversationContext;
  created_at: string;
}

export interface ConversationContext {
  intent?: Intent;
  symbols?: string[];
  marketData?: MarketData[];
  sentiment?: SentimentData;
}

export interface Alert {
  id: string;
  user_id: string;
  symbol: string;
  condition: 'above' | 'below' | 'change_percent';
  target_price?: number;
  percentage_change?: number;
  is_active: boolean;
  last_triggered?: string;
  notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketCache {
  symbol: string;
  price: number;
  change_24h: number;
  volume: number;
  market_cap: number;
  market_type: 'crypto' | 'stock' | 'forex';
  last_updated: string;
}

export interface NewsSentiment {
  id: string;
  symbol: string;
  title: string;
  summary: string;
  sentiment_score: number;
  source: string;
  url: string;
  published_at: string;
  created_at: string;
}

// ============================================
// API Types
// ============================================

export interface Intent {
  intent: 'price_check' | 'analysis' | 'portfolio_advice' | 'news' | 'alert_create' | 'alert_manage' | 'general_question' | 'follow_up';
  symbols: string[];
  timeframe: '1d' | '1w' | '1m' | '3m';
  market_type: 'crypto' | 'stock' | 'forex' | 'all';
  follow_up_context?: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap?: number;
  marketType: 'crypto' | 'stock' | 'forex';
  lastUpdated: string;
}

export interface OHLCV {
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  t: number; // timestamp
}

export interface TechnicalIndicators {
  rsi: number | null;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  } | null;
  movingAverages: {
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
  };
}

export interface SentimentData {
  score: number;
  summary: string;
  keyPoints: string[];
  articles: NewsArticle[];
}

export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  publishedAt: string;
  url: string;
}

export interface VoiceProcessResponse {
  transcript: string;
  response: string;
  audioUrl?: string;
  audioBase64?: string;
  marketData?: {
    symbols: MarketData[];
    analysis?: TechnicalIndicators;
    sentiment?: SentimentData;
  };
  intent: Intent;
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
  marketType: 'crypto' | 'stock' | 'forex';
}

export interface PortfolioSummary {
  holdings: PortfolioHolding[];
  totalValue: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
}

// ============================================
// Component Props Types
// ============================================

export interface VoiceState {
  isListening: boolean;
  isMuted: boolean;
  isProcessing: boolean;
  isAgentSpeaking: boolean;
  elapsedTime: number;
  error: string | null;
}

export interface UserContext {
  riskTolerance: string;
  preferredMarkets: string[];
  portfolio: Portfolio[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface PricesResponse {
  data: MarketData[];
  cached: number;
  fresh: number;
}

export interface AnalysisResponse {
  symbol: string;
  timeframe: string;
  marketType: string;
  technicalAnalysis: TechnicalIndicators;
  historicalData: OHLCV[];
  sentiment: SentimentData;
  aiSummary: string;
}
