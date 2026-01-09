import { invoke } from '@tauri-apps/api/core';
import { useSetupStore } from '../../../stores/setup';
import { useConversationStore } from '../../../stores/conversation';
import { StepContainer } from '../StepContainer';
import { ActionButton } from '../ui';

const SETTINGS_TO_DISABLE = [
  'Paste Result Text',
  'Restore Clipboard',
  'Simulate Key Presses',
];

export function SuperWhisperConfigure() {
  const { goToStep, goBack, skipToStep } = useSetupStore();
  const { addToast } = useConversationStore();

  const handleOpenSuperWhisper = async () => {
    try {
      await invoke('open_superwhisper');
      addToast({
        type: 'info',
        message: 'Opening SuperWhisper...',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to open SuperWhisper:', error);
      addToast({
        type: 'error',
        message: 'Failed to open SuperWhisper',
      });
    }
  };

  return (
    <StepContainer
      title="Configure SuperWhisper"
      description="Open SuperWhisper and disable these options so we can handle transcription directly."
      showBack
      onBack={goBack}
      showSkip
      onSkip={() => skipToStep('voice-output')}
      primaryAction={{
        label: "I've done this",
        onClick: () => goToStep('macrowhisper-install'),
      }}
    >
      <div className="flex flex-col items-center">
        {/* Settings checklist */}
        <div className="w-full max-w-sm bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <div className="space-y-3">
            {SETTINGS_TO_DISABLE.map((setting) => (
              <div
                key={setting}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {setting}
                  </span>
                </div>
                <span className="text-sm text-[#F6821F] font-medium">
                  ← Turn OFF
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Open SuperWhisper button */}
        <ActionButton
          variant="secondary"
          onClick={handleOpenSuperWhisper}
        >
          Open SuperWhisper Settings
        </ActionButton>
      </div>
    </StepContainer>
  );
}
