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
  // Mark if response may be incomplete due to error
  isIncomplete?: boolean;
}

export interface PendingConfirmation {
  id: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  description: string;
  timestamp: number;
}

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  timestamp: number;
  duration?: number; // ms, default 5000
}

interface ConversationStore {
  // Session
  sessionId: string | null;
  projectPath: string | null;
  
  // Voice state
  voiceState: VoiceState;
  
  // Messages
  messages: Message[];
  messageHistoryLimit: number;
  
  // Streaming state - for live text updates during response
  streamingText: string;
  isStreaming: boolean;
  streamingError: string | null;
  
  // Pending confirmation for dangerous actions
  pendingConfirmation: PendingConfirmation | null;
  confirmationTimeoutId: ReturnType<typeof setTimeout> | null;
  
  // Connection status
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Toast notifications
  toasts: Toast[];
  
  // TTS status
  activeTtsEngine: string | null;
  ttsError: string | null;
  
  // Hotkey status
  hotkeyError: string | null;
  
  // Actions
  setSessionId: (id: string | null) => void;
  setProjectPath: (path: string | null) => void;
  setVoiceState: (state: VoiceState) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  setMessageHistoryLimit: (limit: number) => void;
  setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
  setConnectionStatus: (connected: boolean, error?: string | null) => void;
  setConnecting: (connecting: boolean) => void;
  // Streaming actions
  setStreamingText: (text: string) => void;
  appendStreamingText: (delta: string) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  setStreamingError: (error: string | null) => void;
  // Toast actions
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  // TTS status
  setActiveTtsEngine: (engine: string | null) => void;
  setTtsError: (error: string | null) => void;
  // Hotkey status
  setHotkeyError: (error: string | null) => void;
  reset: () => void;
}

// Confirmation timeout duration (30 seconds)
const CONFIRMATION_TIMEOUT_MS = 30000;

export const useConversationStore = create<ConversationStore>((set, get) => ({
  // Initial state
  sessionId: null,
  projectPath: null,
  voiceState: 'idle',
  messages: [],
  messageHistoryLimit: 50,
  streamingText: '',
  isStreaming: false,
  streamingError: null,
  pendingConfirmation: null,
  confirmationTimeoutId: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  toasts: [],
  activeTtsEngine: null,
  ttsError: null,
  hotkeyError: null,
  
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
    ].slice(-state.messageHistoryLimit),
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    ),
  })),
  
  clearMessages: () => set({ messages: [], sessionId: null }),
  
  setMessageHistoryLimit: (limit) => set((state) => ({
    messageHistoryLimit: limit,
    // Trim existing messages if new limit is smaller
    messages: state.messages.slice(-limit),
  })),
  
  setPendingConfirmation: (confirmation) => {
    const state = get();
    
    // Clear any existing timeout
    if (state.confirmationTimeoutId) {
      clearTimeout(state.confirmationTimeoutId);
    }
    
    if (confirmation) {
      // Set up auto-cancel timeout (30 seconds)
      const timeoutId = setTimeout(() => {
        const currentState = get();
        if (currentState.pendingConfirmation?.id === confirmation.id) {
          set({ 
            pendingConfirmation: null, 
            confirmationTimeoutId: null 
          });
          // Add toast notification
          currentState.addToast({
            type: 'warning',
            message: 'Confirmation timed out after 30 seconds',
          });
        }
      }, CONFIRMATION_TIMEOUT_MS);
      
      set({ 
        pendingConfirmation: confirmation,
        confirmationTimeoutId: timeoutId,
      });
    } else {
      set({ 
        pendingConfirmation: null,
        confirmationTimeoutId: null,
      });
    }
  },
  
  setConnectionStatus: (connected, error = null) => set({
    isConnected: connected,
    isConnecting: false,
    connectionError: error,
  }),
  
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  
  // Streaming actions
  setStreamingText: (text) => set({ streamingText: text }),
  
  appendStreamingText: (delta) => set((state) => ({
    streamingText: state.streamingText + delta,
  })),
  
  startStreaming: () => set({ 
    isStreaming: true, 
    streamingText: '',
    streamingError: null,
  }),
  
  stopStreaming: () => set({ 
    isStreaming: false,
    streamingText: '',
  }),
  
  setStreamingError: (error) => set({ streamingError: error }),
  
  // Toast actions
  addToast: (toast) => set((state) => {
    const newToast: Toast = {
      ...toast,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      duration: toast.duration ?? 5000,
    };
    
    // Auto-remove toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(newToast.id);
      }, newToast.duration);
    }
    
    return {
      toasts: [...state.toasts, newToast].slice(-5), // Keep max 5 toasts
    };
  }),
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
  
  clearToasts: () => set({ toasts: [] }),
  
  // TTS status
  setActiveTtsEngine: (engine) => set({ activeTtsEngine: engine }),
  
  setTtsError: (error) => {
    set({ ttsError: error });
    if (error) {
      get().addToast({ type: 'error', message: error });
    }
  },
  
  // Hotkey status
  setHotkeyError: (error) => {
    set({ hotkeyError: error });
    if (error) {
      get().addToast({ type: 'error', message: error, duration: 10000 });
    }
  },
  
  reset: () => {
    const state = get();
    if (state.confirmationTimeoutId) {
      clearTimeout(state.confirmationTimeoutId);
    }
    set({
      sessionId: null,
      projectPath: null,
      voiceState: 'idle',
      messages: [],
      streamingText: '',
      isStreaming: false,
      streamingError: null,
      pendingConfirmation: null,
      confirmationTimeoutId: null,
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      toasts: [],
      activeTtsEngine: null,
      ttsError: null,
      hotkeyError: null,
    });
  },
}));
