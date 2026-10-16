import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, CheckCircle2, Download, Edit3, Eye, EyeOff, FileJson, FolderOpen, Globe2, LockKeyhole, Plus, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { backupSchema, categorySchema, type Backup, type Category, type CategoryInput, type ImportPreview, type Site, type SiteInput } from '../../shared/schema';
import { api, message, write } from '../lib/api';
import { hostname } from '../lib/icon';
import { SiteIcon } from '../components/SiteIcon';
import { SiteForm } from '../components/SiteForm';
import { Modal } from '../components/Modal';

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}
function searchableUrl(value: string) {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
}

type Confirm = { title: string; detail: string; action: () => Promise<unknown> };
export default function Admin() {
  const queryClient = useQueryClient();
  const sitesQuery = useQuery({ queryKey: ['admin', 'sites'], queryFn: () => api<Site[]>('/admin/sites') });
  const categoriesQuery = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api<Category[]>('/admin/categories') });
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: () => api<{ email: string }>('/admin/me') });
  const sites = sitesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const [tab, setTab] = useState<'sites' | 'categories' | 'data'>('sites');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState<number[]>([]);
  const [editor, setEditor] = useState<Site | 'new' | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<Category | 'new' | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [moveCategory, setMoveCategory] = useState('');

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    await queryClient.invalidateQueries({ queryKey: ['public'] });
    setSelected([]);
  }
  async function perform(action: () => Promise<unknown>, success = '已保存修改') {
    setBusy(true); setError(''); setToast('');
    try { await action(); await refresh(); setToast(success); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!confirm) return;
    setBusy(true); setError('');
    try { await confirm.action(); await refresh(); setConfirm(null); setToast('操作完成'); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const needle = normalizeSearchText(search);
  const filtered = sites.filter(s => normalizeSearchText(`${s.name} ${searchableUrl(s.url)} ${s.description}`).includes(needle) && (filter === 'all' || (filter === 'hidden' ? !s.is_visible : s.visibility === filter)) && (categoryFilter === 'all' || (s.category_id ?? 0) === Number(categoryFilter)));
  const allSelected = filtered.length > 0 && filtered.every(s => selected.includes(s.id));
  const batch = (action: string, extra = {}) => write('/admin/sites/batch', 'POST', { action, ids: selected, ...extra });
  const loading = sitesQuery.isPending || categoriesQuery.isPending || me.isPending;
  const loadError = sitesQuery.error || categoriesQuery.error || me.error;
  return <div className="page admin-page">
    <section className="admin-heading"><div><div className="eyebrow"><span />MAKE ROOM FOR YOUR FAVORITES</div><h1>管理你的导航<span className="heading-period">.</span></h1><p>整理好每个链接，给灵感一个舒适的位置。</p></div><span className="admin-identity"><ShieldCheck size={16} />{me.data?.email || '正在验证 Access…'}</span></section>
    <div className="stats-grid"><div className="stat-card"><span className="stat-icon lavender"><Globe2 size={20} /></span><div><span>全部网站</span><strong>{sites.length}<small>个</small></strong></div></div><div className="stat-card"><span className="stat-icon blue"><FolderOpen size={20} /></span><div><span>导航分类</span><strong>{categories.length}<small>组</small></strong></div></div><div className="stat-card"><span className="stat-icon peach"><LockKeyhole size={20} /></span><div><span>私有网站</span><strong>{sites.filter(s => s.visibility === 'private').length}<small>个</small></strong></div></div><div className="stat-card"><span className="stat-icon mint"><Eye size={20} /></span><div><span>公开展示</span><strong>{sites.filter(s => s.is_visible && s.visibility === 'public').length}<small>个</small></strong></div></div></div>
    <div className="admin-tabs" role="tablist" aria-label="管理功能">{([['sites', '网站管理'], ['categories', '分类管理'], ['data', '数据备份']] as const).map(([key, label]) => <button role="tab" aria-selected={tab === key} key={key} onClick={() => { setTab(key); setError(''); setToast(''); }}>{label}</button>)}</div>
    {toast && <div className="success-message" role="status"><CheckCircle2 size={17} />{toast}<button className="icon-button" aria-label="关闭提示" onClick={() => setToast('')}><X size={15} /></button></div>}
    {error && <div role="alert" className="error-message">{error}</div>}
    {loadError ? <div className="empty-state" role="alert"><ShieldCheck size={32} /><h2>无法打开管理数据</h2><p>{message(loadError)}</p><button className="button primary" onClick={() => window.location.reload()}>刷新并重新验证</button></div> : loading ? <div className="admin-panel loading-panel" aria-busy="true">正在读取你的导航…</div> : <>
      {tab === 'sites' && <section className="admin-panel"><div className="panel-toolbar"><div className="compact-search"><Search size={17} /><input aria-label="搜索管理网站" placeholder="搜索网站…" value={search} onChange={e => setSearch(e.target.value)} onInput={e => setSearch(e.currentTarget.value)} /></div><select aria-label="按分类筛选" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">全部分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="0">未分类</option></select><select aria-label="按状态筛选" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部状态</option><option value="public">公开网站</option><option value="private">私有网站</option><option value="hidden">已隐藏</option></select><button className="button primary add-site" onClick={() => setEditor('new')}><Plus size={17} />添加网站</button></div>
        {selected.length > 0 && <div className="batch-toolbar"><strong>已选择 {selected.length} 项</strong><button disabled={busy} onClick={() => void perform(() => batch('show'))}>显示</button><button disabled={busy} onClick={() => void perform(() => batch('hide'))}>隐藏</button><select aria-label="批量移动目标分类" value={moveCategory} onChange={e => setMoveCategory(e.target.value)}><option value="">未分类</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select><button disabled={busy} onClick={() => void perform(() => batch('move', { category_id: moveCategory ? Number(moveCategory) : null }))}>移动分类</button><button className="danger-text" disabled={busy} onClick={() => setConfirm({ title: '批量删除网站', detail: `将永久删除选中的 ${selected.length} 个网站。建议先导出备份。`, action: () => batch('delete') })}>删除</button></div>}
        <div className="table-scroll"><table className="site-table"><thead><tr><th className="check-cell"><input type="checkbox" aria-label="选择当前筛选的全部网站" checked={allSelected} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...filtered.map(s => s.id)])] : selected.filter(id => !filtered.some(s => s.id === id)))} /></th><th>网站</th><th>分类</th><th>可见性</th><th>状态</th><th>排序</th><th className="actions-cell">操作</th></tr></thead><tbody>{filtered.map(site => <tr key={site.id} className={selected.includes(site.id) ? 'row-selected' : ''}><td className="check-cell"><input type="checkbox" aria-label={`选择 ${site.name}`} checked={selected.includes(site.id)} onChange={e => setSelected(e.target.checked ? [...selected, site.id] : selected.filter(id => id !== site.id))} /></td><td><div className="table-site"><SiteIcon site={site} /><div><strong>{site.name}{site.is_pinned === 1 && <span className="pinned-tag">置顶</span>}</strong><a href={site.url} target="_blank" rel="noopener noreferrer">{hostname(site.url)}</a></div></div></td><td><span className="category-chip">{categories.find(c => c.id === site.category_id)?.name || '未分类'}</span></td><td><span className={`visibility-label ${site.visibility}`} >{site.visibility === 'private' ? <LockKeyhole size={13} /> : <Globe2 size={13} />}{site.visibility === 'private' ? '私有' : '公开'}</span></td><td><button className={`status-toggle ${site.is_visible ? 'on' : ''}`} aria-label={`${site.is_visible ? '隐藏' : '显示'} ${site.name}`} disabled={busy} onClick={() => void perform(() => write(`/admin/sites/${site.id}`, 'PUT', { ...site, is_visible: site.is_visible ? 0 : 1 }))}>{site.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}{site.is_visible ? '显示' : '隐藏'}</button></td><td className="muted">{site.sort_order}</td><td className="actions-cell"><button className="icon-button" aria-label={`编辑 ${site.name}`} onClick={() => setEditor(site)}><Edit3 size={16} /></button><button className="icon-button danger-hover" aria-label={`删除 ${site.name}`} onClick={() => setConfirm({ title: '删除网站', detail: `确定删除「${site.name}」？此操作无法在后台撤销。`, action: () => write(`/admin/sites/${site.id}`, 'DELETE') })}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
        {!filtered.length && <div className="empty-state small"><Globe2 size={28} /><h2>{sites.length ? '没有匹配的网站' : '添加你的第一个网站'}</h2><p>{sites.length ? '试试其他关键词或筛选条件。' : '点击右上方「添加网站」开始整理。'}</p></div>}<div className="panel-footer">共 {sites.length} 个网站，当前显示 {filtered.length} 个<span>私有与隐藏项不会出现在公开导航</span></div>
      </section>}
      {tab === 'categories' && <section className="admin-panel"><div className="panel-toolbar"><div><h2>导航分类</h2><p>按习惯分组，让每个链接各就其位。</p></div><button className="button primary push-right" onClick={() => setCategoryEditor('new')}><Plus size={17} />添加分类</button></div><div className="category-list">{categories.map((c, index) => <div className="category-row" key={c.id}><span className="category-folder"><FolderOpen size={20} /></span><div className="category-info"><strong>{c.name}</strong><small>{c.site_count ?? sites.filter(s => s.category_id === c.id).length} 个网站 · 排序 {c.sort_order}</small></div><button className="icon-button" disabled={busy || index === 0} aria-label={`上移 ${c.name}`} onClick={() => { const ids = categories.map(c => c.id); [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; void perform(() => write('/admin/categories/reorder', 'PUT', { ids })); }}><ArrowUp size={16} /></button><button className="icon-button" disabled={busy || index === categories.length - 1} aria-label={`下移 ${c.name}`} onClick={() => { const ids = categories.map(c => c.id); [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]]; void perform(() => write('/admin/categories/reorder', 'PUT', { ids })); }}><ArrowDown size={16} /></button><button className="icon-button" aria-label={`编辑分类 ${c.name}`} onClick={() => setCategoryEditor(c)}><Edit3 size={16} /></button><button className="icon-button danger-hover" aria-label={`删除分类 ${c.name}`} onClick={() => { const count = c.site_count ?? sites.filter(s => s.category_id === c.id).length; setConfirm({ title: '删除分类', detail: count ? `「${c.name}」包含 ${count} 个网站。删除后，它们将移动到「未分类」，网站本身会保留。` : `确定删除「${c.name}」分类？`, action: () => write(`/admin/categories/${c.id}?move_to_uncategorized=1`, 'DELETE') }); }}><Trash2 size={16} /></button></div>)}</div>{!categories.length && <div className="empty-state small"><FolderOpen size={28} /><h2>从一个分类开始整理</h2><p>例如：常用工具、开发资源、AI 工具。</p></div>}</section>}
      {tab === 'data' && <DataManager onImported={refresh} />}
    </>}
    {editor && <SiteForm site={editor === 'new' ? undefined : editor} sites={sites} categories={categories} onClose={() => setEditor(null)} onSave={async data => { await write(editor === 'new' ? '/admin/sites' : `/admin/sites/${editor.id}`, editor === 'new' ? 'POST' : 'PUT', data); await refresh(); setToast('网站已保存'); }} />}
    {categoryEditor && <CategoryForm category={categoryEditor === 'new' ? undefined : categoryEditor} onClose={() => setCategoryEditor(null)} onSave={async input => { await write(categoryEditor === 'new' ? '/admin/categories' : `/admin/categories/${categoryEditor.id}`, categoryEditor === 'new' ? 'POST' : 'PUT', input); await refresh(); setToast('分类已保存'); }} />}
    {confirm && <Modal title={confirm.title} onClose={() => setConfirm(null)} busy={busy}><div className="modal-body"><p className="confirm-description">{confirm.detail}</p>{error && <div className="error-message" role="alert">{error}</div>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => { setConfirm(null); setError(''); }}>取消</button><button className="button danger" disabled={busy} onClick={() => void confirmAction()}>{busy ? '处理中…' : '确认删除'}</button></div></div></Modal>}
  </div>;
}

function CategoryForm({ category, onClose, onSave }: { category?: Category; onClose: () => void; onSave: (data: CategoryInput) => Promise<void> }) {
  const [form, setForm] = useState({ name: category?.name || '', sort_order: category?.sort_order || 0 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Modal title={category ? '编辑分类' : '添加分类'} onClose={onClose} busy={busy}><form className="modal-body" onSubmit={async event => { event.preventDefault(); const result = categorySchema.safeParse(form); if (!result.success) return setError(result.error.issues.map(i => i.message).join('；')); setBusy(true); try { await onSave(result.data); onClose(); } catch (e) { setError(message(e)); setBusy(false); } }}><label>分类名称<input autoFocus required maxLength={40} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例如：开发资源" /></label><label>排序值<input type="number" min={-1000000} max={1000000} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></label>{error && <div className="error-message" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>取消</button><button className="button primary" disabled={busy}>{busy ? '保存中…' : '保存分类'}</button></div></form></Modal>;
}

function DataManager({ onImported }: { onImported: () => Promise<void> }) {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  async function exportData() {
    setBusy(true); setError('');
    try {
      const data = await api<Backup>('/admin/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `moon-nav-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('备份已导出，请妥善保存，其中包含私有网站。');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function runImport(commit: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await write<ImportPreview>('/admin/import', 'POST', { mode, backup, preview: !commit, revision: commit ? preview?.revision : undefined });
      if (commit) { await onImported(); setPreview(null); setBackup(null); setFileName(''); setNotice('导入完成，导航数据已更新。'); }
      else setPreview(result);
    } catch (e) { setError(message(e)); if (commit) setPreview(null); } finally { setBusy(false); }
  }
  return <section className="backup-layout"><div className="admin-panel backup-panel"><span className="backup-icon"><Download size={25} /></span><h2>留一份安心的备份</h2><p>将全部网站、分类和图标设置导出为 JSON。建议在批量修改前，或每月手动备份一次。</p><button className="button secondary" disabled={busy} onClick={() => void exportData()}><Download size={16} />导出 JSON 备份</button><div className="backup-footnote"><ShieldCheck size={16} /><span>数据库也可通过 D1 Time Travel 恢复。免费套餐通常为 7 天，付费套餐为 30 天，以账户实际额度为准。</span></div></div><div className="admin-panel backup-panel"><span className="backup-icon"><Upload size={25} /></span><h2>把你的收藏带回来</h2><p>选择本站导出的 JSON 文件，预览差异后再导入。单次最多 2000 个网站、2000 个分类，总文件不超过 2 MiB。</p><label className="upload-area"><FileJson size={23} /><strong>{fileName || '选择 JSON 备份文件'}</strong><span>点击选择文件</span><input aria-label="选择 JSON 备份文件" type="file" accept=".json,application/json" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; setBackup(null); setPreview(null); setFileName(''); setError(''); setAcknowledged(false); if (!file) return; try { if (file.size > 2 * 1024 * 1024) throw new Error('文件最多 2 MiB'); const raw = JSON.parse(await file.text()); const parsed = backupSchema.safeParse(raw); if (!parsed.success) throw new Error(parsed.error.issues.map(i => i.message).join('；')); setBackup(parsed.data); setFileName(file.name); } catch (err) { setError(message(err)); } e.target.value = ''; }} /></label><div className="import-mode"><label><input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => { setMode('merge'); setPreview(null); }} disabled={busy} /><span><strong>合并</strong><small>同网址更新，同名分类合并，保留其余数据</small></span></label><label><input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => { setMode('replace'); setPreview(null); setAcknowledged(false); }} disabled={busy} /><span><strong>覆盖</strong><small>用备份替换当前全部网站与分类</small></span></label></div><button className="button secondary" disabled={!backup || busy} onClick={() => void runImport(false)}>预览导入差异</button></div>
    {error && <div role="alert" className="error-message full-width">{error}</div>}{notice && <div role="status" className="success-message full-width"><Check size={17} />{notice}</div>}
    {preview && <div className="admin-panel import-preview"><h2>导入差异预览</h2><p>更新数包含所有同网址或同名的匹配记录，即使字段值未变化。</p><div className="table-scroll"><table><thead><tr><th>类型</th><th>新增</th><th>匹配并更新</th><th>删除</th></tr></thead><tbody><tr><td>网站</td><td>{preview.sites.added}</td><td>{preview.sites.updated}</td><td>{preview.sites.removed}</td></tr><tr><td>分类</td><td>{preview.categories.added}</td><td>{preview.categories.updated}</td><td>{preview.categories.removed}</td></tr></tbody></table></div>{mode === 'replace' && <label className="replace-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />我已导出当前数据，确认用备份覆盖全部网站与分类。</label>}<div className="modal-actions"><button className="button secondary" onClick={() => setPreview(null)} disabled={busy}>取消</button><button className={`button ${mode === 'replace' ? 'danger' : 'primary'}`} disabled={busy || (mode === 'replace' && !acknowledged)} onClick={() => void runImport(true)}>{busy ? '导入中…' : '确认导入'}</button></div></div>}
  </section>;
}
