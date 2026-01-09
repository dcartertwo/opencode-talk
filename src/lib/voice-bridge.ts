/**
 * Voice Bridge - Core logic connecting voice I/O to OpenCode
 * 
 * This module handles:
 * - Connecting to OpenCode server
 * - Managing sessions
 * - Processing voice input and sending to OpenCode
 * - Receiving responses and formatting for TTS
 * - Handling confirmations for dangerous actions
 */

import { invoke } from '@tauri-apps/api/core';
import { formatForVoice } from './response-formatter';
import { requiresConfirmation, describeAction } from './confirmation';
import { useConversationStore } from '../stores/conversation';
import { useSettingsStore } from '../stores/settings';
import { createSentenceBuffer, type SentenceBuffer } from './sentence-buffer';

// Voice mode system prompt addition
const VOICE_MODE_PROMPT = `
## Voice Mode Instructions

You are responding via voice synthesis. Optimize your responses for spoken output:

1. **Lead with a brief summary** (1-2 sentences max) that directly answers the question or confirms the action.

2. **For code changes**: Say "I've written [brief description] in [filename]" - do not read code aloud.

3. **For diagrams, tables, or structured output**: Say "I've created a [type] - take a look at the output."

4. **For explanations**: Use natural speech patterns. Avoid:
   - Markdown syntax (don't say "asterisk" or "backtick")
   - URLs (say "I've included a link" instead)
   - Long lists (summarize as "several items including X, Y, and Z")

5. **Keep responses under 30 seconds of speech** when possible. For complex topics, offer to elaborate: "Would you like me to go deeper on any of this?"

6. **For confirmations**: Be concise. "Done." or "Created." or "Updated." is fine.

The user can see the full response in their terminal or panel, so focus on the key information they need to hear.
`;

// Types for OpenCode API responses
interface HealthResponse {
  healthy: boolean;
  version: string;
}

interface Session {
  id: string;
  title?: string;
  createdAt: string;
}

interface Project {
  id: string;
  worktree: string;
  time?: {
    created: number;
    updated: number;
  };
}

interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: {
    toolName: string;
    args: Record<string, unknown>;
    state: string;
  };
}

interface PromptResponse {
  info: {
    id: string;
    role: string;
  };
  parts: MessagePart[];
}

// Server URL
let serverUrl: string = 'http://localhost:4096';
// Track current session ID for quick access
export let currentSessionId: string | null = null;
// Track active EventSource for SSE
let activeEventSource: EventSource | null = null;
// Track if we're currently streaming a response
let isStreamingResponse = false;
// Current request ID for handling concurrent requests
let currentRequestId: string | null = null;
// Active sentence buffer for cleanup
let activeSentenceBuffer: SentenceBuffer | null = null;

/**
 * Check if currently streaming a response
 */
export function isStreaming(): boolean {
  return isStreamingResponse;
}

/**
 * Reset all streaming state (used for cleanup)
 */
function resetStreamingState(): void {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
  isStreamingResponse = false;
  currentRequestId = null;
  if (activeSentenceBuffer) {
    activeSentenceBuffer.clear();
    activeSentenceBuffer = null;
  }
}

/**
 * Initialize connection to OpenCode server
 */
export async function connect(url: string): Promise<boolean> {
  serverUrl = url;
  const store = useConversationStore.getState();
  
  // Set connecting state
  store.setConnecting(true);
  
  try {
    const response = await fetch(`${serverUrl}/global/health`, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    if (!response.ok) {
      throw new Error('Server not healthy');
    }
    
    const health: HealthResponse = await response.json();
    
    if (health.healthy) {
      store.setConnectionStatus(true);
      console.log('Connected to OpenCode server:', health.version);
      return true;
    }
    
    throw new Error('Server not healthy');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    store.setConnectionStatus(false, message);
    console.error('Failed to connect to OpenCode:', message);
    return false;
  }
}

/**
 * Disconnect from OpenCode server
 */
export function disconnect(): void {
  // Clean up all streaming state
  resetStreamingState();
  
  currentSessionId = null;
  
  const store = useConversationStore.getState();
  store.setConnectionStatus(false);
  store.stopStreaming();
}

/**
 * Get or create a session
 */
export async function getOrCreateSession(): Promise<Session | null> {
  const store = useConversationStore.getState();
  
  // If we have an existing session, try to get it
  if (store.sessionId) {
    try {
      const response = await fetch(`${serverUrl}/session/${store.sessionId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const session: Session = await response.json();
        return session;
      }
      // 404 means session doesn't exist anymore, create new one
      if (response.status !== 404) {
        console.warn(`Session fetch returned ${response.status}`);
      }
    } catch (error) {
      // Network error - different from 404
      console.warn('Failed to fetch existing session:', error);
    }
  }
  
  // Create a new session
  try {
    const response = await fetch(`${serverUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Voice Session' }),
      signal: AbortSignal.timeout(10000),
    });
    
    if (response.ok) {
      const session: Session = await response.json();
      store.setSessionId(session.id);
      currentSessionId = session.id;
      return session;
    }
    
    console.error(`Failed to create session: HTTP ${response.status}`);
  } catch (error) {
    console.error('Failed to create session:', error);
  }
  
  return null;
}

/**
 * Start a new conversation (clear session)
 */
export async function startNewConversation(): Promise<void> {
  const store = useConversationStore.getState();
  store.clearMessages();
  store.setSessionId(null);
  currentSessionId = null;
  
  await speak("Starting a new conversation.");
}

/**
 * Send a message to OpenCode using streaming for faster response
 */
export async function sendMessage(text: string): Promise<string | null> {
  const settings = useSettingsStore.getState();
  const store = useConversationStore.getState();
  
  // IMPORTANT: Clean up any existing streaming state before starting
  // This fixes the issue where subsequent recordings don't work
  resetStreamingState();
  store.stopStreaming();
  
  // Check for "new conversation" command
  if (text.toLowerCase().includes('new conversation') || text.toLowerCase().includes('start over')) {
    await startNewConversation();
    return null;
  }
  
  // Get or create session
  const session = await getOrCreateSession();
  if (!session) {
    await speak("I couldn't create a session. Please check the OpenCode server.");
    return null;
  }
  
  // Set processing state
  store.setVoiceState('processing');
  await invoke('set_voice_state', { voiceState: 'processing' });
  
  // Add user message to store
  store.addMessage({ role: 'user', content: text });
  
  try {
    // Use streaming for Piper (fast) or Kokoro TTS
    const useStreaming = settings.ttsEngine === 'piper' || settings.ttsEngine === 'kokoro';
    
    if (useStreaming) {
      return await sendMessageStreaming(session.id, text, settings);
    }
    
    // Fall back to non-streaming for other TTS engines
    return await sendMessageSync(session.id, text, settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending message:', message);
    await speak("Sorry, I encountered an error. Please try again.");
    return null;
  } finally {
    // Reset state
    store.setVoiceState('idle');
    await invoke('set_voice_state', { voiceState: 'idle' });
  }
}

/**
 * Send message with streaming response and TTS
 */
async function sendMessageStreaming(
  sessionId: string,
  text: string,
  settings: ReturnType<typeof useSettingsStore.getState>
): Promise<string | null> {
  const store = useConversationStore.getState();
  
  // Generate a unique request ID
  const requestId = crypto.randomUUID();
  currentRequestId = requestId;
  
  // Start streaming state
  store.startStreaming();
  store.setVoiceState('speaking');
  await invoke('set_voice_state', { voiceState: 'speaking' });
  isStreamingResponse = true;
  
  let fullResponse = '';
  let finalized = false;
  
  // Create sentence buffer that queues TTS for each sentence
  const sentenceBuffer = createSentenceBuffer(
    (sentence) => {
      // Check if this request is still active
      if (currentRequestId !== requestId) {
        return;
      }
      // Fire-and-forget: queue TTS without waiting
      invoke('speak_sentence', {
        text: sentence,
        voice: settings.ttsVoice,
        speed: settings.ttsSpeed,
        engine: settings.ttsEngine,
      }).catch((e) => {
        console.error('[TTS] Error queuing sentence:', e);
      });
    },
    (fullText) => {
      // Check if this request is still active
      if (currentRequestId !== requestId) {
        return;
      }
      // Update UI with streaming text
      store.setStreamingText(fullText);
    },
    (error, sentence) => {
      // Error callback for sentence buffer
      console.error('[SentenceBuffer] Error processing sentence:', error, sentence);
    }
  );
  
  // Track the sentence buffer for cleanup
  activeSentenceBuffer = sentenceBuffer;
  
  return new Promise((resolve, reject) => {
    // Set up SSE connection for events
    const eventSource = new EventSource(`${serverUrl}/event`);
    activeEventSource = eventSource;
    
    let messageStarted = false;
    let completionTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Helper to finalize the message (only runs once)
    const finalizeMessage = () => {
      if (finalized) return;
      finalized = true;
      
      if (completionTimeout) {
        clearTimeout(completionTimeout);
        completionTimeout = null;
      }
      
      // Flush any remaining text in the buffer
      sentenceBuffer.flush();
      
      // Clean up SSE
      eventSource.close();
      activeEventSource = null;
      isStreamingResponse = false;
      
      // Only add message if we have content
      if (fullResponse.length > 0) {
        const formatted = formatForVoice(fullResponse);
        store.addMessage({
          role: 'assistant',
          content: fullResponse,
          spokenContent: formatted.spokenText,
          filesChanged: formatted.filesChanged,
        });
      }
      
      store.stopStreaming();
      resolve(fullResponse || null);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle streaming text deltas
        if (data.type === 'message.part.updated' && data.properties?.delta) {
          messageStarted = true;
          const delta = data.properties.delta;
          fullResponse += delta;
          sentenceBuffer.push(delta);
          
          // Reset completion timeout - finalize after 500ms of no new text
          if (completionTimeout) {
            clearTimeout(completionTimeout);
          }
          completionTimeout = setTimeout(finalizeMessage, 500);
        }
        
        // Handle session.idle as completion signal
        if (data.type === 'session.idle' && messageStarted) {
          finalizeMessage();
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };
    
    eventSource.onerror = () => {
      // Only reject if we haven't started receiving a message
      if (!messageStarted && !finalized) {
        finalized = true;
        eventSource.close();
        activeEventSource = null;
        isStreamingResponse = false;
        store.stopStreaming();
        reject(new Error('SSE connection failed'));
      }
    };
    
    // Send the message (the response will come via SSE)
    const [providerID, modelID] = settings.model.split('/');
    
    fetch(`${serverUrl}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: { providerID, modelID },
        parts: [
          { type: 'text', text: VOICE_MODE_PROMPT },
          { type: 'text', text },
        ],
      }),
    }).catch((error) => {
      console.error('Error sending message:', error);
      if (!finalized) {
        finalized = true;
        eventSource.close();
        activeEventSource = null;
        isStreamingResponse = false;
        store.stopStreaming();
        reject(error);
      }
    });
  });
}

/**
 * Send message synchronously (non-streaming, for non-Kokoro TTS)
 */
async function sendMessageSync(
  sessionId: string,
  text: string,
  settings: ReturnType<typeof useSettingsStore.getState>
): Promise<string | null> {
  const store = useConversationStore.getState();
  
  // Parse model string (e.g., "anthropic/claude-sonnet-4-20250514")
  const [providerID, modelID] = settings.model.split('/');
  
  // Send message to OpenCode
  const response = await fetch(`${serverUrl}/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: { providerID, modelID },
      parts: [
        { type: 'text', text: VOICE_MODE_PROMPT },
        { type: 'text', text },
      ],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  
  const data: PromptResponse = await response.json();
  
  // Extract text from response parts
  let fullResponse = '';
  
  for (const part of data.parts) {
    if (part.type === 'text' && part.text) {
      fullResponse += part.text;
    } else if (part.type === 'tool-invocation' && part.toolInvocation) {
      // Check if this requires confirmation
      const action = requiresConfirmation(
        part.toolInvocation.toolName,
        part.toolInvocation.args,
        {
          confirmFileWrites: settings.confirmFileWrites,
          confirmShellCommands: settings.confirmShellCommands,
          confirmGitOperations: settings.confirmGitOperations,
        }
      );
      
      if (action && action.requiresConfirmation) {
        // Store pending confirmation
        store.setPendingConfirmation({
          id: crypto.randomUUID(),
          toolName: action.toolName,
          toolArgs: part.toolInvocation.args,
          description: action.description,
          timestamp: Date.now(),
        });
        
        // Ask for confirmation
        await speak(describeAction(action));
        return null;
      }
    }
  }
  
  // Format response for voice
  const formatted = formatForVoice(fullResponse);
  
  // Add assistant message to store
  store.addMessage({
    role: 'assistant',
    content: fullResponse,
    spokenContent: formatted.spokenText,
    filesChanged: formatted.filesChanged,
  });
  
  // Speak the response
  await speak(formatted.spokenText);
  
  return fullResponse;
}

/**
 * Handle confirmation response
 */
export async function handleConfirmation(confirmed: boolean): Promise<void> {
  const store = useConversationStore.getState();
  const confirmation = store.pendingConfirmation;
  
  if (!confirmation) {
    return;
  }
  
  // Clear pending confirmation
  store.setPendingConfirmation(null);
  
  if (confirmed) {
    await speak("Okay, proceeding.");
    // TODO: Actually execute the pending action
    // This requires integration with OpenCode's permission system
  } else {
    await speak("Okay, I won't do that.");
  }
}

/**
 * Speak text using TTS
 */
export async function speak(text: string): Promise<void> {
  const settings = useSettingsStore.getState();
  const store = useConversationStore.getState();
  
  store.setVoiceState('speaking');
  
  try {
    await invoke('speak', {
      text,
      engine: settings.ttsEngine,
      voice: settings.ttsVoice,
      speed: settings.ttsSpeed,
    });
  } catch (error) {
    console.error('TTS error:', error);
  } finally {
    store.setVoiceState('idle');
  }
}

/**
 * Stop current speech and streaming
 */
export async function stopSpeaking(): Promise<void> {
  const store = useConversationStore.getState();
  
  // Clean up all streaming state
  resetStreamingState();
  store.stopStreaming();
  
  try {
    // Clear the audio queue and stop current playback
    await invoke('clear_audio_queue');
  } catch (error) {
    console.error('Error clearing audio queue:', error);
  }
  
  try {
    await invoke('stop_speaking');
  } catch (error) {
    console.error('Error stopping speech:', error);
  }
  
  store.setVoiceState('idle');
}

/**
 * Get available projects from OpenCode
 */
export async function getProjects(): Promise<{ path: string; name: string; id: string }[]> {
  try {
    const response = await fetch(`${serverUrl}/project`);
    if (!response.ok) {
      return [];
    }
    
    const projects: Project[] = await response.json();
    return projects.map(p => ({
      id: p.id,
      path: p.worktree,
      name: p.id === 'global' ? 'Global' : (p.worktree.split('/').pop() || p.id),
    }));
  } catch (e) {
    console.error('Failed to get projects:', e);
    return [];
  }
}

interface SessionInfo {
  id: string;
  projectID: string;
  directory: string;
  title?: string;
  time: {
    created: number;
    updated: number;
  };
}

/**
 * Get recent sessions to find working directories
 */
export async function getRecentSessions(): Promise<SessionInfo[]> {
  try {
    const response = await fetch(`${serverUrl}/session`);
    if (!response.ok) {
      return [];
    }
    return response.json();
  } catch (e) {
    console.error('Failed to get sessions:', e);
    return [];
  }
}

/**
 * Ask user which project to work on
 */
export async function askForProject(): Promise<void> {
  // First, try to get recent sessions to find a working directory
  const sessions = await getRecentSessions();
  
  if (sessions.length > 0) {
    // Use the most recently updated session's directory
    const mostRecent = sessions.sort((a, b) => b.time.updated - a.time.updated)[0];
    useConversationStore.getState().setProjectPath(mostRecent.directory);
    console.log(`Using directory from recent session: ${mostRecent.directory}`);
    // Don't speak on startup - just connect silently
    return;
  }
  
  // Fallback to projects
  const projects = await getProjects();
  
  if (projects.length === 0) {
    console.log('No projects found');
    return;
  }
  
  // Use the first project (likely 'global')
  useConversationStore.getState().setProjectPath(projects[0].path);
  console.log(`Using project: ${projects[0].name} at ${projects[0].path}`);
}

/**
 * Handle project selection by voice
 */
export async function selectProject(projectName: string): Promise<boolean> {
  const projects = await getProjects();
  
  // Fuzzy match project name
  const normalizedInput = projectName.toLowerCase();
  const match = projects.find(p => 
    p.name.toLowerCase().includes(normalizedInput) ||
    normalizedInput.includes(p.name.toLowerCase())
  );
  
  if (match) {
    useConversationStore.getState().setProjectPath(match.path);
    await speak(`Switching to ${match.name}.`);
    return true;
  }
  
  await speak(`I couldn't find a project called ${projectName}. Please try again.`);
  return false;
}

/**
 * Process voice input
 */
export async function processVoiceInput(text: string): Promise<void> {
  const store = useConversationStore.getState();
  
  // Check for pending confirmation
  if (store.pendingConfirmation) {
    const { parseConfirmationResponse } = await import('./confirmation');
    const response = parseConfirmationResponse(text);
    
    if (response === 'yes') {
      await handleConfirmation(true);
    } else if (response === 'no') {
      await handleConfirmation(false);
    } else {
      await speak("Sorry, I didn't understand. Please say yes or no.");
    }
    return;
  }
  
  // Check for project switch command
  if (text.toLowerCase().includes('switch to') || text.toLowerCase().includes('work on')) {
    const projectMatch = text.match(/(?:switch to|work on)\s+(.+)/i);
    if (projectMatch) {
      await selectProject(projectMatch[1]);
      return;
    }
  }
  
  // Regular message
  await sendMessage(text);
}
