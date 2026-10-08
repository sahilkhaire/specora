import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  /** Short description of what failed, e.g. "this API". */
  scope?: string;
  /** Extra recovery actions shown next to Reload. */
  actions?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Keeps a render failure in one area from blanking the whole app. Reset it by changing its `key`. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[specora] render error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="ui-empty-state" role="alert">
        <h2>Something went wrong displaying {this.props.scope ?? "this page"}</h2>
        <p>
          The specification may contain a structure Specora doesn't handle yet. Your data is still saved in this
          browser.
        </p>
        <div className="ui-empty-state-actions">
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          {this.props.actions}
        </div>
        <details className="error-boundary-details">
          <summary>Technical details</summary>
          <pre tabIndex={0}>{error.stack ?? error.message}</pre>
        </details>
      </div>
    );
  }
}
