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
  // Get stable function references to avoid infinite loops in useEffect
  const setVoiceState = useConversationStore((state) => state.setVoiceState);
  const setPendingConfirmation = useConversationStore((state) => state.setPendingConfirmation);
  const setHotkeyReady = useConversationStore((state) => state.setHotkeyReady);
  const setHotkeyError = useConversationStore((state) => state.setHotkeyError);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const shortcutUnlistenRef = useRef<(() => Promise<void>) | null>(null);
  const isListeningRef = useRef(false);
  
  // Handle incoming transcription
  const handleTranscription = useCallback(async (text: string) => {
    console.log('Received transcription:', text);
    
    // Set to processing state
    setVoiceState('processing');
    await invoke('set_voice_state', { voiceState: 'processing' });
    
    // Process the voice input
    await processVoiceInput(text);
    
    // Return to idle
    setVoiceState('idle');
    await invoke('set_voice_state', { voiceState: 'idle' });
  }, [setVoiceState]);
  
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
    
    setVoiceState('listening');
    await invoke('set_voice_state', { voiceState: 'listening' });
    console.log('Started listening');
  }, [setVoiceState]);
  
  // Stop listening
  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    
    setVoiceState('idle');
    await invoke('set_voice_state', { voiceState: 'idle' });
    console.log('Stopped listening');
  }, [setVoiceState]);
  
  // Register global shortcuts
  useEffect(() => {
    let mounted = true;
    
    // Reset hotkey ready state when re-registering
    setHotkeyReady(false);
    
    const registerShortcuts = async () => {
      // Convert hotkey format for Tauri
      const pttHotkey = settings.pushToTalkHotkey
        .replace('Option', 'Alt')
        .replace('Command', 'Meta');
      
      const interruptHotkey = settings.interruptHotkey;
      
      try {
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
            setVoiceState('idle');
            setPendingConfirmation(null);
            await invoke('set_voice_state', { voiceState: 'idle' });
            console.log('Interrupted by user');
          });
        }
        
        // Mark hotkey as ready (use display format for UI)
        if (mounted) {
          setHotkeyReady(true, settings.pushToTalkHotkey);
          console.log('Hotkey registered successfully:', settings.pushToTalkHotkey);
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to register shortcuts:', errorMessage);
        
        if (mounted) {
          setHotkeyReady(false);
          setHotkeyError(`Hotkey registration failed: ${errorMessage}`);
        }
      }
    };
    
    registerShortcuts();
    
    return () => {
      mounted = false;
      setHotkeyReady(false);
      shortcutUnlistenRef.current?.();
    };
  }, [settings.pushToTalkHotkey, settings.interruptHotkey, setVoiceState, setPendingConfirmation, setHotkeyReady, setHotkeyError, startListening, stopListening]);
  
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
