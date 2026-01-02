import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * 
 * Catches React component errors and displays a fallback UI
 * Prevents the entire app from crashing
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="w-full max-w-md mb-4">
              <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-auto max-h-40">
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}












