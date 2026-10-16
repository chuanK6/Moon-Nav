import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ZodError } from 'zod';
import { batchSchema, categorySchema, importSchema, reorderSchema, siteSchema, type Category, type Site } from '../shared/schema';
import { access } from './middleware/access';
import { origin } from './middleware/origin';
import { ApiError } from './errors';
import type { AppEnv } from './types';
import { getPublicCache, invalidatePublicCache, putPublicCache } from './cache';
import { importPreview, importStatements } from './import';

export const app = new Hono<AppEnv>().basePath('/api');
const publicFields = 'id, name, url, icon_type, icon_value, description, category_id, sort_order, is_pinned, is_visible, visibility';
const siteOrder = 'ORDER BY is_pinned DESC, sort_order ASC, id ASC';
const now = () => new Date().toISOString();
function parseId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, 'INVALID_ID', '无效的 ID');
  return id;
}
async function json(request: Request) {
  try { return await request.json(); } catch { throw new ApiError(400, 'INVALID_JSON', 'JSON 格式错误'); }
}
async function currentData(db: D1Database) {
  // batch 使备份中的两张表来自同一个事务。
  const result = await db.batch([
    db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC'),
    db.prepare(`SELECT * FROM sites ${siteOrder}`),
  ]);
  return { categories: result[0].results as Category[], sites: result[1].results as Site[] };
}
async function assertCategory(db: D1Database, id: number | null) {
  if (id !== null && !(await db.prepare('SELECT id FROM categories WHERE id = ?').bind(id).first())) {
    throw new ApiError(400, 'INVALID_CATEGORY', '所选分类不存在');
  }
}

app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
  await next();
});
app.use('/admin/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.res.ok) {
    // 等待本地清除完成；其他数据中心的缓存最多存活 60 秒。
    await invalidatePublicCache(c.env.SITE_ORIGIN || new URL(c.req.url).origin);
  }
});
app.use('/admin/*', access);
app.use('/admin/*', origin);
app.use('/admin/*', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: () => { throw new ApiError(413, 'BODY_TOO_LARGE', '请求体最多 2 MiB'); } }));

app.get('/public/*', async (c, next) => {
  if (!['/api/public/sites', '/api/public/categories'].includes(c.req.path)) return next();
  const cached = await getPublicCache(c.req.raw);
  if (cached) return new Response(cached.body, cached);
  await next();
  if (c.res.ok) {
    // 不使用 stale-while-revalidate，确保隐藏或转私有的数据最多只延迟 60 秒。
    c.header('Cache-Control', 'public, max-age=0, s-maxage=60, must-revalidate');
    c.executionCtx.waitUntil(putPublicCache(c.req.raw, c.res.clone()));
  }
});
app.get('/public/sites', async c => {
  const { results } = await c.env.DB.prepare(`SELECT ${publicFields} FROM sites WHERE visibility = 'public' AND is_visible = 1 ${siteOrder}`).all();
  return c.json({ data: results });
});
app.get('/public/categories', async c => {
  const { results } = await c.env.DB.prepare(`
    SELECT c.id, c.name, c.sort_order FROM categories c
    WHERE EXISTS (SELECT 1 FROM sites s WHERE s.category_id = c.id AND s.visibility = 'public' AND s.is_visible = 1)
    ORDER BY c.sort_order ASC, c.id ASC
  `).all();
  return c.json({ data: results });
});

app.get('/admin/me', c => c.json({ data: { email: c.get('email') } }));
app.get('/admin/sites', async c => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM sites ${siteOrder}`).all();
  return c.json({ data: results });
});
app.post('/admin/sites', async c => {
  const s = siteSchema.parse(await json(c.req.raw));
  await assertCategory(c.env.DB, s.category_id);
  const time = now();
  const row = await c.env.DB.prepare(`INSERT INTO sites
    (name,url,icon_type,icon_value,description,category_id,sort_order,is_pinned,is_visible,visibility,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`)
    .bind(s.name,s.url,s.icon_type,s.icon_value,s.description,s.category_id,s.sort_order,s.is_pinned,s.is_visible,s.visibility,time,time).first();
  return c.json({ data: row }, 201);
});
app.put('/admin/sites/:id', async c => {
  const id = parseId(c.req.param('id'));
  const s = siteSchema.parse(await json(c.req.raw));
  await assertCategory(c.env.DB, s.category_id);
  const row = await c.env.DB.prepare(`UPDATE sites SET name=?,url=?,icon_type=?,icon_value=?,description=?,category_id=?,sort_order=?,is_pinned=?,is_visible=?,visibility=?,updated_at=? WHERE id=? RETURNING *`)
    .bind(s.name,s.url,s.icon_type,s.icon_value,s.description,s.category_id,s.sort_order,s.is_pinned,s.is_visible,s.visibility,now(),id).first();
  if (!row) throw new ApiError(404, 'NOT_FOUND', '网站不存在');
  return c.json({ data: row });
});
app.delete('/admin/sites/:id', async c => {
  const row = await c.env.DB.prepare('DELETE FROM sites WHERE id = ? RETURNING id').bind(parseId(c.req.param('id'))).first();
  if (!row) throw new ApiError(404, 'NOT_FOUND', '网站不存在');
  return c.json({ data: row });
});
app.post('/admin/sites/batch', async c => {
  const input = batchSchema.parse(await json(c.req.raw));
  const ids = JSON.stringify([...new Set(input.ids)]);
  let statement: D1PreparedStatement;
  if (input.action === 'move') {
    await assertCategory(c.env.DB, input.category_id);
    statement = c.env.DB.prepare('UPDATE sites SET category_id = ?, updated_at = ? WHERE id IN (SELECT value FROM json_each(?))').bind(input.category_id, now(), ids);
  } else if (input.action === 'delete') {
    statement = c.env.DB.prepare('DELETE FROM sites WHERE id IN (SELECT value FROM json_each(?))').bind(ids);
  } else {
    statement = c.env.DB.prepare('UPDATE sites SET is_visible = ?, updated_at = ? WHERE id IN (SELECT value FROM json_each(?))').bind(input.action === 'show' ? 1 : 0, now(), ids);
  }
  const [result] = await c.env.DB.batch([statement]);
  return c.json({ data: { changed: result.meta.changes } });
});

app.get('/admin/categories', async c => {
  const { results } = await c.env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM sites s WHERE s.category_id=c.id) AS site_count FROM categories c ORDER BY c.sort_order ASC, c.id ASC`).all();
  return c.json({ data: results });
});
app.post('/admin/categories', async c => {
  const input = categorySchema.parse(await json(c.req.raw));
  const time = now();
  const row = await c.env.DB.prepare('INSERT INTO categories (name,sort_order,created_at,updated_at) VALUES (?,?,?,?) RETURNING *').bind(input.name,input.sort_order,time,time).first();
  return c.json({ data: row }, 201);
});
// 静态路由在 /:id 前注册，避免 reorder 被识别为 ID。
app.put('/admin/categories/reorder', async c => {
  const { ids } = reorderSchema.parse(await json(c.req.raw));
  const existing = await c.env.DB.prepare('SELECT id FROM categories').all<{ id: number }>();
  if (existing.results.length !== ids.length || existing.results.some(c => !ids.includes(c.id))) {
    throw new ApiError(400, 'INVALID_ORDER', '请提交完整且无重复的分类顺序');
  }
  await c.env.DB.batch([c.env.DB.prepare(`UPDATE categories SET sort_order = (SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value = categories.id), updated_at = ? WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids),now(),JSON.stringify(ids))]);
  return c.json({ data: { changed: ids.length } });
});
app.put('/admin/categories/:id', async c => {
  const input = categorySchema.parse(await json(c.req.raw));
  const row = await c.env.DB.prepare('UPDATE categories SET name=?, sort_order=?, updated_at=? WHERE id=? RETURNING *').bind(input.name,input.sort_order,now(),parseId(c.req.param('id'))).first();
  if (!row) throw new ApiError(404, 'NOT_FOUND', '分类不存在');
  return c.json({ data: row });
});
app.delete('/admin/categories/:id', async c => {
  const id = parseId(c.req.param('id'));
  const move = c.req.query('move_to_uncategorized') === '1';
  const exists = await c.env.DB.prepare('SELECT id FROM categories WHERE id=?').bind(id).first();
  if (!exists) throw new ApiError(404, 'NOT_FOUND', '分类不存在');
  const row = await c.env.DB.prepare(`DELETE FROM categories WHERE id=? AND (? = 1 OR NOT EXISTS (SELECT 1 FROM sites WHERE category_id=?)) RETURNING id`).bind(id,move ? 1 : 0,id).first();
  if (!row) throw new ApiError(409, 'CATEGORY_NOT_EMPTY', '此分类包含网站，请确认移到未分类后再删除');
  return c.json({ data: row });
});

app.get('/admin/export', async c => {
  const data = await currentData(c.env.DB);
  c.header('Content-Disposition', `attachment; filename="moon-nav-${now().slice(0,10)}.json"`);
  return c.json({ data: { version: 1, exported_at: now(), ...data } });
});
app.post('/admin/import', async c => {
  const input = importSchema.parse(await json(c.req.raw));
  const current = await currentData(c.env.DB);
  const preview = await importPreview(current, input.backup, input.mode);
  if (input.preview) return c.json({ data: preview });
  if (input.revision !== preview.revision) throw new ApiError(409, 'PREVIEW_EXPIRED', '数据或导入文件已变化，请重新预览后导入');
  await c.env.DB.batch(importStatements(c.env.DB, input.backup, input.mode, now()));
  return c.json({ data: { ...preview, imported: input.backup.sites.length } });
});

app.notFound(c => c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404));
app.onError((error, c) => {
  c.header('Cache-Control', 'no-store');
  if (error instanceof ApiError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof ZodError) return c.json({ error: { code: 'VALIDATION_ERROR', message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('；') } }, 400);
  const message = `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`;
  if (message.includes('UNIQUE constraint failed')) return c.json({ error: { code: 'DUPLICATE', message: '该网址或分类名称已存在' } }, 409);
  if (message.includes('FOREIGN KEY constraint failed')) return c.json({ error: { code: 'INVALID_CATEGORY', message: '分类不存在，请刷新后重试' } }, 400);
  // 不输出原始错误，避免日志或响应泄露数据库内容及凭据。
  console.error('API request failed', c.req.method, c.req.path);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试' } }, 500);
});
