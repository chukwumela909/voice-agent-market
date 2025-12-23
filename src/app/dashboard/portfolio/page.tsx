'use client';

import { Portfolio } from '@/components';

export default function PortfolioPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Portfolio</h1>
        <p className="text-foreground-muted">
          Track your holdings and performance
        </p>
      </div>
      
      {/* Portfolio Component */}
      <Portfolio />
    </div>
  );
}
