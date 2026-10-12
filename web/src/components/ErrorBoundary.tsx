import { Component, type ReactNode } from 'react';

/** Shows a recoverable message instead of a blank screen if a page crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="card space-y-3">
          <p className="h2">Something went wrong on this screen</p>
          <p className="text-sm text-ink-700">Resetting the demo data usually fixes it.</p>
          <pre className="overflow-x-auto rounded bg-stone-100 p-2 text-xs">{this.state.error.message}</pre>
          <button className="btn-primary w-full" onClick={() => {
            try { localStorage.removeItem('ccp-prototype-v1'); } catch { /* storage unavailable */ }
            location.reload();
          }}>Reset demo and reload</button>
        </div>
      </div>
    );
  }
}
