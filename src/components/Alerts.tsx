'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Bell, BellOff, Loader2, X, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Alert } from '@/types';

export default function Alerts() {
  const { session } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    symbol: '',
    condition: 'above' as 'above' | 'below' | 'change_percent',
    targetPrice: '',
    percentageChange: '',
  });
  
  useEffect(() => {
    if (session) {
      fetchAlerts();
    }
  }, [session]);
  
  const fetchAlerts = async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch('/api/alerts', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch alerts');
      
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };
  
  const addAlert = async () => {
    if (!session?.access_token) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const body: any = {
        symbol: formData.symbol.toUpperCase(),
        condition: formData.condition,
      };
      
      if (formData.condition === 'change_percent') {
        body.percentageChange = parseFloat(formData.percentageChange);
      } else {
        body.targetPrice = parseFloat(formData.targetPrice);
      }
      
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create alert');
      }
      
      setShowAddModal(false);
      setFormData({ symbol: '', condition: 'above', targetPrice: '', percentageChange: '' });
      fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };
  
  const toggleAlert = async (alert: Alert) => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ isActive: !alert.is_active }),
      });
      
      if (!response.ok) throw new Error('Failed to update alert');
      
      fetchAlerts();
    } catch (err) {
      setError('Failed to update alert');
    }
  };
  
  const deleteAlert = async (id: string) => {
    if (!session?.access_token) return;
    
    if (!confirm('Are you sure you want to delete this alert?')) return;
    
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to delete alert');
      
      fetchAlerts();
    } catch (err) {
      setError('Failed to delete alert');
    }
  };
  
  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'above':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'below':
        return <TrendingDown className="w-4 h-4 text-danger" />;
      case 'change_percent':
        return <Percent className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };
  
  const getConditionText = (alert: Alert) => {
    switch (alert.condition) {
      case 'above':
        return `Price above $${alert.target_price?.toLocaleString()}`;
      case 'below':
        return `Price below $${alert.target_price?.toLocaleString()}`;
      case 'change_percent':
        return `${alert.percentage_change}% change`;
      default:
        return '';
    }
  };
  
  if (!session) {
    return (
      <div className="text-center py-12 text-foreground-muted">
        <p>Please sign in to manage alerts</p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-lg" />
        <div className="skeleton h-20 rounded-lg" />
        <div className="skeleton h-20 rounded-lg" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 px-4 rounded-lg btn-metallic flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Create Alert
      </button>
      
      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No alerts set up</p>
          <p className="text-sm mt-1">Create an alert to get notified of price changes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`card p-4 ${!alert.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      alert.is_active ? 'bg-accent/10' : 'bg-background-tertiary'
                    }`}
                  >
                    {getConditionIcon(alert.condition)}
                  </div>
                  <div>
                    <h3 className="font-bold">{alert.symbol}</h3>
                    <p className="text-sm text-foreground-muted">{getConditionText(alert)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert(alert)}
                    className={`p-2 rounded-lg transition-colors ${
                      alert.is_active
                        ? 'bg-success/10 text-success hover:bg-success/20'
                        : 'bg-background-tertiary text-foreground-muted hover:bg-background-secondary'
                    }`}
                  >
                    {alert.is_active ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2 rounded-lg hover:bg-danger/10 text-foreground-muted hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {alert.last_triggered && (
                <p className="text-xs text-foreground-muted mt-3 pt-3 border-t border-accent/10">
                  Last triggered: {new Date(alert.last_triggered).toLocaleString()}
                </p>
              )}
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
              <h3 className="text-lg font-semibold">Create Alert</h3>
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
                <label className="block text-sm text-foreground-muted mb-1">Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                  className="w-full"
                >
                  <option value="above">Price goes above</option>
                  <option value="below">Price goes below</option>
                  <option value="change_percent">Percentage change</option>
                </select>
              </div>
              
              {formData.condition === 'change_percent' ? (
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.percentageChange}
                    onChange={(e) => setFormData({ ...formData, percentageChange: e.target.value })}
                    placeholder="e.g., 5"
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Target Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.targetPrice}
                    onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full"
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 px-4 rounded-lg bg-background-tertiary hover:bg-background-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addAlert}
                disabled={
                  submitting ||
                  !formData.symbol ||
                  (formData.condition === 'change_percent' ? !formData.percentageChange : !formData.targetPrice)
                }
                className="flex-1 py-2 px-4 rounded-lg btn-metallic disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
