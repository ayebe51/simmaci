import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
        if (this.props.fallback) {
            return this.props.fallback;
        }
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
          {/* Icon with pulse animation */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-30" />
            <div className="relative rounded-full bg-gradient-to-br from-red-100 to-red-200 p-4 shadow-lg shadow-red-100">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              Oops, Terjadi Kesalahan
            </h2>
            <p className="max-w-lg text-gray-500 leading-relaxed">
              Halaman mengalami kesalahan teknis. Silakan muat ulang halaman atau
              kembali ke dashboard.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap justify-center">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Muat Ulang
            </Button>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.href = "/dashboard";
              }}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Ke Dashboard
            </Button>
          </div>

          {/* Collapsible error details */}
          {this.state.error && (
            <div className="mt-4 w-full max-w-xl">
              <button
                onClick={() =>
                  this.setState((s) => ({ showDetails: !s.showDetails }))
                }
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Bug className="h-3.5 w-3.5" />
                {this.state.showDetails ? "Sembunyikan" : "Tampilkan"} Detail Teknis
              </button>

              {this.state.showDetails && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left">
                  <p className="text-xs font-semibold text-red-600 font-mono">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-2 text-[10px] text-gray-500 font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
