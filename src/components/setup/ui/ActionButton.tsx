import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function ActionButton({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
  className,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-150',
        'flex items-center justify-center gap-2',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        variant === 'primary' && [
          'bg-[#F6821F] text-white',
          'hover:bg-[#E5740A]',
          'focus:ring-[#F6821F]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.98]',
        ],
        variant === 'secondary' && [
          'bg-gray-100 text-gray-700',
          'hover:bg-gray-200',
          'focus:ring-gray-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ],
        className
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
