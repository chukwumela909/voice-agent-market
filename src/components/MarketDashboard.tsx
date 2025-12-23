'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Plus, X, Search } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { config } from '@/lib/config';
import type { MarketData } from '@/types';

interface WatchlistItem extends MarketData {
  isLoading?: boolean;
}

export default function MarketDashboard() {
  const { session } = useAuth();
  const [watchlist, setWatchlist] = useState<string[]>([...config.defaultWatchlist]);
  const [prices, setPrices] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [watchlist]);
  
  const fetchPrices = async () => {
    if (watchlist.length === 0) {
      setPrices([]);
      setLoading(false);
      return;
    }
    
    try {
      setRefreshing(true);
      const response = await fetch(`/api/market/prices?symbols=${watchlist.join(',')}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      
      const data = await response.json();
      setPrices(data.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const addSymbol = () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (symbol && !watchlist.includes(symbol)) {
      setWatchlist((prev) => [...prev, symbol]);
      setNewSymbol('');
      setShowAddModal(false);
    }
  };
  
  const removeSymbol = (symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
    setPrices((prev) => prev.filter((p) => p.symbol !== symbol));
  };
  
  const getMarketTypeLabel = (type: string) => {
    switch (type) {
      case 'crypto':
        return '🪙';
      case 'stock':
        return '📈';
      case 'forex':
        return '💱';
      default:
        return '📊';
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Watchlist</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-6 w-20 rounded mb-2" />
              <div className="skeleton h-8 w-32 rounded mb-2" />
              <div className="skeleton h-4 w-16 rounded" />
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
        <div>
          <h2 className="text-lg font-semibold">Watchlist</h2>
          {lastUpdated && (
            <p className="text-xs text-foreground-muted">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrices}
            disabled={refreshing}
            className="p-2 rounded-lg bg-background-tertiary hover:bg-background-secondary transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 rounded-lg btn-metallic"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Price Cards */}
      {prices.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          <p>No symbols in watchlist</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 btn-metallic rounded-lg text-sm"
          >
            Add Symbol
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prices.map((item) => (
            <div
              key={item.symbol}
              className="card p-4 relative group"
            >
              {/* Remove Button */}
              <button
                onClick={() => removeSymbol(item.symbol)}
                className="absolute top-2 right-2 p-1 rounded-full bg-background-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-foreground-muted" />
              </button>
              
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getMarketTypeLabel(item.marketType)}</span>
                  <h3 className="font-bold text-lg">{item.symbol}</h3>
                </div>
                <span
                  className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full ${
                    item.change24h >= 0
                      ? 'bg-success/10 text-success'
                      : 'bg-danger/10 text-danger'
                  }`}
                >
                  {item.change24h >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(item.change24h).toFixed(2)}%
                </span>
              </div>
              
              <p className="text-2xl font-bold mb-1">
                ${item.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: item.price < 1 ? 6 : 2,
                })}
              </p>
              
              {item.volume && (
                <p className="text-xs text-foreground-muted">
                  Vol: ${(item.volume / 1000000).toFixed(2)}M
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Add Symbol Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Symbol</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-background-tertiary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <input
                type="text"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
                placeholder="Enter symbol (e.g., BTC, AAPL, EURUSD)"
                className="w-full pl-10"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 px-4 rounded-lg bg-background-tertiary hover:bg-background-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addSymbol}
                disabled={!newSymbol.trim()}
                className="flex-1 py-2 px-4 rounded-lg btn-metallic disabled:opacity-50"
              >
                Add
              </button>
            </div>
            
            {/* Quick Add Suggestions */}
            <div className="mt-4 pt-4 border-t border-accent/10">
              <p className="text-xs text-foreground-muted mb-2">Popular:</p>
              <div className="flex flex-wrap gap-2">
                {['BTC', 'ETH', 'SOL', 'AAPL', 'TSLA', 'NVDA', 'EURUSD', 'GBPUSD']
                  .filter((s) => !watchlist.includes(s))
                  .slice(0, 6)
                  .map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => {
                        setWatchlist((prev) => [...prev, symbol]);
                        setShowAddModal(false);
                      }}
                      className="px-3 py-1 text-xs rounded-full bg-background-tertiary hover:bg-accent/20 transition-colors"
                    >
                      {symbol}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
