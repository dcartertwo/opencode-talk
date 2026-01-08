/**
 * Response formatter for voice output
 * 
 * Transforms assistant responses into a format suitable for TTS:
 * - Summarizes code blocks
 * - Describes diagrams and tables
 * - Extracts key information for spoken delivery
 */

interface FormattedResponse {
  /** The text to be spoken */
  spokenText: string;
  /** Files that were mentioned or changed */
  filesChanged: string[];
  /** Whether the response contains code */
  hasCode: boolean;
  /** Whether the response contains diagrams/tables */
  hasDiagrams: boolean;
}

/**
 * Extract file paths from text
 */
function extractFilePaths(text: string): string[] {
  const patterns = [
    // Common file path patterns
    /`([^`]+\.(ts|tsx|js|jsx|py|rs|go|java|rb|php|css|scss|html|json|yaml|yml|md|txt|sql|sh))`/gi,
    // Paths with slashes
    /(?:^|\s)((?:\.\/|\.\.\/|\/)?[\w\-./]+\.(ts|tsx|js|jsx|py|rs|go|java|rb|php|css|scss|html|json|yaml|yml|md|txt|sql|sh))(?:\s|$|:)/gim,
  ];
  
  const files = new Set<string>();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      files.add(match[1]);
    }
  }
  
  return Array.from(files);
}

/**
 * Check if text contains code blocks
 */
function containsCodeBlocks(text: string): boolean {
  return /```[\s\S]*?```/g.test(text);
}

/**
 * Check if text contains diagrams or tables
 */
function containsDiagramsOrTables(text: string): boolean {
  // ASCII art tables
  const hasTable = /\|[\s\-:]+\|/g.test(text) || /[┌┐└┘├┤┬┴┼│─]/g.test(text);
  // ASCII diagrams
  const hasDiagram = /[┌┐└┘├┤┬┴┼│─═║╔╗╚╝╠╣╦╩╬→←↑↓↔]/g.test(text);
  // Mermaid or other diagram blocks
  const hasDiagramBlock = /```(mermaid|plantuml|dot|graph|diagram)/gi.test(text);
  
  return hasTable || hasDiagram || hasDiagramBlock;
}

/**
 * Summarize a code block for spoken output
 */
function summarizeCodeBlock(code: string, language: string): string {
  const lines = code.trim().split('\n').length;
  
  // Try to identify what the code does
  let description = `${lines} lines of ${language || 'code'}`;
  
  // Look for function/class definitions
  const functionMatch = code.match(/(?:function|def|fn|func)\s+(\w+)/);
  const classMatch = code.match(/(?:class|struct|interface|type)\s+(\w+)/);
  const componentMatch = code.match(/(?:export\s+)?(?:default\s+)?(?:function|const)\s+(\w+)/);
  
  if (functionMatch) {
    description = `a function called ${functionMatch[1]}`;
  } else if (classMatch) {
    description = `a ${classMatch[0].split(' ')[0].toLowerCase()} called ${classMatch[1]}`;
  } else if (componentMatch && (language === 'tsx' || language === 'jsx')) {
    description = `a React component called ${componentMatch[1]}`;
  }
  
  return description;
}

/**
 * Format a response for voice output
 */
export function formatForVoice(text: string): FormattedResponse {
  const filesChanged = extractFilePaths(text);
  const hasCode = containsCodeBlocks(text);
  const hasDiagrams = containsDiagramsOrTables(text);
  
  let spokenText = text;
  
  // Replace code blocks with summaries
  spokenText = spokenText.replace(/```(\w*)\n([\s\S]*?)```/g, (_, language, code) => {
    const summary = summarizeCodeBlock(code, language);
    const fileMention = filesChanged.length > 0 
      ? ` in ${filesChanged[0]}` 
      : '';
    return `I've written ${summary}${fileMention}. `;
  });
  
  // Replace inline code with just the content (remove backticks)
  spokenText = spokenText.replace(/`([^`]+)`/g, '$1');
  
  // Replace markdown links with just the text
  spokenText = spokenText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Replace headers with emphasis
  spokenText = spokenText.replace(/^#{1,6}\s+(.+)$/gm, '$1: ');
  
  // Replace bullet points
  spokenText = spokenText.replace(/^[\s]*[-*]\s+/gm, '');
  spokenText = spokenText.replace(/^[\s]*\d+\.\s+/gm, '');
  
  // Replace multiple newlines with single space
  spokenText = spokenText.replace(/\n{2,}/g, '. ');
  spokenText = spokenText.replace(/\n/g, ' ');
  
  // Clean up multiple spaces
  spokenText = spokenText.replace(/\s{2,}/g, ' ');
  
  // Clean up multiple periods
  spokenText = spokenText.replace(/\.{2,}/g, '.');
  spokenText = spokenText.replace(/\.\s*\./g, '.');
  
  // Add notes about diagrams/tables if present
  if (hasDiagrams && !spokenText.includes('diagram') && !spokenText.includes('table')) {
    spokenText += ' I\'ve also included a visual diagram or table, take a look at the output.';
  }
  
  // Trim and clean up
  spokenText = spokenText.trim();
  
  // If the response is too long, truncate it for voice
  if (spokenText.length > 500) {
    // Find a good breaking point
    const sentences = spokenText.split(/(?<=[.!?])\s+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length > 450) {
        break;
      }
      truncated += sentence + ' ';
    }
    
    spokenText = truncated.trim() + ' Would you like me to continue?';
  }
  
  return {
    spokenText,
    filesChanged,
    hasCode,
    hasDiagrams,
  };
}

/**
 * Check if a response is a simple confirmation that doesn't need formatting
 */
export function isSimpleConfirmation(text: string): boolean {
  const simplePatterns = [
    /^done\.?$/i,
    /^created\.?$/i,
    /^updated\.?$/i,
    /^deleted\.?$/i,
    /^completed\.?$/i,
    /^ok\.?$/i,
    /^yes\.?$/i,
    /^no\.?$/i,
  ];
  
  const cleanText = text.trim();
  return simplePatterns.some(pattern => pattern.test(cleanText));
}

/**
 * Detect the type of response for appropriate handling
 */
export function detectResponseType(text: string): 'code' | 'explanation' | 'confirmation' | 'question' | 'error' {
  if (isSimpleConfirmation(text)) {
    return 'confirmation';
  }
  
  if (text.includes('```')) {
    return 'code';
  }
  
  if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
    return 'error';
  }
  
  if (text.endsWith('?')) {
    return 'question';
  }
  
  return 'explanation';
}
