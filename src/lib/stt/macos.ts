/**
 * macOS Dictation Fallback
 * 
 * Uses macOS built-in speech recognition as a fallback when SuperWhisper
 * is not available. This uses the Accessibility API via AppleScript.
 * 
 * Note: This is less accurate than SuperWhisper but works out of the box.
 */

import { Command } from '@tauri-apps/plugin-shell';

/**
 * Check if macOS dictation is available
 */
export async function isMacOSDictationAvailable(): Promise<boolean> {
  // macOS dictation is always available on macOS 10.8+
  // We just need to check if the user has enabled it
  try {
    const result = await Command.create('defaults', [
      'read',
      'com.apple.speech.recognition.AppleSpeechRecognition.prefs',
      'DictationIMEnabled',
    ]).execute();
    
    return result.stdout.trim() === '1';
  } catch {
    // If we can't read the pref, assume it's not enabled
    return false;
  }
}

/**
 * Show instructions for enabling macOS dictation
 */
export function getMacOSDictationInstructions(): string {
  return `
# Enable macOS Dictation

1. Open System Settings
2. Go to Keyboard
3. Click on "Dictation"
4. Turn on Dictation
5. Choose your language
6. Optionally enable "Enhanced Dictation" for offline use

Once enabled, you can use the dictation hotkey (default: press Fn twice)
to start dictating.

Note: For best results, we recommend using SuperWhisper instead,
which provides better accuracy and runs fully locally.
  `.trim();
}

/**
 * Start macOS dictation programmatically
 * 
 * This simulates pressing the dictation hotkey.
 * Note: This requires Accessibility permissions.
 */
export async function startMacOSDictation(): Promise<boolean> {
  try {
    // Simulate pressing Fn twice (default dictation hotkey)
    const script = `
      tell application "System Events"
        key code 63
        delay 0.1
        key code 63
      end tell
    `;
    
    await Command.create('osascript', ['-e', script]).execute();
    return true;
  } catch (error) {
    console.error('Failed to start macOS dictation:', error);
    return false;
  }
}

/**
 * Stop macOS dictation
 */
export async function stopMacOSDictation(): Promise<boolean> {
  try {
    // Press Escape or Fn again to stop
    const script = `
      tell application "System Events"
        key code 53
      end tell
    `;
    
    await Command.create('osascript', ['-e', script]).execute();
    return true;
  } catch (error) {
    console.error('Failed to stop macOS dictation:', error);
    return false;
  }
}

/**
 * Get the current text from the clipboard
 * (Dictation puts text in the active field, but we might grab it from clipboard)
 */
export async function getClipboardText(): Promise<string> {
  try {
    const script = `
      the clipboard as text
    `;
    
    const result = await Command.create('osascript', ['-e', script]).execute();
    return result.stdout.trim();
  } catch {
    return '';
  }
}
