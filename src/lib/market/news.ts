import OpenAI from 'openai';
import type { SentimentData, NewsArticle } from '@/types';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Fetch news articles for a symbol
 */
export async function fetchNews(symbol: string, limit: number = 5): Promise<NewsArticle[]> {
  // Map crypto symbols to search terms
  const searchTerms: Record<string, string> = {
    BTC: 'Bitcoin BTC',
    ETH: 'Ethereum ETH',
    SOL: 'Solana SOL',
    XRP: 'Ripple XRP',
    ADA: 'Cardano ADA',
    DOGE: 'Dogecoin DOGE',
  };

  const query = searchTerms[symbol] || symbol;

  try {
    const response = await fetch(
      `${NEWS_API_URL}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${NEWS_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    return data.articles.map((article: any) => ({
      title: article.title,
      description: article.description || '',
      source: article.source?.name || 'Unknown',
      publishedAt: article.publishedAt,
      url: article.url,
    }));
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

/**
 * Analyze sentiment of news articles using GPT
 */
export async function analyzeSentiment(
  symbol: string,
  articles: NewsArticle[]
): Promise<SentimentData> {
  if (articles.length === 0) {
    return {
      score: 0,
      summary: 'No recent news articles found for analysis.',
      keyPoints: [],
      articles: [],
    };
  }

  const articlesText = articles
    .slice(0, 5)
    .map((a, i) => `${i + 1}. "${a.title}" - ${a.description}`)
    .join('\n');

  const prompt = `Analyze the sentiment of these news articles about ${symbol}.

Articles:
${articlesText}

Return ONLY valid JSON with this exact structure:
{
  "score": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "summary": "<2-3 sentence summary of overall market sentiment>",
  "keyPoints": ["<key point 1>", "<key point 2>", "<key point 3>"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a financial sentiment analyst. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No sentiment response');
    }

    const result = JSON.parse(content);

    return {
      score: result.score,
      summary: result.summary,
      keyPoints: result.keyPoints || [],
      articles,
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return {
      score: 0,
      summary: 'Unable to analyze sentiment at this time.',
      keyPoints: [],
      articles,
    };
  }
}

/**
 * Get complete news sentiment analysis for a symbol
 */
export async function getNewsSentiment(symbol: string): Promise<SentimentData> {
  const articles = await fetchNews(symbol, 5);
  return analyzeSentiment(symbol, articles);
}

/**
 * Get sentiment label from score
 */
export function getSentimentLabel(score: number): 'positive' | 'negative' | 'neutral' {
  if (score > 0.3) return 'positive';
  if (score < -0.3) return 'negative';
  return 'neutral';
}

/**
 * Get sentiment color for UI
 */
export function getSentimentColor(score: number): string {
  if (score > 0.3) return '#10b981'; // green
  if (score < -0.3) return '#ef4444'; // red
  return '#9ca3af'; // gray
}
