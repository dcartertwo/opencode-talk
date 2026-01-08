import { useCallback } from 'react';
import { AlertTriangle, Check, X, Shield } from 'lucide-react';
import { handleConfirmation } from '../lib/voice-bridge';
import type { PendingConfirmation } from '../stores/conversation';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
  confirmation: PendingConfirmation;
}

export function ConfirmDialog({ confirmation }: ConfirmDialogProps) {
  const handleAllow = useCallback(async () => {
    await handleConfirmation(true);
  }, []);
  
  const handleDeny = useCallback(async () => {
    await handleConfirmation(false);
  }, []);
  
  // Determine severity for styling
  const getSeverity = (): 'low' | 'medium' | 'high' => {
    const desc = confirmation.description.toLowerCase();
    if (desc.includes('delete') || desc.includes('remove') || desc.includes('force')) {
      return 'high';
    }
    if (desc.includes('write') || desc.includes('modify') || desc.includes('change')) {
      return 'medium';
    }
    return 'low';
  };
  
  const severity = getSeverity();
  
  const severityStyles = {
    low: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-500',
      title: 'text-blue-800 dark:text-blue-200',
    },
    medium: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-500',
      title: 'text-yellow-800 dark:text-yellow-200',
    },
    high: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-500',
      title: 'text-red-800 dark:text-red-200',
    },
  };
  
  const styles = severityStyles[severity];
  
  return (
    <div className={cn(
      'mx-4 mb-4 rounded-xl border-2 overflow-hidden',
      styles.bg,
      styles.border
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-inherit">
        {severity === 'high' ? (
          <AlertTriangle className={cn('w-5 h-5', styles.icon)} />
        ) : (
          <Shield className={cn('w-5 h-5', styles.icon)} />
        )}
        <span className={cn('font-medium', styles.title)}>
          {severity === 'high' ? 'Warning' : 'Confirmation Required'}
        </span>
      </div>
      
      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          OpenCode wants to perform the following action:
        </p>
        
        {/* Action description */}
        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              {confirmation.toolName}
            </span>
          </div>
          <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
            {confirmation.description}
          </p>
        </div>
        
        {/* Voice instruction */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Say <strong>"yes"</strong> or <strong>"no"</strong>, or click a button below:
        </p>
        
        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAllow}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-green-500 hover:bg-green-600 text-white'
            )}
          >
            <Check className="w-4 h-4" />
            Allow
          </button>
          <button
            onClick={handleDeny}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
            )}
          >
            <X className="w-4 h-4" />
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
