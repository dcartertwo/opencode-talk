import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, Loader2, Settings, MessageSquare, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useOpenCode } from '../hooks/useOpenCode';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useSettingsStore } from '../stores/settings';
import { useConversationStore } from '../stores/conversation';
import { cn, formatRelativeTime, formatHotkey } from '../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { StatusIndicator } from './StatusIndicator';

export function FloatingPanel() {
  const settings = useSettingsStore();
  const { 
    isStreaming, 
    isConnecting, 
    streamingMessageId,
    isHotkeyReady,
    hotkeyRegistered,
    hotkeyError,
    isTtsReady,
    ttsEngineReady,
    addToast,
  } = useConversationStore();
  const { 
    isConnected, 
    connectionError, 
    voiceState, 
    messages, 
    pendingConfirmation,
    projectPath,
    newConversation,
    stop,
  } = useOpenCode();
  const { simulateInput } = useVoiceInput();
  
  const [inputText, setInputText] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasShownReadyToast = useRef(false);
  
  // Derived state: app is "prepping" if connecting OR hotkey not registered
  const isPrepping = isConnecting || !isHotkeyReady;
  
  // Show "Ready for voice input" toast once when all systems are ready
  useEffect(() => {
    if (!isPrepping && isConnected && isHotkeyReady && !hasShownReadyToast.current) {
      hasShownReadyToast.current = true;
      addToast({
        type: 'success',
        message: 'Ready for voice input',
        duration: 2000,
      });
    }
  }, [isPrepping, isConnected, isHotkeyReady, addToast]);
  
  // Handle scroll to detect if user is at bottom
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    // Consider "at bottom" if within 50px of the bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  }, []);
  
  // Auto-scroll to bottom when messages change, but only if user is at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);
  
  // Handle manual text input (for testing)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    await simulateInput(inputText);
    setInputText('');
  };
  
  // Handle opening settings
  const handleOpenSettings = async () => {
    await invoke('show_settings');
  };
  
  // Get the visible messages (last 5)
  const visibleMessages = messages.slice(-5);
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Status Bar - compact info bar below native title */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* Spinner while prepping, status indicator when ready */}
          {isPrepping ? (
            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
          ) : (
            <StatusIndicator state={voiceState} />
          )}
          
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {isConnecting ? (
              <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />
            ) : isConnected ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[100px]" title={connectionError || undefined}>
              {isConnecting 
                ? 'Connecting...'
                : isConnected 
                  ? projectPath?.split('/').pop() || 'Connected'
                  : connectionError || 'Disconnected'
              }
            </span>
          </div>
          
          {/* Hotkey status - show after connected */}
          {isConnected && (
            <>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              {hotkeyError ? (
                <span 
                  className="text-xs text-red-500 flex items-center gap-1 cursor-help"
                  title={hotkeyError}
                >
                  {formatHotkey(settings.pushToTalkHotkey)}
                  <AlertCircle className="w-3 h-3" />
                </span>
              ) : isHotkeyReady ? (
                <span className="text-xs text-green-600 dark:text-green-400">
                  {formatHotkey(hotkeyRegistered || settings.pushToTalkHotkey)} ready
                </span>
              ) : (
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  {formatHotkey(settings.pushToTalkHotkey)}...
                </span>
              )}
            </>
          )}
          
          {/* TTS status - show after hotkey ready */}
          {isConnected && isHotkeyReady && isTtsReady && ttsEngineReady && (
            <>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {ttsEngineReady}
              </span>
            </>
          )}
        </div>
        
        <button
          onClick={handleOpenSettings}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">
              Press {formatHotkey(settings.pushToTalkHotkey)} to speak
            </p>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex flex-col gap-1',
                message.role === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2',
                  message.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md',
                  message.isIncomplete && 'border-2 border-yellow-400 dark:border-yellow-600'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">
                  {/* Always show content - spokenContent is only for TTS, not display */}
                  {message.content || (
                    // Show placeholder for empty streaming message
                    isStreaming && message.id === streamingMessageId ? (
                      <span className="text-gray-400 dark:text-gray-500">...</span>
                    ) : null
                  )}
                  {/* Show typing cursor on streaming message */}
                  {isStreaming && message.id === streamingMessageId && (
                    <span className="typing-cursor" />
                  )}
                </p>
                {message.isIncomplete && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Response may be incomplete
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 px-2">
                {formatRelativeTime(message.timestamp)}
              </span>
            </div>
          ))
        )}
        
        {/* Processing indicator (only show when not streaming yet) */}
        {voiceState === 'processing' && !isStreaming && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Confirmation Dialog */}
      {pendingConfirmation && (
        <ConfirmDialog confirmation={pendingConfirmation} />
      )}
      
      {/* Input Area */}
      <div className="border-t border-gray-200/50 dark:border-gray-700/50 p-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                voiceState === 'listening' 
                  ? 'Listening...' 
                  : `Type or press ${formatHotkey(settings.pushToTalkHotkey)} to speak`
              }
              disabled={voiceState !== 'idle'}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
            />
          </div>
          
          <button
            type="button"
            onClick={voiceState === 'speaking' ? stop : undefined}
            className={cn(
              'p-2.5 rounded-full transition-all',
              voiceState === 'idle' && 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700',
              voiceState === 'listening' && 'bg-red-500 text-white animate-pulse',
              voiceState === 'processing' && 'bg-yellow-500 text-white',
              voiceState === 'speaking' && 'bg-green-500 text-white hover:bg-green-600'
            )}
            title={
              voiceState === 'idle' 
                ? `Press ${formatHotkey(settings.pushToTalkHotkey)} to speak`
                : voiceState === 'speaking'
                ? 'Click to stop'
                : voiceState
            }
          >
            {voiceState === 'idle' && <Mic className="w-5 h-5" />}
            {voiceState === 'listening' && <Mic className="w-5 h-5" />}
            {voiceState === 'processing' && <Loader2 className="w-5 h-5 animate-spin" />}
            {voiceState === 'speaking' && <Volume2 className="w-5 h-5" />}
          </button>
        </form>
        
        {/* Quick actions */}
        <div className="flex items-center justify-between mt-2 px-2 text-xs text-gray-400 dark:text-gray-500">
          <button
            onClick={newConversation}
            className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            New conversation
          </button>
          <span>
            {formatHotkey(settings.interruptHotkey)} to interrupt
          </span>
        </div>
      </div>
    </div>
  );
}
