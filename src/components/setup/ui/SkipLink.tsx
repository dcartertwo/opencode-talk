import { cn } from '../../../lib/utils';

interface SkipLinkProps {
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function SkipLink({ onClick, children = 'Skip for now', className }: SkipLinkProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
        'transition-colors duration-150',
        'focus:outline-none focus:underline',
        className
      )}
    >
      {children}
    </button>
  );
}
