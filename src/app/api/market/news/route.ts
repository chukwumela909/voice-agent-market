import { NextRequest, NextResponse } from 'next/server';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'business';
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!NEWS_API_KEY) {
      return NextResponse.json(
        { error: 'News API key not configured' },
        { status: 500 }
      );
    }

    let url: string;
    
    if (query) {
      // Search for specific topic
      const searchQuery = `${query} finance OR stock OR crypto OR market`;
      url = `${NEWS_API_URL}/everything?q=${encodeURIComponent(searchQuery)}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;
    } else {
      // Get top business/finance headlines
      url = `${NEWS_API_URL}/top-headlines?category=${category}&language=en&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      console.error('NewsAPI error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch news' },
        { status: response.status }
      );
    }

    const data = await response.json();

    const articles = (data.articles || []).map((article: any) => ({
      title: article.title,
      description: article.description || '',
      source: article.source?.name || 'Unknown',
      author: article.author || null,
      publishedAt: article.publishedAt,
      url: article.url,
      imageUrl: article.urlToImage || null,
      content: article.content || '',
    }));

    return NextResponse.json({
      articles,
      totalResults: data.totalResults || 0,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
