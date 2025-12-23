'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface UseRealtimeVoiceOptions {
  context?: 'auth' | 'dashboard';
  userId?: string;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onFetchingData?: (isFetching: boolean, toolName?: string) => void;
}

interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions = {}) {
  const {
    context = 'dashboard',
    userId,
    onTranscript,
    onResponse,
    onError,
    onConnectionChange,
    onSpeakingChange,
    onFetchingData,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Check WebRTC support
  const isSupported = typeof window !== 'undefined' && 
    'RTCPeerConnection' in window && 
    'mediaDevices' in navigator;

  const connect = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = 'Your browser does not support voice features. Please use Chrome, Edge, or Safari.';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Get ephemeral token from our API
      const tokenResponse = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, userId }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to create voice session');
      }

      const { client_secret } = await tokenResponse.json();

      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio element for AI responses
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      // Handle incoming audio from OpenAI
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        
        // Monitor when AI is speaking
        const audioTrack = event.streams[0].getAudioTracks()[0];
        if (audioTrack) {
          // Create audio context to detect speech
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(event.streams[0]);
          const analyser = audioContext.createAnalyser();
          source.connect(analyser);
          analyser.fftSize = 256;
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          const checkSpeaking = () => {
            if (!peerConnectionRef.current) return;
            
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const speaking = average > 10;
            
            if (speaking !== isSpeaking) {
              setIsSpeaking(speaking);
              onSpeakingChange?.(speaking);
            }
            
            requestAnimationFrame(checkSpeaking);
          };
          
          checkSpeaking();
        }
      };

      // Get user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000,
        }
      });
      mediaStreamRef.current = stream;

      // Add microphone track to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setIsConnected(true);
        setIsListening(true);
        onConnectionChange?.(true);
      };

      dc.onmessage = (event) => {
        try {
          const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
          handleRealtimeEvent(realtimeEvent);
        } catch (e) {
          console.error('Failed to parse realtime event:', e);
        }
      };

      dc.onclose = () => {
        setIsConnected(false);
        setIsListening(false);
        onConnectionChange?.(false);
      };

      // Create and set local offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI
      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${client_secret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error('Failed to connect to OpenAI Realtime');
      }

      // Set remote description
      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to voice service';
      setError(errorMsg);
      onError?.(errorMsg);
      disconnect();
    } finally {
      setIsConnecting(false);
    }
  }, [isSupported, isConnected, isConnecting, context, userId, onConnectionChange, onError, onSpeakingChange, isSpeaking]);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcription
        onTranscript?.(event.transcript, true);
        break;

      case 'response.audio_transcript.delta':
        // AI response text (streaming)
        // We accumulate these in the component
        break;

      case 'response.audio_transcript.done':
        // AI response complete
        onResponse?.(event.transcript);
        break;

      case 'response.function_call_arguments.done':
        // Function call received - execute it
        handleFunctionCall(event);
        break;

      case 'response.done':
        // Full response complete
        setIsSpeaking(false);
        setIsFetchingData(false);
        onSpeakingChange?.(false);
        onFetchingData?.(false);
        break;

      case 'error':
        console.error('Realtime API error:', event.error);
        onError?.(event.error?.message || 'Voice processing error');
        break;

      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        break;
    }
  }, [onTranscript, onResponse, onError, onSpeakingChange, onFetchingData]);

  // Handle function calls from the AI
  const handleFunctionCall = useCallback(async (event: RealtimeEvent) => {
    const { call_id, name, arguments: argsString } = event;
    
    // Notify UI that we're fetching data
    setIsFetchingData(true);
    onFetchingData?.(true, name);

    try {
      const args = JSON.parse(argsString);
      
      // Call our backend to execute the tool
      const response = await fetch('/api/voice/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: name, arguments: args }),
      });

      const result = await response.json();

      // Send the result back to OpenAI
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        // Send function result
        const outputEvent = {
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id,
            output: JSON.stringify(result),
          },
        };
        dataChannelRef.current.send(JSON.stringify(outputEvent));

        // Trigger AI to continue responding with the data
        dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    } catch (err) {
      console.error('Function call error:', err);
      
      // Send error result back to OpenAI
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        const errorEvent = {
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id,
            output: JSON.stringify({ success: false, error: 'Failed to fetch data' }),
          },
        };
        dataChannelRef.current.send(JSON.stringify(errorEvent));
        dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    } finally {
      setIsFetchingData(false);
      onFetchingData?.(false);
    }
  }, [onFetchingData]);

  const disconnect = useCallback(() => {
    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Clean up audio element
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsFetchingData(false);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  const sendMessage = useCallback((text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      console.error('Data channel not ready');
      return;
    }

    // Send a text message to the conversation
    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    };

    dataChannelRef.current.send(JSON.stringify(event));

    // Trigger response
    dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, []);

  const interruptResponse = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      return;
    }

    // Cancel current response
    dataChannelRef.current.send(JSON.stringify({ type: 'response.cancel' }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isSupported,
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    isFetchingData,
    error,
    connect,
    disconnect,
    sendMessage,
    interruptResponse,
  };
}
