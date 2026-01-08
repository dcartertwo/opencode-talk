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

export class SentenceBuffer {
  private buffer: string = '';
  private onSentence: SentenceCallback;
  private onTextUpdate: ((fullText: string) => void) | null;
  private pendingCallbacks: Promise<void>[] = [];
  
  constructor(
    onSentence: SentenceCallback,
    onTextUpdate?: (fullText: string) => void
  ) {
    this.onSentence = onSentence;
    this.onTextUpdate = onTextUpdate || null;
  }
  
  /**
   * Add incoming text delta to the buffer
   */
  push(delta: string): void {
    this.buffer += delta;
    
    // Notify about full text update (for UI)
    if (this.onTextUpdate) {
      this.onTextUpdate(this.buffer);
    }
    
    // Try to extract complete sentences
    this.extractSentences();
  }
  
  /**
   * Flush any remaining text in the buffer (call when stream ends)
   */
  flush(): void {
    const remaining = this.buffer.trim();
    if (remaining.length > 0) {
      const result = this.onSentence(remaining);
      if (result instanceof Promise) {
        this.pendingCallbacks.push(result);
      }
    }
    this.buffer = '';
  }
  
  /**
   * Clear the buffer without emitting (for interrupts)
   */
  clear(): void {
    this.buffer = '';
  }
  
  /**
   * Get current buffer contents
   */
  getBuffer(): string {
    return this.buffer;
  }
  
  /**
   * Extract and emit complete sentences from the buffer
   */
  private extractSentences(): void {
    while (true) {
      const sentenceEnd = this.findSentenceEnd();
      if (sentenceEnd === -1) {
        break;
      }
      
      // Extract the sentence (including the punctuation)
      const sentence = this.buffer.slice(0, sentenceEnd + 1).trim();
      this.buffer = this.buffer.slice(sentenceEnd + 1).trimStart();
      
      // Only emit if it meets minimum length
      if (sentence.length >= MIN_SENTENCE_LENGTH) {
        // Call the callback and track the promise if it's async
        const result = this.onSentence(sentence);
        if (result instanceof Promise) {
          this.pendingCallbacks.push(result);
        }
      } else {
        // Too short, prepend back to buffer to combine with next
        this.buffer = sentence + ' ' + this.buffer;
        break;
      }
    }
  }
  
  /**
   * Wait for all pending TTS callbacks to complete
   */
  async waitForPending(): Promise<void> {
    await Promise.all(this.pendingCallbacks);
    this.pendingCallbacks = [];
  }
  
  /**
   * Find the index of the next sentence-ending punctuation
   * Returns -1 if no complete sentence is found
   */
  private findSentenceEnd(): number {
    // Look for sentence-ending punctuation followed by space or end
    const patterns = [
      /[.!?](?:\s|$)/g,  // Period, exclamation, or question mark followed by space/end
    ];
    
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(this.buffer)) !== null) {
        const punctIndex = match.index;
        
        // Check if this is actually a sentence end (not an abbreviation)
        if (this.isSentenceEnd(punctIndex)) {
          return punctIndex;
        }
      }
    }
    
    return -1;
  }
  
  /**
   * Check if the punctuation at the given index is a real sentence end
   */
  private isSentenceEnd(punctIndex: number): boolean {
    const char = this.buffer[punctIndex];
    
    // Exclamation and question marks are always sentence ends
    if (char === '!' || char === '?') {
      return true;
    }
    
    // For periods, check if it's an abbreviation
    if (char === '.') {
      // Get the word before the period
      const beforePunct = this.buffer.slice(0, punctIndex);
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
      const afterPunct = this.buffer.slice(punctIndex + 1).trimStart();
      if (afterPunct.length > 0) {
        const nextChar = afterPunct[0];
        // If next char is lowercase letter, likely not a sentence end
        // Exception: could be a new sentence starting with lowercase (rare)
        if (/[a-z]/.test(nextChar)) {
          // But if there's significant space before, it might be a sentence
          const spaceBetween = this.buffer.slice(punctIndex + 1).length - afterPunct.length;
          if (spaceBetween < 2) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
}

/**
 * Create a sentence buffer with the given callbacks
 */
export function createSentenceBuffer(
  onSentence: SentenceCallback,
  onTextUpdate?: (fullText: string) => void
): SentenceBuffer {
  return new SentenceBuffer(onSentence, onTextUpdate);
}
