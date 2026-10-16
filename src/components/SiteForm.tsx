import { useState, type FormEvent } from 'react';
import { siteSchema, type Category, type Site, type SiteInput } from '../../shared/schema';
import { Modal } from './Modal';
import { SiteIcon } from './SiteIcon';
import { normalizeUrl } from '../../shared/schema';
import { message } from '../lib/api';

export const blankSite: SiteInput = { name: '', url: '', icon_type: 'favicon', icon_value: null, description: '', category_id: null, sort_order: 0, is_pinned: 0, is_visible: 1, visibility: 'public' };
export function SiteForm({ site, sites, categories, onClose, onSave }: { site?: Site; sites: Site[]; categories: Category[]; onClose: () => void; onSave: (s: SiteInput) => Promise<void> }) {
  const [form, setForm] = useState<SiteInput>(site ? { ...site } : { ...blankSite });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SiteInput>(key: K, value: SiteInput[K]) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const parsed = siteSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues.map(i => i.message).join('；'));
    if (sites.some(s => s.id !== site?.id && normalizeUrl(s.url) === parsed.data.url)) return setError('该网址已存在，请编辑现有网站');
    setBusy(true);
    try { await onSave(parsed.data); onClose(); } catch (error) { setError(message(error)); setBusy(false); }
  }
  return <Modal title={site ? '编辑网站' : '添加网站'} onClose={onClose} busy={busy} wide>
    <form onSubmit={submit} className="modal-body"><div className="form-preview"><SiteIcon site={form} /><div><strong>{form.name || '你的网站名称'}</strong><p>{form.description || '在这里，收集下一个好用的网站。'}</p></div><span className="badge">实时预览</span></div>
      <div className="form-grid"><label>网站名称 <span>*</span><input autoFocus required maxLength={80} value={form.name} onChange={e => set('name', e.target.value)} placeholder="例如：GitHub" /></label><label>网站地址 <span>*</span><input required type="url" maxLength={2048} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://example.com" /></label><label className="full-width">网站描述<textarea rows={2} maxLength={300} value={form.description} onChange={e => set('description', e.target.value)} placeholder="简单记录一下，它为什么值得收藏…" /></label><label>所属分类<select value={form.category_id ?? ''} onChange={e => set('category_id', e.target.value ? Number(e.target.value) : null)}><option value="">未分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>排序值<input type="number" min={-1000000} max={1000000} value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} /><small>数字越小，排列越靠前</small></label><label>图标方案<select value={form.icon_type} onChange={e => setForm(f => ({ ...f, icon_type: e.target.value as SiteInput['icon_type'], icon_value: null }))}><option value="favicon">在线图标（默认）</option><option value="url">自定义图片</option><option value="letter">首字母</option><option value="color">纯色</option><option value="emoji">Emoji</option></select></label><label>{({ favicon: '图标说明', url: '图片地址', letter: '自定义文字', color: '背景颜色', emoji: 'Emoji' })[form.icon_type]}{form.icon_type === 'favicon' ? <span className="field-hint">在线引用，加载失败自动显示首字母</span> : <input value={form.icon_value || ''} onChange={e => set('icon_value', e.target.value || null)} placeholder={form.icon_type === 'url' ? 'https://… 或 /icons/…' : form.icon_type === 'color' ? '#6861DB（可留空）' : form.icon_type === 'emoji' ? '🌙' : '可留空，默认取名称首字'} />}</label><label>可见性<select aria-label="可见性" value={form.visibility} onChange={e => set('visibility', e.target.value as 'public' | 'private')}><option value="public">公开 · 所有人可见</option><option value="private">私有 · 仅 Access 登录后可见</option></select></label><div className="checkbox-stack"><label><input type="checkbox" checked={form.is_pinned === 1} onChange={e => set('is_pinned', e.target.checked ? 1 : 0)} />置顶网站</label><label><input type="checkbox" checked={form.is_visible === 1} onChange={e => set('is_visible', e.target.checked ? 1 : 0)} />在公开导航中显示（私有项仍不公开）</label></div></div>
      {error && <div role="alert" className="error-message">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>取消</button><button type="submit" className="button primary" disabled={busy}>{busy ? '保存中…' : '保存网站'}</button></div>
    </form>
  </Modal>;
}
