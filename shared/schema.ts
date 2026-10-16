import { z } from 'zod';

export function normalizeUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 http 或 https 网址');
  if (parsed.username || parsed.password) throw new Error('网址不能包含用户名或密码');
  // URL 自动规范化协议、主机名与默认端口；不改路径大小写、查询参数和锚点。
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`;
}

const normalizedUrl = z.string().trim().min(1, '请输入网址').max(2048).transform((v, ctx) => {
  try { return normalizeUrl(v); } catch {
    ctx.addIssue({ code: 'custom', message: '请输入有效的 http:// 或 https:// 网址，且不要包含账号密码' });
    return z.NEVER;
  }
});
const order = z.number().int().min(-1000000).max(1000000);
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const flag = z.union([z.literal(0), z.literal(1)]);

export const siteSchema = z.object({
  name: z.string().trim().min(1, '请输入网站名称').max(80, '名称最多 80 字'),
  url: normalizedUrl,
  icon_type: z.enum(['favicon', 'url', 'letter', 'color', 'emoji']).default('favicon'),
  icon_value: z.string().trim().max(2048).nullable().default(null),
  description: z.string().trim().max(300, '描述最多 300 字').default(''),
  category_id: id.nullable().default(null),
  sort_order: order.default(0),
  is_pinned: flag.default(0),
  is_visible: flag.default(1),
  visibility: z.enum(['public', 'private']).default('public'),
}).superRefine((site, ctx) => {
  const v = site.icon_value ?? '';
  const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['icon_value'], message });
  if (site.icon_type === 'url') {
    if (v.startsWith('/') && !v.startsWith('//') && !/[\\\s\u0000-\u001f]/.test(v)) return;
    try {
      const u = new URL(v);
      if (u.protocol !== 'https:' || u.username || u.password) issue('图标仅支持 HTTPS 或站内路径');
    } catch { issue('图标仅支持 HTTPS 或站内路径'); }
  }
  if (site.icon_type === 'color' && v && !/^#[0-9a-fA-F]{6}$/.test(v)) issue('请输入 6 位十六进制颜色，如 #6861DB');
  if (site.icon_type === 'letter' && Array.from(v).length > 2) issue('自定义首字母最多 2 个字符');
  if (site.icon_type === 'emoji') {
    const segments = [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(v)];
    if (segments.length !== 1 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(v)) issue('请输入一个 emoji');
  }
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, '请输入分类名称').max(40),
  sort_order: order.default(0),
});
export const batchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['show', 'hide', 'delete']), ids: z.array(id).min(1).max(2000) }),
  z.object({ action: z.literal('move'), ids: z.array(id).min(1).max(2000), category_id: id.nullable() }),
]);
export const reorderSchema = z.object({ ids: z.array(id).min(1).max(2000).refine(a => new Set(a).size === a.length, '分类不能重复') });

export const backupSchema = z.object({
  version: z.literal(1),
  exported_at: z.string().datetime().optional(),
  categories: z.array(categorySchema.extend({ id })).max(2000),
  sites: z.array(siteSchema.extend({ id })).max(2000),
}).superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (new Set(data.categories.map(c => c.id)).size !== data.categories.length) fail('分类 ID 重复');
  if (new Set(data.categories.map(c => c.name)).size !== data.categories.length) fail('分类名称重复');
  if (new Set(data.sites.map(s => s.id)).size !== data.sites.length) fail('网站 ID 重复');
  if (new Set(data.sites.map(s => s.url)).size !== data.sites.length) fail('备份中存在规范化后重复的网址');
  const categories = new Set(data.categories.map(c => c.id));
  if (data.sites.some(s => s.category_id !== null && !categories.has(s.category_id))) fail('网站引用了备份中不存在的分类');
});
export const importSchema = z.object({
  mode: z.enum(['merge', 'replace']),
  backup: backupSchema,
  preview: z.boolean().default(true),
  revision: z.string().max(128).optional(),
});

export type SiteInput = z.infer<typeof siteSchema>;
export type Site = SiteInput & { id: number; created_at?: string; updated_at?: string };
export type CategoryInput = z.infer<typeof categorySchema>;
export type Category = CategoryInput & { id: number; site_count?: number; created_at?: string; updated_at?: string };
export type Backup = z.infer<typeof backupSchema>;
export type ImportRequest = z.infer<typeof importSchema>;
export type ImportPreview = {
  revision: string;
  sites: { added: number; updated: number; removed: number };
  categories: { added: number; updated: number; removed: number };
};
