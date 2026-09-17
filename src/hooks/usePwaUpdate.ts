import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { versionManager } from '@/lib/versionManager'

/**
 * Detects when a new service worker is available and coordinates with versionManager.
 * Does NOT aggressively reload the page while user is actively working.
 */
export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Poll for updates every 60 seconds during event operations
        setInterval(() => {
          if (navigator.onLine) {
            r.update().catch(() => {})
          }
        }, 60 * 1000)

        // Check for updates whenever user unlocks phone or switches back to tab
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) {
            r.update().catch(() => {})
            versionManager.checkNow()
          }
        })
      }
      console.log(`[PWA] Service Worker registered: ${swUrl}`)
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error)
    },
  })

  useEffect(() => {
    if (!needRefresh) return

    // Trigger version manager check to notify all listeners and UI
    versionManager.checkNow()

    // If user is completely idle and not busy, prepare the service worker
    if (!versionManager.isUserBusy()) {
      console.info('[PWA] Service worker update available and waiting.')
    }
  }, [needRefresh, updateServiceWorker])
}
