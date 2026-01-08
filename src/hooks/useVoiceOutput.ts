/**
 * Hook for voice output (TTS) management
 */

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settings';
import { useConversationStore } from '../stores/conversation';

export function useVoiceOutput() {
  const settings = useSettingsStore();
  const conversation = useConversationStore();
  
  // Speak text
  const speak = useCallback(async (text: string) => {
    conversation.setVoiceState('speaking');
    
    try {
      await invoke('speak', {
        text,
        engine: settings.ttsEngine,
        voice: settings.ttsVoice,
        speed: settings.ttsSpeed,
      });
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      conversation.setVoiceState('idle');
    }
  }, [settings.ttsEngine, settings.ttsVoice, settings.ttsSpeed, conversation]);
  
  // Stop speaking
  const stop = useCallback(async () => {
    try {
      await invoke('stop_speaking');
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
    
    conversation.setVoiceState('idle');
  }, [conversation]);
  
  // Test voice
  const testVoice = useCallback(async () => {
    await speak("Hello! This is how I'll sound when speaking to you.");
  }, [speak]);
  
  // Get available voices for the current engine
  const getVoices = useCallback(async (): Promise<string[]> => {
    switch (settings.ttsEngine) {
      case 'macos': {
        // macOS has built-in voices
        return [
          'Samantha', 'Alex', 'Victoria', 'Tom', 'Karen', 'Daniel',
          'Moira', 'Tessa', 'Veena', 'Fiona', 'Allison', 'Ava',
        ];
      }
      case 'kokoro': {
        // Kokoro voices
        return [
          'af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_sky',
          'am_adam', 'am_michael',
          'bf_emma', 'bf_isabella',
          'bm_george', 'bm_lewis',
        ];
      }
      case 'piper': {
        // Piper voices (common ones)
        return [
          'en_US-amy-medium',
          'en_US-arctic-medium',
          'en_US-danny-low',
          'en_US-kathleen-low',
          'en_US-lessac-medium',
          'en_US-libritts-high',
          'en_US-ryan-medium',
        ];
      }
      case 'openai': {
        return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      }
      default:
        return [];
    }
  }, [settings.ttsEngine]);
  
  return {
    voiceState: conversation.voiceState,
    speak,
    stop,
    testVoice,
    getVoices,
    currentEngine: settings.ttsEngine,
    currentVoice: settings.ttsVoice,
    currentSpeed: settings.ttsSpeed,
  };
}
