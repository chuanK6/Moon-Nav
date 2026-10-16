import type { Backup, Category, ImportPreview, Site } from '../shared/schema';

export async function importPreview(current: { categories: Category[]; sites: Site[] }, backup: Backup, mode: 'merge' | 'replace'): Promise<ImportPreview> {
  const currentUrls = new Set(current.sites.map(s => s.url));
  const incomingUrls = new Set(backup.sites.map(s => s.url));
  const currentNames = new Set(current.categories.map(c => c.name));
  const incomingNames = new Set(backup.categories.map(c => c.name));
  const bytes = new TextEncoder().encode(JSON.stringify({ current, backup, mode }));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const revision = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return {
    revision,
    sites: {
      added: backup.sites.filter(s => !currentUrls.has(s.url)).length,
      updated: backup.sites.filter(s => currentUrls.has(s.url)).length,
      removed: mode === 'replace' ? current.sites.filter(s => !incomingUrls.has(s.url)).length : 0,
    },
    categories: {
      added: backup.categories.filter(c => !currentNames.has(c.name)).length,
      updated: backup.categories.filter(c => currentNames.has(c.name)).length,
      removed: mode === 'replace' ? current.categories.filter(c => !incomingNames.has(c.name)).length : 0,
    },
  };
}

// json_each 将整个数组作为一个绑定参数；2000 项导入仅需 2～4 条语句，避免超过 D1 每次调用的查询数限制。
export function importStatements(db: D1Database, backup: Backup, mode: 'merge' | 'replace', now: string): D1PreparedStatement[] {
  const categoryNames = new Map(backup.categories.map(c => [c.id, c.name]));
  const rows = backup.sites.map(s => ({ ...s, category_name: s.category_id === null ? null : categoryNames.get(s.category_id) }));
  const statements: D1PreparedStatement[] = [];
  if (mode === 'replace') statements.push(db.prepare('DELETE FROM sites'), db.prepare('DELETE FROM categories'));
  statements.push(db.prepare(`
    INSERT INTO categories (name, sort_order, created_at, updated_at)
    SELECT json_extract(value, '$.name'), json_extract(value, '$.sort_order'), ?, ?
    FROM json_each(?) WHERE 1
    ON CONFLICT(name) DO UPDATE SET sort_order = excluded.sort_order, updated_at = excluded.updated_at
  `).bind(now, now, JSON.stringify(backup.categories)));
  statements.push(db.prepare(`
    INSERT INTO sites (name,url,icon_type,icon_value,description,category_id,sort_order,is_pinned,is_visible,visibility,created_at,updated_at)
    SELECT json_extract(j.value,'$.name'), json_extract(j.value,'$.url'),
      json_extract(j.value,'$.icon_type'), json_extract(j.value,'$.icon_value'),
      json_extract(j.value,'$.description'), c.id,
      json_extract(j.value,'$.sort_order'), json_extract(j.value,'$.is_pinned'),
      json_extract(j.value,'$.is_visible'), json_extract(j.value,'$.visibility'), ?, ?
    FROM json_each(?) j LEFT JOIN categories c ON c.name = json_extract(j.value,'$.category_name') WHERE 1
    ON CONFLICT(url) DO UPDATE SET name=excluded.name, icon_type=excluded.icon_type,
      icon_value=excluded.icon_value, description=excluded.description, category_id=excluded.category_id,
      sort_order=excluded.sort_order, is_pinned=excluded.is_pinned, is_visible=excluded.is_visible,
      visibility=excluded.visibility, updated_at=excluded.updated_at
  `).bind(now, now, JSON.stringify(rows)));
  return statements;
}
