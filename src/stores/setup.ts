import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type SetupStep =
  | 'welcome'
  | 'voice-input-choice'
  | 'superwhisper-install'
  | 'superwhisper-configure'
  | 'macrowhisper-install'
  | 'macrowhisper-configure'
  | 'voice-input-test'
  | 'macos-dictation'
  | 'voice-output'
  | 'opencode-connection'
  | 'ready';

export type VoiceInputChoice = 'superwhisper' | 'macos';

interface Detection {
  superwhisperInstalled: boolean;
  superwhisperHotkey: string | null;
  macrowhisperInstalled: boolean;
  macrowhisperRunning: boolean;
  macrowhisperConfigured: boolean;
  homebrewInstalled: boolean;
  openCodeConnected: boolean;
  openCodeVersion: string | null;
}

interface StepsCompleted {
  voiceInput: boolean;
  voiceOutput: boolean;
  openCodeConnection: boolean;
}

interface SetupStore {
  // Current step
  currentStep: SetupStep;
  stepHistory: SetupStep[];
  
  // User choices
  voiceInputChoice: VoiceInputChoice | null;
  
  // Detection cache
  detection: Detection;
  isDetecting: boolean;
  
  // Completion tracking
  stepsCompleted: StepsCompleted;
  
  // Error state
  error: string | null;
  
  // Actions
  goToStep: (step: SetupStep) => void;
  goBack: () => void;
  setVoiceInputChoice: (choice: VoiceInputChoice) => void;
  updateDetection: (partial: Partial<Detection>) => void;
  refreshDetection: () => Promise<void>;
  markStepComplete: (step: keyof StepsCompleted) => void;
  skipToStep: (step: SetupStep) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialDetection: Detection = {
  superwhisperInstalled: false,
  superwhisperHotkey: null,
  macrowhisperInstalled: false,
  macrowhisperRunning: false,
  macrowhisperConfigured: false,
  homebrewInstalled: false,
  openCodeConnected: false,
  openCodeVersion: null,
};

const initialStepsCompleted: StepsCompleted = {
  voiceInput: false,
  voiceOutput: false,
  openCodeConnection: false,
};

export const useSetupStore = create<SetupStore>((set) => ({
  currentStep: 'welcome',
  stepHistory: [],
  voiceInputChoice: null,
  detection: initialDetection,
  isDetecting: false,
  stepsCompleted: initialStepsCompleted,
  error: null,
  
  goToStep: (step) => set((state) => ({
    currentStep: step,
    stepHistory: [...state.stepHistory, state.currentStep],
    error: null,
  })),
  
  goBack: () => set((state) => {
    const history = [...state.stepHistory];
    const previousStep = history.pop();
    return {
      currentStep: previousStep || 'welcome',
      stepHistory: history,
      error: null,
    };
  }),
  
  setVoiceInputChoice: (choice) => set({ voiceInputChoice: choice }),
  
  updateDetection: (partial) => set((state) => ({
    detection: { ...state.detection, ...partial },
  })),
  
  refreshDetection: async () => {
    set({ isDetecting: true });
    
    try {
      const [
        superwhisperInstalled,
        superwhisperHotkey,
        macrowhisperInstalled,
        macrowhisperRunning,
        macrowhisperConfigured,
        homebrewInstalled,
      ] = await Promise.all([
        invoke<boolean>('is_superwhisper_installed'),
        invoke<string | null>('get_superwhisper_hotkey'),
        invoke<boolean>('is_macrowhisper_installed'),
        invoke<boolean>('is_macrowhisper_running'),
        invoke<boolean>('is_macrowhisper_configured'),
        invoke<boolean>('is_homebrew_installed'),
      ]);
      
      set((state) => ({
        detection: {
          ...state.detection,
          superwhisperInstalled,
          superwhisperHotkey,
          macrowhisperInstalled,
          macrowhisperRunning,
          macrowhisperConfigured,
          homebrewInstalled,
        },
        isDetecting: false,
      }));
    } catch (error) {
      console.error('Failed to refresh detection:', error);
      set({ isDetecting: false });
    }
  },
  
  markStepComplete: (step) => set((state) => ({
    stepsCompleted: { ...state.stepsCompleted, [step]: true },
  })),
  
  skipToStep: (step) => set((state) => ({
    currentStep: step,
    stepHistory: [...state.stepHistory, state.currentStep],
    error: null,
  })),
  
  setError: (error) => set({ error }),
  
  reset: () => set({
    currentStep: 'welcome',
    stepHistory: [],
    voiceInputChoice: null,
    detection: initialDetection,
    stepsCompleted: initialStepsCompleted,
    error: null,
  }),
}));

// Helper to get the step number for progress indicator
export function getStepNumber(step: SetupStep, voiceInputChoice: VoiceInputChoice | null): number {
  const commonSteps: SetupStep[] = ['welcome', 'voice-input-choice'];
  const superwhisperSteps: SetupStep[] = [
    'superwhisper-install',
    'superwhisper-configure',
    'macrowhisper-install',
    'macrowhisper-configure',
    'voice-input-test',
  ];
  const macosSteps: SetupStep[] = ['macos-dictation'];
  const finalSteps: SetupStep[] = ['voice-output', 'opencode-connection', 'ready'];
  
  const commonIndex = commonSteps.indexOf(step);
  if (commonIndex !== -1) return commonIndex;
  
  if (voiceInputChoice === 'superwhisper') {
    const swIndex = superwhisperSteps.indexOf(step);
    if (swIndex !== -1) return commonSteps.length + swIndex;
    
    const finalIndex = finalSteps.indexOf(step);
    if (finalIndex !== -1) return commonSteps.length + superwhisperSteps.length + finalIndex;
  } else {
    const macosIndex = macosSteps.indexOf(step);
    if (macosIndex !== -1) return commonSteps.length + macosIndex;
    
    const finalIndex = finalSteps.indexOf(step);
    if (finalIndex !== -1) return commonSteps.length + macosSteps.length + finalIndex;
  }
  
  return 0;
}

// Helper to get total steps for progress indicator
export function getTotalSteps(voiceInputChoice: VoiceInputChoice | null): number {
  const commonSteps = 2; // welcome, voice-input-choice
  const finalSteps = 3;  // voice-output, opencode-connection, ready
  
  if (voiceInputChoice === 'superwhisper') {
    return commonSteps + 5 + finalSteps; // 5 superwhisper steps
  } else if (voiceInputChoice === 'macos') {
    return commonSteps + 1 + finalSteps; // 1 macos step
  }
  
  // Before choice is made, assume superwhisper path (longer)
  return commonSteps + 5 + finalSteps;
}
