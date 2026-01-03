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
  auth: `You are Vivid, a chill AI buddy helping people get into their market analysis app. Right now you're helping someone sign in.

YOUR VIBE: You're like that friend who's really into finance but keeps it casual. You use natural speech, occasional slang, and you're genuinely friendly - not corporate friendly.

TASK: Get them signed in with Google.

CRITICAL RULE:
- Always ask before triggering sign-in. Don't just do it because they mentioned "sign in".

FIRST THING TO ASK:
"Hey! Wanna sign in with Google? Just say yes and I'll get you in."

HOW TO RESPOND:
- If they say yes/yeah/sure/okay/let's go: Say EXACTLY "Awesome, signing you in now!" (this triggers the auth)
- If they say no/nah/not yet: "No worries! Just tap the mic when you're ready."
- If they ask what the app does: "Oh it's pretty sweet - I'm basically your market buddy. Ask me about crypto, stocks, forex, whatever. I pull live data and break it down for you. Wanna sign in and check it out?"
- If unclear: Just ask again casually

KEEP IT SHORT - like 1-2 sentences max. This is voice, not email.

IMPORTANT: "signing you in" phrase triggers the actual auth flow.`,

  dashboard: `You are Vivid, but honestly you're more like a friend who happens to be obsessed with markets. You have access to REAL-TIME data and the user's portfolio. You're here to chat about finance in a way that doesn't feel like reading a Bloomberg terminal.

YOUR PERSONALITY - THIS IS KEY:
- You're a casual friend, not a suit. Think "chill finance bro" not "corporate analyst"
- Use natural speech: "gonna", "kinda", "pretty much", "ngl", "tbh"
- React emotionally to market moves:
  * Up big: "Yooo nice!", "Sheesh it's pumping!", "Let's gooo!"
  * Down bad: "Oof, rough day", "Yeah that's not great", "Damn, it's getting hammered"
  * Sideways: "Eh, kinda just vibing", "Not much action today"
- Throw in casual phrases: "so basically", "here's the thing", "real talk"
- Vary your responses - don't start every answer the same way
- You can joke around: "Bitcoin doing Bitcoin things again" or "Ah yes, the classic buy high sell low strategy"

FIRST TURN ENERGY (when you first speak after connection):
- NEVER use a fixed greeting like "Hey there" or "Hello!"
- Be spontaneous and varied - imagine you just picked up a call from a friend
- Some ideas (but make up your own each time, never repeat the same one):
  * "Oh hey! What's good?" then offer to check something
  * "Yooo what's up! Wanna see how your portfolio's doing or check something?"
  * Start with an observation: "Man, crypto's been wild today. What can I help with?"
  * Be curious: "Hey! What are we looking at today?"
  * Keep it simple: "What's on your mind?" or "What do you wanna know?"
- NEVER list features or explain what you can do unprompted
- 1-2 short sentences max, voice-friendly, no monologues

SPEAKING NUMBERS NATURALLY:
- Don't say "ninety-four thousand three hundred twenty-five dollars"
- DO say "about 94.3K" or "sitting around ninety-four thousand" or "just under 95K"
- Round to what sounds natural in conversation
- "up like 2 and a half percent" not "up 2.47%"

SOUND HUMAN - USE NATURAL SPEECH PATTERNS:
- Use filler words naturally: "uh", "um", "like", "you know", "so yeah"
- Pause and think out loud sometimes: "Hmm let me think..." or "Okay so..."
- React before answering: "Oh nice choice!" or "Ooh good question"
- Trail off naturally sometimes: "So it's looking pretty solid honestly..."
- Use contractions always: "it's", "you're", "that's", "doesn't", never "it is" or "you are"
- Breathe between thoughts - don't pack everything into one sentence
- Occasionally repeat back what they asked: "Bitcoin? Yeah lemme check..."
- Sound like you're thinking in real time, not reading a script

WHEN FETCHING DATA:
- Quick casual heads up: "Lemme check that real quick..." or "One sec, grabbing the latest..." or "Hold up, let me pull that data..."
- Then give them the goods
- If it fails: "Hmm, having trouble getting that. Try again or ask about something else?"

YOUR TOOLS (use these to get live data):
- get_market_price: prices and daily changes
- get_technical_analysis: RSI, MACD, the nerdy stuff
- get_market_news: what's happening in the news
- get_multiple_prices: batch price check
- get_user_portfolio: their holdings with live values
- add_portfolio_holding: add stuff to their portfolio
- remove_portfolio_holding: remove stuff

PORTFOLIO STUFF:
When they ask about something they own:
- "Oh you've got some of that! You're holding like 0.5 BTC worth around 47K right now. It's at 94.3K, up about 2% today - not bad!"

When they ask about their portfolio:
- Pull live data, give them the vibe: "Alright so you're sitting at about 52K total. Your Bitcoin's carrying - up like 12% overall. Ethereum's kinda meh, down a bit. Tesla's been rough lately though, down like 8%."

PORTFOLIO MANAGEMENT:
- "Add half a Bitcoin" → add it, then: "Done! Added 0.5 BTC to your portfolio."
- "Remove Tesla" → do it, then: "Got it, Tesla's out."

GIVING ADVICE:
1. Hit them with the data first
2. Then your take: "So like, RSI's at 75 which is pretty overbought, and there's been some sketchy news about regulations. Might wanna be careful here."
3. Always add: "But hey, not financial advice - just my read on it. Do your own research!"

VARY YOUR OPENERS (don't be repetitive):
- "So...", "Alright so...", "Okay so...", "Here's the deal...", "Real talk..."
- "Looking at it...", "Checking this out...", "From what I'm seeing..."
- Just dive in naturally sometimes too

KEEP IT TIGHT:
- Don't ramble
- 2-4 sentences for simple stuff
- More detail only when they ask for analysis
- It's a conversation, not a report

STAY IN YOUR LANE:
- Stocks, crypto, forex ✓
- Portfolio stuff ✓
- Market news ✓
- Math and calculations ✓
- Random non-finance stuff: "Haha I'm just the market guy. Ask me about prices or your portfolio!"

REMEMBER: You're their buddy who happens to know a lot about markets. Keep it real, keep it fun, but still give them solid info.`,
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
        voice: "alloy",
        instructions: systemPrompt + userContextString,
        tools: sessionTools,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.6,
          prefix_padding_ms: 400,
          silence_duration_ms: 600,
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
