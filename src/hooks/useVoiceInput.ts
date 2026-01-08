/**
 * Hook for voice input (STT) management
 * 
 * For now, this uses a simple text input simulation.
 * Voice recording via CapsLock will show the listening state
 * but actual transcription requires SuperWhisper or similar.
 */

import { useEffect, useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useSettingsStore } from '../stores/settings';
import { useConversationStore } from '../stores/conversation';
import { processVoiceInput, stopSpeaking } from '../lib/voice-bridge';

// Event types from Macrowhisper/SuperWhisper
interface TranscriptionEvent {
  text: string;
  confidence?: number;
}

export function useVoiceInput() {
  const settings = useSettingsStore();
  const conversation = useConversationStore();
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const shortcutUnlistenRef = useRef<(() => Promise<void>) | null>(null);
  const isListeningRef = useRef(false);
  
  // Handle incoming transcription
  const handleTranscription = useCallback(async (text: string) => {
    console.log('Received transcription:', text);
    
    // Set to processing state
    conversation.setVoiceState('processing');
    await invoke('set_voice_state', { voiceState: 'processing' });
    
    // Process the voice input
    await processVoiceInput(text);
    
    // Return to idle
    conversation.setVoiceState('idle');
    await invoke('set_voice_state', { voiceState: 'idle' });
  }, [conversation]);
  
  // Listen for transcription events from SuperWhisper/Macrowhisper
  useEffect(() => {
    let mounted = true;
    
    const setupListener = async () => {
      // Listen for transcription events from the Rust backend
      unlistenRef.current = await listen<TranscriptionEvent>('transcription', (event) => {
        if (mounted && event.payload.text) {
          handleTranscription(event.payload.text);
        }
      });
    };
    
    setupListener();
    
    return () => {
      mounted = false;
      unlistenRef.current?.();
    };
  }, [handleTranscription]);
  
  // Start listening
  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;
    isListeningRef.current = true;
    
    conversation.setVoiceState('listening');
    await invoke('set_voice_state', { voiceState: 'listening' });
    console.log('Started listening');
  }, [conversation]);
  
  // Stop listening
  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    
    conversation.setVoiceState('idle');
    await invoke('set_voice_state', { voiceState: 'idle' });
    console.log('Stopped listening');
  }, [conversation]);
  
  // Register global shortcuts
  useEffect(() => {
    let mounted = true;
    
    const registerShortcuts = async () => {
      try {
        // Convert hotkey format for Tauri
        let pttHotkey = settings.pushToTalkHotkey
          .replace('Option', 'Alt')
          .replace('Command', 'Meta');
        
        const interruptHotkey = settings.interruptHotkey;
        
        console.log('Registering push-to-talk hotkey:', pttHotkey);
        
        // Register push-to-talk (press to start, release to stop)
        await register(pttHotkey, async (event) => {
          if (!mounted) return;
          
          console.log('Hotkey event:', event.state);
          
          if (event.state === 'Pressed') {
            await startListening();
          } else if (event.state === 'Released') {
            await stopListening();
          }
        });
        
        // Register interrupt hotkey
        if (interruptHotkey && interruptHotkey !== pttHotkey) {
          console.log('Registering interrupt hotkey:', interruptHotkey);
          
          await register(interruptHotkey, async () => {
            if (!mounted) return;
            
            // Stop any speaking
            await stopSpeaking();
            isListeningRef.current = false;
            conversation.setVoiceState('idle');
            conversation.setPendingConfirmation(null);
            await invoke('set_voice_state', { voiceState: 'idle' });
            console.log('Interrupted by user');
          });
        }
        
        shortcutUnlistenRef.current = async () => {
          try {
            await unregister(pttHotkey);
            if (interruptHotkey && interruptHotkey !== pttHotkey) {
              await unregister(interruptHotkey);
            }
          } catch (e) {
            console.error('Failed to unregister shortcuts:', e);
          }
        };
      } catch (error) {
        console.error('Failed to register shortcuts:', error);
      }
    };
    
    registerShortcuts();
    
    return () => {
      mounted = false;
      shortcutUnlistenRef.current?.();
    };
  }, [settings.pushToTalkHotkey, settings.interruptHotkey, conversation, startListening, stopListening]);
  
  // Simulate text input (for testing without voice)
  const simulateInput = useCallback(async (text: string) => {
    await handleTranscription(text);
  }, [handleTranscription]);
  
  return {
    voiceState: conversation.voiceState,
    startListening,
    stopListening,
    simulateInput,
  };
}
