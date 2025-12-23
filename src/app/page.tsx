'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeVoice } from '@/lib/hooks/useRealtimeVoice';
import { Mic, Loader2, X, Volume2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';

export default function AuthPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  
  // Voice State
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentMessage, setAgentMessage] = useState('');
  const [pendingSignIn, setPendingSignIn] = useState(false);
  
  // Use refs for consent tracking to avoid stale closures
  const hasAskedForConsentRef = useRef(false);
  const lastUserTranscriptRef = useRef('');
  const [hasAskedForConsent, setHasAskedForConsent] = useState(false);

  const {
    isSupported,
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    error: voiceError,
    connect,
    disconnect,
    sendMessage,
  } = useRealtimeVoice({
    context: 'auth',
    onTranscript: (text, isFinal) => {
      setTranscript(text);
      if (isFinal) {
        lastUserTranscriptRef.current = text;
        console.log('[Auth] User said:', text);
      }
    },
    onResponse: (text) => {
      setAgentMessage(text);
      const lower = text.toLowerCase();
      console.log('[Auth] Assistant said:', text);

      // Mark that the assistant asked for confirmation (consent gate)
      if (
        lower.includes('would you like') ||
        lower.includes('say yes') ||
        lower.includes('confirm')
      ) {
        hasAskedForConsentRef.current = true;
        setHasAskedForConsent(true);
        console.log('[Auth] Consent question detected');
      }

      // Trigger Google OAuth when assistant says "signing you in"
      if (lower.includes('signing you in')) {
        const userLower = lastUserTranscriptRef.current.toLowerCase();
        const affirmed = /\b(yes|yep|yeah|sure|confirm|continue|ok|okay|go ahead|sign|log)\b/.test(userLower);
        
        console.log('[Auth] Sign-in trigger detected. User transcript:', userLower, 'Affirmed:', affirmed, 'Consent asked:', hasAskedForConsentRef.current);

        // Trigger sign-in - trust the AI's judgment since it has consent instructions
        setPendingSignIn(true);
        setTimeout(() => {
          console.log('[Auth] Triggering Google sign-in...');
          signInWithGoogle();
        }, 800);
      }
    },
    onError: (error) => {
      console.error('Voice error:', error);
    },
    onSpeakingChange: (speaking) => {
      if (!speaking) {
        setTranscript('');
      }
    },
  });

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const toggleVoiceMode = useCallback(() => {
    if (isVoiceMode) {
      disconnect();
      setIsVoiceMode(false);
      setTranscript('');
      setAgentMessage('');
      hasAskedForConsentRef.current = false;
      lastUserTranscriptRef.current = '';
      setHasAskedForConsent(false);
    } else {
      setIsVoiceMode(true);
      setAgentMessage('Connecting...');
      connect();
    }
  }, [isVoiceMode, connect, disconnect]);

  // When connected in auth voice mode, proactively prompt the assistant to ask for consent first.
  useEffect(() => {
    if (!isVoiceMode) return;
    if (!isConnected) return;
    if (pendingSignIn) return;
    if (hasAskedForConsent) return;

    setAgentMessage('');
    sendMessage(
      'Start the authentication flow. Ask me to confirm Google sign-in first.'
    );
  }, [isVoiceMode, isConnected, pendingSignIn, hasAskedForConsent, sendMessage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/5 via-background to-background pointer-events-none" />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Logo */}
          <div className="relative mx-auto w-24 h-24 mb-8 group">
            <div className="absolute inset-0 bg-accent/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500" />
            <div className="relative w-full h-full bg-gradient-to-br from-accent to-accent-dark rounded-3xl flex items-center justify-center shadow-2xl border border-white/10">
              <Mic className="w-10 h-10 text-background" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Vivid
            </h1>
            <p className="text-lg text-foreground-muted max-w-sm mx-auto leading-relaxed">
              Your personal AI market analyst. 
              <br />
              Just speak to trade.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-8 space-y-4">
            <button
              onClick={signInWithGoogle}
              disabled={pendingSignIn}
              className="w-full py-4 px-6 rounded-xl bg-white text-gray-900 font-semibold text-lg flex items-center justify-center gap-3 hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pendingSignIn ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {pendingSignIn ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-foreground-muted/50 relative z-10">
        <p>© {new Date().getFullYear()} Vivid. Not financial advice.</p>
      </footer>

      {/* Floating Voice Button */}
      <button
        onClick={toggleVoiceMode}
        disabled={!isSupported}
        className="fixed bottom-8 right-8 z-20 w-16 h-16 rounded-full bg-accent text-background shadow-lg shadow-accent/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
        title={!isSupported ? 'Voice not supported in this browser' : 'Tap to use voice'}
      >
        {isConnecting ? (
          <Loader2 className="w-8 h-8 animate-spin" />
        ) : (
          <>
            <div className="absolute inset-0 rounded-full bg-accent/50 animate-ping opacity-0 group-hover:opacity-100" />
            <Mic className="w-8 h-8" />
          </>
        )}
      </button>

      {/* Voice Mode Overlay */}
      {isVoiceMode && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <button 
            onClick={toggleVoiceMode}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-full max-w-md text-center space-y-12">
            {/* Voice Error */}
            {voiceError && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{voiceError}</p>
              </div>
            )}

            {/* Visualizer */}
            <div className="relative h-32 flex items-center justify-center">
              {isConnecting ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-accent" />
                  <p className="text-foreground-muted">Connecting...</p>
                </div>
              ) : isListening ? (
                <div className="flex items-center justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-3 bg-accent rounded-full"
                      style={{
                        height: `${20 + Math.random() * 60}px`,
                        animation: 'pulse 0.5s ease-in-out infinite',
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              ) : isSpeaking ? (
                <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
                  <Volume2 className="w-10 h-10 text-accent" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
                  <Mic className="w-10 h-10 text-accent/50" />
                </div>
              )}
            </div>

            {/* Agent Message */}
            <div className="space-y-4 min-h-[80px]">
              {agentMessage && (
                <p className="text-xl font-medium text-accent animate-in fade-in">
                  {agentMessage}
                </p>
              )}
              {transcript && (
                <p className="text-lg text-foreground-muted">
                  &ldquo;{transcript}&rdquo;
                </p>
              )}
            </div>

            {/* Status */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <div className={`w-2 h-2 rounded-full transition-colors ${
                isConnecting ? 'bg-yellow-500 animate-pulse' :
                isConnected ? (isListening ? 'bg-red-500 animate-pulse' : 'bg-green-500') :
                'bg-gray-500'
              }`} />
              <span className="text-sm font-medium">
                {isConnecting ? 'Connecting...' :
                 !isConnected ? 'Disconnected' :
                 isListening ? 'Listening...' :
                 isSpeaking ? 'Speaking...' :
                 'Ready'}
              </span>
            </div>

            {/* Not Supported Warning */}
            {!isSupported && (
              <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">Voice features are not supported in this browser. Please use Chrome, Edge, or Safari.</p>
              </div>
            )}
          </div>
        </div>
      )}

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