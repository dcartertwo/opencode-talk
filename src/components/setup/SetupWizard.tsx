import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSetupStore, type SetupStep } from '../../stores/setup';
import { SetupProgress } from './SetupProgress';
import { Welcome, VoiceInputChoice, SuperWhisperInstall, StubStep, Ready } from './steps';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -30 : 30,
    opacity: 0,
  }),
};

function renderStep(step: SetupStep) {
  switch (step) {
    case 'welcome':
      return <Welcome />;
    case 'voice-input-choice':
      return <VoiceInputChoice />;
    case 'superwhisper-install':
      return <SuperWhisperInstall />;
    case 'superwhisper-configure':
      return (
        <StubStep
          title="Configure SuperWhisper"
          nextStep="macrowhisper-install"
          skipStep="voice-output"
        />
      );
    case 'macrowhisper-install':
      return (
        <StubStep
          title="Install Macrowhisper"
          nextStep="macrowhisper-configure"
          skipStep="voice-output"
        />
      );
    case 'macrowhisper-configure':
      return (
        <StubStep
          title="Configuring Macrowhisper"
          nextStep="voice-input-test"
          skipStep="voice-output"
        />
      );
    case 'voice-input-test':
      return (
        <StubStep
          title="Test Voice Input"
          nextStep="voice-output"
          skipStep="voice-output"
        />
      );
    case 'macos-dictation':
      return (
        <StubStep
          title="Enable macOS Dictation"
          nextStep="voice-output"
          skipStep="voice-output"
        />
      );
    case 'voice-output':
      return (
        <StubStep
          title="Voice Output"
          nextStep="opencode-connection"
          skipStep="opencode-connection"
        />
      );
    case 'opencode-connection':
      return (
        <StubStep
          title="Connect to OpenCode"
          nextStep="ready"
          skipStep="ready"
        />
      );
    case 'ready':
      return <Ready />;
    default:
      return <Welcome />;
  }
}

export function SetupWizard() {
  const { currentStep, refreshDetection } = useSetupStore();
  const prevStepRef = useRef<SetupStep>(currentStep);
  
  // Determine animation direction based on navigation
  const getDirection = () => {
    const prevStep = prevStepRef.current;
    const stepOrder: SetupStep[] = [
      'welcome',
      'voice-input-choice',
      'superwhisper-install',
      'superwhisper-configure',
      'macrowhisper-install',
      'macrowhisper-configure',
      'voice-input-test',
      'macos-dictation',
      'voice-output',
      'opencode-connection',
      'ready',
    ];
    
    const prevIndex = stepOrder.indexOf(prevStep);
    const currentIndex = stepOrder.indexOf(currentStep);
    
    return currentIndex >= prevIndex ? 1 : -1;
  };
  
  const direction = getDirection();
  
  // Update ref after calculating direction
  useEffect(() => {
    prevStepRef.current = currentStep;
  }, [currentStep]);
  
  // Refresh detection on mount
  useEffect(() => {
    refreshDetection();
  }, [refreshDetection]);
  
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Progress indicator - hide on welcome and ready */}
      {currentStep !== 'welcome' && currentStep !== 'ready' && (
        <SetupProgress />
      )}
      
      {/* Step content with animations */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="flex-1 flex flex-col"
        >
          {renderStep(currentStep)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
