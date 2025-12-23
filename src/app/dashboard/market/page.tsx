'use client';

import { MarketDashboard } from '@/components';
import NewsFeed from '@/components/NewsFeed';
import { config } from '@/lib/config';

export default function MarketPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Market Overview</h1>
        <p className="text-foreground-muted">
          Track your favorite assets and latest financial news
        </p>
      </div>
      
      {/* Market Dashboard */}
      <MarketDashboard />

      {/* Financial News */}
      <NewsFeed watchlistSymbols={config.defaultWatchlist} />
    </div>
  );
}
