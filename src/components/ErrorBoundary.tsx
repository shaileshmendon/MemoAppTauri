import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white px-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm text-center max-w-md mb-6 leading-relaxed">
            {this.state.error.message || "An unexpected error occurred. Your data is safe."}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition-colors">
            <RefreshCw size={15} />
            Restart App
          </button>
          <details className="mt-6 max-w-lg w-full">
            <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400">
              Technical details
            </summary>
            <pre className="mt-2 text-xs text-slate-500 bg-black/30 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
