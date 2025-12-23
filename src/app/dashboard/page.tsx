'use client';

import { useRouter } from 'next/navigation';
import { Mic, TrendingUp, Calculator, DollarSign } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Welcome to Vivid</h1>
        <p className="text-foreground-muted">
          Your AI-powered financial assistant
        </p>
      </div>

      {/* Voice Assistant Card */}
      <button
        onClick={() => router.push('/dashboard/voice')}
        className="w-full card p-8 mb-6 hover:border-accent/30 transition-all group text-left"
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
            <Mic className="w-8 h-8 text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-1">Talk to Vivid</h2>
            <p className="text-foreground-muted">
              Ask about markets, get price updates, or do financial calculations
            </p>
          </div>
          <div className="text-accent text-2xl group-hover:translate-x-1 transition-transform">
            →
          </div>
        </div>
      </button>

      {/* Quick Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <TrendingUp className="w-8 h-8 text-green-400 mb-3" />
          <h3 className="font-semibold mb-1">Market Analysis</h3>
          <p className="text-sm text-foreground-muted">
            Get real-time insights on stocks, crypto, and forex
          </p>
        </div>

        <div className="card p-5">
          <DollarSign className="w-8 h-8 text-blue-400 mb-3" />
          <h3 className="font-semibold mb-1">Currency Conversion</h3>
          <p className="text-sm text-foreground-muted">
            Convert between any currencies including crypto
          </p>
        </div>

        <div className="card p-5">
          <Calculator className="w-8 h-8 text-purple-400 mb-3" />
          <h3 className="font-semibold mb-1">Financial Math</h3>
          <p className="text-sm text-foreground-muted">
            Calculate ROI, percentages, profit/loss, and more
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 p-4 bg-background-secondary rounded-lg border border-accent/10">
        <p className="text-xs text-foreground-muted text-center">
          Vivid provides information only, not financial advice. Always do your own research.
        </p>
      </div>
    </div>
  );
}
