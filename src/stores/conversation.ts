import { create } from 'zustand';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // For assistant messages, we may have both full content and spoken summary
  spokenContent?: string;
  // Track if this message triggered file changes
  filesChanged?: string[];
}

export interface PendingConfirmation {
  id: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  description: string;
  timestamp: number;
}

interface ConversationStore {
  // Session
  sessionId: string | null;
  projectPath: string | null;
  
  // Voice state
  voiceState: VoiceState;
  
  // Messages
  messages: Message[];
  
  // Streaming state - for live text updates during response
  streamingText: string;
  isStreaming: boolean;
  
  // Pending confirmation for dangerous actions
  pendingConfirmation: PendingConfirmation | null;
  
  // Connection status
  isConnected: boolean;
  connectionError: string | null;
  
  // Actions
  setSessionId: (id: string | null) => void;
  setProjectPath: (path: string | null) => void;
  setVoiceState: (state: VoiceState) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
  setConnectionStatus: (connected: boolean, error?: string | null) => void;
  // Streaming actions
  setStreamingText: (text: string) => void;
  appendStreamingText: (delta: string) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  // Initial state
  sessionId: null,
  projectPath: null,
  voiceState: 'idle',
  messages: [],
  streamingText: '',
  isStreaming: false,
  pendingConfirmation: null,
  isConnected: false,
  connectionError: null,
  
  // Actions
  setSessionId: (id) => set({ sessionId: id }),
  
  setProjectPath: (path) => set({ projectPath: path }),
  
  setVoiceState: (state) => set({ voiceState: state }),
  
  addMessage: (message) => set((state) => ({
    messages: [
      ...state.messages,
      {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    ].slice(-10), // Keep only last 10 messages for memory efficiency
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    ),
  })),
  
  clearMessages: () => set({ messages: [], sessionId: null }),
  
  setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),
  
  setConnectionStatus: (connected, error = null) => set({
    isConnected: connected,
    connectionError: error,
  }),
  
  // Streaming actions
  setStreamingText: (text) => set({ streamingText: text }),
  
  appendStreamingText: (delta) => set((state) => ({
    streamingText: state.streamingText + delta,
  })),
  
  startStreaming: () => set({ 
    isStreaming: true, 
    streamingText: '',
  }),
  
  stopStreaming: () => set({ 
    isStreaming: false,
    streamingText: '',
  }),
  
  reset: () => set({
    sessionId: null,
    projectPath: null,
    voiceState: 'idle',
    messages: [],
    streamingText: '',
    isStreaming: false,
    pendingConfirmation: null,
    isConnected: false,
    connectionError: null,
  }),
}));
