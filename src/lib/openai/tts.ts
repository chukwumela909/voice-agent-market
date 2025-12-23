import OpenAI from 'openai';
import { config } from '@/lib/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Convert text to speech using OpenAI TTS
 * Returns audio as a Buffer (for server-side processing)
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  const mp3 = await openai.audio.speech.create({
    model: config.voice.ttsModel,
    voice: config.voice.ttsVoice,
    input: text,
    speed: config.voice.ttsSpeed,
  });

  const arrayBuffer = await mp3.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Convert text to speech and return as base64 string
 * Useful for sending directly to client without storage
 */
export async function textToSpeechBase64(text: string): Promise<string> {
  const buffer = await textToSpeech(text);
  return buffer.toString('base64');
}

/**
 * Convert text to speech and return as a data URL
 * Can be used directly in an Audio element
 */
export async function textToSpeechDataUrl(text: string): Promise<string> {
  const base64 = await textToSpeechBase64(text);
  return `data:audio/mpeg;base64,${base64}`;
}
