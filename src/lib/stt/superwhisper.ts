/**
 * SuperWhisper Integration via Macrowhisper
 * 
 * SuperWhisper is a macOS app that provides local Whisper-based transcription.
 * Macrowhisper is a helper that monitors SuperWhisper's output and triggers actions.
 * 
 * Integration flow:
 * 1. User triggers SuperWhisper with global hotkey
 * 2. SuperWhisper transcribes and saves to recordings folder
 * 3. Macrowhisper detects the new transcription
 * 4. Macrowhisper calls our shell action with the transcription
 * 5. We receive it via Tauri event
 */

import { invoke } from '@tauri-apps/api/core';
import { writeTextFile, readTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export interface MacrowhisperConfig {
  defaults: {
    activeAction: string;
    pressReturn: boolean;
    actionDelay: number;
  };
  shells?: Record<string, {
    action: string;
    triggerVoice?: string;
    triggerApp?: string;
    triggerMode?: string;
  }>;
}

// Port for the local transcription server
export const TRANSCRIPTION_SERVER_PORT = 7891;

/**
 * Check if SuperWhisper is installed
 */
export async function isSuperWhisperInstalled(): Promise<boolean> {
  try {
    return await invoke<boolean>('is_app_installed', { appName: 'superwhisper' });
  } catch {
    return false;
  }
}

/**
 * Check if Macrowhisper is installed
 */
export async function isMacrowhisperInstalled(): Promise<boolean> {
  try {
    return await invoke<boolean>('is_command_available', { command: 'macrowhisper' });
  } catch {
    return false;
  }
}

/**
 * Get the Macrowhisper config path
 */
export async function getMacrowhisperConfigPath(): Promise<string> {
  const home = await homeDir();
  return await join(home, '.config', 'macrowhisper', 'macrowhisper.json');
}

/**
 * Read the current Macrowhisper configuration
 */
export async function readMacrowhisperConfig(): Promise<MacrowhisperConfig | null> {
  try {
    const configPath = await getMacrowhisperConfigPath();
    const configExists = await exists(configPath);
    
    if (!configExists) {
      return null;
    }
    
    const content = await readTextFile(configPath);
    return JSON.parse(content) as MacrowhisperConfig;
  } catch (error) {
    console.error('Failed to read Macrowhisper config:', error);
    return null;
  }
}

/**
 * Write Macrowhisper configuration
 */
export async function writeMacrowhisperConfig(config: MacrowhisperConfig): Promise<boolean> {
  try {
    const configPath = await getMacrowhisperConfigPath();
    const configDir = configPath.replace('/macrowhisper.json', '');
    
    // Ensure directory exists
    const dirExists = await exists(configDir);
    if (!dirExists) {
      await mkdir(configDir, { recursive: true });
    }
    
    await writeTextFile(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to write Macrowhisper config:', error);
    return false;
  }
}

/**
 * Generate the OpenCode Talk action configuration for Macrowhisper
 * 
 * This creates a shell action that:
 * 1. Sends the transcription to our local HTTP server
 * 2. Brings OpenCode Talk to the front
 */
export function generateOpenCodeTalkAction(): MacrowhisperConfig['shells'] {
  return {
    opencodeTalk: {
      // Send transcription to our local server using curl
      // {{swResult}} is replaced by Macrowhisper with the transcription text
      action: `curl -s -X POST http://127.0.0.1:7891/transcription -H "Content-Type: application/json" -d '{"text": "{{swResult}}"}'`,
    },
  };
}

/**
 * Configure Macrowhisper to work with OpenCode Talk
 * 
 * This modifies the Macrowhisper config to:
 * 1. Add our shell action
 * 2. NOT auto-paste (we handle that)
 * 3. Send transcriptions to our app
 */
export async function configureMacrowhisper(merge: boolean = true): Promise<boolean> {
  try {
    let config: MacrowhisperConfig;
    
    if (merge) {
      const existingConfig = await readMacrowhisperConfig();
      config = existingConfig || {
        defaults: {
          activeAction: 'opencodeTalk',
          pressReturn: false,
          actionDelay: 0.3,
        },
      };
    } else {
      config = {
        defaults: {
          activeAction: 'opencodeTalk',
          pressReturn: false,
          actionDelay: 0.3,
        },
      };
    }
    
    // Add/update our action
    config.shells = {
      ...config.shells,
      ...generateOpenCodeTalkAction(),
    };
    
    // Ensure defaults don't auto-paste (we handle that)
    config.defaults.pressReturn = false;
    
    return await writeMacrowhisperConfig(config);
  } catch (error) {
    console.error('Failed to configure Macrowhisper:', error);
    return false;
  }
}

/**
 * Get setup instructions for SuperWhisper + Macrowhisper
 */
export function getSetupInstructions(): string {
  return `
# SuperWhisper + Macrowhisper Setup

## 1. Install SuperWhisper
Download from: https://superwhisper.com
- Purchase or use free tier  
- Configure your preferred hotkey (e.g., Option+Space)
- Choose a local Whisper model for best privacy

## 2. Install Macrowhisper
\`\`\`bash
brew install ognistik/formulae/macrowhisper
\`\`\`

## 3. Configure SuperWhisper
In SuperWhisper settings:
- Turn OFF: "Paste Result Text"
- Turn OFF: "Restore Clipboard After Paste"  
- Turn OFF: "Simulate Key Presses"
- Keep ON: "Recording Window"

## 4. Configure Macrowhisper
Edit ~/.config/macrowhisper/macrowhisper.json:
\`\`\`json
{
  "defaults": {
    "activeAction": "opencodeTalk",
    "pressReturn": false,
    "actionDelay": 0.3
  },
  "shells": {
    "opencodeTalk": {
      "action": "curl -s -X POST http://127.0.0.1:7891/transcription -H \\"Content-Type: application/json\\" -d '{\\"text\\": \\"{{swResult}}\\"}'"
    }
  }
}
\`\`\`

## 5. Start Macrowhisper Service
\`\`\`bash
macrowhisper --start-service
\`\`\`

## 6. Test
1. Make sure OpenCode Talk is running
2. Press your SuperWhisper hotkey and speak
3. The transcription should appear in OpenCode Talk

## Troubleshooting
- Test the server: curl -X POST http://127.0.0.1:7891/transcription -d '{"text": "test"}'
- Check Macrowhisper status: macrowhisper --service-status
- Restart Macrowhisper: macrowhisper --restart-service
  `.trim();
}
