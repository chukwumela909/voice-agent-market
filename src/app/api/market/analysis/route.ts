import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalData, detectMarketType, getCompleteAnalysis, generateTechnicalSummary } from '@/lib/market';
import { getNewsSentiment } from '@/lib/market/news';
import { generateMarketAnalysis } from '@/lib/openai/gpt';
import { rateLimit } from '@/lib/middleware/rateLimit';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const timeframe = (searchParams.get('timeframe') || '1d') as '1d' | '1w' | '1m' | '3m';
    const marketTypeParam = searchParams.get('marketType') as 'crypto' | 'stock' | 'forex' | undefined;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter required' },
        { status: 400 }
      );
    }

    const marketType = marketTypeParam || detectMarketType(symbol);

    // Fetch all data in parallel
    const [historicalData, sentiment] = await Promise.all([
      getHistoricalData(symbol, marketType, timeframe),
      getNewsSentiment(symbol),
    ]);

    // Calculate technical indicators
    const technicalAnalysis = getCompleteAnalysis(historicalData);
    const technicalSummary = generateTechnicalSummary(technicalAnalysis);

    // Generate AI summary
    const aiSummary = await generateMarketAnalysis(
      `Provide a detailed analysis of ${symbol}`,
      { 
        analysis: technicalAnalysis, 
        sentiment,
        prices: [{
          symbol,
          price: historicalData.length > 0 ? historicalData[historicalData.length - 1].c : 0,
          change24h: 0,
          volume: historicalData.length > 0 ? historicalData[historicalData.length - 1].v : 0,
          marketType,
          lastUpdated: new Date().toISOString(),
        }]
      },
      { riskTolerance: 'moderate', preferredMarkets: [marketType], portfolio: [] }
    );

    return NextResponse.json({
      symbol,
      timeframe,
      marketType,
      technicalAnalysis,
      technicalSummary,
      historicalData: historicalData.slice(-50), // Limit data points
      sentiment,
      aiSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate market analysis' },
      { status: 500 }
    );
  }
}
