'use client';

import { Alerts } from '@/components';

export default function AlertsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Price Alerts</h1>
        <p className="text-foreground-muted">
          Get notified when prices hit your targets
        </p>
      </div>
      
      {/* Alerts Component */}
      <Alerts />
    </div>
  );
}
