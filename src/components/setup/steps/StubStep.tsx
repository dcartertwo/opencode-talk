import { useSetupStore, type SetupStep } from '../../../stores/setup';
import { StepContainer } from '../StepContainer';

interface StubStepProps {
  title: string;
  nextStep: SetupStep;
  skipStep?: SetupStep;
}

export function StubStep({ title, nextStep, skipStep }: StubStepProps) {
  const { goToStep, goBack, skipToStep } = useSetupStore();
  
  return (
    <StepContainer
      title={title}
      description="This step is coming soon."
      showBack
      onBack={goBack}
      showSkip={!!skipStep}
      onSkip={skipStep ? () => skipToStep(skipStep) : undefined}
      primaryAction={{
        label: 'Continue',
        onClick: () => goToStep(nextStep),
      }}
    >
      <div className="flex items-center justify-center h-48 rounded-lg bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Step content placeholder</p>
      </div>
    </StepContainer>
  );
}
