import type { TechnicalIndicators, OHLCV } from '@/types';

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate smoothed RSI for remaining periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const currentGain = change >= 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) {
    return null;
  }

  const slice = prices.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / period;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);
  
  // Start with SMA
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
  
  // Calculate EMA for remaining periods
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } | null {
  if (prices.length < slowPeriod + signalPeriod) {
    return null;
  }

  // Calculate MACD line (fast EMA - slow EMA)
  const macdValues: number[] = [];
  
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    const slice = prices.slice(0, i + 1);
    const fastEMA = calculateEMA(slice, fastPeriod);
    const slowEMA = calculateEMA(slice, slowPeriod);
    
    if (fastEMA !== null && slowEMA !== null) {
      macdValues.push(fastEMA - slowEMA);
    }
  }

  if (macdValues.length < signalPeriod) {
    return null;
  }

  // Calculate signal line (EMA of MACD)
  const signal = calculateEMA(macdValues, signalPeriod);
  const macd = macdValues[macdValues.length - 1];

  if (signal === null) {
    return null;
  }

  return {
    macd,
    signal,
    histogram: macd - signal,
  };
}

/**
 * Calculate all moving averages
 */
export function calculateMovingAverages(prices: number[]): {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
} {
  return {
    sma20: calculateSMA(prices, 20),
    sma50: calculateSMA(prices, 50),
    sma200: calculateSMA(prices, 200),
  };
}

/**
 * Get complete technical analysis from OHLCV data
 */
export function getCompleteAnalysis(historicalData: OHLCV[]): TechnicalIndicators {
  const closePrices = historicalData.map((d) => d.c);

  return {
    rsi: calculateRSI(closePrices),
    macd: calculateMACD(closePrices),
    movingAverages: calculateMovingAverages(closePrices),
  };
}

/**
 * Interpret RSI value
 */
export function interpretRSI(rsi: number | null): string {
  if (rsi === null) return 'insufficient data';
  if (rsi >= 70) return 'overbought';
  if (rsi <= 30) return 'oversold';
  if (rsi >= 60) return 'bullish';
  if (rsi <= 40) return 'bearish';
  return 'neutral';
}

/**
 * Interpret MACD
 */
export function interpretMACD(macd: { macd: number; signal: number; histogram: number } | null): string {
  if (macd === null) return 'insufficient data';
  
  if (macd.histogram > 0 && macd.macd > 0) {
    return 'strong bullish momentum';
  }
  if (macd.histogram > 0) {
    return 'bullish momentum building';
  }
  if (macd.histogram < 0 && macd.macd < 0) {
    return 'strong bearish momentum';
  }
  if (macd.histogram < 0) {
    return 'bearish momentum building';
  }
  return 'neutral';
}

/**
 * Generate technical analysis summary
 */
export function generateTechnicalSummary(indicators: TechnicalIndicators): string {
  const parts: string[] = [];
  
  if (indicators.rsi !== null) {
    parts.push(`RSI at ${indicators.rsi.toFixed(1)} (${interpretRSI(indicators.rsi)})`);
  }
  
  if (indicators.macd) {
    parts.push(`MACD shows ${interpretMACD(indicators.macd)}`);
  }
  
  const { sma20, sma50, sma200 } = indicators.movingAverages;
  if (sma20 && sma50) {
    if (sma20 > sma50) {
      parts.push('short-term trend is bullish (SMA20 > SMA50)');
    } else {
      parts.push('short-term trend is bearish (SMA20 < SMA50)');
    }
  }
  
  return parts.join('. ') || 'Insufficient data for technical analysis.';
}
