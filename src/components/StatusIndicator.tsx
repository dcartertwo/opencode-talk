import { cn } from '../lib/utils';
import type { VoiceState } from '../stores/conversation';

interface StatusIndicatorProps {
  state: VoiceState;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ state, size = 'md' }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };
  
  const dotSize = sizeClasses[size];
  
  if (state === 'idle') {
    return (
      <div className={cn('rounded-full bg-gray-400', dotSize)} />
    );
  }
  
  if (state === 'listening') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <div 
          className={cn(
            'absolute rounded-full bg-red-500/30 animate-ping',
            size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'
          )} 
        />
        {/* Inner dot */}
        <div className={cn('rounded-full bg-red-500 relative z-10', dotSize)} />
      </div>
    );
  }
  
  if (state === 'processing') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Spinning ring */}
        <div 
          className={cn(
            'absolute rounded-full border-2 border-yellow-500/30 border-t-yellow-500 animate-spin',
            size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8'
          )} 
        />
        {/* Inner dot */}
        <div className={cn('rounded-full bg-yellow-500 relative z-10', dotSize)} />
      </div>
    );
  }
  
  if (state === 'speaking') {
    return (
      <div className="flex items-center gap-0.5">
        {/* Audio visualization bars */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'bg-green-500 rounded-full listening-bar',
              size === 'sm' ? 'w-0.5 h-2' : size === 'md' ? 'w-1 h-3' : 'w-1.5 h-4'
            )}
            style={{
              animationDelay: `${i * 0.1}s`,
              height: size === 'sm' ? '8px' : size === 'md' ? '12px' : '16px',
            }}
          />
        ))}
      </div>
    );
  }
  
  return null;
}

// Larger status indicator with label
export function StatusIndicatorWithLabel({ state }: { state: VoiceState }) {
  const labels: Record<VoiceState, string> = {
    idle: 'Ready',
    listening: 'Listening',
    processing: 'Processing',
    speaking: 'Speaking',
  };
  
  const colors: Record<VoiceState, string> = {
    idle: 'text-gray-500',
    listening: 'text-red-500',
    processing: 'text-yellow-500',
    speaking: 'text-green-500',
  };
  
  return (
    <div className="flex items-center gap-2">
      <StatusIndicator state={state} size="md" />
      <span className={cn('text-sm font-medium', colors[state])}>
        {labels[state]}
      </span>
    </div>
  );
}
