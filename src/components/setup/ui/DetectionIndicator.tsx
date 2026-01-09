import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type DetectionStatus = 'checking' | 'success' | 'missing' | 'error';

interface DetectionIndicatorProps {
  status: DetectionStatus;
  labels: {
    checking?: string;
    success?: string;
    missing?: string;
    error?: string;
  };
  className?: string;
}

export function DetectionIndicator({ status, labels, className }: DetectionIndicatorProps) {
  const defaultLabels = {
    checking: 'Checking...',
    success: 'Detected',
    missing: 'Not detected',
    error: 'Error',
  };
  
  const label = labels[status] || defaultLabels[status];
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          {status === 'checking' && (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          )}
          {status === 'success' && (
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
          {status === 'missing' && (
            <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
          )}
          {status === 'error' && (
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <X className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      
      <span className={cn(
        'text-sm',
        status === 'success' && 'text-green-600',
        status === 'missing' && 'text-gray-500',
        status === 'checking' && 'text-gray-400',
        status === 'error' && 'text-red-600',
      )}>
        {label}
      </span>
    </div>
  );
}
