import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { FloatingPanel } from './components/FloatingPanel';
import { Settings } from './components/Settings';
import './styles/globals.css';

type WindowLabel = 'main' | 'settings';

function App() {
  const [windowLabel, setWindowLabel] = useState<WindowLabel | null>(null);
  
  useEffect(() => {
    // Determine which window we're in
    const window = getCurrentWebviewWindow();
    setWindowLabel(window.label as WindowLabel);
  }, []);
  
  // Show nothing until we know which window we're in
  if (!windowLabel) {
    return null;
  }
  
  // Render the appropriate component based on window
  if (windowLabel === 'settings') {
    return <Settings />;
  }
  
  // Default is the floating panel (main window)
  return <FloatingPanel />;
}

export default App;
