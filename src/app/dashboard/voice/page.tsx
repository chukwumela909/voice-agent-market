'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeVoice } from '@/lib/hooks/useRealtimeVoice';
import { X } from 'lucide-react';

type Particle = {
  angle: number;
  distanceRatio: number; // 0 to 1, how far from center
  offset: number;
  speed: number;
  size: number;
};

export default function VoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const hasAutoConnected = useRef(false);
  
  // Canvas and animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const audioLevelRef = useRef(0);
  
  // Audio visualization
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isSpeakingRef = useRef(false);

  const {
    isSupported,
    isConnected,
    isConnecting,
    isSpeaking,
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

  // Keep speaking ref in sync
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Initialize particles
  useEffect(() => {
    const particleCount = 300;
    const particles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      // Distribute particles throughout the circle using square root for uniform distribution
      const distanceRatio = Math.sqrt(Math.random());
      particles.push({
        angle: Math.random() * Math.PI * 2,
        distanceRatio,
        offset: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.2,
        size: 0.8 + Math.random() * 1.2,
      });
    }
    
    particlesRef.current = particles;
  }, []);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Combine user audio level with speaking state
      const micLevel = audioLevelRef.current;
      const speakingLevel = isSpeakingRef.current ? 0.6 + Math.sin(time * 10) * 0.35 : 0;
      const level = Math.max(micLevel, speakingLevel);
      
      time += 0.016 * (1 + level * 4); // Speed up with audio

      const particles = particlesRef.current;
      const maxRadius = 90;

      // Draw all particles
      for (const p of particles) {
        // Base position within circle
        const baseRadius = p.distanceRatio * maxRadius;
        
        // Vibration pushes particles outward based on audio level
        const vibrationAmount = (5 + level * 50) * p.distanceRatio;
        const vibration = Math.sin(time * p.speed * 2 + p.offset) * vibrationAmount;
        const radius = baseRadius + vibration + level * 40 * p.distanceRatio;

        // Particles also rotate slightly
        const angleOffset = Math.sin(time * 0.5 + p.offset) * 0.1 * level;
        const x = centerX + Math.cos(p.angle + angleOffset) * radius;
        const y = centerY + Math.sin(p.angle + angleOffset) * radius;

        // Particle size pulses with audio
        const size = p.size * (1 + level * 2);

        // Brighter when audio is active
        const alpha = 0.4 + level * 0.6;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(192, 192, 192, ${alpha})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Set up audio visualization
  useEffect(() => {
    if (!isConnected || !mediaStream) {
      audioLevelRef.current = 0;
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
          const level = average / 255;
          audioLevelRef.current = level;
          setAudioLevel(level);

          audioAnimationRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (err) {
        console.error('Failed to set up visualization:', err);
      }
    };

    setupVisualization();

    return () => {
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
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

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex flex-col">
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-10 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
      >
        <X className="w-6 h-6 text-white/70" />
      </button>

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleToggleVoice}
        className="flex-1 cursor-pointer"
      />

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
