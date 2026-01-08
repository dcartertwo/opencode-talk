/**
 * STT (Speech-to-Text) Layer
 * 
 * Provides a unified interface for voice input from:
 * - SuperWhisper (via Macrowhisper)
 * - macOS Dictation (fallback)
 */

export type STTEngine = 'superwhisper' | 'macos';

export interface STTConfig {
  engine: STTEngine;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  isFinal: boolean;
}

export type TranscriptionCallback = (result: TranscriptionResult) => void;

// Re-export specific implementations
export * from './superwhisper';
export * from './macos';
