import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Bindings } from '../types';
import { ApiError } from '../errors';

const keysets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export function isLocal(request: Request, env: Bindings) {
  return env.ENVIRONMENT === 'local' && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(request.url).hostname);
}
export async function verifyAccess(request: Request, env: Bindings, resolver?: JWTVerifyGetKey): Promise<string> {
  if (isLocal(request, env) && env.DEV_BYPASS_ACCESS === '1') return 'local@moon.nav';
  const team = env.ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.ACCESS_AUD?.trim();
  if (!team || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(team)) {
    throw new ApiError(503, 'ACCESS_NOT_CONFIGURED', '尚未配置 Cloudflare Access，请设置 Team Domain 与 AUD');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', '请通过 Cloudflare Access 登录后访问');
  const issuer = `https://${team}`;
  if (!resolver && !keysets.has(issuer)) {
    keysets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      cacheMaxAge: 60 * 60 * 1000, cooldownDuration: 30_000, timeoutDuration: 5000,
    }));
  }
  try {
    const { payload } = await jwtVerify(token, resolver ?? keysets.get(issuer)!, {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    if (typeof payload.email !== 'string' || !payload.email) throw new Error('Missing email');
    return payload.email;
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Access 身份无效或已过期，请重新登录');
  }
}
export const access = createMiddleware<AppEnv>(async (c, next) => {
  c.set('email', await verifyAccess(c.req.raw, c.env));
  await next();
});
