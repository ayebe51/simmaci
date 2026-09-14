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
        // Poll for updates every 45 seconds during live event operations
        setInterval(() => {
          if (navigator.onLine) {
            r.update().catch(() => {})
          }
        }, 45 * 1000)

        // Check for updates whenever user unlocks phone or switches back to tab
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

    // If user is not actively typing into an input/textarea, auto-update seamlessly!
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')
    if (!isTyping) {
      console.info('[PWA] Versi baru terdeteksi. Memuat versi terbaru secara otomatis...')
      updateServiceWorker(true)
    } else {
      toast.info('Pembaruan Sistem Tersedia', {
        description: 'Pembaruan akan aktif otomatis, atau klik tombol di bawah.',
        duration: 10000,
        action: {
          label: 'Perbarui Sekarang',
          onClick: () => updateServiceWorker(true),
        },
      })
    }
  }, [needRefresh, updateServiceWorker])
}
