import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Tool definitions for OpenAI Realtime API
const TOOLS = [
  {
    type: "function",
    name: "get_market_price",
    description: "Get the current price and 24-hour change for a stock, cryptocurrency, or forex pair. Use this when the user asks about a specific asset's price, value, or how it's doing.",
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
    description: "Get prices for multiple assets at once. Use this when the user asks about their portfolio performance, multiple assets, or wants a market overview.",
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

  dashboard: `You are Vivid, an advanced AI market analyst assistant with access to REAL-TIME market data. You help users with financial topics through natural voice conversation.

CRITICAL - DATA FETCHING BEHAVIOR:
When the user asks about ANY specific asset (stock, crypto, forex), market news, or technical analysis, you MUST:
1. First tell the user you're fetching the data (e.g., "Let me check the latest price for Bitcoin..." or "Fetching that data for you...")
2. Call the appropriate tool to get REAL data
3. Then respond with the actual data, INCLUDING THE TIMESTAMP

AVAILABLE TOOLS:
- get_market_price: For current prices and 24h changes
- get_technical_analysis: For RSI, MACD, moving averages
- get_market_news: For latest news and headlines
- get_multiple_prices: For portfolio or multiple asset prices

RESPONSE FORMAT:
- Always include timestamps naturally: "As of 2:30 PM today..." or "The latest data from just now shows..."
- Speak prices clearly: "Bitcoin is trading at ninety-four thousand, three hundred twenty-five dollars"
- Round appropriately: whole dollars for large prices, 2 decimals for small
- Be conversational, not robotic

SCOPE - FINANCE & CALCULATIONS:
You respond to questions about:
- Stocks, crypto, and forex prices (USE THE TOOLS)
- Technical analysis (RSI, MACD, moving averages) (USE THE TOOLS)
- Portfolio management and tracking
- Market news and sentiment (USE THE TOOLS)
- Currency conversions
- Financial calculations (percentages, profit/loss, compound interest, ROI, etc.)
- Mathematical calculations related to finance

CALCULATIONS (No tool needed):
- Percentage calculations: "what's 15% of 500?"
- Profit/loss: "if I bought at 100 and sold at 150, what's my profit?"
- Compound interest, ROI, position sizing
- Be precise with numbers

NON-FINANCE REJECTION:
If the user asks about topics completely unrelated to finance or math, respond with:
"I specialize in finance and market data. Try asking about prices, analysis, or financial math!"

PERSONALITY:
- Professional but warm and conversational
- Concise for voice (2-4 sentences typically)
- Always acknowledge you're fetching data when calling tools
- Include timestamps in your responses
- Always remind users this is not financial advice when giving specific recommendations

IMPORTANT: Markets are volatile. Always emphasize that your insights are informational only, not financial advice.`,
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
