export const PUBLIC_PATHS = ['/api/public/sites', '/api/public/categories'];
function supported(request: Request) {
  const host = new URL(request.url).hostname;
  return !host.endsWith('.pages.dev') && !['localhost', '127.0.0.1', '[::1]'].includes(host);
}
export function publicCache(): Cache | undefined {
  return typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
}
export function cacheKey(request: Request) {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}
export async function getPublicCache(request: Request) {
  if (!supported(request)) return undefined;
  try { return await publicCache()?.match(cacheKey(request)); } catch { return undefined; }
}
export async function putPublicCache(request: Request, response: Response) {
  if (!supported(request)) return;
  try { await publicCache()?.put(cacheKey(request), response); } catch { /* 缓存不可用时继续提供数据库结果 */ }
}
export async function invalidatePublicCache(origin: string) {
  const cache = publicCache();
  if (!cache) return;
  await Promise.allSettled(PUBLIC_PATHS.map(path => cache.delete(new Request(new URL(path, origin)))));
}
