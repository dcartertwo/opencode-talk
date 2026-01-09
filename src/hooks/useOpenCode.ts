/**
 * Hook for OpenCode connection and operations
 */

import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settings';
import { useConversationStore } from '../stores/conversation';
import { 
  connect, 
  disconnect, 
  sendMessage, 
  processVoiceInput,
  startNewConversation,
  askForProject,
  stopSpeaking,
} from '../lib/voice-bridge';

// Check if TTS engine is ready
async function checkTtsReadiness(
  engine: string,
  setTtsReady: (ready: boolean, engine?: string | null) => void
): Promise<void> {
  try {
    if (engine === 'kokoro') {
      // Ping Kokoro server health endpoint
      const response = await fetch('http://127.0.0.1:7892/health', {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        setTtsReady(true, 'Kokoro');
        return;
      }
      // Kokoro not ready, will fall back to Piper
      console.log('Kokoro server not ready, will fall back to Piper');
      setTtsReady(true, 'Piper (fallback)');
    } else if (engine === 'piper') {
      setTtsReady(true, 'Piper');
    } else if (engine === 'macos') {
      setTtsReady(true, 'macOS');
    } else if (engine === 'edge') {
      setTtsReady(true, 'Edge');
    } else if (engine === 'openai') {
      setTtsReady(true, 'OpenAI');
    } else {
      // Unknown engine, assume ready
      setTtsReady(true, engine);
    }
  } catch (error) {
    // Kokoro server unavailable, will fall back
    if (engine === 'kokoro') {
      console.log('Kokoro server unavailable, will fall back to Piper');
      setTtsReady(true, 'Piper (fallback)');
    } else {
      setTtsReady(true, engine);
    }
  }
}

export function useOpenCode() {
  const settings = useSettingsStore();
  const conversation = useConversationStore();
  
  // Connect on mount and when server URL changes
  useEffect(() => {
    let mounted = true;
    
    const doConnect = async () => {
      const success = await connect(settings.serverUrl);
      if (mounted && success) {
        // Ask for project if not set
        if (!conversation.projectPath) {
          await askForProject();
        }
        
        // Check TTS readiness
        await checkTtsReadiness(settings.ttsEngine, conversation.setTtsReady);
      }
    };
    
    doConnect();
    
    return () => {
      mounted = false;
      disconnect();
    };
  }, [settings.serverUrl]);
  
  // Re-check TTS readiness when TTS engine changes
  useEffect(() => {
    if (conversation.isConnected) {
      checkTtsReadiness(settings.ttsEngine, conversation.setTtsReady);
    }
  }, [settings.ttsEngine, conversation.isConnected, conversation.setTtsReady]);
  
  // Send a message
  const send = useCallback(async (text: string) => {
    return sendMessage(text);
  }, []);
  
  // Process voice input (handles confirmations, commands, etc.)
  const processInput = useCallback(async (text: string) => {
    return processVoiceInput(text);
  }, []);
  
  // Start a new conversation
  const newConversation = useCallback(async () => {
    return startNewConversation();
  }, []);
  
  // Stop speaking
  const stop = useCallback(async () => {
    return stopSpeaking();
  }, []);
  
  return {
    isConnected: conversation.isConnected,
    connectionError: conversation.connectionError,
    sessionId: conversation.sessionId,
    projectPath: conversation.projectPath,
    voiceState: conversation.voiceState,
    messages: conversation.messages,
    pendingConfirmation: conversation.pendingConfirmation,
    send,
    processInput,
    newConversation,
    stop,
  };
}
