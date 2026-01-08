import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  X, 
  Mic, 
  Volume2, 
  Server, 
  Shield, 
  Layout,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useSettingsStore, type Settings as SettingsType, type SettingsStore } from '../stores/settings';
import { useVoiceOutput } from '../hooks/useVoiceOutput';
import { cn } from '../lib/utils';

type SettingsTab = 'voice-input' | 'voice-output' | 'opencode' | 'behavior' | 'ui';

export function Settings() {
  const settings = useSettingsStore();
  const { testVoice, getVoices } = useVoiceOutput();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('voice-input');
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // Load available voices when TTS engine changes
  useEffect(() => {
    const loadVoices = async () => {
      const voices = await getVoices();
      setAvailableVoices(voices);
    };
    loadVoices();
  }, [settings.ttsEngine, getVoices]);
  
  // Check OpenCode connection
  useEffect(() => {
    const checkConnection = async () => {
      setConnectionStatus('checking');
      try {
        const response = await fetch(`${settings.serverUrl}/global/health`);
        if (response.ok) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('error');
        }
      } catch {
        setConnectionStatus('error');
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, [settings.serverUrl]);
  
  const handleClose = async () => {
    await invoke('hide_settings');
  };
  
  const handleTestVoice = async () => {
    setIsTesting(true);
    await testVoice();
    setIsTesting(false);
  };
  
  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      settings.resetSettings();
    }
  };
  
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'voice-input', label: 'Voice Input', icon: <Mic className="w-4 h-4" /> },
    { id: 'voice-output', label: 'Voice Output', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'opencode', label: 'OpenCode', icon: <Server className="w-4 h-4" /> },
    { id: 'behavior', label: 'Behavior', icon: <Shield className="w-4 h-4" /> },
    { id: 'ui', label: 'Interface', icon: <Layout className="w-4 h-4" /> },
  ];
  
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Settings
        </h1>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'voice-input' && (
            <VoiceInputSettings settings={settings} />
          )}
          
          {activeTab === 'voice-output' && (
            <VoiceOutputSettings 
              settings={settings}
              availableVoices={availableVoices}
              onTestVoice={handleTestVoice}
              isTesting={isTesting}
            />
          )}
          
          {activeTab === 'opencode' && (
            <OpenCodeSettings 
              settings={settings}
              connectionStatus={connectionStatus}
            />
          )}
          
          {activeTab === 'behavior' && (
            <BehaviorSettings settings={settings} />
          )}
          
          {activeTab === 'ui' && (
            <UISettings settings={settings} />
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reset to Defaults
        </button>
        <span className="text-xs text-gray-400">
          OpenCode Talk v0.1.0
        </span>
      </div>
    </div>
  );
}

// Voice Input Settings
function VoiceInputSettings({ settings }: { settings: SettingsStore }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Voice Input
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              STT Engine
            </label>
            <select
              value={settings.sttEngine}
              onChange={(e) => settings.setSettings({ sttEngine: e.target.value as 'superwhisper' | 'macos' })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="superwhisper">SuperWhisper (recommended)</option>
              <option value="macos">macOS Dictation (fallback)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              SuperWhisper provides better accuracy and runs locally.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Push-to-Talk Hotkey
            </label>
            <input
              type="text"
              value={settings.pushToTalkHotkey}
              onChange={(e) => settings.setSettings({ pushToTalkHotkey: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Option+Space"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Continuous Mode Hotkey
            </label>
            <input
              type="text"
              value={settings.continuousModeHotkey}
              onChange={(e) => settings.setSettings({ continuousModeHotkey: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Option+Shift+Space"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Interrupt Hotkey
            </label>
            <input
              type="text"
              value={settings.interruptHotkey}
              onChange={(e) => settings.setSettings({ interruptHotkey: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Escape"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Voice Output Settings
function VoiceOutputSettings({ 
  settings, 
  availableVoices, 
  onTestVoice, 
  isTesting 
}: { 
  settings: SettingsStore;
  availableVoices: string[];
  onTestVoice: () => void;
  isTesting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Voice Output
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              TTS Engine
            </label>
            <select
              value={settings.ttsEngine}
              onChange={(e) => settings.setSettings({ 
                ttsEngine: e.target.value as SettingsType['ttsEngine'],
                ttsVoice: '', // Reset voice when engine changes
              })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="kokoro">Kokoro (highest quality, local)</option>
              <option value="piper">Piper (fast, local)</option>
              <option value="macos">macOS (fastest, basic)</option>
              <option value="openai">OpenAI TTS (cloud)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Voice
            </label>
            <select
              value={settings.ttsVoice}
              onChange={(e) => settings.setSettings({ ttsVoice: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableVoices.map((voice) => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Speed: {settings.ttsSpeed.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.ttsSpeed}
              onChange={(e) => settings.setSettings({ ttsSpeed: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>2.0x</span>
            </div>
          </div>
          
          {settings.ttsEngine === 'openai' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={settings.openaiApiKey || ''}
                onChange={(e) => settings.setSettings({ openaiApiKey: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="sk-..."
              />
            </div>
          )}
          
          <button
            onClick={onTestVoice}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                Test Voice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// OpenCode Settings
function OpenCodeSettings({ 
  settings, 
  connectionStatus 
}: { 
  settings: SettingsStore;
  connectionStatus: 'checking' | 'connected' | 'error';
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          OpenCode Connection
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.serverUrl}
                onChange={(e) => settings.setSettings({ serverUrl: e.target.value })}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="http://localhost:4096"
              />
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                {connectionStatus === 'checking' && (
                  <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                )}
                {connectionStatus === 'connected' && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                {connectionStatus === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={cn(
                  'text-xs font-medium',
                  connectionStatus === 'checking' && 'text-gray-400',
                  connectionStatus === 'connected' && 'text-green-500',
                  connectionStatus === 'error' && 'text-red-500'
                )}>
                  {connectionStatus === 'checking' && 'Checking...'}
                  {connectionStatus === 'connected' && 'Connected'}
                  {connectionStatus === 'error' && 'Error'}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model
            </label>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => settings.setSettings({ model: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="anthropic/claude-sonnet-4-20250514"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Agent
            </label>
            <input
              type="text"
              value={settings.agent}
              onChange={(e) => settings.setSettings({ agent: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Behavior Settings
function BehaviorSettings({ settings }: { settings: SettingsStore }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Confirmation Settings
        </h2>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.confirmFileWrites}
              onChange={(e) => settings.setSettings({ confirmFileWrites: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Require confirmation for file writes
            </span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.confirmShellCommands}
              onChange={(e) => settings.setSettings({ confirmShellCommands: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Require confirmation for shell commands
            </span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.confirmGitOperations}
              onChange={(e) => settings.setSettings({ confirmGitOperations: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Require confirmation for git operations
            </span>
          </label>
        </div>
      </div>
      
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Other Settings
        </h2>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.playSoundOnResponse}
              onChange={(e) => settings.setSettings({ playSoundOnResponse: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Play sound when response is ready
            </span>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoStartOnLogin}
              onChange={(e) => settings.setSettings({ autoStartOnLogin: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Start OpenCode Talk on login
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

// UI Settings
function UISettings({ settings }: { settings: SettingsStore }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Interface Settings
        </h2>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showFloatingPanel}
              onChange={(e) => settings.setSettings({ showFloatingPanel: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Show floating panel during conversation
            </span>
          </label>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Panel Position
            </label>
            <select
              value={settings.panelPosition}
              onChange={(e) => settings.setSettings({ 
                panelPosition: e.target.value as SettingsType['panelPosition'] 
              })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Panel Opacity: {Math.round(settings.panelOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={settings.panelOpacity}
              onChange={(e) => settings.setSettings({ panelOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
