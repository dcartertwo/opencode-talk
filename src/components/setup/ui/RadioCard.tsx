import { cn } from '../../../lib/utils';

interface RadioCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioCard({
  selected,
  onClick,
  title,
  description,
  badge,
  disabled,
  className,
}: RadioCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-lg border-2 text-left transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F6821F] dark:focus:ring-offset-gray-900',
        selected
          ? 'border-[#F6821F] bg-orange-50 dark:bg-orange-950/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Radio indicator */}
        <div className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
          'transition-colors duration-150',
          selected
            ? 'border-[#F6821F] bg-[#F6821F]'
            : 'border-gray-300 dark:border-gray-600'
        )}>
          {selected && (
            <div className="w-2 h-2 rounded-full bg-white" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-medium',
              selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
            )}>
              {title}
            </span>
            {badge && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#F6821F] text-white">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
