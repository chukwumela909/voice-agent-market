'use client';

import { Navigation } from '@/components';
import { VoiceAssistant } from '@/components/VoiceAssistant';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Main Content - offset for sidebar on desktop */}
      <main className="md:ml-64 pt-16 md:pt-0 pb-24 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Always-on Voice Assistant */}
      <VoiceAssistant />
    </div>
  );
}
