import OpenAI from 'openai';
import { config } from '@/lib/config';
import type { Intent, UserContext, MarketData, SentimentData, TechnicalIndicators } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract intent and entities from user transcript
 */
export async function extractIntent(
  transcript: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<Intent> {
  const systemPrompt = `You are an intent extraction system for a financial market analysis voice agent.
Extract the user's intent from their query. Consider conversation history for context.

Known crypto symbols: ${config.cryptoSymbols.join(', ')}
Known forex pairs: ${config.forexPairs.join(', ')}
Common stocks: AAPL, TSLA, MSFT, GOOGL, AMZN, META, NVDA, etc.

Return ONLY valid JSON with this structure:
{
  "intent": "price_check" | "analysis" | "portfolio_advice" | "news" | "alert_create" | "alert_manage" | "general_question" | "follow_up",
  "symbols": ["BTC", "ETH"], // uppercase, normalized (e.g., "Bitcoin" -> "BTC")
  "timeframe": "1d" | "1w" | "1m" | "3m",
  "market_type": "crypto" | "stock" | "forex" | "all",
  "follow_up_context": "string if this is a follow-up question"
}

Rules:
- If user says "bitcoin", convert to "BTC"
- If user says "ethereum", convert to "ETH"
- If no timeframe mentioned, default to "1d"
- If asking about "my portfolio" or "my holdings", intent is "portfolio_advice"
- If user says "what about X" or "and X?", it's likely a "follow_up"
- For general market questions without specific symbols, use "general_question"`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-4).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: transcript },
  ];

  const completion = await openai.chat.completions.create({
    model: config.gpt.model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.3, // Lower temperature for more consistent extraction
    max_tokens: 200,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error('No response from intent extraction');
  }

  return JSON.parse(content) as Intent;
}

/**
 * Generate market analysis response using GPT-4
 */
export async function generateMarketAnalysis(
  userQuery: string,
  marketData: {
    prices?: MarketData[];
    analysis?: TechnicalIndicators;
    sentiment?: SentimentData;
  },
  userContext: UserContext,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const systemPrompt = `You are an expert financial market analyst AI assistant named "Vivid".
You provide insights on crypto, forex, and stocks in a conversational, friendly tone.

CRITICAL RULES:
1. Keep responses concise (under 150 words) - this will be spoken aloud
2. Be conversational and natural, like talking to a friend who's a finance expert
3. Always acknowledge uncertainty - use phrases like "based on current data", "indicators suggest"
4. Never give direct buy/sell recommendations
5. End responses naturally, don't always add disclaimers (they're shown in UI)

User Context:
- Risk tolerance: ${userContext.riskTolerance}
- Preferred markets: ${userContext.preferredMarkets.join(', ')}
- Portfolio: ${userContext.portfolio.length > 0 ? userContext.portfolio.map((p) => `${p.symbol}: ${p.quantity}`).join(', ') : 'No holdings tracked'}

Current Market Data:
${JSON.stringify(marketData, null, 2)}

Response style:
- Start with a brief, direct answer to the question
- Add 1-2 relevant insights or context
- If applicable, mention a key indicator or trend
- Keep it natural and flowing for voice delivery`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userQuery },
  ];

  const completion = await openai.chat.completions.create({
    model: config.gpt.model,
    messages,
    temperature: config.gpt.temperature,
    max_tokens: config.gpt.maxTokens,
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error('No response from GPT');
  }

  return response;
}

/**
 * Generate a quick price response
 */
export async function generatePriceResponse(
  symbols: string[],
  prices: MarketData[]
): Promise<string> {
  if (prices.length === 0) {
    return "I couldn't fetch the current prices. Let me try again in a moment.";
  }

  if (prices.length === 1) {
    const p = prices[0];
    const direction = p.change24h >= 0 ? 'up' : 'down';
    const emoji = p.change24h >= 0 ? '📈' : '📉';
    return `${p.symbol} is currently at $${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, ${direction} ${Math.abs(p.change24h).toFixed(2)}% in the last 24 hours. ${emoji}`;
  }

  // Multiple symbols
  const priceStrings = prices.map((p) => {
    const direction = p.change24h >= 0 ? 'up' : 'down';
    return `${p.symbol} at $${p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${direction} ${Math.abs(p.change24h).toFixed(2)}%)`;
  });

  return `Here are the current prices: ${priceStrings.join(', ')}.`;
}

/**
 * Generate sentiment summary
 */
export async function generateSentimentSummary(
  symbol: string,
  sentiment: SentimentData
): Promise<string> {
  const sentimentLabel =
    sentiment.score > 0.3 ? 'positive' : sentiment.score < -0.3 ? 'negative' : 'neutral';

  return `Market sentiment for ${symbol} is currently ${sentimentLabel}. ${sentiment.summary}`;
}

/**
 * Generate portfolio advice
 */
export async function generatePortfolioAdvice(
  userContext: UserContext,
  marketData: MarketData[]
): Promise<string> {
  if (userContext.portfolio.length === 0) {
    return "I don't see any holdings in your portfolio yet. Would you like to add some positions so I can help you track them?";
  }

  const systemPrompt = `You are a friendly financial advisor assistant. The user wants insights about their portfolio.

User's Portfolio:
${userContext.portfolio.map((h) => `- ${h.symbol}: ${h.quantity} units at avg price $${h.avg_buy_price}`).join('\n')}

Current Prices:
${marketData.map((m) => `- ${m.symbol}: $${m.price} (${m.change24h >= 0 ? '+' : ''}${m.change24h.toFixed(2)}%)`).join('\n')}

Risk Tolerance: ${userContext.riskTolerance}

Give a brief, conversational summary of their portfolio performance. Keep it under 100 words.
Do NOT give specific buy/sell advice. Focus on observations and general insights.`;

  const completion = await openai.chat.completions.create({
    model: config.gpt.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'How is my portfolio doing?' },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  return completion.choices[0].message.content || "I couldn't analyze your portfolio right now.";
}
