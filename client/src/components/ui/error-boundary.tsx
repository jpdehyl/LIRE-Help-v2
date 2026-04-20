import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  // Label shown above the error, so when we wrap multiple screens we know
  // which one blew up in a screenshot.
  boundary: string;
  children: ReactNode;
  // Optional: return custom fallback UI instead of the default error card.
  fallback?: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

// Prevents a single broken component from taking down a whole page. In
// production, React errors are minified by default and surface as
// `Minified React error #31; visit reactjs.org/docs/error-decoder.html?...`
// in the console — which is useless when triaging from a screenshot. This
// boundary catches the throw and renders the full error message (and stack
// trace when available) directly into the page so operators can copy it into
// a bug report without opening devtools.
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.boundary}]`, error, info);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error);

    return (
      <div className="rounded-sm border border-error bg-[rgba(220,38,38,0.06)] p-4 font-body text-[13px] leading-[1.55] text-fg">
        <div className="font-mono text-[10px] uppercase tracking-eyebrow text-error">
          Render error · {this.props.boundary}
        </div>
        <p className="mt-2 font-semibold">{error.message}</p>
        {error.stack ? (
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xs bg-surface-2 p-2 font-mono text-[11px] leading-[1.5] text-fg-muted">
            {error.stack}
          </pre>
        ) : null}
      </div>
    );
  }
}
