import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
        if (this.props.fallback) {
            return this.props.fallback;
        }
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          <h2 className="text-xl font-semibold text-gray-900">Terjadi Kesalahan</h2>
          <p className="max-w-md text-gray-500">
            {this.state.error?.message || "Terjadi kesalahan yang tidak terduga pada halaman ini."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
                Muat Ulang Halaman
            </Button>
            <Button onClick={() => this.setState({ hasError: false, error: null })}>
                Coba Lagi
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
