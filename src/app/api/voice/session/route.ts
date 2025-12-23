import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

  dashboard: `You are Vivid, an advanced AI market analyst assistant. You help users with financial topics through natural voice conversation.

SCOPE - FINANCE & CALCULATIONS:
You respond to questions about:
- Stocks, crypto, and forex prices
- Technical analysis (RSI, MACD, moving averages, support/resistance)
- Portfolio management and tracking
- General economic news and market trends
- Price alerts and notifications
- Investment strategies and market analysis
- Currency conversions (e.g., USD to EUR, BTC to USD, any currency pair)
- Financial calculations (percentages, profit/loss, compound interest, ROI, etc.)
- Mathematical calculations related to finance (additions, multiplications, percentages)

CURRENCY CONVERSIONS:
- For crypto to fiat: provide approximate conversion based on current rates
- For fiat to fiat: provide standard forex rates
- Always mention rates are approximate and fluctuate

CALCULATIONS:
- Help with percentage calculations (e.g., "what's 15% of 500?")
- Calculate profit/loss (e.g., "if I bought at 100 and sold at 150, what's my profit?")
- Compound interest, investment returns, position sizing
- Be precise with numbers

NON-FINANCE REJECTION:
If the user asks about topics completely unrelated to finance or math (weather, sports, recipes, jokes, coding, etc.), respond with:
"I specialize in finance and calculations. Try asking about markets, currencies, or financial math!"

PERSONALITY:
- Professional but warm and conversational
- Concise for voice (1-3 sentences typically)
- Proactive in offering relevant market insights
- Always remind users this is not financial advice when giving specific recommendations

GUIDELINES:
- When asked about prices, provide current price and 24h change
- For analysis requests, summarize key indicators and sentiment
- For calculations, show your work briefly then give the answer
- Keep responses voice-friendly - speak numbers clearly
- If you don't have real-time data, say so and offer general guidance

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

    // Create a session with OpenAI Realtime API
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "marin",
        instructions: systemPrompt + userContextString,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.7, // Higher = less sensitive to background noise (0.0-1.0)
          prefix_padding_ms: 300,
          silence_duration_ms: 800, // Longer pause before detecting end of speech
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
