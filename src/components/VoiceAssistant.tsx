'use client';

import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';

export function VoiceAssistant() {
  const router = useRouter();

  const handleClick = () => {
    router.push('/dashboard/voice');
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-20 right-6 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-accent text-white shadow-lg shadow-accent/30 flex items-center justify-center hover:scale-110 hover:bg-accent-dark active:scale-95 transition-all duration-200"
      aria-label="Open voice assistant"
    >
      <Mic className="w-6 h-6" />
    </button>
  );
}
