/**
 * SkeletonPage — CSS-only animated skeleton placeholder for lazy-loaded pages.
 * Uses Tailwind's `animate-pulse` for the shimmer effect.
 * No additional JS library imports required.
 *
 * Approximates the typical SIMMACI page layout:
 * - Top header bar
 * - Sidebar navigation
 * - Main content area with cards/tables
 */
export default function SkeletonPage() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex w-64 flex-col gap-4 border-r border-gray-200 bg-white p-4">
        {/* Logo placeholder */}
        <div className="h-8 w-32 rounded bg-gray-200 animate-pulse" />

        {/* Nav items */}
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-5 rounded bg-gray-200 animate-pulse" />
              <div
                className="h-4 rounded bg-gray-200 animate-pulse"
                style={{ width: `${60 + (i % 3) * 20}%` }}
              />
            </div>
          ))}
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Page title */}
          <div className="h-7 w-48 rounded bg-gray-200 animate-pulse mb-6" />

          {/* Stats cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="h-4 w-20 rounded bg-gray-200 animate-pulse mb-2" />
                <div className="h-6 w-16 rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Table/content area */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {/* Table header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
            </div>

            {/* Table rows */}
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-8 rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 flex-1 rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                  <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
