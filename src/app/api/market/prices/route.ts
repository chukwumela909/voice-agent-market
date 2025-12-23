import { NextRequest, NextResponse } from 'next/server';
import { getPrices, detectMarketType } from '@/lib/market';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/middleware/rateLimit';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const marketType = searchParams.get('marketType') as 'crypto' | 'stock' | 'forex' | undefined;

    if (!symbolsParam) {
      return NextResponse.json(
        { error: 'Symbols parameter required' },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());
    const supabase = createAdminClient();

    // Check cache first
    const { data: cached } = await supabase
      .from('market_cache')
      .select('*')
      .in('symbol', symbols)
      .gte('last_updated', new Date(Date.now() - config.cache.quotes).toISOString());

    const cachedSymbols = new Set(cached?.map((c) => c.symbol) || []);
    const symbolsToFetch = symbols.filter((s) => !cachedSymbols.has(s));

    // Fetch missing data
    let freshData: any[] = [];
    if (symbolsToFetch.length > 0) {
      freshData = await getPrices(symbolsToFetch, marketType);

      // Update cache
      if (freshData.length > 0) {
        const cacheUpdates = freshData.map((item) => ({
          symbol: item.symbol,
          price: item.price,
          change_24h: item.change24h,
          volume: item.volume || 0,
          market_cap: item.marketCap || 0,
          market_type: item.marketType,
          last_updated: new Date().toISOString(),
        }));

        await supabase
          .from('market_cache')
          .upsert(cacheUpdates, { onConflict: 'symbol' });
      }
    }

    // Combine cached and fresh data
    const cachedData = (cached || []).map((c) => ({
      symbol: c.symbol,
      price: c.price,
      change24h: c.change_24h,
      volume: c.volume,
      marketCap: c.market_cap,
      marketType: c.market_type,
      lastUpdated: c.last_updated,
    }));

    const allData = [...cachedData, ...freshData];

    // Sort by original symbol order
    const sortedData = symbols
      .map((s) => allData.find((d) => d.symbol === s))
      .filter(Boolean);

    return NextResponse.json({
      data: sortedData,
      cached: cached?.length || 0,
      fresh: freshData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market prices' },
      { status: 500 }
    );
  }
}
