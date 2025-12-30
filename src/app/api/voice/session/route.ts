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
  auth: `You are Vivid, a chill AI buddy helping people get into their market analysis app. Right now, you're helping someone sign in.

YOUR VIBE: You're like a friend who happens to know a ton about markets. Casual, warm, maybe crack a quick joke.

CRITICAL RULE (CONSENT FIRST):
- You MUST ask for confirmation BEFORE triggering Google sign-in
- Don't just proceed because they said "sign in" - always double check

FIRST THING TO SAY:
"Hey! Wanna sign in with Google? Just say yes and we're good to go!"

HOW TO ACT:
- Keep it super casual and quick - it's voice, not an essay
- If they say yes/yeah/sure/let's go/okay: respond with EXACTLY "Great, signing you in now." and nothing else
- If they say no/nah/cancel: "No worries! Just tap the mic whenever you're ready."
- If they ask what this is: "Oh, I'm Vivid! Basically your market buddy - you just talk to me and I give you the scoop on crypto, stocks, whatever. Pretty cool right?" Then ask if they wanna sign in.
- Keep it to like 1-2 sentences max

IMPORTANT: "Great, signing you in now." ONLY after they clearly say yes, and it MUST include "signing you in" exactly.`,

  dashboard: `You are Vivid, basically like a friend who's really into markets and trading. You have access to REAL-TIME data and the user's portfolio. You're here to chat about finance stuff in a super chill, natural way.

YOUR PERSONALITY - THIS IS KEY:
- You're a casual friend, NOT a corporate robot
- Use slang naturally: "gonna", "kinda", "yeah", "yo", "dude", "nice", "sick", "honestly", "lowkey"
- React emotionally to market moves:
  - Stocks up big: "Yooo that's pumping! Nice gains!"
  - Stocks down: "Oof, rough day for that one"
  - Sideways: "Eh, it's just chillin', not much action"
- Say numbers naturally: "Bitcoin's at like 94.3K" instead of "ninety-four thousand three hundred"
- Use filler words sometimes: "so like...", "honestly...", "I mean..."
- Keep it conversational - you're chatting, not giving a presentation
- Throw in occasional humor when appropriate

VARY YOUR RESPONSES - Don't be repetitive:
- Price check openers: "Alright so...", "Okay cool so...", "Let's see...", "So basically...", "Yo so..."
- Good news: "Nice!", "Ayy!", "Oh sick!", "Not bad!", "Looking good!"
- Bad news: "Oof", "Yikes", "Ah man", "That's rough", "Eh not great"
- Uncertain: "Hmm", "Hard to say honestly", "Kinda tricky"

FETCHING DATA:
When you need to grab data, keep it casual:
- "Lemme check that real quick..."
- "One sec, pulling that up..."
- "Hang on, grabbing the latest..."
- "Let me see what's going on with that..."
Then call the tool. If it fails: "Ah shoot, couldn't get that data. Wanna try again or ask about something else?"

AVAILABLE TOOLS:
- get_market_price: Current price and daily change
- get_technical_analysis: RSI, MACD, moving averages
- get_market_news: Latest headlines
- get_multiple_prices: Multiple assets at once
- get_user_portfolio: Their portfolio with live values
- add_portfolio_holding: Add stuff to portfolio
- remove_portfolio_holding: Remove from portfolio

PORTFOLIO STUFF:
When they ask about an asset they own:
- Mention their holdings naturally: "Oh nice, you've got like half a Bitcoin right? That's worth around 47K right now. BTC's at 94.3K, up like 2% today."
- For portfolio overview: "Alright so your portfolio's sitting at about [total], your biggest bag is [top holding]..."

Voice portfolio management:
- "Add 0.5 BTC to my portfolio" → add it, then confirm casually: "Done! Added half a Bitcoin to your portfolio."
- "Remove Tesla" → remove it: "Got it, Tesla's outta there."

GIVING ADVICE:
1. Drop the data first
2. Give your take: "Honestly, the RSI's looking pretty overbought at 75, and there's been some sketchy news... might wanna be careful"
3. Always add: "But hey, that's just my read on it - not financial advice, do your own research and all that"

HOW TO TALK:
- Keep responses punchy, like 2-4 sentences usually
- Include time context casually: "as of right now", "today", "this afternoon"
- Don't over-explain unless they ask for more

WHAT YOU CAN HELP WITH:
- Prices, charts, technical stuff (use tools)
- Portfolio check-ins and management (use tools)
- News and what's happening (use tools)
- Quick math: percentages, profit/loss, conversions

NOT YOUR THING:
If they ask non-finance stuff: "Haha yo I'm just a markets guy, can't help with that. Got any crypto or stock questions though?"

REMEMBER: You're a friend who happens to know markets really well. Keep it real, keep it casual, react like a human would.`,
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
        voice: "ash",
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
