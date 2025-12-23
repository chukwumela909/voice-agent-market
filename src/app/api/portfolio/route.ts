import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPrices } from '@/lib/market';
import { requireAuth } from '@/lib/middleware/auth';
import { rateLimit } from '@/lib/middleware/rateLimit';
import { validateInput, portfolioCreateSchema } from '@/lib/validation/schemas';
import type { PortfolioHolding, PortfolioSummary } from '@/types';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // Authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const supabase = createAdminClient();

    // Fetch user's portfolio
    const { data: holdings, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    if (!holdings || holdings.length === 0) {
      return NextResponse.json<PortfolioSummary>({
        holdings: [],
        totalValue: 0,
        totalProfitLoss: 0,
        totalProfitLossPercent: 0,
      });
    }

    // Fetch current prices for all holdings
    const symbols = holdings.map((h) => h.symbol);
    const currentPrices = await getPrices(symbols);

    // Create price lookup map
    const priceMap = new Map(currentPrices.map((p) => [p.symbol, p.price]));

    // Calculate values
    const enrichedHoldings: PortfolioHolding[] = holdings.map((holding) => {
      const currentPrice = priceMap.get(holding.symbol) || holding.avg_buy_price;
      const totalValue = holding.quantity * currentPrice;
      const costBasis = holding.quantity * holding.avg_buy_price;
      const profitLoss = totalValue - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      return {
        id: holding.id,
        symbol: holding.symbol,
        quantity: holding.quantity,
        avgBuyPrice: holding.avg_buy_price,
        currentPrice,
        totalValue,
        profitLoss,
        profitLossPercent,
        marketType: holding.market_type,
      };
    });

    const totalValue = enrichedHoldings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalCostBasis = enrichedHoldings.reduce((sum, h) => sum + h.quantity * h.avgBuyPrice, 0);
    const totalProfitLoss = totalValue - totalCostBasis;
    const totalProfitLossPercent = totalCostBasis > 0 ? (totalProfitLoss / totalCostBasis) * 100 : 0;

    return NextResponse.json<PortfolioSummary>({
      holdings: enrichedHoldings,
      totalValue,
      totalProfitLoss,
      totalProfitLossPercent,
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // Authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const body = await request.json();
    const validated = validateInput(portfolioCreateSchema, body);

    const supabase = createAdminClient();

    // Check if holding already exists
    const { data: existing } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', validated.symbol)
      .single();

    if (existing) {
      // Update existing holding (average the prices)
      const newQuantity = existing.quantity + validated.quantity;
      const newAvgPrice =
        (existing.avg_buy_price * existing.quantity + validated.avgBuyPrice * validated.quantity) /
        newQuantity;

      const { data, error } = await supabase
        .from('portfolios')
        .update({
          quantity: newQuantity,
          avg_buy_price: newAvgPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Create new holding
      const { data, error } = await supabase
        .from('portfolios')
        .insert({
          user_id: userId,
          symbol: validated.symbol,
          quantity: validated.quantity,
          avg_buy_price: validated.avgBuyPrice,
          market_type: validated.marketType,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
  } catch (error) {
    console.error('Error adding to portfolio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add holding' },
      { status: 500 }
    );
  }
}
