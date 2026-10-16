import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { app } from '../server/app';
import { backupSchema, type Backup, type Category, type ImportPreview, type Site } from '../shared/schema';
import type { Bindings } from '../server/types';
import { importStatements } from '../server/import';
import { invalidatePublicCache } from '../server/cache';

const base = 'http://127.0.0.1:8788';
async function call(path: string, method = 'GET', body?: unknown, overrides: Partial<Bindings> = {}, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`${base}/api${path}`, {
    method, headers: { Origin: base, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: env.DB, SITE_ORIGIN: base, ENVIRONMENT: 'local', DEV_BYPASS_ACCESS: '1', ...overrides }, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
async function data<T>(response: Response): Promise<T> {
  const payload = await response.json() as { data: T; error?: unknown };
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload.data;
}
const category = async (name = '工具') => data<Category>(await call('/admin/categories', 'POST', { name }));
const site = async (props: Record<string, unknown> = {}) => data<Site>(await call('/admin/sites', 'POST', { name: 'Test', url: 'https://example.com', ...props }));
const inputBackup = (): Backup => backupSchema.parse({ version: 1, categories: [{ id: 10, name: '导入分类', sort_order: 2 }], sites: [{ id: 22, name: '导入网站', url: 'https://import.example.com', category_id: 10, icon_type: 'emoji', icon_value: '🌙', visibility: 'private' }] });
async function importData(backup: Backup, mode: 'merge' | 'replace') {
  const preview = await data<ImportPreview>(await call('/admin/import', 'POST', { backup, mode }));
  return call('/admin/import', 'POST', { backup, mode, preview: false, revision: preview.revision });
}

describe('D1 接口与隐私边界', () => {
  it('公共接口仅返回公开可见网站，不泄露私有分类和内部时间字段', async () => {
    const publicCategory = await category('公开分类');
    const privateCategory = await category('秘密分类');
    await site({ category_id: publicCategory.id });
    await site({ name: '秘密', url: 'https://secret.com', category_id: privateCategory.id, visibility: 'private' });
    await site({ name: '隐藏', url: 'https://hidden.com', is_visible: 0 });
    const response = await call('/public/sites');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    const list = await data<Site[]>(response);
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('created_at');
    expect(list[0].url).toBe('https://example.com');
    expect(await data<Category[]>(await call('/public/categories'))).toEqual([{ id: publicCategory.id, name: '公开分类', sort_order: 0 }]);
    expect(await data<Site[]>(await call('/admin/sites'))).toHaveLength(3);
  });
  it('管理接口未登录返回 401 且禁止缓存，配置缺失返回 503', async () => {
    const response = await call('/admin/sites', 'GET', undefined, { DEV_BYPASS_ACCESS: '0', ACCESS_TEAM_DOMAIN: 'moon.cloudflareaccess.com', ACCESS_AUD: 'aud' });
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await call('/admin/sites', 'GET', undefined, { DEV_BYPASS_ACCESS: '0' })).status).toBe(503);
  });
  it('拒绝跨站、缺失 Origin、非 JSON、超大请求与非法 ID', async () => {
    expect((await call('/admin/sites', 'POST', {}, {}, { Origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await call('/admin/sites', 'POST', {}, {}, { Origin: '' })).status).toBe(403);
    expect((await call('/admin/sites', 'POST', {}, {}, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await call('/admin/sites', 'POST', { description: 'x'.repeat(2 * 1024 * 1024) })).status).toBe(413);
    expect((await call('/admin/sites/not-an-id', 'DELETE', {})).status).toBe(400);
  });
  it('完整网站 CRUD、重复网址约束、排序及分类约束', async () => {
    const a = await site({ url: 'HTTPS://EXAMPLE.COM:443/', sort_order: 10 });
    expect((await call('/admin/sites', 'POST', { name: '重复', url: 'https://example.com' })).status).toBe(409);
    expect((await call('/admin/sites', 'POST', { name: '错误分类', url: 'https://new.com', category_id: 999 })).status).toBe(400);
    const b = await site({ name: '置顶', url: 'https://pinned.com', is_pinned: 1, sort_order: 100 });
    const updated = await data<Site>(await call(`/admin/sites/${a.id}`, 'PUT', { ...a, name: '已修改', visibility: 'private' }));
    expect(updated.name).toBe('已修改');
    expect((await data<Site[]>(await call('/admin/sites'))).map(s => s.id)).toEqual([b.id, a.id]);
    expect((await call(`/admin/sites/${a.id}`, 'DELETE', {})).status).toBe(200);
    expect((await call(`/admin/sites/${a.id}`, 'DELETE', {})).status).toBe(404);
  });
  it('删除非空分类需确认，确认后网站移到未分类；支持分类重排', async () => {
    const a = await category('A'); const b = await category('B');
    await site({ category_id: a.id });
    expect((await call(`/admin/categories/${a.id}`, 'DELETE', {})).status).toBe(409);
    expect((await call('/admin/categories/reorder', 'PUT', { ids: [b.id] })).status).toBe(400);
    expect((await call('/admin/categories/reorder', 'PUT', { ids: [b.id, a.id] })).status).toBe(200);
    expect((await data<Category[]>(await call('/admin/categories'))).map(c => c.id)).toEqual([b.id, a.id]);
    await call(`/admin/categories/${a.id}?move_to_uncategorized=1`, 'DELETE', {});
    expect((await data<Site[]>(await call('/admin/sites')))[0].category_id).toBe(null);
  });
  it('批量显示、隐藏、移动与删除', async () => {
    const a = await site(); const b = await site({ url: 'https://b.com' }); const c = await category();
    const ids = [a.id, b.id];
    await call('/admin/sites/batch', 'POST', { action: 'hide', ids });
    expect(await data<Site[]>(await call('/public/sites'))).toHaveLength(0);
    await call('/admin/sites/batch', 'POST', { action: 'show', ids });
    await call('/admin/sites/batch', 'POST', { action: 'move', ids, category_id: c.id });
    expect((await data<Site[]>(await call('/admin/sites'))).every(s => s.category_id === c.id && s.is_visible === 1)).toBe(true);
    await call('/admin/sites/batch', 'POST', { action: 'delete', ids });
    expect(await data<Site[]>(await call('/admin/sites'))).toHaveLength(0);
  });
  it('边缘缓存可读取且可主动清除', async () => {
    const url = 'https://nav.example.com/api/public/sites';
    const fetchPublic = async () => {
      const ctx = createExecutionContext();
      const response = await app.fetch(new Request(url), { DB: env.DB }, ctx);
      await waitOnExecutionContext(ctx);
      return data<Site[]>(response);
    };
    await invalidatePublicCache('https://nav.example.com');
    await site();
    expect(await fetchPublic()).toHaveLength(1);
    await env.DB.prepare('UPDATE sites SET visibility=?').bind('private').run();
    expect(await fetchPublic()).toHaveLength(1);
    await invalidatePublicCache('https://nav.example.com');
    expect(await fetchPublic()).toHaveLength(0);
  });
});

describe('备份导入与事务', () => {
  it('合并按规范化网址及分类名称更新，保留其他记录', async () => {
    const c = await category('导入分类');
    const original = await site({ category_id: c.id });
    const backup = inputBackup();
    backup.sites.push({ ...original, name: '合并更新', category_id: 10 });
    const result = await importData(backup, 'merge');
    expect(result.status).toBe(200);
    const sites = await data<Site[]>(await call('/admin/sites'));
    expect(sites).toHaveLength(2);
    expect(sites.find(s => s.url === original.url)).toMatchObject({ id: original.id, name: '合并更新' });
    expect(sites.find(s => s.url === backup.sites[0].url)?.category_id).toBe(c.id);
    expect(await data<Category[]>(await call('/admin/categories'))).toHaveLength(1);
  });
  it('覆盖替换全部数据，保留图标与私有属性，导出可再次导入', async () => {
    await category('旧分类'); await site();
    expect((await importData(inputBackup(), 'replace')).status).toBe(200);
    const exported = await data<Backup>(await call('/admin/export'));
    expect(backupSchema.safeParse(exported).success).toBe(true);
    expect(exported.sites).toHaveLength(1);
    expect(exported.sites[0]).toMatchObject({ name: '导入网站', visibility: 'private', icon_type: 'emoji', icon_value: '🌙' });
    expect((await importData(backupSchema.parse(exported), 'replace')).status).toBe(200);
    expect(await data<Site[]>(await call('/public/sites'))).toHaveLength(0);
  });
  it('导入前必须预览，预览后数据库变化时拒绝使用旧确认', async () => {
    const backup = inputBackup();
    expect((await call('/admin/import', 'POST', { backup, mode: 'replace', preview: false })).status).toBe(409);
    const preview = await data<ImportPreview>(await call('/admin/import', 'POST', { backup, mode: 'replace' }));
    await site();
    expect((await call('/admin/import', 'POST', { backup, mode: 'replace', preview: false, revision: preview.revision })).status).toBe(409);
    expect(await data<Site[]>(await call('/admin/sites'))).toHaveLength(1);
  });
  it('数据库写入失败时，覆盖模式的删除与插入一起回滚', async () => {
    const c = await category('原始分类'); await site({ category_id: c.id });
    await env.DB.prepare("CREATE TRIGGER reject_import BEFORE INSERT ON sites WHEN NEW.name = '导入网站' BEGIN SELECT RAISE(ABORT, 'test import failure'); END").run();
    expect((await importData(inputBackup(), 'replace')).status).toBe(500);
    expect((await data<Site[]>(await call('/admin/sites')))[0].name).toBe('Test');
    expect((await data<Category[]>(await call('/admin/categories')))[0].name).toBe('原始分类');
  });
  it('2000 项导入保持原子批次且只需少量 SQL 语句', async () => {
    const backup = inputBackup();
    backup.sites = Array.from({ length: 2000 }, (_, i) => ({ ...backup.sites[0], id: i + 1, url: `https://import.example.com/${i}` }));
    expect(importStatements(env.DB, backup, 'merge', new Date().toISOString())).toHaveLength(2);
    expect((await importData(backup, 'merge')).status).toBe(200);
    expect((await data<Site[]>(await call('/admin/sites'))).length).toBe(2000);
  });
});
