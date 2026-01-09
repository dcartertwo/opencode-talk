import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { Check, Keyboard } from 'lucide-react';
import { ActionButton } from '../ui';
import { useSetupStore } from '../../../stores/setup';

export function Ready() {
  const { detection, markStepComplete } = useSetupStore();
  
  const handleFinish = async () => {
    // Mark all steps as complete
    markStepComplete('voiceInput');
    markStepComplete('voiceOutput');
    markStepComplete('openCodeConnection');
    
    // Close setup window and show main window
    await invoke('finish_setup');
  };
  
  const hotkey = detection.superwhisperHotkey || 'your SuperWhisper hotkey';
  
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-12 py-8">
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
      >
        <Check className="w-8 h-8 text-white" strokeWidth={3} />
      </motion.div>
      
      {/* Title */}
      <motion.h1
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-2xl font-semibold text-gray-900"
      >
        You're all set!
      </motion.h1>
      
      {/* Quick reference */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-4 rounded-lg bg-gray-50 border border-gray-200 max-w-sm w-full"
      >
        <div className="flex items-start gap-3">
          <Keyboard className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-gray-700">
              Press <span className="font-medium text-gray-900">{hotkey}</span> to start talking
            </p>
            <p className="mt-2 text-gray-500">
              Press <span className="font-medium">Escape</span> to stop or interrupt
            </p>
          </div>
        </div>
      </motion.div>
      
      {/* CTA */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10"
      >
        <ActionButton onClick={handleFinish}>
          Start Using App
        </ActionButton>
      </motion.div>
    </div>
  );
}
