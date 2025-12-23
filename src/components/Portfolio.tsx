'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Loader2, Edit2, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { PortfolioHolding, PortfolioSummary } from '@/types';

export default function Portfolio() {
  const { session } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    avgBuyPrice: '',
    marketType: 'crypto' as 'crypto' | 'stock' | 'forex',
  });
  
  useEffect(() => {
    if (session) {
      fetchPortfolio();
    }
  }, [session]);
  
  const fetchPortfolio = async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch('/api/portfolio', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch portfolio');
      
      const data = await response.json();
      setPortfolio(data);
    } catch (err) {
      console.error('Error fetching portfolio:', err);
      setError('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };
  
  const addHolding = async () => {
    if (!session?.access_token) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          symbol: formData.symbol.toUpperCase(),
          quantity: parseFloat(formData.quantity),
          avgBuyPrice: parseFloat(formData.avgBuyPrice),
          marketType: formData.marketType,
        }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add holding');
      }
      
      setShowAddModal(false);
      setFormData({ symbol: '', quantity: '', avgBuyPrice: '', marketType: 'crypto' });
      fetchPortfolio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holding');
    } finally {
      setSubmitting(false);
    }
  };
  
  const deleteHolding = async (id: string) => {
    if (!session?.access_token) return;
    
    if (!confirm('Are you sure you want to remove this holding?')) return;
    
    try {
      const response = await fetch(`/api/portfolio/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to delete holding');
      
      fetchPortfolio();
    } catch (err) {
      setError('Failed to delete holding');
    }
  };
  
  if (!session) {
    return (
      <div className="text-center py-12 text-foreground-muted">
        <p>Please sign in to view your portfolio</p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-lg" />
        <div className="skeleton h-24 rounded-lg" />
        <div className="skeleton h-24 rounded-lg" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {portfolio && (
        <div className="card p-6 bg-gradient-to-br from-background-secondary to-background-tertiary border-accent/20">
          <p className="text-sm text-foreground-muted mb-1">Total Portfolio Value</p>
          <p className="text-3xl font-bold mb-2">
            ${portfolio.totalValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              portfolio.totalProfitLoss >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {portfolio.totalProfitLoss >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>
              {portfolio.totalProfitLoss >= 0 ? '+' : ''}
              ${portfolio.totalProfitLoss.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-foreground-muted">
              ({portfolio.totalProfitLossPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      )}
      
      {/* Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 px-4 rounded-lg btn-metallic flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Holding
      </button>
      
      {/* Holdings List */}
      {portfolio?.holdings.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          <p>No holdings yet</p>
          <p className="text-sm mt-1">Add your first position to start tracking</p>
        </div>
      ) : (
        <div className="space-y-3">
          {portfolio?.holdings.map((holding) => (
            <div key={holding.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{holding.symbol}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                      {holding.marketType}
                    </span>
                  </div>
                  <p className="text-sm text-foreground-muted">
                    {holding.quantity} units @ ${holding.avgBuyPrice.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => deleteHolding(holding.id)}
                  className="p-2 rounded-lg hover:bg-danger/10 text-foreground-muted hover:text-danger transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-foreground-muted">Current Price</p>
                  <p className="font-semibold">${holding.currentPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Total Value</p>
                  <p className="font-semibold">
                    ${holding.totalValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-accent/10 flex items-center justify-between">
                <span className="text-sm text-foreground-muted">P/L</span>
                <span
                  className={`font-semibold ${
                    holding.profitLoss >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {holding.profitLoss >= 0 ? '+' : ''}
                  ${holding.profitLoss.toFixed(2)} ({holding.profitLossPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
          {error}
        </div>
      )}
      
      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Holding</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-background-tertiary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Symbol</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g., BTC, AAPL"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Market Type</label>
                <select
                  value={formData.marketType}
                  onChange={(e) => setFormData({ ...formData, marketType: e.target.value as any })}
                  className="w-full"
                >
                  <option value="crypto">Crypto</option>
                  <option value="stock">Stock</option>
                  <option value="forex">Forex</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Average Buy Price ($)</label>
                <input
                  type="number"
                  step="any"
                  value={formData.avgBuyPrice}
                  onChange={(e) => setFormData({ ...formData, avgBuyPrice: e.target.value })}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 px-4 rounded-lg bg-background-tertiary hover:bg-background-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addHolding}
                disabled={submitting || !formData.symbol || !formData.quantity || !formData.avgBuyPrice}
                className="flex-1 py-2 px-4 rounded-lg btn-metallic disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
