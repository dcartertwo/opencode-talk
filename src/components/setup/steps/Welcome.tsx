import { Mic } from 'lucide-react';
import { ActionButton } from '../ui';
import { useSetupStore } from '../../../stores/setup';

export function Welcome() {
  const { goToStep } = useSetupStore();
  
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-12 py-8">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#F6821F] to-[#E5740A] flex items-center justify-center shadow-lg">
        <Mic className="w-10 h-10 text-white" />
      </div>
      
      {/* Title */}
      <h1 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center">
        Welcome to OpenCode Talk
      </h1>
      
      {/* Description */}
      <p className="mt-3 text-gray-500 dark:text-gray-400 text-center max-w-sm">
        Talk naturally with your AI coding assistant. Let's get you set up in a few minutes.
      </p>
      
      {/* CTA */}
      <div className="mt-10">
        <ActionButton onClick={() => goToStep('voice-input-choice')}>
          Get Started
        </ActionButton>
      </div>
    </div>
  );
}
