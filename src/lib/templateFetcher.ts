import { skTemplateApi } from './api';

/**
 * Mapping of SK type identifiers to bundled static fallback templates in /public/templates/
 */
export const STATIC_SK_TEMPLATES: Record<string, string> = {
  gty: '/templates/sk-gty-template.docx',
  sk_template_gty: '/templates/sk-gty-template.docx',
  gtt: '/templates/sk-gtt-template.docx',
  sk_template_gtt: '/templates/sk-gtt-template.docx',
  tendik: '/templates/sk-tendik-template.docx',
  sk_template_tendik: '/templates/sk-tendik-template.docx',
  kamad: '/templates/sk-kamad non pns-template.docx',
  sk_template_kamad: '/templates/sk-kamad non pns-template.docx',
  kamad_nonpns: '/templates/sk-kamad non pns-template.docx',
  sk_template_kamad_nonpns: '/templates/sk-kamad non pns-template.docx',
  kamad_pns: '/templates/sk-kamad pns-template.docx',
  sk_template_kamad_pns: '/templates/sk-kamad pns-template.docx',
  kamad_plt: '/templates/sk-plt kamad-template.docx',
  sk_template_kamad_plt: '/templates/sk-plt kamad-template.docx',
  pemberhentian: '/templates/TEMPLATE SK PEMBERHENTIAN.docx',
  sk_template_pemberhentian: '/templates/TEMPLATE SK PEMBERHENTIAN.docx',
};

/**
 * Converts an ArrayBuffer into a binary string for PizZip / docxtemplater
 */
export function arrayBufferToBinary(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

/**
 * Fetches a template file as an ArrayBuffer and binary string with Bearer auth header.
 * If the primary URL fails (e.g. 401, 403, 404, or network error),
 * it seamlessly falls back to the static template URL.
 */
export async function fetchTemplateBinary(
  primaryUrl: string,
  fallbackUrl?: string
): Promise<{ arrayBuffer: ArrayBuffer; binary: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const tryFetch = async (url: string) => {
    const headers: Record<string, string> = {};
    // Attach Bearer token for internal API/minio/storage routes or relative paths
    const isInternal =
      url.startsWith('/') ||
      (typeof window !== 'undefined' && url.includes(window.location.host)) ||
      url.includes('/api/');
    if (token && isInternal) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return {
      arrayBuffer,
      binary: arrayBufferToBinary(arrayBuffer),
    };
  };

  try {
    return await tryFetch(primaryUrl);
  } catch (primaryErr) {
    if (fallbackUrl && fallbackUrl !== primaryUrl) {
      console.warn(
        `[TemplateFetcher] Gagal unduh template dari (${primaryUrl}):`,
        primaryErr,
        `Mencoba fallback ke template statis bawaan: ${fallbackUrl}`
      );
      try {
        return await tryFetch(fallbackUrl);
      } catch (fallbackErr) {
        throw new Error(
          `Gagal mengunduh template SK dari server maupun fallback lokal (${
            fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
          })`
        );
      }
    }
    throw primaryErr;
  }
}

/**
 * Resolves and downloads the active SK template for a given sk_type with complete resilience:
 * 1. Queries skTemplateApi.getActive(skType) to get active template metadata.
 * 2. Attempts download via authorized endpoint GET /sk-templates/{id}/download (works for all roles).
 * 3. Falls back to template file_url if available.
 * 4. Falls back to static bundled template in /templates/ if server storage is unavailable.
 */
export async function getActiveSkTemplateBinary(
  skType: string
): Promise<{ arrayBuffer: ArrayBuffer; binary: string }> {
  const cleanType = skType.replace(/^sk_template_/, '');
  const staticFallback =
    STATIC_SK_TEMPLATES[skType] ||
    STATIC_SK_TEMPLATES[cleanType] ||
    `/templates/sk-${cleanType}-template.docx`;

  try {
    const activeRes = await skTemplateApi.getActive(cleanType);
    const templateData = activeRes?.data ?? activeRes;

    // 1. Try downloading by template ID via API endpoint (Sanctum authenticated, open to all roles)
    if (templateData?.id) {
      try {
        const buffer = await skTemplateApi.downloadArrayBuffer(templateData.id);
        return {
          arrayBuffer: buffer,
          binary: arrayBufferToBinary(buffer),
        };
      } catch (idErr) {
        console.warn(
          `[TemplateFetcher] Unduh template via ID (${templateData.id}) gagal, mencoba via file_url`,
          idErr
        );
      }
    }

    // 2. Try downloading via file_url (MinIO proxy / storage) with Bearer token
    if (templateData?.file_url) {
      try {
        return await fetchTemplateBinary(templateData.file_url, staticFallback);
      } catch (urlErr) {
        console.warn(
          `[TemplateFetcher] Unduh template via file_url gagal, menggunakan static fallback`,
          urlErr
        );
      }
    }
  } catch {
    // getActive returned 404 or failed — fall back to static template
  }

  // 3. Guaranteed fallback to bundled static file
  return await fetchTemplateBinary(staticFallback);
}
