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
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isSpeakingRef = useRef(false);

  // Check WebRTC support
  const isSupported = typeof window !== 'undefined' && 
    'RTCPeerConnection' in window && 
    'mediaDevices' in navigator;

  // Handle function calls from the AI - defined first so it can be used in event handler
  const handleFunctionCall = useCallback(async (event: RealtimeEvent) => {
    const { call_id, name, arguments: argsString } = event;
    
    console.log('Executing function call:', name, argsString);
    
    // Notify UI that we're fetching data
    setIsFetchingData(true);
    onFetchingData?.(true, name);

    try {
      const args = JSON.parse(argsString || '{}');
      
      // Call our backend to execute the tool (include userId for portfolio operations)
      const response = await fetch('/api/voice/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: name, arguments: args, userId }),
      });

      const result = await response.json();
      console.log('Function result:', result);

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
            output: JSON.stringify({ success: false, error: 'Failed to fetch data. Please try again.' }),
          },
        };
        dataChannelRef.current.send(JSON.stringify(errorEvent));
        dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    } finally {
      setIsFetchingData(false);
      onFetchingData?.(false);
    }
  }, [onFetchingData, userId]);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case 'session.created':
        console.log('Session created successfully');
        break;

      case 'session.updated':
        console.log('Session updated');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcription
        console.log('User said:', event.transcript);
        onTranscript?.(event.transcript, true);
        break;

      case 'response.audio_transcript.delta':
        // AI response text (streaming)
        break;

      case 'response.audio_transcript.done':
        // AI response complete
        console.log('AI response transcript:', event.transcript);
        onResponse?.(event.transcript);
        break;

      case 'response.audio.delta':
        // Audio chunk received - AI is speaking
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          onSpeakingChange?.(true);
        }
        break;

      case 'response.audio.done':
        // Audio finished
        console.log('AI audio response complete');
        break;

      case 'response.function_call_arguments.done':
        // Function call received - execute it
        console.log('Function call:', event.name);
        handleFunctionCall(event);
        break;

      case 'response.done':
        // Full response complete
        console.log('Response complete');
        isSpeakingRef.current = false;
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
        console.log('User started speaking');
        setIsListening(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('User stopped speaking');
        setIsListening(false);
        break;

      case 'input_audio_buffer.committed':
        console.log('Audio buffer committed');
        break;

      case 'conversation.item.created':
        console.log('Conversation item created:', event.item?.type);
        break;

      case 'response.created':
        console.log('AI response started');
        break;

      case 'response.output_item.added':
        console.log('Output item added');
        break;

      case 'response.content_part.added':
        console.log('Content part added');
        break;

      default:
        // Don't log every event to reduce noise
        break;
    }
  }, [onTranscript, onResponse, onError, onSpeakingChange, onFetchingData, handleFunctionCall]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting voice...');
    
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
    setMediaStream(null);

    // Clean up audio element
    if (audioElementRef.current) {
      if (audioElementRef.current.parentNode) {
        audioElementRef.current.parentNode.removeChild(audioElementRef.current);
      }
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    isSpeakingRef.current = false;
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsFetchingData(false);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  const connect = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = 'Your browser does not support voice features. Please use Chrome, Edge, or Safari.';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (isConnected || isConnecting) {
      console.log('Already connected or connecting');
      return;
    }

    console.log('Starting voice connection...');
    setIsConnecting(true);
    setError(null);

    try {
      // Get ephemeral token from our API
      console.log('Fetching session token...');
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
      console.log('Got session token');

      // Create peer connection with STUN servers for NAT traversal
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      });
      peerConnectionRef.current = pc;

      // Set up audio element for AI responses
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      audioElementRef.current = audioEl;
      
      // Append to body to ensure it works on mobile
      document.body.appendChild(audioEl);

      // Handle incoming audio from OpenAI
      pc.ontrack = (event) => {
        console.log('Received audio track from OpenAI');
        audioEl.srcObject = event.streams[0];
        
        // Explicitly play audio (needed for some browsers)
        const playPromise = audioEl.play();
        if (playPromise) {
          playPromise.catch(e => {
            console.log('Audio autoplay blocked:', e);
          });
        }
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          disconnect();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
      };

      // Get user's microphone
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      mediaStreamRef.current = stream;
      setMediaStream(stream);
      console.log('Got microphone access');

      // Add microphone track to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('Data channel opened - connection ready');
        setIsConnected(true);
        setIsConnecting(false);
        setIsListening(true);
        onConnectionChange?.(true);
        
        // Send initial response.create to trigger greeting from AI
        setTimeout(() => {
          if (dc.readyState === 'open') {
            console.log('Triggering initial AI greeting');
            dc.send(JSON.stringify({ type: 'response.create' }));
          }
        }, 1000);
      };

      dc.onmessage = (event) => {
        try {
          const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
          handleRealtimeEvent(realtimeEvent);
        } catch (e) {
          console.error('Failed to parse realtime event:', e);
        }
      };

      dc.onerror = (event) => {
        console.error('Data channel error:', event);
      };

      dc.onclose = () => {
        console.log('Data channel closed');
        setIsConnected(false);
        setIsListening(false);
        onConnectionChange?.(false);
      };

      // Create and set local offer
      console.log('Creating WebRTC offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI
      console.log('Sending offer to OpenAI...');
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
        const errorText = await sdpResponse.text();
        console.error('OpenAI SDP error:', errorText);
        throw new Error('Failed to connect to OpenAI Realtime');
      }

      // Set remote description
      const answerSdp = await sdpResponse.text();
      console.log('Got SDP answer, setting remote description...');
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
      
      console.log('WebRTC connection established!');

    } catch (err) {
      console.error('Connection error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to voice service';
      setError(errorMsg);
      onError?.(errorMsg);
      disconnect();
      setIsConnecting(false);
    }
  }, [isSupported, isConnected, isConnecting, context, userId, onConnectionChange, onError, handleRealtimeEvent, disconnect]);

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
    mediaStream,
    error,
    connect,
    disconnect,
    sendMessage,
    interruptResponse,
  };
}
