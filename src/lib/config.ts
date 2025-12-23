// Application configuration constants

export const config = {
  // Default watchlist symbols
  defaultWatchlist: ['BTC', 'ETH', 'AAPL', 'TSLA', 'EURUSD'],

  // Market types
  marketTypes: ['crypto', 'stocks', 'forex'] as const,

  // Cache TTLs (in milliseconds)
  cache: {
    quotes: 30 * 1000, // 30 seconds for price quotes
    sentiment: 10 * 60 * 1000, // 10 minutes for sentiment
    news: 15 * 60 * 1000, // 15 minutes for news
  },

  // Rate limiting
  rateLimit: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },

  // Voice settings
  voice: {
    ttsModel: 'tts-1' as const,
    ttsVoice: 'alloy' as const,
    ttsSpeed: 1.0,
    whisperModel: 'whisper-1' as const,
    whisperLanguage: 'en',
  },

  // GPT settings
  gpt: {
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    maxTokens: 500,
  },

  // Timeframes for analysis
  timeframes: ['1d', '1w', '1m', '3m'] as const,

  // Risk tolerance options
  riskTolerances: ['conservative', 'moderate', 'aggressive'] as const,

  // Compliance disclaimer
  disclaimer: `This assistant provides informational market commentary only and is not financial advice. Markets are volatile; consider your own situation and do your own research before making decisions.`,

  // Short disclaimer for voice responses
  shortDisclaimer: `Remember, this is informational only, not financial advice.`,

  // Symbol mappings for different market types
  symbolPrefixes: {
    crypto: 'X:', // Polygon format: X:BTCUSD
    forex: 'C:', // Polygon format: C:EURUSD
    stock: '', // Polygon format: AAPL
  },

  // Common crypto symbols (for detection)
  cryptoSymbols: ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'LINK', 'AVAX'],
  
  // Common forex pairs
  forexPairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'],

  // UI Theme colors
  theme: {
    primary: '#1a1a2e', // Dark blue-black
    secondary: '#16213e', // Darker blue
    accent: '#c0c0c0', // Metallic silver
    accentLight: '#d4d4d4', // Light silver
    success: '#10b981', // Green
    danger: '#ef4444', // Red
    warning: '#f59e0b', // Orange
    background: '#0f0f1a', // Very dark
    surface: '#1a1a2e', // Card backgrounds
    text: '#e5e5e5', // Light text
    textMuted: '#9ca3af', // Muted text
  },
} as const;

export type MarketType = (typeof config.marketTypes)[number];
export type Timeframe = (typeof config.timeframes)[number];
export type RiskTolerance = (typeof config.riskTolerances)[number];
