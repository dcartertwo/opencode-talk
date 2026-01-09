import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useSetupStore, getStepNumber, getTotalSteps } from '../../stores/setup';

export function SetupProgress() {
  const { currentStep, voiceInputChoice } = useSetupStore();
  
  const currentIndex = getStepNumber(currentStep, voiceInputChoice);
  const totalSteps = getTotalSteps(voiceInputChoice);
  
  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <motion.div
          key={index}
          className={cn(
            'w-2 h-2 rounded-full transition-colors duration-300',
            index < currentIndex
              ? 'bg-[#F6821F]'
              : index === currentIndex
              ? 'bg-[#F6821F]'
              : 'bg-gray-200'
          )}
          initial={false}
          animate={{
            scale: index === currentIndex ? 1.25 : 1,
          }}
          transition={{ duration: 0.2 }}
        />
      ))}
    </div>
  );
}
