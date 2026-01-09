import { useSetupStore } from '../../../stores/setup';
import { StepContainer } from '../StepContainer';
import { RadioCard } from '../ui';

export function VoiceInputChoice() {
  const { voiceInputChoice, setVoiceInputChoice, goToStep, goBack, skipToStep } = useSetupStore();
  
  const handleContinue = () => {
    if (voiceInputChoice === 'superwhisper') {
      goToStep('superwhisper-install');
    } else if (voiceInputChoice === 'macos') {
      goToStep('macos-dictation');
    }
  };
  
  return (
    <StepContainer
      title="Voice Input"
      description="How would you like to talk to OpenCode?"
      showBack
      onBack={goBack}
      showSkip
      onSkip={() => skipToStep('voice-output')}
      primaryAction={{
        label: 'Continue',
        onClick: handleContinue,
        disabled: !voiceInputChoice,
      }}
    >
      <div className="space-y-3">
        <RadioCard
          selected={voiceInputChoice === 'superwhisper'}
          onClick={() => setVoiceInputChoice('superwhisper')}
          title="SuperWhisper"
          description="Best accuracy, works offline. Requires one-time purchase ($39)."
          badge="Recommended"
        />
        
        <RadioCard
          selected={voiceInputChoice === 'macos'}
          onClick={() => setVoiceInputChoice('macos')}
          title="macOS Dictation"
          description="Built-in, works immediately. Less accurate for technical terms."
        />
      </div>
    </StepContainer>
  );
}
