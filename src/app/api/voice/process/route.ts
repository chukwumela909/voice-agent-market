import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeAudio } from '@/lib/openai/whisper';
import { extractIntent, generateMarketAnalysis, generatePriceResponse, generatePortfolioAdvice } from '@/lib/openai/gpt';
import { textToSpeechBase64 } from '@/lib/openai/tts';
import { getPrices, getHistoricalData, detectMarketType, getCompleteAnalysis } from '@/lib/market';
import { getNewsSentiment } from '@/lib/market/news';
import { rateLimit } from '@/lib/middleware/rateLimit';
import { requireAuth } from '@/lib/middleware/auth';
import type { UserContext, Intent, MarketData, SentimentData, TechnicalIndicators } from '@/types';

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimit(request, { maxRequests: 20, windowMs: 60000 });
  if (rateLimitResponse) return rateLimitResponse;

  // Authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob | null;
    const textInput = formData.get('text') as string | null;
    const conversationHistoryRaw = formData.get('conversationHistory') as string | null;

    // Parse conversation history if provided
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = 
      conversationHistoryRaw ? JSON.parse(conversationHistoryRaw) : [];

    let transcript: string;

    // Get transcript from audio or text
    if (audioFile && audioFile.size > 0) {
      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      transcript = await transcribeAudio(buffer, audioFile.type);
    } else if (textInput) {
      transcript = textInput;
    } else {
      return NextResponse.json(
        { error: 'No audio or text input provided' },
        { status: 400 }
      );
    }

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not transcribe audio or empty input' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch user context
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId);

    const userContext: UserContext = {
      riskTolerance: userProfile?.risk_tolerance || 'moderate',
      preferredMarkets: userProfile?.preferred_markets || ['crypto'],
      portfolio: portfolio || [],
    };

    // Extract intent
    const intent = await extractIntent(transcript, conversationHistory);

    // Fetch market data based on intent
    let marketData: {
      symbols: MarketData[];
      analysis?: TechnicalIndicators;
      sentiment?: SentimentData;
    } = { symbols: [] };

    let response: string;

    switch (intent.intent) {
      case 'price_check': {
        if (intent.symbols.length > 0) {
          const prices = await getPrices(intent.symbols);
          marketData.symbols = prices;
          response = await generatePriceResponse(intent.symbols, prices);
        } else {
          response = "Which asset would you like me to check the price for? You can ask about crypto like Bitcoin or Ethereum, stocks like Apple or Tesla, or forex pairs.";
        }
        break;
      }

      case 'analysis': {
        if (intent.symbols.length > 0) {
          const symbol = intent.symbols[0];
          const marketType = detectMarketType(symbol);
          
          // Fetch all data in parallel
          const [prices, historicalData, sentiment] = await Promise.all([
            getPrices(intent.symbols),
            getHistoricalData(symbol, marketType, intent.timeframe),
            getNewsSentiment(symbol),
          ]);

          const analysis = getCompleteAnalysis(historicalData);
          
          marketData = {
            symbols: prices,
            analysis,
            sentiment,
          };

          response = await generateMarketAnalysis(
            transcript,
            marketData,
            userContext,
            conversationHistory
          );
        } else {
          response = "Which asset would you like me to analyze? Just name a cryptocurrency, stock, or forex pair.";
        }
        break;
      }

      case 'portfolio_advice': {
        if (userContext.portfolio.length > 0) {
          const portfolioSymbols = userContext.portfolio.map((h) => h.symbol);
          const prices = await getPrices(portfolioSymbols);
          marketData.symbols = prices;
          response = await generatePortfolioAdvice(userContext, prices);
        } else {
          response = "I don't see any holdings in your portfolio yet. Would you like to add some positions so I can help you track them?";
        }
        break;
      }

      case 'news': {
        if (intent.symbols.length > 0) {
          const symbol = intent.symbols[0];
          const sentiment = await getNewsSentiment(symbol);
          marketData.sentiment = sentiment;
          
          const sentimentLabel = sentiment.score > 0.3 ? 'positive' : sentiment.score < -0.3 ? 'negative' : 'neutral';
          response = `Market sentiment for ${symbol} is ${sentimentLabel}. ${sentiment.summary}`;
          
          if (sentiment.keyPoints.length > 0) {
            response += ` Key points: ${sentiment.keyPoints.slice(0, 2).join('. ')}.`;
          }
        } else {
          response = "Which asset would you like to hear the news sentiment for?";
        }
        break;
      }

      case 'alert_create':
      case 'alert_manage': {
        response = "I can help you manage price alerts. You can set alerts through the alerts section in your dashboard, or tell me something like 'alert me when Bitcoin goes above 50,000'.";
        break;
      }

      case 'follow_up':
      case 'general_question':
      default: {
        // For general questions or follow-ups, use the full analysis generation
        if (intent.symbols.length > 0) {
          const prices = await getPrices(intent.symbols);
          marketData.symbols = prices;
        }
        
        response = await generateMarketAnalysis(
          transcript,
          marketData,
          userContext,
          conversationHistory
        );
        break;
      }
    }

    // Generate TTS audio
    const audioBase64 = await textToSpeechBase64(response);

    // Save conversation to database
    await supabase.from('conversations').insert({
      user_id: userId,
      user_message: transcript,
      agent_response: response,
      context: {
        intent,
        symbols: intent.symbols,
        marketData: marketData.symbols,
        sentiment: marketData.sentiment,
      },
    });

    return NextResponse.json({
      transcript,
      response,
      audioBase64,
      marketData,
      intent,
    });
  } catch (error) {
    console.error('Error processing voice:', error);
    return NextResponse.json(
      { error: 'Failed to process voice request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
