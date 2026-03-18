import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isQuotaError = this.state.errorMsg.toLowerCase().includes('quota');
      
      return (
        <div className="min-h-screen bg-royal-bg text-royal-text flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-royal-surface p-8 rounded-xl shadow-2xl max-w-md border border-royal-border">
            <h1 className="text-2xl font-serif text-royal-gold mb-4">
              {isQuotaError ? "Daily Limit Reached" : "Something went wrong"}
            </h1>
            <p className="text-royal-muted mb-6">
              {isQuotaError 
                ? "The application has reached its free daily database limit. Please try again tomorrow when the quota resets."
                : "An unexpected error occurred. Please refresh the page and try again."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-royal-gold text-royal-bg px-6 py-2 rounded-sm font-bold tracking-widest text-sm hover:bg-white transition-colors"
            >
              REFRESH PAGE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
