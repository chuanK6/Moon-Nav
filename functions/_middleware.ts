import { verifyAccess } from '../server/middleware/access';
import { ApiError } from '../server/errors';
import type { Bindings } from '../server/types';
import { privatePagePolicy } from '../shared/security';

// 即使 Access 的路径策略漏配，私有页面也不会直接返回 HTML。
export const onRequest: PagesFunction<Bindings> = async context => {
  const path = new URL(context.request.url).pathname;
  if (/^\/(admin|my)(\/|$)/.test(path)) {
    try { await verifyAccess(context.request, context.env); } catch (error) {
      const status = error instanceof ApiError ? error.status : 503;
      return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>需要 Access 身份验证</title><body><h1>此页面需要 Cloudflare Access</h1><p>请通过已配置 Access 的自定义域名登录。若仍无法访问，请检查 Team Domain、AUD 和路径策略。</p><a href="/">返回公开导航</a></body></html>`, {
        status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'" },
      });
    }
    const response = await context.next();
    const secured = new Response(response.body, response);
    secured.headers.set('Cache-Control', 'no-store');
    secured.headers.set('Content-Security-Policy', await privatePagePolicy());
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('X-Frame-Options', 'DENY');
    secured.headers.set('Referrer-Policy', 'no-referrer');
    secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return secured;
  }
  return context.next();
};
