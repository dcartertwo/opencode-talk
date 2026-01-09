import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronRight } from 'lucide-react';
import { useSetupStore } from '../../../stores/setup';
import { useDetectionPolling } from '../../../hooks/useDetectionPolling';
import { StepContainer } from '../StepContainer';
import { CodeBlock, DetectionIndicator, type DetectionStatus } from '../ui';

const MACROWHISPER_INSTALL_CMD = 'brew install ognistik/formulae/macrowhisper';
const HOMEBREW_INSTALL_CMD = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

export function MacrowhisperInstall() {
  const { goToStep, goBack, skipToStep, updateDetection } = useSetupStore();
  const [showHomebrew, setShowHomebrew] = useState(false);

  // Poll for Macrowhisper installation
  const { isChecking, isDetected } = useDetectionPolling(
    () => invoke<boolean>('is_macrowhisper_installed'),
    {
      interval: 2000,
      onDetected: () => {
        updateDetection({ macrowhisperInstalled: true });
      },
    }
  );

  // Open brew.sh in browser
  const handleOpenBrewSite = async () => {
    try {
      await invoke('open_external_url', { url: 'https://brew.sh' });
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  // Derive detection status for indicator
  const status: DetectionStatus = isChecking
    ? 'checking'
    : isDetected
      ? 'success'
      : 'missing';

  return (
    <StepContainer
      title="Install Macrowhisper"
      description="Macrowhisper connects SuperWhisper to OpenCode Talk."
      showBack
      onBack={goBack}
      showSkip
      onSkip={() => skipToStep('voice-output')}
      primaryAction={{
        label: 'Continue',
        onClick: () => goToStep('macrowhisper-configure'),
        disabled: !isDetected,
      }}
    >
      <div className="space-y-3">
        {/* Macrowhisper install command */}
        <CodeBlock code={MACROWHISPER_INSTALL_CMD} />

        {/* Detection status */}
        <div className="flex justify-center">
          <DetectionIndicator
            status={status}
            labels={{
              checking: 'Checking...',
              success: 'Macrowhisper is installed',
              missing: 'Waiting for installation...',
            }}
          />
        </div>

        {/* Homebrew help section - collapsible */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowHomebrew(!showHomebrew)}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <ChevronRight 
              className={`w-4 h-4 transition-transform ${showHomebrew ? 'rotate-90' : ''}`} 
            />
            Don't have Homebrew?
          </button>
          
          {showHomebrew && (
            <div className="mt-3 space-y-2">
              <CodeBlock code={HOMEBREW_INSTALL_CMD} />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Or visit{' '}
                <button
                  onClick={handleOpenBrewSite}
                  className="text-[#F6821F] hover:underline"
                >
                  brew.sh
                </button>
                {' '}for more info.
              </p>
            </div>
          )}
        </div>
      </div>
    </StepContainer>
  );
}
