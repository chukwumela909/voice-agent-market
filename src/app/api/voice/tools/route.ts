import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPrice, getHistoricalData, detectMarketType } from '@/lib/market/polygon';
import { getCompleteAnalysis, interpretRSI, interpretMACD } from '@/lib/market/indicators';
import { createAdminClient } from '@/lib/supabase/admin';

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

// Portfolio tools
async function getUserPortfolio(args: {}, userId?: string) {
  if (!userId) {
    return {
      success: false,
      error: 'User not authenticated. Please sign in to view your portfolio.'
    };
  }

  try {
    const supabase = createAdminClient();
    
    // Fetch user's portfolio holdings
    const { data: holdings, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    if (!holdings || holdings.length === 0) {
      return {
        success: true,
        data: {
          holdings: [],
          totalValue: 0,
          totalProfitLoss: 0,
          totalProfitLossPercent: 0,
          message: "You don't have any holdings in your portfolio yet. Would you like to add some?",
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        }
      };
    }

    // Fetch live prices for all holdings
    const holdingsWithPrices = await Promise.all(
      holdings.map(async (holding: any) => {
        try {
          const marketType = detectMarketType(holding.symbol);
          const priceData = await getCurrentPrice(holding.symbol, marketType);
          
          const currentValue = holding.quantity * priceData.price;
          const costBasis = holding.quantity * (holding.avg_buy_price || 0);
          const profitLoss = costBasis > 0 ? currentValue - costBasis : 0;
          const profitLossPercent = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;

          return {
            symbol: holding.symbol,
            quantity: holding.quantity,
            avgBuyPrice: holding.avg_buy_price,
            currentPrice: priceData.price,
            change24h: priceData.change24h,
            currentValue,
            profitLoss,
            profitLossPercent: profitLossPercent.toFixed(2),
            marketType: holding.market_type || marketType,
          };
        } catch (err) {
          // If we can't get price, return holding without live data
          return {
            symbol: holding.symbol,
            quantity: holding.quantity,
            avgBuyPrice: holding.avg_buy_price,
            currentPrice: null,
            change24h: null,
            currentValue: null,
            profitLoss: null,
            profitLossPercent: null,
            marketType: holding.market_type,
            error: 'Could not fetch current price'
          };
        }
      })
    );

    // Calculate totals
    const totalValue = holdingsWithPrices.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    const totalCostBasis = holdingsWithPrices.reduce((sum, h) => {
      return sum + (h.quantity * (h.avgBuyPrice || 0));
    }, 0);
    const totalProfitLoss = totalCostBasis > 0 ? totalValue - totalCostBasis : 0;
    const totalProfitLossPercent = totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0;

    const now = new Date();

    return {
      success: true,
      data: {
        holdings: holdingsWithPrices,
        totalValue: totalValue.toFixed(2),
        totalCostBasis: totalCostBasis.toFixed(2),
        totalProfitLoss: totalProfitLoss.toFixed(2),
        totalProfitLossPercent: totalProfitLossPercent.toFixed(2),
        holdingsCount: holdingsWithPrices.length,
        timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to fetch portfolio: ${error.message}`
    };
  }
}

async function addPortfolioHolding(args: { symbol: string; quantity: number; avgBuyPrice?: number }, userId?: string) {
  if (!userId) {
    return {
      success: false,
      error: 'User not authenticated. Please sign in to manage your portfolio.'
    };
  }

  const symbol = args.symbol.toUpperCase();
  const quantity = args.quantity;
  const avgBuyPrice = args.avgBuyPrice;

  if (quantity <= 0) {
    return {
      success: false,
      error: 'Quantity must be greater than zero.'
    };
  }

  try {
    const supabase = createAdminClient();
    const marketType = detectMarketType(symbol);

    // Check if holding already exists
    const { data: existing } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .single();

    if (existing) {
      // Update existing holding - calculate new average price
      const newQuantity = existing.quantity + quantity;
      let newAvgPrice = existing.avg_buy_price;
      
      if (avgBuyPrice && existing.avg_buy_price) {
        // Weighted average
        newAvgPrice = ((existing.quantity * existing.avg_buy_price) + (quantity * avgBuyPrice)) / newQuantity;
      } else if (avgBuyPrice) {
        newAvgPrice = avgBuyPrice;
      }

      const { error } = await supabase
        .from('portfolios')
        .update({
          quantity: newQuantity,
          avg_buy_price: newAvgPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;

      return {
        success: true,
        data: {
          action: 'updated',
          symbol,
          previousQuantity: existing.quantity,
          addedQuantity: quantity,
          newQuantity,
          avgBuyPrice: newAvgPrice?.toFixed(2),
          message: `Updated your ${symbol} holding. You now have ${newQuantity} ${symbol}.`
        }
      };
    } else {
      // Create new holding
      const { error } = await supabase
        .from('portfolios')
        .insert({
          user_id: userId,
          symbol,
          quantity,
          avg_buy_price: avgBuyPrice || null,
          market_type: marketType,
        });

      if (error) throw error;

      return {
        success: true,
        data: {
          action: 'added',
          symbol,
          quantity,
          avgBuyPrice: avgBuyPrice?.toFixed(2) || null,
          marketType,
          message: `Added ${quantity} ${symbol} to your portfolio.`
        }
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to add holding: ${error.message}`
    };
  }
}

async function removePortfolioHolding(args: { symbol: string }, userId?: string) {
  if (!userId) {
    return {
      success: false,
      error: 'User not authenticated. Please sign in to manage your portfolio.'
    };
  }

  const symbol = args.symbol.toUpperCase();

  try {
    const supabase = createAdminClient();

    // Check if holding exists
    const { data: existing } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .single();

    if (!existing) {
      return {
        success: false,
        error: `You don't have ${symbol} in your portfolio.`
      };
    }

    // Delete the holding
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', existing.id);

    if (error) throw error;

    return {
      success: true,
      data: {
        action: 'removed',
        symbol,
        removedQuantity: existing.quantity,
        message: `Removed ${existing.quantity} ${symbol} from your portfolio.`
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to remove holding: ${error.message}`
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, arguments: args, userId } = body;
    
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
      case 'get_user_portfolio':
        result = await getUserPortfolio(args, userId);
        break;
      case 'add_portfolio_holding':
        result = await addPortfolioHolding(args, userId);
        break;
      case 'remove_portfolio_holding':
        result = await removePortfolioHolding(args, userId);
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
