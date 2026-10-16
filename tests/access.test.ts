import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { isLocal, verifyAccess } from '../server/middleware/access';
import type { Bindings } from '../server/types';

const production = { ACCESS_TEAM_DOMAIN: 'moon.cloudflareaccess.com', ACCESS_AUD: 'test-audience', ENVIRONMENT: 'production' } as Bindings;
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let resolver: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  pair = await generateKeyPair('RS256', { extractable: true });
  resolver = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'test-key', alg: 'RS256' }] });
});
async function token(overrides: { aud?: string; iss?: string; exp?: number; email?: string } = {}) {
  return new SignJWT({ email: overrides.email ?? 'moon@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setSubject('user-id')
    .setAudience(overrides.aud ?? 'test-audience').setIssuer(overrides.iss ?? 'https://moon.cloudflareaccess.com')
    .setIssuedAt().setExpirationTime(overrides.exp ?? Math.floor(Date.now() / 1000) + 3600).sign(pair.privateKey);
}
const request = (jwt: string) => new Request('https://nav.example.com/api/admin/me', { headers: { 'Cf-Access-Jwt-Assertion': jwt } });
describe('Access 身份验证', () => {
  it('验证真实 RSA 签名并返回邮箱', async () => {
    await expect(verifyAccess(request(await token()), production, resolver)).resolves.toBe('moon@example.com');
  });
  it('拒绝缺失 JWT', async () => {
    await expect(verifyAccess(new Request('https://nav.example.com/api/admin/me'), production, resolver)).rejects.toMatchObject({ status: 401 });
  });
  it.each([{ aud: 'wrong' }, { iss: 'https://wrong.cloudflareaccess.com' }, { exp: 1 }])('拒绝错误 aud、iss 或过期 JWT %j', async overrides => {
    await expect(verifyAccess(request(await token(overrides)), production, resolver)).rejects.toMatchObject({ status: 401 });
  });
  it('拒绝伪造签名', async () => {
    const jwt = await token();
    const parts = jwt.split('.');
    parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
    await expect(verifyAccess(request(parts.join('.')), production, resolver)).rejects.toMatchObject({ status: 401 });
  });
  it('生产与预览域名不能通过误配本地变量绕过身份验证', async () => {
    const env = { ...production, ENVIRONMENT: 'local', DEV_BYPASS_ACCESS: '1' };
    await expect(verifyAccess(new Request('https://preview.pages.dev/api/admin/me'), env, resolver)).rejects.toMatchObject({ status: 401 });
    expect(isLocal(new Request('http://localhost.evil.com/admin'), env)).toBe(false);
    await expect(verifyAccess(new Request('http://127.0.0.1/api/admin/me'), { ...env, ENVIRONMENT: 'production' }, resolver)).rejects.toMatchObject({ status: 401 });
    await expect(verifyAccess(new Request('http://127.0.0.1/api/admin/me'), env)).resolves.toBe('local@moon.nav');
  });
  it('缺少 Access 配置时拒绝开放', async () => {
    await expect(verifyAccess(request('any'), {} as Bindings, resolver)).rejects.toMatchObject({ status: 503 });
  });
});
