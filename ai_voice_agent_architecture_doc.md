# AI Voice Market Analysis Agent - System Architecture

## Project Overview

An AI-powered voice agent that provides real-time market analysis for cryptocurrency, forex, and stock markets with personalized suggestions and portfolio management.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │     Next.js Web App (Vercel)                           │ │
│  │  - Voice Interface (Web Audio API)                     │ │
│  │  - Real-time Chart Display                             │ │
│  │  - User Dashboard                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER (Next.js)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Routes (/api/...)                                 │ │
│  │  - Voice Processing Endpoints                          │ │
│  │  - Market Data Endpoints                               │ │
│  │  - User Management                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ↓                       ↓
┌──────────────────────────┐  ┌──────────────────────────┐
│   EXTERNAL AI SERVICES   │  │   DATABASE (Supabase)    │
│  - OpenAI Whisper (STT)  │  │  - User Profiles         │
│  - OpenAI GPT-4 (LLM)    │  │  - User Portfolios       │
│  - OpenAI TTS            │  │  - Conversation History  │
└──────────────────────────┘  │  - Market Preferences    │
                              │  - Alert Settings        │
                              └──────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│              MARKET DATA SERVICES                            │
│  - Polygon.io API (Real-time + Historical)                  │
│  - News Sentiment API (NewsAPI, Alpha Vantage)              │
└─────────────────────────────────────────────────────────────┘
```

---

## System Requirements

### Functional Requirements

1. **Voice Interaction**
   - Conversational and command-based interface
   - User can interrupt agent mid-response
   - Real-time voice transcription
   - Natural language processing for market queries
   - Text-to-speech responses

2. **Market Analysis**
   - Real-time price tracking (crypto, forex, stocks)
   - Historical data analysis
   - Technical indicators (RSI, MACD, Moving Averages)
   - Sentiment analysis from news sources
   - AI-powered predictions with disclaimers

3. **User Features**
   - User authentication and profiles
   - Personalized portfolio tracking
   - Custom price alerts and notifications
   - Conversation history
   - Risk tolerance settings

4. **Data & Analytics**
   - Multi-asset support (crypto, forex, stocks)
   - Multiple timeframes (1d, 1w, 1m, 3m)
   - Real-time price updates
   - News sentiment integration

### Non-Functional Requirements

- **Performance**: Real-time response (<3s for voice queries)
- **Scalability**: Support 10+ concurrent users initially, scale to 1000s
- **Security**: User authentication, data encryption, RLS policies
- **Compliance**: Financial disclaimer on all advice
- **Language**: English only (MVP)
- **Platform**: Web application (mobile later)

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts / Lightweight Charts
- **Voice**: Web Audio API
- **State Management**: React Hooks (useState, useContext)

### Backend
- **Framework**: Next.js API Routes
- **Language**: TypeScript
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (for audio files)
- **Real-time**: Supabase Realtime / Polling

### AI Services
- **Speech-to-Text**: OpenAI Whisper
- **LLM**: OpenAI GPT-4 Turbo
- **Text-to-Speech**: OpenAI TTS
- **Model**: No custom training (using APIs)

### External APIs
- **Market Data**: Polygon.io API
- **News**: NewsAPI
- **Sentiment Analysis**: GPT-4 based

### Hosting & Infrastructure
- **Frontend Hosting**: Vercel
- **Database**: Supabase Cloud
- **CDN**: Vercel Edge Network
- **Environment**: Cloud-based (no self-hosting)

---

## Database Schema

### User Management

```sql
-- User profiles (extends Supabase Auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  risk_tolerance VARCHAR(20), -- 'conservative', 'moderate', 'aggressive'
  preferred_markets TEXT[], -- ['crypto', 'stocks', 'forex']
  notification_preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

### Portfolio Management

```sql
-- Portfolio holdings
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  avg_buy_price DECIMAL(20, 8),
  market_type VARCHAR(20), -- 'crypto', 'stock', 'forex'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, symbol)
);

CREATE INDEX idx_user_portfolio ON portfolios(user_id);

-- Row Level Security
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own portfolio" ON portfolios
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can modify own portfolio" ON portfolios
  FOR ALL USING (auth.uid() = user_id);
```

### Conversation History

```sql
-- Conversation logs
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  agent_response TEXT NOT NULL,
  context JSONB, -- Store market data, symbols discussed, etc.
  audio_url TEXT, -- URL to stored TTS audio
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_conversations ON conversations(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);
```

### Alerts System

```sql
-- Price alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  condition VARCHAR(20), -- 'above', 'below', 'change_percent'
  target_price DECIMAL(20, 8),
  percentage_change DECIMAL(5, 2), -- For percentage-based alerts
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_active_alerts ON alerts(is_active, symbol);
CREATE INDEX idx_user_alerts ON alerts(user_id);

-- Row Level Security
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own alerts" ON alerts
  FOR ALL USING (auth.uid() = user_id);
```

### Market Data Cache

```sql
-- Market data cache (reduces API calls)
CREATE TABLE market_cache (
  symbol VARCHAR(20) PRIMARY KEY,
  price DECIMAL(20, 8),
  change_24h DECIMAL(10, 4),
  volume DECIMAL(30, 2),
  market_cap DECIMAL(30, 2),
  market_type VARCHAR(20), -- 'crypto', 'stock', 'forex'
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_last_updated ON market_cache(last_updated);
CREATE INDEX idx_market_type ON market_cache(market_type);
```

### News & Sentiment

```sql
-- News sentiment cache
CREATE TABLE news_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20),
  title TEXT,
  summary TEXT,
  sentiment_score DECIMAL(3, 2), -- -1 to 1 (negative to positive)
  source VARCHAR(100),
  url TEXT,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_symbol_date ON news_sentiment(symbol, published_at DESC);
```

---

## API Architecture

### Core API Endpoints

#### Voice Processing

```typescript
POST /api/voice/process
```

**Request:**
```typescript
FormData {
  audio: Blob (audio recording),
  userId: string
}
```

**Process Flow:**
1. Transcribe audio using OpenAI Whisper
2. Extract intent and entities from transcript
3. Fetch relevant market data based on intent
4. Generate AI response using GPT-4 with context
5. Convert response to speech using OpenAI TTS
6. Save conversation to database
7. Return transcript, response, audio URL, and market data

**Response:**
```typescript
{
  transcript: string,
  response: string,
  audioUrl: string,
  marketData: {
    symbols: Array<{
      symbol: string,
      price: number,
      change24h: number,
      // ... other data
    }>,
    analysis: object,
    sentiment: object
  }
}
```

#### Market Data

```typescript
GET /api/market/prices?symbols=BTC,ETH,AAPL&marketType=crypto
```

**Response:**
```typescript
{
  data: Array<{
    symbol: string,
    price: number,
    change24h: number,
    volume: number,
    marketCap: number,
    lastUpdated: string
  }>
}
```

```typescript
GET /api/market/analysis?symbol=BTC&timeframe=1d&marketType=crypto
```

**Response:**
```typescript
{
  symbol: string,
  historicalData: Array<OHLCV>,
  technicalIndicators: {
    rsi: number,
    macd: {
      macd: number,
      signal: number,
      histogram: number
    },
    movingAverages: {
      sma20: number,
      sma50: number,
      sma200: number
    }
  },
  sentiment: {
    score: number, // -1 to 1
    summary: string,
    news: Array<NewsItem>
  },
  aiAnalysis: string
}
```

#### Portfolio Management

```typescript
GET /api/portfolio
POST /api/portfolio
PUT /api/portfolio/:id
DELETE /api/portfolio/:id
```

**GET Response:**
```typescript
{
  holdings: Array<{
    id: string,
    symbol: string,
    quantity: number,
    avgBuyPrice: number,
    currentPrice: number,
    totalValue: number,
    profitLoss: number,
    profitLossPercent: number,
    marketType: string
  }>,
  totalValue: number,
  totalProfitLoss: number
}
```

#### Alerts

```typescript
GET /api/alerts
POST /api/alerts
PUT /api/alerts/:id
DELETE /api/alerts/:id
GET /api/alerts/check (background job endpoint)
```

#### User Profile

```typescript
GET /api/user/profile
PUT /api/user/profile
GET /api/user/conversations?limit=20&offset=0
```

---

## AI Integration Details

### OpenAI Whisper (Speech-to-Text)

```typescript
// lib/openai/whisper.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
  
  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    language: 'en',
    response_format: 'json'
  });
  
  return transcription.text;
}
```

**Configuration:**
- Model: `whisper-1`
- Language: English
- Format: JSON
- Cost: $0.006 per minute

### GPT-4 (Analysis & Intent)

```typescript
// lib/openai/gpt.ts

export async function extractIntent(transcript: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{
      role: 'system',
      content: `Extract the user's intent from their query. Return JSON:
      {
        "intent": "price_check" | "analysis" | "portfolio_advice" | "news" | "alert_create" | "general_question",
        "symbols": ["BTC", "ETH"],
        "timeframe": "1d" | "1w" | "1m" | "3m",
        "market_type": "crypto" | "stock" | "forex"
      }`
    }, {
      role: 'user',
      content: transcript
    }],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(completion.choices[0].message.content);
}

export async function generateMarketAnalysis(
  userQuery: string,
  marketData: any,
  userContext: any
): Promise<string> {
  
  const systemPrompt = `You are an expert financial market analyst AI assistant. 
You provide insights on crypto, forex, and stocks.

IMPORTANT DISCLAIMERS:
- Always state that your analysis is for informational purposes only
- Not financial advice - users should do their own research
- Markets are volatile and past performance doesn't guarantee future results

User Context:
- Risk tolerance: ${userContext.riskTolerance}
- Portfolio: ${JSON.stringify(userContext.portfolio)}

Current Market Data:
${JSON.stringify(marketData)}

Provide clear, concise analysis with:
1. Current market situation
2. Key technical indicators interpretation
3. Sentiment analysis from news
4. Potential suggestions (with strong disclaimer)
5. Risk factors to consider

Keep response under 150 words for voice delivery.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery }
    ],
    temperature: 0.7,
    max_tokens: 500
  });
  
  return completion.choices[0].message.content;
}
```

**Configuration:**
- Model: `gpt-4-turbo-preview`
- Temperature: 0.7 (balanced creativity)
- Max tokens: 500
- Cost: $0.03/1K tokens (input), $0.06/1K tokens (output)

### OpenAI TTS (Text-to-Speech)

```typescript
// lib/openai/tts.ts

export async function textToSpeech(text: string): Promise<string> {
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
    input: text,
    speed: 1.0
  });
  
  // Convert to buffer
  const buffer = Buffer.from(await mp3.arrayBuffer());
  
  // Upload to Supabase Storage
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
  const { data, error } = await supabase.storage
    .from('voice-responses')
    .upload(fileName, buffer, {
      contentType: 'audio/mpeg',
      cacheControl: '3600'
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('voice-responses')
    .getPublicUrl(data.path);
  
  return publicUrl;
}
```

**Configuration:**
- Model: `tts-1` (faster) or `tts-1-hd` (higher quality)
- Voice: `alloy` (neutral, recommended for financial content)
- Speed: 1.0 (normal pace)
- Cost: $15 per 1M characters

---

## Market Data Integration

### Polygon.io API

```typescript
// lib/market/polygon.ts

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const BASE_URL = 'https://api.polygon.io';

export async function getCurrentPrice(
  symbol: string, 
  marketType: 'crypto' | 'stock' | 'forex'
) {
  let endpoint = '';
  
  if (marketType === 'crypto') {
    // Format: X:BTCUSD
    endpoint = `/v2/last/trade/X:${symbol}USD`;
  } else if (marketType === 'stock') {
    // Format: AAPL
    endpoint = `/v2/last/trade/${symbol}`;
  } else if (marketType === 'forex') {
    // Format: C:EURUSD
    endpoint = `/v2/last/trade/C:${symbol}`;
  }
  
  const response = await fetch(
    `${BASE_URL}${endpoint}?apiKey=${POLYGON_API_KEY}`
  );
  const data = await response.json();
  
  return {
    symbol,
    price: data.results.price,
    timestamp: data.results.timestamp,
    exchange: data.results.exchange
  };
}

export async function getHistoricalData(
  symbol: string,
  marketType: string,
  timeframe: '1d' | '1w' | '1m' | '3m'
) {
  const days = {
    '1d': 1,
    '1w': 7,
    '1m': 30,
    '3m': 90
  }[timeframe];
  
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];
  
  // Format ticker based on market type
  const prefix = marketType === 'crypto' ? 'X:' : 
                 marketType === 'forex' ? 'C:' : '';
  const suffix = (marketType === 'crypto' || marketType === 'forex') ? 'USD' : '';
  const tickerSymbol = `${prefix}${symbol}${suffix}`;
  
  const endpoint = `/v2/aggs/ticker/${tickerSymbol}/range/1/day/${from}/${to}`;
  const response = await fetch(
    `${BASE_URL}${endpoint}?adjusted=true&sort=asc&apiKey=${POLYGON_API_KEY}`
  );
  const data = await response.json();
  
  // Returns array of: { o, h, l, c, v, t }
  return data.results;
}

export async function get24HourChange(symbol: string, marketType: string) {
  const data = await getHistoricalData(symbol, marketType, '1d');
  if (!data || data.length < 2) return null;
  
  const yesterday = data[data.length - 2].c;
  const today = data[data.length - 1].c;
  const change = ((today - yesterday) / yesterday) * 100;
  
  return {
    change,
    previousClose: yesterday,
    currentPrice: today
  };
}
```

**API Limits:**
- Free: 5 API calls per minute
- Starter ($29/mo): Unlimited stocks, 100 req/min
- Developer ($199/mo): All assets, 100 req/min

### Technical Indicators

```typescript
// lib/market/indicators.ts
import { RSI, MACD, SMA, EMA } from 'technicalindicators';

export function calculateRSI(prices: number[], period: number = 14): number {
  const result = RSI.calculate({ values: prices, period });
  return result[result.length - 1];
}

export function calculateMACD(prices: number[]) {
  const result = MACD.calculate({
    values: prices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  return result[result.length - 1];
}

export function calculateSMA(prices: number[], period: number) {
  const result = SMA.calculate({ values: prices, period });
  return result[result.length - 1];
}

export function calculateMovingAverages(prices: number[]) {
  return {
    sma20: calculateSMA(prices, 20),
    sma50: calculateSMA(prices, 50),
    sma200: calculateSMA(prices, 200)
  };
}

export async function getCompleteAnalysis(
  symbol: string,
  marketType: string,
  timeframe: string
) {
  // Get historical data
  const historicalData = await getHistoricalData(symbol, marketType, timeframe);
  const closePrices = historicalData.map((d: any) => d.c);
  
  // Calculate indicators
  const rsi = calculateRSI(closePrices);
  const macd = calculateMACD(closePrices);
  const movingAverages = calculateMovingAverages(closePrices);
  
  return {
    historicalData,
    technicalIndicators: {
      rsi,
      macd,
      movingAverages
    }
  };
}
```

**NPM Package:**
```bash
npm install technicalindicators
```

### News Sentiment Analysis

```typescript
// lib/market/news.ts

export async function getNewsSentiment(symbol: string) {
  // Fetch news articles
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  const response = await fetch(
    `https://newsapi.org/v2/everything?q=${symbol}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`
  );
  const data = await response.json();
  
  if (!data.articles || data.articles.length === 0) {
    return { score: 0, summary: 'No recent news found', articles: [] };
  }
  
  // Prepare articles for sentiment analysis
  const articles = data.articles.slice(0, 5).map((a: any) => ({
    title: a.title,
    description: a.description,
    source: a.source.name,
    publishedAt: a.publishedAt,
    url: a.url
  }));
  
  // Use GPT-4 for sentiment analysis
  const sentimentPrompt = `Analyze the sentiment of these news articles about ${symbol}. 
  
Articles:
${JSON.stringify(articles, null, 2)}

Return JSON with:
{
  "score": number from -1 (very negative) to 1 (very positive),
  "summary": "Brief 2-sentence summary of overall sentiment",
  "keyPoints": ["point1", "point2", "point3"]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: 'You are a financial sentiment analyst.' },
      { role: 'user', content: sentimentPrompt }
    ],
    response_format: { type: 'json_object' }
  });
  
  const sentiment = JSON.parse(completion.choices[0].message.content);
  
  // Cache sentiment in database
  await supabase.from('news_sentiment').insert(
    articles.map(a => ({
      symbol,
      title: a.title,
      summary: a.description,
      sentiment_score: sentiment.score,
      source: a.source,
      url: a.url,
      published_at: a.publishedAt
    }))
  );
  
  return {
    ...sentiment,
    articles
  };
}
```

---

## Frontend Components

### Voice Interface Component

```typescript
// app/components/VoiceInterface.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/lib/hooks/useUser';

export default function VoiceInterface() {
  const [isRecording, setIsRecording] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const { user } = useUser();
  
  const startRecording = async () => {
    try {
      setError(null);
      
      // Stop agent if currently speaking
      if (isAgentSpeaking && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsAgentSpeaking(false);
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm' 
        });
        await processVoice(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const processVoice = async (audioBlob: Blob) => {
    if (!user) {
      setError('Please log in to use voice features');
      return;
    }
    
    setIsProcessing(true);
    setTranscript('');
    setAgentResponse('');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('userId', user.id);
      
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to process voice');
      }
      
      const data = await response.json();
      
      setTranscript(data.transcript);
      setAgentResponse(data.response);
      
      // Play agent response
      if (data.audioUrl) {
        audioRef.current = new Audio(data.audioUrl);
        setIsAgentSpeaking(true);
        
        audioRef.current.onended = () => {
          setIsAgentSpeaking(false);
        };
        
        audioRef.current.onerror = () => {
          setError('Failed to play audio response');
          setIsAgentSpeaking(false);
        };
        
        await audioRef.current.play();
      }
      
    } catch (err) {
      console.error('Error processing voice:', err);
      setError('Failed to process your request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const interruptAgent = () => {
    if (audioRef.current && isAgentSpeaking) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAgentSpeaking(false);
    }
  };
  
  return (
    <div className="voice-interface p-6 bg-white rounded-lg shadow-lg">
      <div className="flex flex-col items-center space-y-4">
        {/* Voice Button */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={isProcessing}
          className={`
            w-24 h-24 rounded-full flex items-center justify-center
            transition-all duration-200 text-white text-4xl
            ${isRecording 
              ? 'bg-red-500 scale-110 animate-pulse' 
              : 'bg-blue-500 hover:bg-blue-600'
            }
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          🎤
        </button>
        
        <div className="text-center">
          {isRecording && (
            <p className="text-sm text-gray-600">Recording... Release to send</p>
          )}
          {isProcessing && (
            <p className="text-sm text-gray-600">Processing your request...</p>
          )}
          {!isRecording && !isProcessing && (
            <p className="text-sm text-gray-600">Hold to talk</p>
          )}
        </div>
        
        {/* Interrupt Button */}
        {isAgentSpeaking && (
          <button
            onClick={interruptAgent}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            ⏸️ Interrupt Agent
          </button>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        {/* Transcript Display */}
        {transcript && (
          <div className="w-full p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">You said:</p>
            <p className="text-gray-800">{transcript}</p>
          </div>
        )}
        
        {/* Agent Response Display */}
        {agentResponse && (
          <div className="w-full p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-500 mb-1">Agent response:</p>
            <p className="text-gray-800">{agentResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Market Dashboard Component

```typescript
// app/components/MarketDashboard.tsx

'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  marketType: string;
}

export default function MarketDashboard() {
  const [watchlist, setWatchlist] = useState<string[]>(['BTC', 'ETH', 'AAPL', 'TSLA']);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC');
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [watchlist]);
  
  useEffect(() => {
    if (selectedSymbol) {
      fetchChartData(selectedSymbol);
    }
  }, [selectedSymbol]);
  
  const fetchPrices = async () => {
    try {
      const response = await fetch(
        `/api/market/prices?symbols=${watchlist.join(',')}`
      );
      const data = await response.json();
      setPrices(data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  };
  
  const fetchChartData = async (symbol: string) => {
    try {
      const response = await fetch(
        `/api/market/historical?symbol=${symbol}&timeframe=1w`
      );
      const data = await response.json();
      
      // Format for recharts
      const formatted = data.data.map((item: any) => ({
        date: new Date(item.t).toLocaleDateString(),
        price: item.c
      }));
      
      setChartData(formatted);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };
  
  if (loading) {
    return <div className="p-6">Loading market data...</div>;
  }
  
  return (
    <div className="market-dashboard space-y-6">
      {/* Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {prices.map((item) => (
          <div
            key={item.symbol}
            onClick={() => setSelectedSymbol(item.symbol)}
            className={`
              p-4 rounded-lg cursor-pointer transition-all
              ${selectedSymbol === item.symbol 
                ? 'bg-blue-50 border-2 border-blue-500' 
                : 'bg-white border border-gray-200 hover:border-blue-300'
              }
            `}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg">{item.symbol}</h3>
              <span className="text-xs text-gray-500">{item.marketType}</span>
            </div>
            
            <p className="text-2xl font-bold text-gray-900 mb-1">
              ${item.price.toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })}
            </p>
            
            <p className={`text-sm font-medium ${
              item.change24h >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {item.change24h >= 0 ? '↑' : '↓'} {Math.abs(item.change24h).toFixed(2)}%
            </p>
          </div>
        ))}
      </div>
      
      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">{selectedSymbol} - 7 Day Chart</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

### Portfolio Component

```typescript
// app/components/Portfolio.tsx

'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/lib/hooks/useUser';

interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
  marketType: string;
}

export default function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalProfitLoss, setTotalProfitLoss] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const { user } = useUser();
  
  useEffect(() => {
    if (user) {
      fetchPortfolio();
    }
  }, [user]);
  
  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio');
      const data = await response.json();
      
      setHoldings(data.holdings);
      setTotalValue(data.totalValue);
      setTotalProfitLoss(data.totalProfitLoss);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    }
  };
  
  if (loading) {
    return <div className="p-6">Loading portfolio...</div>;
  }
  
  return (
    <div className="portfolio space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-semibold mb-2">Total Portfolio Value</h2>
        <p className="text-4xl font-bold mb-2">
          ${totalValue.toLocaleString(undefined, { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
          })}
        </p>
        <p className={`text-lg font-medium ${
          totalProfitLoss >= 0 ? 'text-green-100' : 'text-red-100'
        }`}>
          {totalProfitLoss >= 0 ? '↑' : '↓'} ${Math.abs(totalProfitLoss).toLocaleString(undefined, { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
          })} ({((totalProfitLoss / totalValue) * 100).toFixed(2)}%)
        </p>
      </div>
      
      {/* Add Holding Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
      >
        + Add Holding
      </button>
      
      {/* Holdings List */}
      <div className="space-y-4">
        {holdings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No holdings yet. Add your first position!</p>
          </div>
        ) : (
          holdings.map((holding) => (
            <div 
              key={holding.id}
              className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold">{holding.symbol}</h3>
                  <p className="text-sm text-gray-500">{holding.marketType}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Quantity</p>
                  <p className="font-semibold">{holding.quantity}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-500">Avg Buy Price</p>
                  <p className="font-semibold">${holding.avgBuyPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current Price</p>
                  <p className="font-semibold">${holding.currentPrice.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="border-t pt-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Total Value</p>
                  <p className="text-lg font-bold">
                    ${holding.totalValue.toLocaleString(undefined, { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2 
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    holding.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {holding.profitLoss >= 0 ? '+' : ''}${holding.profitLoss.toFixed(2)}
                  </p>
                  <p className={`text-sm font-medium ${
                    holding.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({holding.profitLossPercent.toFixed(2)}%)
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## Complete API Implementation

### Voice Processing Endpoint

```typescript
// app/api/voice/process/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transcribeAudio } from '@/lib/openai/whisper';
import { extractIntent, generateMarketAnalysis } from '@/lib/openai/gpt';
import { textToSpeech } from '@/lib/openai/tts';
import { getCurrentPrice, getCompleteAnalysis } from '@/lib/market/polygon';
import { getNewsSentiment } from '@/lib/market/news';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob;
    const userId = formData.get('userId') as string;
    
    if (!audioFile || !userId) {
      return NextResponse.json(
        { error: 'Missing audio or userId' },
        { status: 400 }
      );
    }
    
    // Step 1: Transcribe audio to text
    console.log('Transcribing audio...');
    const transcript = await transcribeAudio(audioFile);
    
    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not transcribe audio' },
        { status: 400 }
      );
    }
    
    // Step 2: Extract intent and entities
    console.log('Extracting intent...');
    const intent = await extractIntent(transcript);
    
    // Step 3: Fetch user context
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId);
    
    const userContext = {
      riskTolerance: userProfile?.risk_tolerance || 'moderate',
      preferredMarkets: userProfile?.preferred_markets || ['crypto'],
      portfolio: portfolio || []
    };
    
    // Step 4: Fetch market data based on intent
    console.log('Fetching market data...');
    let marketData: any = {};
    
    if (intent.symbols && intent.symbols.length > 0) {
      // Fetch current prices
      const pricePromises = intent.symbols.map((symbol: string) =>
        getCurrentPrice(symbol, intent.market_type || 'crypto')
      );
      const prices = await Promise.all(pricePromises);
      
      // Fetch analysis for primary symbol
      const primarySymbol = intent.symbols[0];
      const analysis = await getCompleteAnalysis(
        primarySymbol,
        intent.market_type || 'crypto',
        intent.timeframe || '1d'
      );
      
      // Fetch news sentiment
      const sentiment = await getNewsSentiment(primarySymbol);
      
      marketData = {
        prices,
        analysis,
        sentiment,
        intent
      };
    }
    
    // Step 5: Generate AI response
    console.log('Generating AI response...');
    const aiResponse = await generateMarketAnalysis(
      transcript,
      marketData,
      userContext
    );
    
    // Step 6: Convert to speech
    console.log('Converting to speech...');
    const audioUrl = await textToSpeech(aiResponse);
    
    // Step 7: Save conversation to database
    await supabase.from('conversations').insert({
      user_id: userId,
      user_message: transcript,
      agent_response: aiResponse,
      context: marketData,
      audio_url: audioUrl
    });
    
    // Step 8: Return response
    return NextResponse.json({
      transcript,
      response: aiResponse,
      audioUrl,
      marketData,
      intent
    });
    
  } catch (error) {
    console.error('Error processing voice:', error);
    return NextResponse.json(
      { error: 'Failed to process voice request' },
      { status: 500 }
    );
  }
}
```

### Market Prices Endpoint

```typescript
// app/api/market/prices/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPrice } from '@/lib/market/polygon';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const marketType = searchParams.get('marketType') || 'crypto';
    
    if (!symbolsParam) {
      return NextResponse.json(
        { error: 'Symbols parameter required' },
        { status: 400 }
      );
    }
    
    const symbols = symbolsParam.split(',');
    
    // Check cache first
    const { data: cached } = await supabase
      .from('market_cache')
      .select('*')
      .in('symbol', symbols)
      .gte('last_updated', new Date(Date.now() - 30000).toISOString()); // 30 seconds cache
    
    const cachedSymbols = new Set(cached?.map(c => c.symbol) || []);
    const symbolsToFetch = symbols.filter(s => !cachedSymbols.has(s));
    
    // Fetch missing data
    let freshData = [];
    if (symbolsToFetch.length > 0) {
      const pricePromises = symbolsToFetch.map(symbol =>
        getCurrentPrice(symbol, marketType as any)
      );
      freshData = await Promise.all(pricePromises);
      
      // Update cache
      const cacheUpdates = freshData.map(item => ({
        symbol: item.symbol,
        price: item.price,
        market_type: marketType,
        last_updated: new Date().toISOString()
      }));
      
      await supabase
        .from('market_cache')
        .upsert(cacheUpdates, { onConflict: 'symbol' });
    }
    
    // Combine cached and fresh data
    const allData = [
      ...(cached || []),
      ...freshData.map(item => ({
        symbol: item.symbol,
        price: item.price,
        market_type: marketType,
        change_24h: 0, // Calculate separately if needed
        last_updated: new Date().toISOString()
      }))
    ];
    
    return NextResponse.json({
      data: allData,
      cached: cached?.length || 0,
      fresh: freshData.length
    });
    
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market prices' },
      { status: 500 }
    );
  }
}
```

### Market Analysis Endpoint

```typescript
// app/api/market/analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCompleteAnalysis } from '@/lib/market/polygon';
import { getNewsSentiment } from '@/lib/market/news';
import { generateMarketAnalysis } from '@/lib/openai/gpt';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || '1d';
    const marketType = searchParams.get('marketType') || 'crypto';
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter required' },
        { status: 400 }
      );
    }
    
    // Fetch complete technical analysis
    const analysis = await getCompleteAnalysis(
      symbol,
      marketType,
      timeframe
    );
    
    // Fetch news sentiment
    const sentiment = await getNewsSentiment(symbol);
    
    // Generate AI summary
    const aiSummary = await generateMarketAnalysis(
      `Provide a detailed analysis of ${symbol}`,
      { analysis, sentiment },
      { riskTolerance: 'moderate', portfolio: [] }
    );
    
    return NextResponse.json({
      symbol,
      timeframe,
      marketType,
      technicalAnalysis: analysis.technicalIndicators,
      historicalData: analysis.historicalData,
      sentiment,
      aiSummary
    });
    
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate market analysis' },
      { status: 500 }
    );
  }
}
```

### Portfolio Endpoints

```typescript
// app/api/portfolio/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentPrice } from '@/lib/market/polygon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Fetch user's portfolio
    const { data: holdings, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        holdings: [],
        totalValue: 0,
        totalProfitLoss: 0
      });
    }
    
    // Fetch current prices for all holdings
    const pricePromises = holdings.map(h =>
      getCurrentPrice(h.symbol, h.market_type)
    );
    const currentPrices = await Promise.all(pricePromises);
    
    // Calculate values
    const enrichedHoldings = holdings.map((holding, index) => {
      const currentPrice = currentPrices[index].price;
      const totalValue = holding.quantity * currentPrice;
      const costBasis = holding.quantity * holding.avg_buy_price;
      const profitLoss = totalValue - costBasis;
      const profitLossPercent = (profitLoss / costBasis) * 100;
      
      return {
        id: holding.id,
        symbol: holding.symbol,
        quantity: holding.quantity,
        avgBuyPrice: holding.avg_buy_price,
        currentPrice,
        totalValue,
        profitLoss,
        profitLossPercent,
        marketType: holding.market_type
      };
    });
    
    const totalValue = enrichedHoldings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalProfitLoss = enrichedHoldings.reduce((sum, h) => sum + h.profitLoss, 0);
    
    return NextResponse.json({
      holdings: enrichedHoldings,
      totalValue,
      totalProfitLoss
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
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { symbol, quantity, avgBuyPrice, marketType } = body;
    
    // Validate input
    if (!symbol || !quantity || !avgBuyPrice || !marketType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if holding already exists
    const { data: existing } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .single();
    
    if (existing) {
      // Update existing holding (average the prices)
      const newQuantity = existing.quantity + quantity;
      const newAvgPrice = 
        (existing.avg_buy_price * existing.quantity + avgBuyPrice * quantity) / newQuantity;
      
      const { data, error } = await supabase
        .from('portfolios')
        .update({
          quantity: newQuantity,
          avg_buy_price: newAvgPrice,
          updated_at: new Date().toISOString()
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
          symbol,
          quantity,
          avg_buy_price: avgBuyPrice,
          market_type: marketType
        })
        .select()
        .single();
      
      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
    
  } catch (error) {
    console.error('Error adding to portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to add holding' },
      { status: 500 }
    );
  }
}
```

---

## Security Implementation

### Authentication Middleware

```typescript
// lib/middleware/auth.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>
) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized - No token provided' },
      { status: 401 }
    );
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid token' },
      { status: 401 }
    );
  }
  
  // Add user ID to request headers for downstream use
  const modifiedRequest = new NextRequest(request.url, {
    ...request,
    headers: new Headers(request.headers)
  });
  modifiedRequest.headers.set('x-user-id', user.id);
  
  return handler(modifiedRequest, user.id);
}
```

### Rate Limiting

```typescript
// lib/middleware/rateLimit.ts

import { NextRequest, NextResponse } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(limit: number, windowMs: number) {
  return async (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    const record = rateLimitMap.get(ip);
    
    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, {
        count: 1,
        resetTime: now + windowMs
      });
      return null; // Allow request
    }
    
    if (record.count >= limit) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
          }
        }
      );
    }
    
    record.count++;
    return null; // Allow request
  };
}

// Usage in API route
// const rateLimitCheck = await rateLimit(10, 60000)(request); // 10 req/min
// if (rateLimitCheck) return rateLimitCheck;
```

### Input Validation

```typescript
// lib/validation/schemas.ts

import { z } from 'zod';

export const portfolioSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  quantity: z.number().positive(),
  avgBuyPrice: z.number().positive(),
  marketType: z.enum(['crypto', 'stock', 'forex'])
});

export const alertSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  condition: z.enum(['above', 'below', 'change_percent']),
  targetPrice: z.number().positive().optional(),
  percentageChange: z.number().optional()
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
```

---

## Deployment Guide

### Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Polygon.io
POLYGON_API_KEY=your-polygon-key

# NewsAPI
NEWS_API_KEY=your-news-api-key

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add OPENAI_API_KEY
vercel env add POLYGON_API_KEY
# ... ad