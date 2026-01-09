import { ChevronLeft } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface BackButtonProps {
  onClick: () => void;
  className?: string;
}

export function BackButton({ onClick, className }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-gray-500 hover:text-gray-700',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 rounded',
        '-ml-1 py-1 pr-2',
        className
      )}
    >
      <ChevronLeft className="w-5 h-5" />
      <span className="text-sm font-medium">Back</span>
    </button>
  );
}
