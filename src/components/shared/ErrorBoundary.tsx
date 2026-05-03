import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center bg-warm/30 p-4">
            <div className="bg-white rounded-xl border border-navy/10 p-8 max-w-md w-full text-center">
              <h1 className="text-xl font-display text-navy mb-2">
                Something went wrong
              </h1>
              <p className="text-sm text-mist mb-6">
                An unexpected error occurred. Please refresh the page to
                continue.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm bg-teal text-white px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
