import { useEffect, useState, Component, type ReactNode } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { FloatingPanel } from './components/FloatingPanel';
import { Settings } from './components/Settings';
import { ToastContainer } from './components/Toast';
import './styles/globals.css';

// Error boundary to catch React errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 text-red-800">
          <h1 className="font-bold">Something went wrong</h1>
          <pre className="text-xs mt-2 whitespace-pre-wrap">
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

type WindowLabel = 'main' | 'settings';

function App() {
  const [windowLabel, setWindowLabel] = useState<WindowLabel | null>(null);
  
  useEffect(() => {
    // Determine which window we're in
    const window = getCurrentWebviewWindow();
    console.log('Window label:', window.label);
    setWindowLabel(window.label as WindowLabel);
  }, []);
  
  // Show nothing until we know which window we're in
  if (!windowLabel) {
    return <div className="p-4">Loading...</div>;
  }
  
  // Render the appropriate component based on window
  if (windowLabel === 'settings') {
    return (
      <ErrorBoundary>
        <Settings />
        <ToastContainer />
      </ErrorBoundary>
    );
  }
  
  // Default is the floating panel (main window)
  return (
    <ErrorBoundary>
      <FloatingPanel />
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;
