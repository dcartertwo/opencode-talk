import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS support
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a timestamp to a relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Convert a hotkey string to display format
 */
export function formatHotkey(hotkey: string): string {
  return hotkey
    .replace('Option', '⌥')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace('Control', '⌃')
    .replace('Ctrl', '⌃')
    .replace('Command', '⌘')
    .replace('Cmd', '⌘')
    .replace('Meta', '⌘')
    .replace('Space', '␣')
    .replace('Escape', '⎋')
    .replace('Enter', '↵')
    .replace('Tab', '⇥')
    .replace(/\+/g, '');
}

/**
 * Parse a display hotkey back to code format
 */
export function parseHotkey(display: string): string {
  return display
    .replace('⌥', 'Option+')
    .replace('⇧', 'Shift+')
    .replace('⌃', 'Control+')
    .replace('⌘', 'Command+')
    .replace('␣', 'Space')
    .replace('⎋', 'Escape')
    .replace('↵', 'Enter')
    .replace('⇥', 'Tab')
    .replace(/\+$/, '');
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Check if we're running in Tauri
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
