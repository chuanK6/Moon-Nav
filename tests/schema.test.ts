import { describe, expect, it } from 'vitest';
import { backupSchema, normalizeUrl, siteSchema } from '../shared/schema';
import { domainColor } from '../src/lib/icon';

describe('网址规范化与共享校验', () => {
  it('规范化协议、主机名、默认端口和尾部斜杠，保留查询与路径大小写', () => {
    expect(normalizeUrl(' HTTPS://EXAMPLE.COM:443/Path///?a=B#Anchor ')).toBe('https://example.com/Path?a=B#Anchor');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com/Path/?redirect=https://other.com/#Anchor')).toBe('https://example.com/Path?redirect=https://other.com/#Anchor');
    expect(normalizeUrl('http://example.com')).not.toBe(normalizeUrl('https://example.com'));
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'ftp://example.com', 'https://u:pw@example.com', 'not-a-url'])('拒绝危险或无效网址 %s', url => {
    expect(siteSchema.safeParse({ name: 'test', url }).success).toBe(false);
  });
  it.each(['//evil.com/a.svg', '/\\evil.com/a.svg', 'http://example.com/a.png', 'data:image/png;base64,AA'])('拒绝不安全图标 %s', icon_value => {
    expect(siteSchema.safeParse({ name: 'x', url: 'https://example.com', icon_type: 'url', icon_value }).success).toBe(false);
  });
  it('支持站内图片、HTTPS、首字母、颜色和组合 emoji', () => {
    for (const [icon_type, icon_value] of [['url', '/icons/my.svg'], ['url', 'https://example.com/icon.png'], ['letter', 'M'], ['color', '#4F46E5'], ['emoji', '👨‍💻'], ['emoji', '🇨🇳']]) {
      expect(siteSchema.safeParse({ name: 'test', url: 'https://example.com', icon_type, icon_value }).success).toBe(true);
    }
    expect(siteSchema.safeParse({ name: 'x', url: 'https://example.com', icon_type: 'emoji', icon_value: '😀😀' }).success).toBe(false);
    expect(siteSchema.safeParse({ name: 'x', url: 'https://example.com', icon_type: 'color', icon_value: 'red' }).success).toBe(false);
  });
  it('限制长度与导入条数，拒绝悬空分类与重复规范化网址', () => {
    expect(siteSchema.safeParse({ name: 'x'.repeat(81), url: 'https://example.com' }).success).toBe(false);
    expect(backupSchema.safeParse({ version: 1, categories: [], sites: [{ id: 1, name: 'x', url: 'https://a.com', category_id: 9 }] }).success).toBe(false);
    expect(backupSchema.safeParse({ version: 1, categories: [], sites: [{ id: 1, name: 'x', url: 'https://A.com/' }, { id: 2, name: 'y', url: 'https://a.com' }] }).success).toBe(false);
    expect(backupSchema.safeParse({ version: 1, categories: [], sites: Array.from({ length: 2001 }, (_, i) => ({ id: i + 1, name: 'x', url: `https://a.com/${i}` })) }).success).toBe(false);
  });
  it('同一域名的回退颜色稳定', () => {
    expect(domainColor('https://example.com/a')).toBe(domainColor('https://example.com/b'));
    expect(domainColor('https://example.com')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
