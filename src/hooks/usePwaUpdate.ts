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
      // Poll for updates every 60 seconds so long-running sessions catch deploys
      if (r) {
        setInterval(() => {
          r.update()
        }, 60 * 1000)
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
