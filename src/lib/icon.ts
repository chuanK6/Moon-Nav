export const FAVICON_SERVICE = 'https://www.google.com/s2/favicons';
export const ICON_COLORS = ['#7466c4', '#427d92', '#508268', '#b37e45', '#b46a83', '#667db0', '#8a7790'];
export function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
export function domainColor(url: string) {
  let hash = 0;
  for (const character of hostname(url)) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return ICON_COLORS[(hash >>> 0) % ICON_COLORS.length];
}
export function faviconUrl(url: string) {
  return `${FAVICON_SERVICE}?domain=${encodeURIComponent(hostname(url))}&sz=64`;
}
