/**
 * Triggers a browser download from a Blob response.
 *
 * Creates a temporary object URL, attaches it to an anchor element,
 * triggers the download, then revokes the URL to free memory.
 *
 * @param blob - The file blob to download
 * @param filename - The filename for the downloaded file
 */
export function downloadExcel(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
