'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeVoice } from '@/lib/hooks/useRealtimeVoice';
import { X } from 'lucide-react';

export default function VoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const hasAutoConnected = useRef(false);
  
  // Audio visualization
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const {
    isSupported,
    isConnected,
    isConnecting,
    mediaStream,
    error,
    connect,
    disconnect,
  } = useRealtimeVoice({
    context: 'dashboard',
    userId: user?.id,
    onError: (err) => {
      console.error('Voice error:', err);
    },
  });

  // Set up audio visualization
  useEffect(() => {
    if (!isConnected || !mediaStream) {
      setAudioLevel(0);
      return;
    }

    const setupVisualization = async () => {
      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(mediaStream);
        const analyser = audioContext.createAnalyser();
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);
        analyserRef.current = analyser;

        const updateLevel = () => {
          if (!analyserRef.current) return;
          
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);

          animationRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (err) {
        console.error('Failed to set up visualization:', err);
      }
    };

    setupVisualization();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isConnected, mediaStream]);

  const handleClose = () => {
    disconnect();
    router.back();
  };

  const handleToggleVoice = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  // Auto-connect when page loads
  useEffect(() => {
    if (!isSupported) return;
    if (hasAutoConnected.current) return;
    if (isConnected || isConnecting) return;
    
    hasAutoConnected.current = true;
    const timer = setTimeout(() => {
      connect();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  // Circle size based on audio level
  const baseSize = 160;
  const maxGrow = 80;
  const circleSize = baseSize + (audioLevel * maxGrow);
  const glowIntensity = 20 + (audioLevel * 60);

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex flex-col">
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-10 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
      >
        <X className="w-6 h-6 text-white/70" />
      </button>

      {/* Centered Circle */}
      <div className="flex-1 flex items-center justify-center">
        <div
          onClick={handleToggleVoice}
          className="rounded-full cursor-pointer transition-all duration-75"
          style={{
            width: circleSize,
            height: circleSize,
            background: isConnecting 
              ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
              : 'linear-gradient(135deg, #c0c0c0 0%, #808080 100%)',
            boxShadow: isConnected 
              ? `0 0 ${glowIntensity}px ${glowIntensity / 2}px rgba(192, 192, 192, 0.4)`
              : isConnecting
                ? '0 0 40px 20px rgba(251, 191, 36, 0.3)'
                : '0 0 20px 10px rgba(192, 192, 192, 0.2)',
          }}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Not Supported Warning */}
      {!isSupported && (
        <div className="absolute inset-0 bg-[#0a0a0f]/95 flex items-center justify-center p-6 z-20">
          <div className="text-center">
            <p className="text-xl font-semibold text-red-400 mb-2">Voice Not Supported</p>
            <p className="text-gray-400 mb-4">
              Please use Chrome, Edge, or Safari for voice features.
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-gray-700 rounded-lg text-white hover:bg-gray-600"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
