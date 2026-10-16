import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../functions/_middleware';
import type { Bindings } from '../server/types';
import { THEME_SCRIPT } from '../shared/security';

function context(path: string, env: Partial<Bindings> = {}) {
  const next = vi.fn(async () => new Response(`<script>${THEME_SCRIPT}</script>`, { headers: { 'Content-Type': 'text/html' } }));
  return {
    next,
    ctx: { request: new Request(`http://127.0.0.1:8788${path}`), env, next } as unknown as Parameters<typeof onRequest>[0],
  };
}
describe('Pages 私有页面入口', () => {
  it.each(['/admin', '/admin/nested', '/my', '/my/nested'])('未通过 Access 时不返回 %s 的前端 HTML', async path => {
    const { ctx, next } = context(path, { ACCESS_TEAM_DOMAIN: 'moon.cloudflareaccess.com', ACCESS_AUD: 'aud' });
    const response = await onRequest(ctx);
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(next).not.toHaveBeenCalled();
  });
  it('通过身份校验后，私有 HTML 具有不可缓存和 CSP 响应头', async () => {
    const { ctx, next } = context('/my', { ENVIRONMENT: 'local', DEV_BYPASS_ACCESS: '1' });
    const response = await onRequest(ctx);
    expect(next).toHaveBeenCalledOnce();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self' 'sha256-");
    expect(response.headers.get('Content-Security-Policy')).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
  it('公共页与 API 继续交给各自处理程序', async () => {
    for (const path of ['/', '/api/admin/sites', '/api/public/sites']) {
      const { ctx, next } = context(path);
      expect((await onRequest(ctx)).status).toBe(200);
      expect(next).toHaveBeenCalledOnce();
    }
  });
});
