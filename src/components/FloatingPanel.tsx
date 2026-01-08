import { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, Loader2, Settings, MessageSquare } from 'lucide-react';
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
  const { streamingText, isStreaming } = useConversationStore();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages or streaming text changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);
  
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
          <StatusIndicator state={voiceState} />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {isConnected 
              ? projectPath?.split('/').pop() || 'Connected'
              : connectionError || 'Disconnected'
            }
          </span>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">
                  {message.spokenContent || message.content}
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 px-2">
                {formatRelativeTime(message.timestamp)}
              </span>
            </div>
          ))
        )}
        
        {/* Streaming response - show as it arrives */}
        {isStreaming && streamingText && (
          <div className="flex flex-col gap-1 items-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md">
              <p className="text-sm whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-text-bottom" />
              </p>
            </div>
          </div>
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
