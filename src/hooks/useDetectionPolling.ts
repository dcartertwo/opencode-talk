import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDetectionPollingOptions {
  /** Polling interval in ms (default: 2000) */
  interval?: number;
  /** Callback when detection becomes true */
  onDetected?: () => void;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

interface UseDetectionPollingResult {
  /** True only during the initial check (not subsequent polls) */
  isChecking: boolean;
  /** True if the check function returned true */
  isDetected: boolean;
  /** Manually trigger a check */
  refresh: () => Promise<void>;
}

/**
 * Hook for polling a detection function at regular intervals.
 * Useful for checking if software is installed while user is on a setup step.
 */
export function useDetectionPolling(
  checkFn: () => Promise<boolean>,
  options: UseDetectionPollingOptions = {}
): UseDetectionPollingResult {
  const { interval = 2000, onDetected, enabled = true } = options;
  
  // isChecking only true for initial check, not subsequent polls (prevents flickering)
  const [isChecking, setIsChecking] = useState(true);
  const [isDetected, setIsDetected] = useState(false);
  
  // Track if onDetected has been called to prevent multiple calls
  const hasCalledOnDetected = useRef(false);
  // Store the latest checkFn to avoid dependency issues
  const checkFnRef = useRef(checkFn);
  checkFnRef.current = checkFn;
  // Store the latest onDetected callback
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  
  const runCheck = useCallback(async (isInitial: boolean = false) => {
    // Only show checking state for initial check
    if (isInitial) {
      setIsChecking(true);
    }
    
    try {
      const result = await checkFnRef.current();
      setIsDetected(result);
      
      // Call onDetected once when detection becomes true
      if (result && !hasCalledOnDetected.current) {
        hasCalledOnDetected.current = true;
        onDetectedRef.current?.();
      }
    } catch (error) {
      console.error('Detection check failed:', error);
      setIsDetected(false);
    } finally {
      if (isInitial) {
        setIsChecking(false);
      }
    }
  }, []);
  
  // Initial check on mount
  useEffect(() => {
    if (enabled) {
      runCheck(true);
    }
  }, [enabled, runCheck]);
  
  // Polling interval (silent checks, no loading state)
  useEffect(() => {
    if (!enabled || isDetected) {
      // Stop polling if disabled or already detected
      return;
    }
    
    const intervalId = setInterval(() => runCheck(false), interval);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isDetected, interval, runCheck]);
  
  return {
    isChecking,
    isDetected,
    refresh: () => runCheck(true),
  };
}
