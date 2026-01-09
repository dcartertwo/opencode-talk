import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { FloatingPanel } from './components/FloatingPanel';
import { Settings } from './components/Settings';
import { ToastContainer } from './components/Toast';
import './styles/globals.css';

type WindowLabel = 'main' | 'settings';

function App() {
  const [windowLabel, setWindowLabel] = useState<WindowLabel | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Determine which window we're in
    try {
      const window = getCurrentWebviewWindow();
      console.log('Window label:', window.label);
      setWindowLabel((window.label as WindowLabel) || 'main');
    } catch (e) {
      console.error('Failed to get window label:', e);
      setError(String(e));
      // Default to main window on error
      setWindowLabel('main');
    }
  }, []);
  
  // Show loading state until we know which window we're in
  if (!windowLabel) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }
  
  // Log error if there was one (but still render the app)
  if (error) {
    console.error('App initialization error:', error);
  }
  
  // Render the appropriate component based on window
  if (windowLabel === 'settings') {
    return (
      <>
        <Settings />
        <ToastContainer />
      </>
    );
  }
  
  // Default is the floating panel (main window)
  return (
    <>
      <FloatingPanel />
      <ToastContainer />
    </>
  );
}

export default App;
