import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Page crash caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // A stale-chunk error after a new deploy isn't a real "page crash" — the fix is
      // simply to reload and fetch the fresh build. Show a reload-first message for it.
      const msg = this.state.error?.message || '';
      const isChunkError = /chunk|dynamically imported module|importing a module script failed|failed to fetch/i.test(msg);
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {isChunkError ? 'नया version उपलब्ध है / New version available' : 'इस पेज में त्रुटि हुई / Page Error'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isChunkError
                ? 'ऐप अपडेट हो गया है — कृपया पेज reload करें। आपका डेटा सुरक्षित है।'
                : (msg || 'An unexpected error occurred')}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                Reload / पेज दोबारा लोड करें
              </button>
              {!isChunkError && (
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted"
                >
                  पुनः प्रयास / Retry
                </button>
              )}
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted"
              >
                Dashboard पर जाएं
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
