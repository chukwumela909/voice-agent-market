'use client';

import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, X, Clock, TrendingUp } from 'lucide-react';

interface NewsArticle {
  title: string;
  description: string;
  source: string;
  author: string | null;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  content: string;
}

interface NewsFeedProps {
  watchlistSymbols?: readonly string[] | string[];
}

export default function NewsFeed({ watchlistSymbols = [] }: NewsFeedProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    fetchNews();
  }, [watchlistSymbols]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      
      // Fetch general financial news
      const generalResponse = await fetch('/api/market/news?limit=6');
      const generalData = await generalResponse.json();
      
      let allArticles = generalData.articles || [];

      // If user has watchlist, also fetch news for those symbols
      if (watchlistSymbols.length > 0) {
        const symbolQueries = watchlistSymbols.slice(0, 3).join(' OR ');
        const specificResponse = await fetch(`/api/market/news?query=${encodeURIComponent(symbolQueries)}&limit=4`);
        const specificData = await specificResponse.json();
        
        // Merge and dedupe
        const specificArticles = specificData.articles || [];
        const existingTitles = new Set(allArticles.map((a: NewsArticle) => a.title));
        
        for (const article of specificArticles) {
          if (!existingTitles.has(article.title)) {
            allArticles.push(article);
          }
        }
      }

      // Sort by date and limit
      allArticles.sort((a: NewsArticle, b: NewsArticle) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      setArticles(allArticles.slice(0, 10));
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">Financial News</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-4 w-3/4 rounded mb-2" />
              <div className="skeleton h-3 w-full rounded mb-2" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">Financial News</h2>
        </div>
        <button
          onClick={fetchNews}
          className="text-xs text-accent hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <div className="text-center py-8 text-foreground-muted">
          <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No news available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article, index) => (
            <button
              key={index}
              onClick={() => setSelectedArticle(article)}
              className="card p-4 text-left hover:border-accent/30 transition-all group"
            >
              <div className="flex items-start gap-3">
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-accent/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-accent transition-colors">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-foreground-muted">
                    <span className="truncate">{article.source}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(article.publishedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Article Modal */}
      {selectedArticle && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedArticle(null)}
        >
          <div 
            className="card w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-background-secondary border-b border-white/10 p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-foreground-muted mb-2">
                  <span className="font-medium text-accent">{selectedArticle.source}</span>
                  <span>•</span>
                  <span>{formatDate(selectedArticle.publishedAt)}</span>
                </div>
                <h2 className="font-semibold text-lg leading-tight">{selectedArticle.title}</h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {selectedArticle.imageUrl && (
                <img
                  src={selectedArticle.imageUrl}
                  alt=""
                  className="w-full h-48 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}

              {selectedArticle.description && (
                <p className="text-foreground-muted leading-relaxed">
                  {selectedArticle.description}
                </p>
              )}

              {selectedArticle.content && (
                <p className="text-foreground-muted text-sm leading-relaxed">
                  {selectedArticle.content.replace(/\[\+\d+ chars\]/, '')}
                </p>
              )}

              {selectedArticle.author && (
                <p className="text-xs text-foreground-muted/70">
                  By {selectedArticle.author}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-background-secondary border-t border-white/10 p-4">
              <a
                href={selectedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Read Full Article
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
