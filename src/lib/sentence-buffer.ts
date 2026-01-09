/**
 * SentenceBuffer - Accumulates streaming text and emits complete sentences
 * 
 * Used for streaming TTS: as text arrives from OpenCode, we buffer it and
 * emit complete sentences so TTS can start generating audio immediately.
 */

// Common abbreviations that end with a period but aren't sentence endings
const ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr',
  'vs', 'etc', 'inc', 'ltd', 'corp',
  'st', 'ave', 'blvd', 'rd',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'e.g', 'i.e', 'cf', 'al', 'no', 'vol', 'pg',
]);

// Minimum sentence length to emit (avoids choppy single-word sentences)
const MIN_SENTENCE_LENGTH = 10;

export type SentenceCallback = (sentence: string) => void | Promise<void>;
export type ErrorCallback = (error: Error, sentence: string) => void;

export interface SentenceBuffer {
  push: (delta: string) => void;
  flush: () => void;
  clear: () => void;
  getBuffer: () => string;
  getSentenceCount: () => number;
  getErrorCount: () => number;
}

/**
 * Create a sentence buffer with the given callbacks
 */
export function createSentenceBuffer(
  onSentence: SentenceCallback,
  onTextUpdate?: (fullText: string) => void,
  onError?: ErrorCallback
): SentenceBuffer {
  let buffer = '';
  let sentenceCount = 0;
  let errorCount = 0;
  
  /**
   * Safely emit a sentence with error handling
   */
  function emitSentence(sentence: string): void {
    try {
      const result = onSentence(sentence);
      sentenceCount++;
      
      // Handle async callbacks - fire and forget but log errors
      if (result instanceof Promise) {
        result.catch((err) => {
          errorCount++;
          console.error('[SentenceBuffer] Async callback error:', err);
          if (onError) {
            onError(err instanceof Error ? err : new Error(String(err)), sentence);
          }
        });
      }
    } catch (err) {
      errorCount++;
      console.error('[SentenceBuffer] Sync callback error:', err);
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)), sentence);
      }
    }
  }
  
  /**
   * Check if the punctuation at the given index is a real sentence end
   */
  function isSentenceEnd(punctIndex: number): boolean {
    const char = buffer[punctIndex];
    
    // Exclamation and question marks are always sentence ends
    if (char === '!' || char === '?') {
      return true;
    }
    
    // For periods, check if it's an abbreviation
    if (char === '.') {
      // Get the word before the period
      const beforePunct = buffer.slice(0, punctIndex);
      const wordMatch = beforePunct.match(/(\w+)$/);
      
      if (wordMatch) {
        const word = wordMatch[1].toLowerCase();
        
        // Check if it's a known abbreviation
        if (ABBREVIATIONS.has(word)) {
          return false;
        }
        
        // Check for single letter (like middle initials: "John F. Kennedy")
        if (word.length === 1) {
          return false;
        }
        
        // Check for number followed by period (like "1." in a list)
        if (/^\d+$/.test(word)) {
          return false;
        }
      }
      
      // Check what comes after - if it's lowercase, probably not sentence end
      const afterPunct = buffer.slice(punctIndex + 1).trimStart();
      if (afterPunct.length > 0) {
        const nextChar = afterPunct[0];
        // If next char is lowercase letter, likely not a sentence end
        if (/[a-z]/.test(nextChar)) {
          // But if there's significant space before, it might be a sentence
          const spaceBetween = buffer.slice(punctIndex + 1).length - afterPunct.length;
          if (spaceBetween < 2) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
  
  /**
   * Find the index of the next sentence-ending punctuation
   * Returns -1 if no complete sentence is found
   */
  function findSentenceEnd(): number {
    const pattern = /[.!?](?:\s|$)/g;
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(buffer)) !== null) {
      const punctIndex = match.index;
      
      // Check if this is actually a sentence end (not an abbreviation)
      if (isSentenceEnd(punctIndex)) {
        return punctIndex;
      }
    }
    
    return -1;
  }
  
  /**
   * Extract and emit complete sentences from the buffer
   */
  function extractSentences(): void {
    while (true) {
      const sentenceEnd = findSentenceEnd();
      if (sentenceEnd === -1) {
        break;
      }
      
      // Extract the sentence (including the punctuation)
      const sentence = buffer.slice(0, sentenceEnd + 1).trim();
      buffer = buffer.slice(sentenceEnd + 1).trimStart();
      
      // Only emit if it meets minimum length
      if (sentence.length >= MIN_SENTENCE_LENGTH) {
        emitSentence(sentence);
      } else {
        // Too short, prepend back to buffer to combine with next
        buffer = sentence + ' ' + buffer;
        break;
      }
    }
  }
  
  return {
    /**
     * Add incoming text delta to the buffer
     */
    push(delta: string): void {
      buffer += delta;
      
      // Notify about full text update (for UI)
      if (onTextUpdate) {
        onTextUpdate(buffer);
      }
      
      // Try to extract complete sentences
      extractSentences();
    },
    
    /**
     * Flush any remaining text in the buffer (call when stream ends)
     */
    flush(): void {
      const remaining = buffer.trim();
      if (remaining.length > 0) {
        emitSentence(remaining);
      }
      buffer = '';
    },
    
    /**
     * Clear the buffer without emitting (for interrupts)
     */
    clear(): void {
      buffer = '';
    },
    
    /**
     * Get current buffer contents
     */
    getBuffer(): string {
      return buffer;
    },
    
    /**
     * Get count of sentences emitted
     */
    getSentenceCount(): number {
      return sentenceCount;
    },
    
    /**
     * Get count of errors that occurred
     */
    getErrorCount(): number {
      return errorCount;
    },
  };
}
