-- Vivid Database Schema
-- Run this migration in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USER PROFILES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  voice_passphrase_hash TEXT, -- Optional voice authentication
  risk_tolerance TEXT DEFAULT 'moderate' CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
  preferred_markets TEXT[] DEFAULT ARRAY['crypto', 'stocks'],
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "voice": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================
-- PORTFOLIOS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'stock', 'forex')),
  quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
  average_cost DECIMAL(20, 8) NOT NULL CHECK (average_cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique symbol per user
  UNIQUE(user_id, symbol)
);

-- Enable RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- RLS Policies for portfolios
CREATE POLICY "Users can view own portfolios" ON portfolios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios" ON portfolios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios" ON portfolios
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolios" ON portfolios
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);

-- =====================
-- ALERTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'stock', 'forex')),
  condition TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  target_price DECIMAL(20, 8) NOT NULL CHECK (target_price > 0),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alerts
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts" ON alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts" ON alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active = true;

-- =====================
-- CONVERSATIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL, -- User's transcribed speech
  intent JSONB, -- Parsed intent from GPT
  response TEXT NOT NULL, -- AI response text
  context JSONB, -- Market data context used for response
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups and ordering
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- =====================
-- MARKET CACHE TABLE
-- =====================
CREATE TABLE IF NOT EXISTS market_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'stock', 'forex')),
  price_data JSONB NOT NULL,
  technical_indicators JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique symbol + asset_type
  UNIQUE(symbol, asset_type)
);

-- No RLS needed - this is public cache data
-- But we'll add a policy for read access
ALTER TABLE market_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market cache" ON market_cache
  FOR SELECT USING (true);

-- Service role can manage cache
CREATE POLICY "Service role can manage cache" ON market_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Index for faster lookups
CREATE INDEX idx_market_cache_symbol ON market_cache(symbol);
CREATE INDEX idx_market_cache_expires ON market_cache(expires_at);

-- =====================
-- NEWS SENTIMENT TABLE
-- =====================
CREATE TABLE IF NOT EXISTS news_sentiment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'stock', 'forex')),
  headline TEXT NOT NULL,
  summary TEXT,
  sentiment_score DECIMAL(3, 2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  sentiment_label TEXT CHECK (sentiment_label IN ('bullish', 'bearish', 'neutral')),
  source TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE news_sentiment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read news sentiment" ON news_sentiment
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage news" ON news_sentiment
  FOR ALL USING (auth.role() = 'service_role');

-- Index for faster lookups
CREATE INDEX idx_news_symbol ON news_sentiment(symbol);
CREATE INDEX idx_news_created_at ON news_sentiment(created_at DESC);

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_cache_updated_at
  BEFORE UPDATE ON market_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- CLEANUP FUNCTIONS
-- =====================

-- Function to clean up expired cache entries (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM market_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old conversations (keep last 100 per user)
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversations
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM conversations
    ) ranked
    WHERE rn > 100
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
