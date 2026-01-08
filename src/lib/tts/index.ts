/**
 * TTS (Text-to-Speech) Layer
 * 
 * Provides a unified interface for voice output from:
 * - Edge TTS (Microsoft neural voices, very natural)
 * - Kokoro (highest quality, local)
 * - Piper (fast, local)
 * - macOS say (instant, basic)
 * - OpenAI TTS (cloud, high quality)
 */

import { invoke } from '@tauri-apps/api/core';

export type TTSEngine = 'edge' | 'kokoro' | 'piper' | 'macos' | 'openai';

export interface TTSConfig {
  engine: TTSEngine;
  voice: string;
  speed: number;
  apiKey?: string; // For OpenAI
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * Speak text using the configured TTS engine
 */
export async function speak(
  text: string,
  config: TTSConfig
): Promise<void> {
  await invoke('speak', {
    text,
    engine: config.engine,
    voice: config.voice,
    speed: config.speed,
  });
}

/**
 * Stop any currently playing speech
 */
export async function stopSpeaking(): Promise<void> {
  await invoke('stop_speaking');
}

/**
 * Get available voices for an engine
 */
export function getVoicesForEngine(engine: TTSEngine): TTSVoice[] {
  switch (engine) {
    case 'edge':
      return getEdgeVoices();
    case 'macos':
      return getMacOSVoices();
    case 'kokoro':
      return getKokoroVoices();
    case 'piper':
      return getPiperVoices();
    case 'openai':
      return getOpenAIVoices();
    default:
      return [];
  }
}

// Voice definitions for each engine
function getEdgeVoices(): TTSVoice[] {
  return [
    // US English - Female
    { id: 'en-US-AriaNeural', name: 'Aria (US)', language: 'en-US', gender: 'female' },
    { id: 'en-US-JennyNeural', name: 'Jenny (US)', language: 'en-US', gender: 'female' },
    { id: 'en-US-MichelleNeural', name: 'Michelle (US)', language: 'en-US', gender: 'female' },
    { id: 'en-US-SaraNeural', name: 'Sara (US)', language: 'en-US', gender: 'female' },
    // US English - Male
    { id: 'en-US-GuyNeural', name: 'Guy (US)', language: 'en-US', gender: 'male' },
    { id: 'en-US-DavisNeural', name: 'Davis (US)', language: 'en-US', gender: 'male' },
    { id: 'en-US-TonyNeural', name: 'Tony (US)', language: 'en-US', gender: 'male' },
    { id: 'en-US-JasonNeural', name: 'Jason (US)', language: 'en-US', gender: 'male' },
    // UK English
    { id: 'en-GB-SoniaNeural', name: 'Sonia (UK)', language: 'en-GB', gender: 'female' },
    { id: 'en-GB-RyanNeural', name: 'Ryan (UK)', language: 'en-GB', gender: 'male' },
    { id: 'en-GB-LibbyNeural', name: 'Libby (UK)', language: 'en-GB', gender: 'female' },
    // Australian English
    { id: 'en-AU-NatashaNeural', name: 'Natasha (AU)', language: 'en-AU', gender: 'female' },
    { id: 'en-AU-WilliamNeural', name: 'William (AU)', language: 'en-AU', gender: 'male' },
  ];
}

function getMacOSVoices(): TTSVoice[] {
  return [
    { id: 'Samantha', name: 'Samantha', language: 'en-US', gender: 'female' },
    { id: 'Alex', name: 'Alex', language: 'en-US', gender: 'male' },
    { id: 'Victoria', name: 'Victoria', language: 'en-US', gender: 'female' },
    { id: 'Tom', name: 'Tom', language: 'en-US', gender: 'male' },
    { id: 'Karen', name: 'Karen', language: 'en-AU', gender: 'female' },
    { id: 'Daniel', name: 'Daniel', language: 'en-GB', gender: 'male' },
    { id: 'Moira', name: 'Moira', language: 'en-IE', gender: 'female' },
    { id: 'Tessa', name: 'Tessa', language: 'en-ZA', gender: 'female' },
    { id: 'Veena', name: 'Veena', language: 'en-IN', gender: 'female' },
    { id: 'Fiona', name: 'Fiona', language: 'en-GB', gender: 'female' },
    { id: 'Allison', name: 'Allison', language: 'en-US', gender: 'female' },
    { id: 'Ava', name: 'Ava', language: 'en-US', gender: 'female' },
  ];
}

function getKokoroVoices(): TTSVoice[] {
  return [
    // American Female
    { id: 'af_heart', name: 'Heart (American Female)', language: 'en-US', gender: 'female' },
    { id: 'af_bella', name: 'Bella (American Female)', language: 'en-US', gender: 'female' },
    { id: 'af_nicole', name: 'Nicole (American Female)', language: 'en-US', gender: 'female' },
    { id: 'af_sarah', name: 'Sarah (American Female)', language: 'en-US', gender: 'female' },
    { id: 'af_sky', name: 'Sky (American Female)', language: 'en-US', gender: 'female' },
    // American Male
    { id: 'am_adam', name: 'Adam (American Male)', language: 'en-US', gender: 'male' },
    { id: 'am_michael', name: 'Michael (American Male)', language: 'en-US', gender: 'male' },
    // British Female
    { id: 'bf_emma', name: 'Emma (British Female)', language: 'en-GB', gender: 'female' },
    { id: 'bf_isabella', name: 'Isabella (British Female)', language: 'en-GB', gender: 'female' },
    // British Male
    { id: 'bm_george', name: 'George (British Male)', language: 'en-GB', gender: 'male' },
    { id: 'bm_lewis', name: 'Lewis (British Male)', language: 'en-GB', gender: 'male' },
  ];
}

function getPiperVoices(): TTSVoice[] {
  return [
    { id: 'en_US-amy-medium', name: 'Amy (Medium)', language: 'en-US', gender: 'female' },
    { id: 'en_US-arctic-medium', name: 'Arctic (Medium)', language: 'en-US', gender: 'male' },
    { id: 'en_US-danny-low', name: 'Danny (Low)', language: 'en-US', gender: 'male' },
    { id: 'en_US-kathleen-low', name: 'Kathleen (Low)', language: 'en-US', gender: 'female' },
    { id: 'en_US-lessac-medium', name: 'Lessac (Medium)', language: 'en-US', gender: 'female' },
    { id: 'en_US-libritts-high', name: 'LibriTTS (High)', language: 'en-US', gender: 'neutral' },
    { id: 'en_US-ryan-medium', name: 'Ryan (Medium)', language: 'en-US', gender: 'male' },
    { id: 'en_GB-alan-medium', name: 'Alan (British)', language: 'en-GB', gender: 'male' },
    { id: 'en_GB-jenny_dioco-medium', name: 'Jenny (British)', language: 'en-GB', gender: 'female' },
  ];
}

function getOpenAIVoices(): TTSVoice[] {
  return [
    { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral' },
    { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
    { id: 'fable', name: 'Fable', language: 'en', gender: 'neutral' },
    { id: 'onyx', name: 'Onyx', language: 'en', gender: 'male' },
    { id: 'nova', name: 'Nova', language: 'en', gender: 'female' },
    { id: 'shimmer', name: 'Shimmer', language: 'en', gender: 'female' },
  ];
}

/**
 * Get the default voice for an engine
 */
export function getDefaultVoice(engine: TTSEngine): string {
  switch (engine) {
    case 'edge':
      return 'en-US-AriaNeural';
    case 'macos':
      return 'Samantha';
    case 'kokoro':
      return 'af_heart';
    case 'piper':
      return 'en_US-amy-medium';
    case 'openai':
      return 'nova';
    default:
      return '';
  }
}

/**
 * Check if an engine is available
 */
export async function isEngineAvailable(engine: TTSEngine): Promise<boolean> {
  switch (engine) {
    case 'edge':
      // edge-tts should be installed via pip
      return true; // We installed it
    case 'macos':
      // Always available on macOS
      return true;
    case 'kokoro':
      // Check if kokoro Python package is installed
      try {
        await invoke('is_command_available', { command: 'python3' });
        // Could also check if kokoro package is installed
        return true;
      } catch {
        return false;
      }
    case 'piper':
      return await invoke('is_command_available', { command: 'piper' });
    case 'openai':
      // OpenAI is always "available" but requires API key
      return true;
    default:
      return false;
  }
}
