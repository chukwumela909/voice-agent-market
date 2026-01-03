'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeVoice } from '@/lib/hooks/useRealtimeVoice';
import VividVoiceVisualizer from '@/components/VividVoiceVisualizer';
import { X, Mic, Volume2, Loader2 } from 'lucide-react';

export default function VoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [fetchingTool, setFetchingTool] = useState<string | null>(null);
  const hasAutoConnected = useRef(false);
  
  // Audio visualization
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Friendly tool names for display
  const getToolDisplayName = (toolName: string) => {
    switch (toolName) {
      case 'get_market_price': return 'Fetching price data...';
      case 'get_technical_analysis': return 'Analyzing indicators...';
      case 'get_market_news': return 'Getting latest news...';
      case 'get_multiple_prices': return 'Fetching multiple prices...';
      case 'get_user_portfolio': return 'Loading your portfolio...';
      case 'add_portfolio_holding': return 'Updating your portfolio...';
      case 'remove_portfolio_holding': return 'Updating your portfolio...';
      default: return 'Fetching data...';
    }
  };

  const {
    isSupported,
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    isFetchingData,
    mediaStream,
    error,
    connect,
    disconnect,
  } = useRealtimeVoice({
    context: 'dashboard',
    userId: user?.id,
    onFetchingData: (isFetching, toolName) => {
      setFetchingTool(isFetching && toolName ? toolName : null);
    },
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
        const stream = mediaStream;
        
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        const updateLevel = () => {
          if (!analyserRef.current) return;
          
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average level (0-255) and normalize to 0-1
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

  // Auto-connect when page loads (only once)
  useEffect(() => {
    if (!isSupported || !user) return;
    if (hasAutoConnected.current) return;
    if (isConnected || isConnecting) return;
    
    hasAutoConnected.current = true;
    console.log('Auto-connecting voice...');
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      connect();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, user]);

  // Calculate orb size based on audio level
  const orbScale = 1 + (audioLevel * 0.5); // Scale from 1x to 1.5x
  const orbGlow = audioLevel * 60; // Glow intensity

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <VividVoiceVisualizer 
        className="absolute inset-0 z-0 pointer-events-none"
        level={isConnected ? audioLevel : 0.05}
        isConnected={true}
        isSpeaking={isSpeaking}
        isFetching={!!fetchingTool}
      />
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-10 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Pulsing Orb Visualizer */}
        <div className="relative mb-12">
          {/* Outer glow rings */}
          <div 
            className="absolute inset-0 rounded-full bg-accent/20 blur-xl transition-transform duration-100"
            style={{ 
              transform: `scale(${orbScale * 1.5})`,
              opacity: 0.3 + audioLevel * 0.4 
            }}
          />
          <div 
            className="absolute inset-0 rounded-full bg-accent/30 blur-lg transition-transform duration-100"
            style={{ 
              transform: `scale(${orbScale * 1.2})`,
              opacity: 0.4 + audioLevel * 0.3 
            }}
          />
          
          {/* Main orb */}
          <div
            className={`
              relative w-40 h-40 rounded-full flex items-center justify-center
              transition-all duration-100 cursor-pointer
              ${isConnecting
                ? 'bg-gradient-to-br from-yellow-500 to-orange-500 animate-pulse'
                : isConnected 
                  ? isSpeaking 
                    ? 'bg-gradient-to-br from-accent to-purple-500' 
                    : 'bg-gradient-to-br from-accent to-accent-dark'
                  : 'bg-gray-600 hover:bg-gray-500'}
            `}
            style={{
              transform: `scale(${orbScale})`,
              boxShadow: isConnected 
                ? `0 0 ${orbGlow}px ${orbGlow/2}px rgba(59, 130, 246, 0.5)`
                : isConnecting
                  ? '0 0 30px 15px rgba(234, 179, 8, 0.3)'
                  : 'none',
            }}
            onClick={handleToggleVoice}
          >
            {isConnecting ? (
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            ) : isSpeaking ? (
              <Volume2 className="w-16 h-16 text-white animate-pulse" />
            ) : (
              <Mic className={`w-16 h-16 text-white ${isListening ? 'animate-pulse' : ''}`} />
            )}
          </div>

          {/* Ripple effect when speaking */}
          {isSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-accent/50 animate-ping" />
              <div className="absolute inset-[-20px] rounded-full border border-accent/30 animate-ping" style={{ animationDelay: '0.2s' }} />
              <div className="absolute inset-[-40px] rounded-full border border-accent/20 animate-ping" style={{ animationDelay: '0.4s' }} />
            </>
          )}
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          <p className={`text-lg font-medium mb-2 ${
            error ? 'text-red-400' : 
            isFetchingData ? 'text-yellow-400' :
            isSpeaking ? 'text-accent' :
            isListening ? 'text-green-400' :
            'text-foreground-muted'
          }`}>
            {error ? 'Error connecting' :
             isConnecting ? 'Connecting...' :
             isFetchingData ? (fetchingTool ? getToolDisplayName(fetchingTool) : 'Fetching data...') :
             isSpeaking ? 'Vivid is speaking...' :
             isListening ? 'Listening...' :
             !isConnected ? 'Tap to connect' :
             'Ready'}
          </p>
          
          {error && (
            <p className="text-sm text-red-400/70">{error}</p>
          )}

          {/* Fetching indicator */}
          {isFetchingData && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
              <span className="text-sm text-foreground-muted">Getting real-time data</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="p-6 text-center">
        <p className="text-sm text-foreground-muted/50">
          Ask about stocks, crypto, forex, or do financial calculations
        </p>
      </div>

      {/* Not Supported Warning */}
      {!isSupported && (
        <div className="absolute inset-0 bg-background/95 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-xl font-semibold text-red-400 mb-2">Voice Not Supported</p>
            <p className="text-foreground-muted mb-4">
              Please use Chrome, Edge, or Safari for voice features.
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-accent rounded-lg text-white"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
