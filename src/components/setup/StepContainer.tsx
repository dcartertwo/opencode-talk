import { cn } from '../../lib/utils';
import { ActionButton, BackButton, SkipLink } from './ui';

interface StepContainerProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  showBack?: boolean;
  onBack?: () => void;
  showSkip?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function StepContainer({
  children,
  title,
  description,
  showBack = true,
  onBack,
  showSkip = true,
  onSkip,
  skipLabel = 'Skip for now',
  primaryAction,
  secondaryAction,
  className,
}: StepContainerProps) {
  return (
    <div className={cn('flex-1 flex flex-col px-12 py-8', className)}>
      {/* Header with back button */}
      <div className="h-8 flex items-center">
        {showBack && onBack && (
          <BackButton onClick={onBack} />
        )}
      </div>
      
      {/* Title and description */}
      <div className="mt-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 mt-8">
        {children}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-6 mt-auto">
        <div>
          {showSkip && onSkip && (
            <SkipLink onClick={onSkip}>{skipLabel}</SkipLink>
          )}
        </div>
        <div className="flex items-center gap-3">
          {secondaryAction && (
            <ActionButton
              onClick={secondaryAction.onClick}
              variant="secondary"
            >
              {secondaryAction.label}
            </ActionButton>
          )}
          {primaryAction && (
            <ActionButton
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
            >
              {primaryAction.label}
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
