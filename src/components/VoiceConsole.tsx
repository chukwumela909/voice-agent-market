'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, AlertCircle, PhoneOff } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeVoice } from '@/lib/hooks/useRealtimeVoice';
import type { MarketData } from '@/types';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  marketData?: MarketData[];
}

export default function VoiceConsole() {
  const { user } = useAuth();
  
  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    isSupported,
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    error,
    connect,
    disconnect,
    interruptResponse,
  } = useRealtimeVoice({
    context: 'dashboard',
    userId: user?.id,
    onTranscript: (text, isFinal) => {
      setCurrentTranscript(text);
      if (isFinal && text.trim()) {
        // Add user message
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          type: 'user',
          content: text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setCurrentTranscript('');
      }
    },
    onResponse: (text) => {
      if (text.trim()) {
        // Add assistant message
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          type: 'assistant',
          content: text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentResponse('');
      }
    },
    onError: (errorMsg) => {
      console.error('Voice error:', errorMsg);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript, currentResponse]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const toggleConnection = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  const handleInterrupt = useCallback(() => {
    interruptResponse();
  }, [interruptResponse]);
  
  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isConnected && (
          <div className="text-center text-foreground-muted py-12">
            <div className="text-6xl mb-4">🎙️</div>
            <h3 className="text-xl font-semibold mb-2">Start a Conversation</h3>
            <p className="text-sm max-w-md mx-auto">
              Click the microphone button to connect. Then just speak naturally about crypto prices, stock analysis, 
              market trends, or your portfolio. I&apos;m here to help!
            </p>
            {!isSupported && (
              <div className="mt-6 flex items-center justify-center gap-2 text-yellow-400">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">Voice features are not supported in this browser.</p>
              </div>
            )}
          </div>
        )}

        {isConnected && messages.length === 0 && !isListening && (
          <div className="text-center text-foreground-muted py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
              <Volume2 className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Connected</h3>
            <p className="text-sm">Start speaking to ask about markets...</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-accent text-background-secondary rounded-br-sm'
                  : 'glass rounded-bl-sm'
              }`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              
              {/* Market data badges */}
              {message.marketData && message.marketData.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-accent/20">
                  {message.marketData.map((data) => (
                    <div
                      key={data.symbol}
                      className="flex items-center gap-2 bg-background/50 rounded-full px-3 py-1"
                    >
                      <span className="font-semibold text-xs">{data.symbol}</span>
                      <span className="text-xs">${data.price.toLocaleString()}</span>
                      <span
                        className={`text-xs font-medium ${
                          data.change24h >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {data.change24h >= 0 ? '↑' : '↓'}
                        {Math.abs(data.change24h).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-foreground-muted mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {/* Current transcript (user speaking) */}
        {currentTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 bg-accent/50 text-background-secondary">
              <p className="text-sm leading-relaxed italic">{currentTranscript}</p>
            </div>
          </div>
        )}

        {/* Current response (AI speaking) */}
        {currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-[80%] glass rounded-2xl rounded-bl-sm px-4 py-3">
              <p className="text-sm leading-relaxed">{currentResponse}</p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-danger text-sm flex-1">{error}</p>
        </div>
      )}
      
      {/* Voice Controls */}
      <div className="p-4 border-t border-accent/10">
        <div className="flex items-center justify-center gap-4">
          {/* Audio Level Indicator */}
          {isListening && (
            <div className="flex items-end gap-1 h-8">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-accent rounded-full"
                  style={{
                    height: `${8 + Math.random() * 24}px`,
                    animation: 'pulse 0.5s ease-in-out infinite',
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Main Mic Button */}
          <button
            onClick={toggleConnection}
            disabled={!isSupported || isConnecting}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center
              transition-all duration-200 relative
              ${isConnected
                ? 'bg-danger'
                : 'btn-metallic'
              }
              ${(!isSupported || isConnecting) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isConnecting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isConnected ? (
              <>
                {isListening && (
                  <div className="absolute inset-0 rounded-full bg-danger/50 animate-ping" />
                )}
                <Mic className="w-6 h-6 text-white relative z-10" />
              </>
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </button>
          
          {/* Interrupt/Disconnect Button */}
          {isConnected && (
            <button
              onClick={isSpeaking ? handleInterrupt : disconnect}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-background-tertiary border border-accent/20 hover:border-accent/40 transition-colors"
              title={isSpeaking ? 'Interrupt' : 'Disconnect'}
            >
              {isSpeaking ? (
                <VolumeX className="w-5 h-5 text-warning" />
              ) : (
                <PhoneOff className="w-5 h-5 text-danger" />
              )}
            </button>
          )}
        </div>
        
        {/* Status Text */}
        <div className="text-center mt-3">
          {isConnecting ? (
            <p className="text-sm text-foreground-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </p>
          ) : !isConnected ? (
            <p className="text-sm text-foreground-muted">
              {isSupported ? 'Tap to start talking' : 'Voice not supported'}
            </p>
          ) : isSpeaking ? (
            <p className="text-sm text-accent flex items-center justify-center gap-2">
              <Volume2 className="w-4 h-4" />
              AI speaking... tap to interrupt
            </p>
          ) : isListening ? (
            <p className="text-sm text-danger flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-danger rounded-full animate-pulse" />
              Listening...
            </p>
          ) : (
            <p className="text-sm text-success flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-success rounded-full" />
              Connected - speak anytime
            </p>
          )}
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}
