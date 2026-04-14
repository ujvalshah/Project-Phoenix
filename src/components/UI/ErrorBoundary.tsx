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

      // Default fallback must clear the fixed Header (h-14 lg:h-16 = 56/64px)
      // since it may replace an entire page, where HeaderSpacer would otherwise
      // reserve that space. See src/LAYOUT_ARCHITECTURE.md.
      return (
        <div className="w-full min-h-[60vh] pt-20 lg:pt-24 pb-12 px-4 flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
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















