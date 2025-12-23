import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Tool definitions for OpenAI Realtime API
const TOOLS = [
  {
    type: "function",
    name: "get_market_price",
    description: "Get the current price and 24-hour change for a stock, cryptocurrency, or forex pair. Use this when the user asks about a specific asset's price, value, or how it's doing. IMPORTANT: If the user holds this asset in their portfolio, also mention their holdings and current value.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The ticker symbol (e.g., BTC for Bitcoin, ETH for Ethereum, AAPL for Apple, TSLA for Tesla, EURUSD for Euro/Dollar)"
        }
      },
      required: ["symbol"]
    }
  },
  {
    type: "function",
    name: "get_technical_analysis",
    description: "Get technical analysis indicators (RSI, MACD, moving averages) for a symbol. Use this when the user asks about technical analysis, indicators, trends, or wants a deeper market analysis.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The ticker symbol to analyze"
        },
        timeframe: {
          type: "string",
          enum: ["1d", "1w", "1m", "3m"],
          description: "The timeframe for analysis: 1d (1 day), 1w (1 week), 1m (1 month), 3m (3 months). Default is 1m."
        }
      },
      required: ["symbol"]
    }
  },
  {
    type: "function",
    name: "get_market_news",
    description: "Get the latest financial news and headlines. Use this when the user asks about news, market updates, what's happening in the market, or sentiment for a specific asset.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Optional: A specific ticker symbol to get news about (e.g., BTC, AAPL)"
        },
        topic: {
          type: "string",
          description: "Optional: A topic to search for (e.g., 'cryptocurrency', 'federal reserve', 'earnings')"
        }
      },
      required: []
    }
  },
  {
    type: "function",
    name: "get_multiple_prices",
    description: "Get prices for multiple assets at once. Use this when the user asks about multiple assets or wants a market overview.",
    parameters: {
      type: "object",
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "Array of ticker symbols to get prices for"
        }
      },
      required: ["symbols"]
    }
  },
  {
    type: "function",
    name: "get_user_portfolio",
    description: "Get the user's complete portfolio with live prices, values, and profit/loss. Use this when the user asks about their portfolio, holdings, investments, how their assets are doing, or wants portfolio advice. This fetches real-time data.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    type: "function",
    name: "add_portfolio_holding",
    description: "Add a new holding or update an existing holding in the user's portfolio. Use this when the user wants to add an asset to their portfolio, bought something, or wants to track a new investment.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The ticker symbol to add (e.g., BTC, ETH, AAPL)"
        },
        quantity: {
          type: "number",
          description: "The quantity/amount of the asset"
        },
        avgBuyPrice: {
          type: "number",
          description: "The average buy price per unit (optional, for tracking profit/loss)"
        }
      },
      required: ["symbol", "quantity"]
    }
  },
  {
    type: "function",
    name: "remove_portfolio_holding",
    description: "Remove a holding from the user's portfolio. Use this when the user wants to remove an asset, sold everything, or no longer wants to track an investment.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The ticker symbol to remove from portfolio"
        }
      },
      required: ["symbol"]
    }
  }
];

// System prompts for different contexts
const SYSTEM_PROMPTS = {
  auth: `You are Vivid, an AI assistant for a voice-driven market analysis app. You are currently helping a user authenticate.

CURRENT TASK: Help the user sign in or sign up with Google authentication.

CRITICAL RULE (CONSENT FIRST):
- You MUST ask for explicit confirmation BEFORE triggering Google sign-in.
- Do NOT proceed just because the user mentions "sign in" or "google". Always ask first.

DEFAULT FIRST QUESTION (ask this early):
"Would you like to continue with Google to sign in or sign up? Please say yes to proceed or no to cancel."

BEHAVIOR:
- Be warm, friendly, and concise since this is voice interaction
- If the user clearly affirms (e.g., "yes", "confirm", "continue", "okay", "go ahead"), respond with EXACTLY: "Great, signing you in now." and nothing else
- If the user declines (e.g., "no", "cancel", "stop"), respond with: "No problem. Tap the mic button whenever you're ready to sign in."
- If the user asks what this app does, briefly explain: "Vivid is your personal AI market analyst. Just speak naturally to get real-time insights on crypto, stocks, and forex." Then ask the default first question.
- If the user's intent is unclear, repeat the default first question
- Keep responses under 2 sentences

IMPORTANT: Your "Great, signing you in now." response MUST ONLY happen after explicit user confirmation, and it MUST contain the phrase "signing you in" so the app knows to trigger authentication.`,

  dashboard: `You are Vivid, an advanced AI market analyst assistant with access to REAL-TIME market data and the user's portfolio. You help users with financial topics through natural voice conversation.

CRITICAL - DATA FETCHING COMMUNICATION:
Whenever you need to fetch external data (prices, news, portfolio, technical analysis), you MUST:
1. FIRST tell the user you're pausing to fetch data: "Let me grab the latest data on that..." or "One moment while I fetch the current prices..."
2. Call the appropriate tool
3. If successful: respond with the data including timestamps
4. If error: tell the user "I encountered an issue fetching that data. Let me try again or you can ask about something else."

AVAILABLE TOOLS:
- get_market_price: Current price and 24h change for any asset
- get_technical_analysis: RSI, MACD, moving averages for deeper analysis
- get_market_news: Latest financial news and headlines
- get_multiple_prices: Prices for multiple assets at once
- get_user_portfolio: User's complete portfolio with LIVE values and profit/loss
- add_portfolio_holding: Add or update a holding in user's portfolio
- remove_portfolio_holding: Remove a holding from user's portfolio

PORTFOLIO AWARENESS - VERY IMPORTANT:
When the user asks about ANY asset they might hold in their portfolio:
1. First fetch the price data
2. Check if they hold this asset (from the portfolio context provided)
3. If they hold it, PROACTIVELY mention: "You currently hold [quantity] [symbol] worth approximately [value]. The current price is [price], [up/down] [change]% today."
4. Example: "You currently hold 0.5 Bitcoin worth about forty-seven thousand dollars. Bitcoin is trading at ninety-four thousand, three hundred twenty-five dollars, up 2.3% as of 3:45 PM."

When the user asks about their portfolio:
1. Use get_user_portfolio to fetch live data with current values
2. Summarize total value, top holdings, and overall performance
3. Mention any significant gains or losses

PORTFOLIO UPDATES VIA VOICE:
Users can manage their portfolio by voice:
- "Add 0.5 Bitcoin to my portfolio at 94,000" → use add_portfolio_holding
- "Remove Tesla from my portfolio" → use remove_portfolio_holding
- Always confirm the action after completing it

GIVING ADVICE (Data First, Then Suggestion):
When asked for advice or recommendations:
1. First present the DATA: current price, technical indicators, recent news
2. Then offer a SUGGESTION with context: "Based on the RSI showing overbought at 75, and recent news about regulatory concerns, you might consider..."
3. Always end with DISCLAIMER: "Remember, this is just my analysis and not financial advice. Always do your own research."

RESPONSE FORMAT:
- Always include timestamps: "As of 3:45 PM today..." 
- Speak prices clearly: "ninety-four thousand, three hundred twenty-five dollars"
- Be conversational and natural
- Keep responses focused (3-5 sentences for simple queries, more for analysis)

SCOPE - FINANCE & CALCULATIONS:
- Stocks, crypto, forex prices (USE TOOLS)
- Technical analysis (USE TOOLS)
- Portfolio tracking and management (USE TOOLS)
- Market news and sentiment (USE TOOLS)
- Currency conversions, percentages, profit/loss calculations

CALCULATIONS (No tool needed):
- Percentage calculations: "what's 15% of 500?"
- Profit/loss math: "if I bought at 100 and sold at 150..."
- Compound interest, ROI, position sizing

NON-FINANCE REJECTION:
"I specialize in finance and market data. Try asking about prices, your portfolio, or financial calculations!"

PERSONALITY:
- Professional but warm and conversational
- Always communicate when fetching data
- Include timestamps in responses
- Proactively mention user's holdings when relevant
- Present data first, suggestions second, disclaimer last

IMPORTANT: Markets are volatile. Your insights are informational only, not financial advice.`,
};

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const context = body.context || "dashboard";
    const userId = body.userId;

    // Fetch user context if authenticated AND service role key is available
    let userContextString = "";
    if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createAdminClient();
        
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", userId)
          .single();

        const { data: portfolio } = await supabase
          .from("portfolios")
          .select("*")
          .eq("user_id", userId);

        if (profile) {
          userContextString = `

USER CONTEXT:
- Risk Tolerance: ${profile.risk_tolerance || "moderate"}
- Preferred Markets: ${(profile.preferred_markets || ["crypto"]).join(", ")}
- Portfolio Holdings: ${portfolio?.length ? portfolio.map((p: any) => `${p.symbol} (${p.quantity})`).join(", ") : "None yet"}`;
        }
      } catch (e) {
        console.warn('Failed to fetch user context:', e);
        // Continue without user context
      }
    }

    const systemPrompt = SYSTEM_PROMPTS[context as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.dashboard;

    // Only include tools for dashboard context
    const sessionTools = context === 'dashboard' ? TOOLS : [];

    // Create a session with OpenAI Realtime API
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "coral",
        instructions: systemPrompt + userContextString,
        tools: sessionTools,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.7,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("OpenAI Realtime session error:", error);
      return NextResponse.json(
        { error: "Failed to create voice session", details: error },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      client_secret: data.client_secret.value,
      expires_at: data.client_secret.expires_at,
    });
  } catch (error: any) {
    console.error("Voice session error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
