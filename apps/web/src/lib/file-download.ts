import { apiClient } from './api-client';

function extractFilenameFromHeader(disposition: unknown, fallback: string): string {
  if (typeof disposition !== 'string') {
    return fallback;
  }
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const simpleMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return simpleMatch?.[1]?.trim() || fallback;
}

export async function downloadBlobFile(
  url: string,
  fallbackFilename: string,
  params?: Record<string, unknown>,
  mimeType = 'application/octet-stream',
): Promise<void> {
  const res = await apiClient.get<Blob>(url, {
    params,
    responseType: 'blob',
  });

  const blob =
    res.data instanceof Blob ? res.data : new Blob([res.data], { type: mimeType });
  const filename = extractFilenameFromHeader(
    res.headers?.['content-disposition'],
    fallbackFilename,
  );

  const objectUrl = window.URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }
}

