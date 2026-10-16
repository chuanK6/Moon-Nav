import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';
import { isLocal } from './access';
import { ApiError } from '../errors';

export const origin = createMiddleware<AppEnv>(async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const allowed = new Set<string>();
    if (c.env.SITE_ORIGIN) {
      try { allowed.add(new URL(c.env.SITE_ORIGIN).origin); } catch { /* 拒绝错误配置 */ }
    }
    if (isLocal(c.req.raw, c.env)) {
      allowed.add(new URL(c.req.url).origin);
      if (c.env.DEV_FRONTEND_ORIGIN) allowed.add(c.env.DEV_FRONTEND_ORIGIN);
    }
    const incoming = c.req.header('Origin');
    if (!incoming || !allowed.has(incoming)) throw new ApiError(403, 'ORIGIN_MISMATCH', '请求来源不被允许，请从本站操作');
    if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) {
      throw new ApiError(415, 'JSON_REQUIRED', '请求需要使用 application/json');
    }
  }
  await next();
});
