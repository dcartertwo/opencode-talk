import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { useSetupStore } from '../../../stores/setup';
import { StepContainer } from '../StepContainer';
import { ActionButton, CodeBlock } from '../ui';

type ConfigStatus = 'configuring' | 'starting' | 'success' | 'error';

const MACROWHISPER_CONFIG = `{
  "defaults": {
    "activeAction": "opencodeTalk",
    "pressReturn": false,
    "actionDelay": 0.3
  },
  "scriptsShell": {
    "opencodeTalk": {
      "action": "curl -s -X POST http://127.0.0.1:7891/transcription -H 'Content-Type: application/json' -d '{\\"text\\": \\"{{swResult}}\\"}'",
      "icon": "🎤"
    }
  }
}`;

const START_SERVICE_CMD = 'macrowhisper --start-service';
const CONFIG_PATH = '~/.config/macrowhisper/macrowhisper.json';
const MAX_RETRY_TIME_MS = 60000; // 1 minute

export function MacrowhisperConfigure() {
  const { goToStep, goBack, skipToStep, updateDetection } = useSetupStore();
  
  const [status, setStatus] = useState<ConfigStatus>('configuring');
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  
  const failureCountRef = useRef(0);
  
  const startTimeRef = useRef<number>(Date.now());
  const hasAutoAdvanced = useRef(false);

  const runConfiguration = async () => {
    // Check if we've exceeded the retry time limit
    if (Date.now() - startTimeRef.current > MAX_RETRY_TIME_MS) {
      setError('Configuration timed out after 1 minute. Please try manual configuration.');
      setStatus('error');
      setShowManual(true);
      return;
    }

    setStatus('configuring');
    setError(null);

    try {
      // Step 1: Write configuration (idempotent)
      await invoke('configure_macrowhisper');
      updateDetection({ macrowhisperConfigured: true });

      // Step 2: Check if service is already running
      const isRunning = await invoke<boolean>('is_macrowhisper_running');
      
      if (isRunning) {
        // Already running, we're done
        updateDetection({ macrowhisperRunning: true });
        setStatus('success');
        return;
      }

      // Step 3: Start the service
      setStatus('starting');
      await invoke('start_macrowhisper_service');
      updateDetection({ macrowhisperRunning: true });
      
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setStatus('error');
      failureCountRef.current += 1;
      // Auto-expand manual section after 2 failures
      if (failureCountRef.current >= 2) {
        setShowManual(true);
      }
    }
  };

  // Run configuration on mount
  useEffect(() => {
    runConfiguration();
  }, []);

  // Auto-advance on success
  useEffect(() => {
    if (status === 'success' && !hasAutoAdvanced.current) {
      hasAutoAdvanced.current = true;
      // Small delay so user sees success state
      const timer = setTimeout(() => {
        goToStep('voice-input-test');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status, goToStep]);

  const handleRetry = () => {
    runConfiguration();
  };

  const canRetry = Date.now() - startTimeRef.current < MAX_RETRY_TIME_MS;

  return (
    <StepContainer
      title="Configuring Macrowhisper"
      description="Setting up the connection to OpenCode Talk."
      showBack
      onBack={goBack}
      showSkip
      onSkip={() => skipToStep('voice-output')}
      primaryAction={
        status === 'error'
          ? {
              label: "I've done this manually",
              onClick: () => goToStep('voice-input-test'),
            }
          : undefined
      }
    >
      <div className="flex flex-col items-center">
        {/* Status display */}
        <div className="flex flex-col items-center gap-3 mb-6">
          {(status === 'configuring' || status === 'starting') && (
            <>
              <Loader2 className="w-10 h-10 text-[#F6821F] animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">
                {status === 'configuring' ? 'Writing configuration...' : 'Starting service...'}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-green-600 dark:text-green-400 font-medium">
                Configuration complete
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-10 h-10 text-red-500" />
              <p className="text-red-600 dark:text-red-400 font-medium">
                Configuration failed
              </p>
              {error && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
                  {error}
                </p>
              )}
              {canRetry && (
                <ActionButton variant="secondary" onClick={handleRetry}>
                  Retry
                </ActionButton>
              )}
            </>
          )}
        </div>

        {/* Manual instructions - collapsible */}
        {status === 'error' && (
          <div className="w-full border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              onClick={() => setShowManual(!showManual)}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${showManual ? 'rotate-90' : ''}`}
              />
              Configure manually
            </button>

            {showManual && (
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    1. Create or edit <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{CONFIG_PATH}</code>:
                  </p>
                  <CodeBlock code={MACROWHISPER_CONFIG} language="json" />
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    2. Start the service:
                  </p>
                  <CodeBlock code={START_SERVICE_CMD} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </StepContainer>
  );
}
