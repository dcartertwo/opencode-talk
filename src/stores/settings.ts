import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Settings {
  // Voice Input
  sttEngine: 'superwhisper' | 'macos';
  pushToTalkHotkey: string;
  continuousModeHotkey: string;
  interruptHotkey: string;
  
  // Voice Output
  ttsEngine: 'edge' | 'kokoro' | 'piper' | 'macos' | 'openai';
  ttsVoice: string;
  ttsSpeed: number;
  openaiApiKey?: string;
  
  // OpenCode
  serverUrl: string;
  model: string;
  agent: string;
  
  // Behavior
  confirmFileWrites: boolean;
  confirmShellCommands: boolean;
  confirmGitOperations: boolean;
  showFloatingPanel: boolean;
  playSoundOnResponse: boolean;
  autoStartOnLogin: boolean;
  
  // UI
  panelPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  panelOpacity: number;
}

export interface SettingsStore extends Settings {
  setSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  // Voice Input
  sttEngine: 'superwhisper',
  pushToTalkHotkey: 'Alt+Space',  // Option+Space on Mac
  continuousModeHotkey: 'Alt+Shift+Space',
  interruptHotkey: 'Escape',
  
  // Voice Output - Kokoro with warm server for fast, high-quality streaming
  ttsEngine: 'kokoro',
  ttsVoice: 'af_heart',  // Natural female voice
  ttsSpeed: 1.2,
  
  // OpenCode
  serverUrl: 'http://localhost:4096',
  model: 'anthropic/claude-sonnet-4-20250514',
  agent: 'default',
  
  // Behavior
  confirmFileWrites: true,
  confirmShellCommands: true,
  confirmGitOperations: true,
  showFloatingPanel: true,
  playSoundOnResponse: true,
  autoStartOnLogin: false,
  
  // UI
  panelPosition: 'top-right',
  panelOpacity: 0.95,
};

// Custom storage using Tauri's store plugin
const tauriStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('settings.json');
      const value = await store.get<string>(name);
      return value ?? null;
    } catch (e) {
      // Fallback to localStorage during development
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('settings.json');
      await store.set(name, value);
      await store.save();
    } catch (e) {
      // Fallback to localStorage during development
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('settings.json');
      await store.delete(name);
      await store.save();
    } catch (e) {
      // Fallback to localStorage during development
      localStorage.removeItem(name);
    }
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      
      setSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
      
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'opencode-talk-settings',
      storage: createJSONStorage(() => tauriStorage),
    }
  )
);

export { defaultSettings };
