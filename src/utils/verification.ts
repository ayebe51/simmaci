export function getVerificationBaseUrl(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

export function getSkVerificationUrl(nomorSk: string): string {
  return `${getVerificationBaseUrl()}/verify/sk/${encodeURIComponent(nomorSk)}`;
}
