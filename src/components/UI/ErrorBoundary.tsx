import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { recordError } from '@/observability/telemetry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    recordError({ error, info: errorInfo, source: 'ErrorBoundary' });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-12 h-12 mb-4 text-slate-400 dark:text-slate-500" />
          <p className="text-sm font-medium mb-2">Something went wrong displaying this content.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}












