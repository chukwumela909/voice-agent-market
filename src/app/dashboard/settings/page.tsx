'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { User, Shield, Bell, Loader2, Save } from 'lucide-react';

type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';
type PreferredMarket = 'crypto' | 'stocks' | 'forex';

export default function SettingsPage() {
  const { user, profile, refreshProfile, session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState<{
    riskTolerance: RiskTolerance;
    preferredMarkets: PreferredMarket[];
    emailNotifications: boolean;
    pushNotifications: boolean;
    voiceNotifications: boolean;
  }>({
    riskTolerance: profile?.risk_tolerance || 'moderate',
    preferredMarkets: profile?.preferred_markets || ['crypto', 'stocks'],
    emailNotifications: profile?.notification_preferences?.email ?? true,
    pushNotifications: profile?.notification_preferences?.push ?? true,
    voiceNotifications: profile?.notification_preferences?.voice ?? true,
  });

  const handleSave = async () => {
    if (!session?.access_token) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          riskTolerance: formData.riskTolerance,
          preferredMarkets: formData.preferredMarkets,
          notificationPreferences: {
            email: formData.emailNotifications,
            push: formData.pushNotifications,
            voice: formData.voiceNotifications,
          },
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update profile');
      
      await refreshProfile();
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleMarket = (market: PreferredMarket) => {
    setFormData((prev) => ({
      ...prev,
      preferredMarkets: prev.preferredMarkets.includes(market)
        ? prev.preferredMarkets.filter((m) => m !== market)
        : [...prev.preferredMarkets, market],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-foreground-muted">
          Customize your Vivid experience
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-success/10 border border-success/20 text-success'
              : 'bg-danger/10 border border-danger/20 text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Account Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/10">
            <User className="w-5 h-5 text-accent" />
          </div>
          <h2 className="text-lg font-semibold">Account</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-foreground-muted mb-1">Email</label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="w-full bg-background-tertiary/50 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Risk Profile Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-warning/10">
            <Shield className="w-5 h-5 text-warning" />
          </div>
          <h2 className="text-lg font-semibold">Risk Profile</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-foreground-muted mb-2">Risk Tolerance</label>
            <div className="grid grid-cols-3 gap-3">
              {(['conservative', 'moderate', 'aggressive'] as RiskTolerance[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setFormData({ ...formData, riskTolerance: level })}
                  className={`py-3 px-4 rounded-lg capitalize transition-all ${
                    formData.riskTolerance === level
                      ? 'bg-accent text-background font-semibold'
                      : 'bg-background-tertiary hover:bg-background-secondary'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-foreground-muted mb-2">Preferred Markets</label>
            <div className="flex flex-wrap gap-3">
              {([
                { id: 'crypto' as PreferredMarket, label: '🪙 Crypto' },
                { id: 'stocks' as PreferredMarket, label: '📈 Stocks' },
                { id: 'forex' as PreferredMarket, label: '💱 Forex' },
              ]).map((market) => (
                <button
                  key={market.id}
                  onClick={() => toggleMarket(market.id)}
                  className={`py-2 px-4 rounded-lg transition-all ${
                    formData.preferredMarkets.includes(market.id)
                      ? 'bg-accent/20 border border-accent text-accent'
                      : 'bg-background-tertiary border border-transparent hover:border-accent/20'
                  }`}
                >
                  {market.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-success/10">
            <Bell className="w-5 h-5 text-success" />
          </div>
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        
        <div className="space-y-4">
          {[
            { id: 'emailNotifications', label: 'Email Notifications', desc: 'Receive alerts via email' },
            { id: 'pushNotifications', label: 'Push Notifications', desc: 'Browser push notifications' },
            { id: 'voiceNotifications', label: 'Voice Notifications', desc: 'Voice agent mentions alerts' },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-foreground-muted">{item.desc}</p>
              </div>
              <button
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id as keyof typeof prev],
                  }))
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  formData[item.id as keyof typeof formData]
                    ? 'bg-success'
                    : 'bg-background-tertiary'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    formData[item.id as keyof typeof formData]
                      ? 'translate-x-7'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-xl btn-metallic font-semibold flex items-center justify-center gap-2"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
