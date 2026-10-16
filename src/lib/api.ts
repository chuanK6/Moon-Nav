export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    cache: path.startsWith('/admin') ? 'no-store' : 'default',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const type = response.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) {
    throw new ApiError('会话可能已过期，请刷新页面通过 Cloudflare Access 登录', response.status, 'ACCESS_REQUIRED');
  }
  const payload = await response.json() as { data?: T; error?: { code: string; message: string } };
  if (!response.ok || payload.error) throw new ApiError(payload.error?.message || '请求失败，请稍后重试', response.status, payload.error?.code || 'REQUEST_FAILED');
  return payload.data as T;
}
export const write = <T>(path: string, method: string, body: unknown = {}) => api<T>(path, { method, body: JSON.stringify(body) });
export const message = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试';
