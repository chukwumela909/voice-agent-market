import { config } from '@/lib/config';
import type { MarketData, OHLCV } from '@/types';

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const BASE_URL = 'https://api.polygon.io';

type MarketType = 'crypto' | 'stock' | 'forex';

/**
 * Format ticker symbol based on market type for Polygon API
 */
function formatTicker(symbol: string, marketType: MarketType): string {
  switch (marketType) {
    case 'crypto':
      // Format: X:BTCUSD
      return `X:${symbol}USD`;
    case 'forex':
      // Format: C:EURUSD (already includes USD if pair)
      return symbol.includes('USD') ? `C:${symbol}` : `C:${symbol}USD`;
    case 'stock':
    default:
      return symbol;
  }
}

/**
 * Detect market type from symbol
 */
export function detectMarketType(symbol: string): MarketType {
  const upperSymbol = symbol.toUpperCase();
  
  if ((config.cryptoSymbols as readonly string[]).includes(upperSymbol)) {
    return 'crypto';
  }
  
  if (config.forexPairs.some((pair) => upperSymbol.includes(pair.replace('USD', '')))) {
    return 'forex';
  }
  
  return 'stock';
}

/**
 * Get current price for a symbol
 */
export async function getCurrentPrice(
  symbol: string,
  marketType: MarketType
): Promise<MarketData> {
  const ticker = formatTicker(symbol, marketType);
  
  // Use previous close endpoint for more reliable data on free tier
  const endpoint = `/v2/aggs/ticker/${ticker}/prev`;
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}?apiKey=${POLYGON_API_KEY}`);
    
    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      throw new Error(`No data found for ${symbol}`);
    }
    
    const result = data.results[0];
    
    return {
      symbol,
      price: result.c, // close price
      change24h: ((result.c - result.o) / result.o) * 100, // % change from open
      volume: result.v,
      marketCap: undefined, // Not available from this endpoint
      marketType,
      lastUpdated: new Date(result.t).toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get prices for multiple symbols
 */
export async function getPrices(
  symbols: string[],
  marketType?: MarketType
): Promise<MarketData[]> {
  const results = await Promise.allSettled(
    symbols.map((symbol) => {
      const type = marketType || detectMarketType(symbol);
      return getCurrentPrice(symbol, type);
    })
  );
  
  return results
    .filter((r): r is PromiseFulfilledResult<MarketData> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Get historical OHLCV data
 */
export async function getHistoricalData(
  symbol: string,
  marketType: MarketType,
  timeframe: '1d' | '1w' | '1m' | '3m'
): Promise<OHLCV[]> {
  const days: Record<string, number> = {
    '1d': 1,
    '1w': 7,
    '1m': 30,
    '3m': 90,
  };
  
  const daysBack = days[timeframe];
  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const to = new Date().toISOString().split('T')[0];
  
  const ticker = formatTicker(symbol, marketType);
  
  // Determine multiplier based on timeframe
  const multiplier = timeframe === '1d' ? 1 : 1;
  const span = timeframe === '1d' ? 'hour' : 'day';
  
  const endpoint = `/v2/aggs/ticker/${ticker}/range/${multiplier}/${span}/${from}/${to}`;
  
  try {
    const response = await fetch(
      `${BASE_URL}${endpoint}?adjusted=true&sort=asc&apiKey=${POLYGON_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.results) {
      return [];
    }
    
    return data.results.map((item: any) => ({
      o: item.o,
      h: item.h,
      l: item.l,
      c: item.c,
      v: item.v,
      t: item.t,
    }));
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

/**
 * Get 24-hour price change
 */
export async function get24HourChange(
  symbol: string,
  marketType: MarketType
): Promise<{ change: number; previousClose: number; currentPrice: number } | null> {
  try {
    const ticker = formatTicker(symbol, marketType);
    const endpoint = `/v2/aggs/ticker/${ticker}/prev`;
    
    const response = await fetch(`${BASE_URL}${endpoint}?apiKey=${POLYGON_API_KEY}`);
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return null;
    }
    
    const result = data.results[0];
    const change = ((result.c - result.o) / result.o) * 100;
    
    return {
      change,
      previousClose: result.o,
      currentPrice: result.c,
    };
  } catch (error) {
    console.error(`Error fetching 24h change for ${symbol}:`, error);
    return null;
  }
}

/**
 * Search for ticker symbols
 */
export async function searchTickers(query: string): Promise<Array<{ ticker: string; name: string; market: string }>> {
  const endpoint = `/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=10`;
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}&apiKey=${POLYGON_API_KEY}`);
    const data = await response.json();
    
    if (!data.results) {
      return [];
    }
    
    return data.results.map((item: any) => ({
      ticker: item.ticker,
      name: item.name,
      market: item.market,
    }));
  } catch (error) {
    console.error('Error searching tickers:', error);
    return [];
  }
}
