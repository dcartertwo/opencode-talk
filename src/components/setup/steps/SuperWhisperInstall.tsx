import { invoke } from '@tauri-apps/api/core';
import { useSetupStore } from '../../../stores/setup';
import { useConversationStore } from '../../../stores/conversation';
import { useDetectionPolling } from '../../../hooks/useDetectionPolling';
import { StepContainer } from '../StepContainer';
import { ActionButton, DetectionIndicator, type DetectionStatus } from '../ui';
import { SuperWhisperIllustration } from '../ui/SuperWhisperIllustration';

export function SuperWhisperInstall() {
  const { goToStep, goBack, skipToStep, updateDetection } = useSetupStore();
  const { addToast } = useConversationStore();
  
  // Poll for SuperWhisper installation
  const { isChecking, isDetected } = useDetectionPolling(
    () => invoke<boolean>('is_superwhisper_installed'),
    {
      interval: 2000,
      onDetected: () => {
        // Update store cache when detected
        updateDetection({ superwhisperInstalled: true });
      },
    }
  );
  
  // Handle download button click
  const handleDownload = async () => {
    try {
      await invoke('open_external_url', { url: 'https://superwhisper.com' });
      addToast({
        type: 'info',
        message: 'Opening SuperWhisper website...',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to open URL:', error);
      addToast({
        type: 'error',
        message: 'Failed to open browser',
      });
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
      title="Install SuperWhisper"
      description="SuperWhisper provides the best transcription accuracy with local processing for privacy."
      showBack
      onBack={goBack}
      showSkip
      onSkip={() => skipToStep('voice-output')}
      primaryAction={{
        label: 'Continue',
        onClick: () => goToStep('superwhisper-configure'),
        disabled: !isDetected,
      }}
    >
      <div className="flex flex-col items-center">
        {/* Illustration */}
        <SuperWhisperIllustration className="mb-4" />
        
        {/* Detection status */}
        <div className="mb-4">
          <DetectionIndicator
            status={status}
            labels={{
              checking: 'Checking...',
              success: 'SuperWhisper is installed',
              missing: 'Not detected',
            }}
          />
        </div>
        
        {/* Download button - only show when not installed */}
        {!isDetected && (
          <ActionButton
            variant="secondary"
            onClick={handleDownload}
          >
            Download SuperWhisper
          </ActionButton>
        )}
      </div>
    </StepContainer>
  );
}
