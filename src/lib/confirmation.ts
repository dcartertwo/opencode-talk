/**
 * Confirmation system for dangerous actions
 * 
 * Detects when OpenCode is about to perform a potentially dangerous action
 * and prompts the user for confirmation.
 */

export interface DangerousAction {
  toolName: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

// Patterns that indicate dangerous shell commands
const DANGEROUS_SHELL_PATTERNS = [
  { pattern: /rm\s+-rf?/, description: 'Delete files/directories', severity: 'high' as const },
  { pattern: /rm\s+/, description: 'Delete files', severity: 'medium' as const },
  { pattern: />\s*\//, description: 'Overwrite system files', severity: 'high' as const },
  { pattern: /sudo\s+/, description: 'Run with elevated permissions', severity: 'high' as const },
  { pattern: /chmod\s+/, description: 'Change file permissions', severity: 'medium' as const },
  { pattern: /chown\s+/, description: 'Change file ownership', severity: 'medium' as const },
  { pattern: /mv\s+.*\/dev\/null/, description: 'Move to null device', severity: 'high' as const },
  { pattern: /:\s*>\s*/, description: 'Truncate file', severity: 'medium' as const },
  { pattern: /mkfs/, description: 'Format filesystem', severity: 'high' as const },
  { pattern: /dd\s+/, description: 'Direct disk write', severity: 'high' as const },
  { pattern: /curl.*\|\s*(?:ba)?sh/, description: 'Execute remote script', severity: 'high' as const },
  { pattern: /wget.*\|\s*(?:ba)?sh/, description: 'Execute remote script', severity: 'high' as const },
  { pattern: /npm\s+publish/, description: 'Publish package', severity: 'medium' as const },
  { pattern: /npx\s+/, description: 'Execute npm package', severity: 'low' as const },
];

// Patterns for dangerous git commands
const DANGEROUS_GIT_PATTERNS = [
  { pattern: /push.*--force/, description: 'Force push to remote', severity: 'high' as const },
  { pattern: /push.*-f\b/, description: 'Force push to remote', severity: 'high' as const },
  { pattern: /reset.*--hard/, description: 'Hard reset (loses changes)', severity: 'high' as const },
  { pattern: /clean.*-fd/, description: 'Delete untracked files', severity: 'medium' as const },
  { pattern: /branch.*-[dD]/, description: 'Delete branch', severity: 'low' as const },
  { pattern: /checkout\s+--\s+\./, description: 'Discard all changes', severity: 'medium' as const },
  { pattern: /stash\s+drop/, description: 'Delete stash', severity: 'low' as const },
  { pattern: /rebase/, description: 'Rebase commits', severity: 'medium' as const },
];

/**
 * Check if a shell command is dangerous
 */
export function checkShellCommand(command: string): DangerousAction | null {
  for (const { pattern, description, severity } of DANGEROUS_SHELL_PATTERNS) {
    if (pattern.test(command)) {
      return {
        toolName: 'bash',
        description: `${description}: ${command}`,
        severity,
        requiresConfirmation: severity !== 'low',
      };
    }
  }
  
  // Check for git commands
  if (command.includes('git ')) {
    for (const { pattern, description, severity } of DANGEROUS_GIT_PATTERNS) {
      if (pattern.test(command)) {
        return {
          toolName: 'git',
          description: `${description}: ${command}`,
          severity,
          requiresConfirmation: severity !== 'low',
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if a file write is dangerous
 */
export function checkFileWrite(filePath: string): DangerousAction | null {
  const dangerousPatterns = [
    { pattern: /\.env/, description: 'Environment file', severity: 'high' as const },
    { pattern: /credentials/, description: 'Credentials file', severity: 'high' as const },
    { pattern: /secrets?/, description: 'Secrets file', severity: 'high' as const },
    { pattern: /\.ssh/, description: 'SSH configuration', severity: 'high' as const },
    { pattern: /\.aws/, description: 'AWS configuration', severity: 'high' as const },
    { pattern: /\.npmrc/, description: 'NPM configuration', severity: 'medium' as const },
    { pattern: /package\.json/, description: 'Package manifest', severity: 'low' as const },
    { pattern: /tsconfig\.json/, description: 'TypeScript config', severity: 'low' as const },
  ];
  
  for (const { pattern, description, severity } of dangerousPatterns) {
    if (pattern.test(filePath)) {
      return {
        toolName: 'write',
        description: `Writing to ${description}: ${filePath}`,
        severity,
        requiresConfirmation: severity !== 'low',
      };
    }
  }
  
  // All file writes should be confirmed by default
  return {
    toolName: 'write',
    description: `Create/modify file: ${filePath}`,
    severity: 'low',
    requiresConfirmation: true, // User setting can override
  };
}

/**
 * Parse voice input for confirmation response
 */
export function parseConfirmationResponse(input: string): 'yes' | 'no' | 'unknown' {
  const normalizedInput = input.toLowerCase().trim();
  
  const yesPatterns = [
    'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'go ahead',
    'do it', 'proceed', 'continue', 'confirm', 'approved', 'allow',
    'affirmative', 'absolutely', 'definitely', 'please do', 'go for it',
  ];
  
  const noPatterns = [
    'no', 'nope', 'nah', 'don\'t', 'stop', 'cancel', 'abort',
    'deny', 'reject', 'negative', 'skip', 'pass', 'never mind',
    'forget it', 'don\'t do it', 'hold on', 'wait',
  ];
  
  for (const pattern of yesPatterns) {
    if (normalizedInput.includes(pattern)) {
      return 'yes';
    }
  }
  
  for (const pattern of noPatterns) {
    if (normalizedInput.includes(pattern)) {
      return 'no';
    }
  }
  
  return 'unknown';
}

/**
 * Generate a spoken description of a pending action
 */
export function describeAction(action: DangerousAction): string {
  const severityPrefix = action.severity === 'high' 
    ? 'Warning! ' 
    : action.severity === 'medium' 
      ? 'Attention: ' 
      : '';
  
  return `${severityPrefix}I'd like to ${action.description.toLowerCase()}. Should I proceed?`;
}

/**
 * Check if a tool call requires confirmation based on user settings
 */
export function requiresConfirmation(
  toolName: string,
  toolArgs: Record<string, unknown>,
  settings: {
    confirmFileWrites: boolean;
    confirmShellCommands: boolean;
    confirmGitOperations: boolean;
  }
): DangerousAction | null {
  switch (toolName) {
    case 'bash':
    case 'shell': {
      if (!settings.confirmShellCommands) return null;
      const command = (toolArgs.command as string) || '';
      return checkShellCommand(command);
    }
    
    case 'write':
    case 'edit': {
      if (!settings.confirmFileWrites) return null;
      const filePath = (toolArgs.filePath as string) || (toolArgs.path as string) || '';
      return checkFileWrite(filePath);
    }
    
    case 'git': {
      if (!settings.confirmGitOperations) return null;
      const command = (toolArgs.command as string) || '';
      const action = checkShellCommand(`git ${command}`);
      if (action) {
        action.toolName = 'git';
      }
      return action;
    }
    
    default:
      return null;
  }
}
