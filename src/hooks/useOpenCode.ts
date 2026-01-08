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
      }
    };
    
    doConnect();
    
    return () => {
      mounted = false;
      disconnect();
    };
  }, [settings.serverUrl]);
  
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
