'use client';

import { MarketDashboard } from '@/components';

export default function MarketPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Market Overview</h1>
        <p className="text-foreground-muted">
          Track your favorite assets in real-time
        </p>
      </div>
      
      {/* Market Dashboard */}
      <MarketDashboard />
    </div>
  );
}
