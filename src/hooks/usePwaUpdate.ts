import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'

/**
 * Detects when a new service worker is available and shows a toast
 * prompting the user to reload and get the latest version.
 */
export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Poll for updates every 10 minutes instead of every 60 seconds to save bandwidth
        setInterval(() => {
          if (navigator.onLine) {
            r.update().catch(() => {})
          }
        }, 10 * 60 * 1000)

        // Check for updates when user returns to the tab
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) {
            r.update().catch(() => {})
          }
        })
      }
      console.log(`SW registered: ${swUrl}`)
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  useEffect(() => {
    if (!needRefresh) return

    toast.info('Versi baru tersedia', {
      description: 'Aplikasi telah diperbarui. Muat ulang untuk mendapatkan versi terbaru.',
      duration: Infinity,
      action: {
        label: 'Muat Ulang',
        onClick: () => updateServiceWorker(true),
      },
    })
  }, [needRefresh, updateServiceWorker])
}
