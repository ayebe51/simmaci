import { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary that specifically catches dynamic import (chunk load) failures.
 * Displays a retry button that re-attempts the import without a full page reload.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Only handle chunk load errors
    if (isChunkLoadError(error)) {
      return { hasError: true, error }
    }
    // Re-throw non-chunk errors so they propagate to parent boundaries
    throw error
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ChunkErrorBoundary] Dynamic import failed:", error, errorInfo)
  }

  private handleRetry = () => {
    // Clear the error state — this triggers a re-render which re-attempts
    // the lazy import (React.lazy will retry the dynamic import() call)
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center px-4">
          <div className="rounded-full bg-amber-100 p-3">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Gagal memuat halaman
            </h3>
            <p className="text-sm text-gray-500 max-w-md">
              Terjadi kesalahan saat memuat halaman. Periksa koneksi internet Anda dan coba lagi.
            </p>
          </div>

          <Button
            onClick={this.handleRetry}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Detects whether an error is a chunk/dynamic-import load failure.
 * Covers Webpack ChunkLoadError, Vite dynamic import failures,
 * and generic network errors from import().
 */
function isChunkLoadError(error: Error): boolean {
  // Webpack-style ChunkLoadError
  if (error.name === "ChunkLoadError") return true

  // Vite/ESM dynamic import failures
  const message = error.message || ""
  if (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("Loading CSS chunk")
  ) {
    return true
  }

  // TypeError from network failures during import
  if (error instanceof TypeError && message.includes("Failed to fetch")) {
    return true
  }

  return false
}
