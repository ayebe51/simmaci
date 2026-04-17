import { useQuery } from '@tanstack/react-query'
import { skTemplateApi } from '@/lib/api'
import axios from 'axios'

interface UseSkTemplateResult {
  templateUrl: string | null
  isLoading: boolean
  error: string | null
}

/**
 * Resolves the active SK template URL for a given sk_type.
 *
 * - Returns the uploaded template's `file_url` when an active template exists.
 * - Falls back to the bundled static template on HTTP 404 or when no active template is found.
 * - Sets `error` (and returns `templateUrl: null`) on 5xx or network errors.
 */
export function useSkTemplate(skType: string): UseSkTemplateResult {
  const fallbackUrl = `/templates/sk-${skType}-template.docx`

  const { data, isLoading, error } = useQuery({
    queryKey: ['sk-template-active', skType],
    queryFn: () => skTemplateApi.getActive(skType),
    retry: (failureCount, err) => {
      // Don't retry on 404 — that's an expected "no active template" state
      if (axios.isAxiosError(err) && err.response?.status === 404) return false
      return failureCount < 2
    },
  })

  // 404 or no active template → silent fallback
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    return { templateUrl: fallbackUrl, isLoading: false, error: null }
  }

  // 5xx or network error → surface error, no URL
  if (error) {
    const isNetworkError = axios.isAxiosError(error) && !error.response
    const status = axios.isAxiosError(error) ? error.response?.status : null
    const message = isNetworkError
      ? `Gagal mengunduh template ${skType}. Periksa koneksi atau hubungi administrator.`
      : `Gagal mengunduh template ${skType} (error ${status}). Periksa koneksi atau hubungi administrator.`
    return { templateUrl: null, isLoading: false, error: message }
  }

  // Success — use the active template's file_url, fall back if somehow null
  const templateUrl = data?.file_url ?? fallbackUrl

  return { templateUrl, isLoading, error: null }
}
