import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribe audio to text using OpenAI Whisper
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
  // Create a File object from the buffer using Uint8Array for compatibility
  const uint8Array = new Uint8Array(audioBuffer);
  const file = new File([uint8Array], 'audio.webm', { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    language: 'en',
    response_format: 'json',
  });

  return transcription.text;
}

/**
 * Transcribe audio from a Blob (for client-side usage)
 */
export async function transcribeAudioBlob(audioBlob: Blob): Promise<string> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return transcribeAudio(buffer, audioBlob.type);
}
