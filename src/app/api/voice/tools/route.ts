import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPrice, getHistoricalData, detectMarketType } from '@/lib/market/polygon';
import { getCompleteAnalysis, interpretRSI, interpretMACD } from '@/lib/market/indicators';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';

// Tool execution handlers
async function getMarketPrice(args: { symbol: string }) {
  const symbol = args.symbol.toUpperCase();
  const marketType = detectMarketType(symbol);
  
  try {
    const data = await getCurrentPrice(symbol, marketType);
    const now = new Date();
    
    return {
      success: true,
      data: {
        symbol: data.symbol,
        price: data.price,
        change24h: data.change24h?.toFixed(2),
        volume: data.volume,
        marketType: data.marketType,
        timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Could not fetch price for ${symbol}. The market may be closed or the symbol may be invalid.`
    };
  }
}

async function getTechnicalAnalysis(args: { symbol: string; timeframe?: string }) {
  const symbol = args.symbol.toUpperCase();
  const timeframe = (args.timeframe as '1d' | '1w' | '1m' | '3m') || '1m';
  const marketType = detectMarketType(symbol);
  
  try {
    // First get historical data from Polygon
    const historicalData = await getHistoricalData(symbol, marketType, timeframe);
    
    if (!historicalData || historicalData.length === 0) {
      return {
        success: false,
        error: `No historical data available for ${symbol}. The market may be closed.`
      };
    }
    
    // Then calculate technical indicators
    const indicators = getCompleteAnalysis(historicalData);
    const now = new Date();
    
    // Get current price for context
    const priceData = await getCurrentPrice(symbol, marketType).catch(() => null);
    
    return {
      success: true,
      data: {
        symbol,
        timeframe,
        currentPrice: priceData?.price || historicalData[historicalData.length - 1].c,
        indicators: {
          rsi: indicators.rsi !== null ? {
            value: indicators.rsi.toFixed(1),
            interpretation: interpretRSI(indicators.rsi)
          } : null,
          macd: indicators.macd ? {
            macd: indicators.macd.macd.toFixed(4),
            signal: indicators.macd.signal.toFixed(4),
            histogram: indicators.macd.histogram.toFixed(4),
            interpretation: interpretMACD(indicators.macd)
          } : null,
          movingAverages: {
            sma20: indicators.movingAverages.sma20?.toFixed(2) || null,
            sma50: indicators.movingAverages.sma50?.toFixed(2) || null,
            sma200: indicators.movingAverages.sma200?.toFixed(2) || null,
          }
        },
        dataPoints: historicalData.length,
        timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Could not fetch technical analysis for ${symbol}.`
    };
  }
}

async function getMarketNews(args: { symbol?: string; topic?: string }) {
  try {
    let url: string;
    const query = args.symbol || args.topic || 'cryptocurrency stocks finance';
    const searchQuery = `${query} finance OR stock OR crypto OR market`;
    url = `${NEWS_API_URL}/everything?q=${encodeURIComponent(searchQuery)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch news');
    }
    
    const data = await response.json();
    const now = new Date();
    
    const articles = (data.articles || []).slice(0, 5).map((article: any) => ({
      title: article.title,
      source: article.source?.name || 'Unknown',
      publishedAt: new Date(article.publishedAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      summary: article.description?.slice(0, 150) || '',
    }));
    
    return {
      success: true,
      data: {
        query: args.symbol || args.topic || 'general finance',
        articles,
        timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }
    };
  } catch (error) {
    return {
      success: false,
      error: 'Could not fetch market news.'
    };
  }
}

async function getMultiplePrices(args: { symbols: string[] }) {
  const results = await Promise.allSettled(
    args.symbols.map(symbol => getMarketPrice({ symbol }))
  );
  
  const prices = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map(r => r.value.data)
    .filter(Boolean);
  
  const now = new Date();
  
  return {
    success: true,
    data: {
      prices,
      timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, arguments: args } = body;
    
    let result;
    
    switch (tool) {
      case 'get_market_price':
        result = await getMarketPrice(args);
        break;
      case 'get_technical_analysis':
        result = await getTechnicalAnalysis(args);
        break;
      case 'get_market_news':
        result = await getMarketNews(args);
        break;
      case 'get_multiple_prices':
        result = await getMultiplePrices(args);
        break;
      default:
        result = { success: false, error: `Unknown tool: ${tool}` };
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Tool execution error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Tool execution failed' },
      { status: 500 }
    );
  }
}
