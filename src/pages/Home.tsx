import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, CircleAlert, FolderOpen, Grid2X2, LockKeyhole, Pin, Search, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Category, Site } from '../../shared/schema';
import { api, message } from '../lib/api';
import { SiteCard } from '../components/SiteCard';

export default function Home({ personal = false }: { personal?: boolean }) {
  const scope = personal ? 'admin' : 'public';
  const sitesQuery = useQuery({ queryKey: [scope, 'sites'], queryFn: () => api<Site[]>(`/${scope}/sites`), staleTime: personal ? 0 : 30_000 });
  const categoriesQuery = useQuery({ queryKey: [scope, 'categories'], queryFn: () => api<Category[]>(`/${scope}/categories`), staleTime: personal ? 0 : 30_000 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<number | 'all' | 'pinned'>('all');
  const sites = sitesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const filtered = useMemo(() => sites.filter(s => {
    const match = `${s.name} ${s.description} ${s.url}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    return match && (category === 'all' || (category === 'pinned' ? s.is_pinned === 1 : (s.category_id ?? 0) === category));
  }), [sites, search, category]);
  const pinned = filtered.filter(s => s.is_pinned === 1);
  const groups = [...categories.map(c => ({ id: c.id, name: c.name })), { id: 0, name: '未分类' }].map(c => ({ ...c, sites: filtered.filter(s => (s.category_id ?? 0) === c.id && !s.is_pinned) })).filter(c => c.sites.length);
  const error = sitesQuery.error || categoriesQuery.error;
  const loading = sitesQuery.isPending || categoriesQuery.isPending;
  return <div className="page home-page">
    <section className="page-heading"><div><div className="eyebrow"><span />{personal ? 'YOUR PRIVATE SPACE' : 'A LITTLE SPACE, MANY POSSIBILITIES'}</div><h1>{personal ? '我的收藏' : '发现好站，'}{!personal && <span>从这里开始<span className="heading-period">.</span></span>}</h1><p>{personal ? '你的全部链接，安心放在自己的空间里。包含私有与隐藏网站。' : '把常用与喜欢放在一起，让每一次出发都更简单。'}</p></div><div className="heading-art" aria-hidden="true"><span className="art-ring" /><Bookmark size={28} /><span className="art-star">✦</span><span className="art-dot" /></div></section>
    <div className="home-toolbar"><div className="search-box"><Search size={20} /><input aria-label="搜索网站" placeholder="搜索网站名称、描述或网址…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="icon-button" aria-label="清空搜索" onClick={() => setSearch('')}><X size={16} /></button>}<span className="search-caption">搜索你的灵感</span></div><span className="total-count"><strong>{sites.length}</strong> 个好站，等你探索</span></div>
    <div className="category-tabs" aria-label="分类筛选"><button className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}><Grid2X2 size={15} />全部网站<span>{sites.length}</span></button><button className={category === 'pinned' ? 'selected' : ''} onClick={() => setCategory('pinned')}><Pin size={14} />置顶</button>{categories.map(c => <button key={c.id} className={category === c.id ? 'selected' : ''} onClick={() => setCategory(c.id)}>{c.name}<span>{sites.filter(s => s.category_id === c.id).length}</span></button>)}{sites.some(s => s.category_id === null) && <button className={category === 0 ? 'selected' : ''} onClick={() => setCategory(0)}>未分类</button>}</div>
    {error ? <div className="empty-state" role="alert"><CircleAlert size={32} /><h2>暂时无法读取导航</h2><p>{message(error)}</p><button className="button secondary" onClick={() => { void sitesQuery.refetch(); void categoriesQuery.refetch(); }}>重新加载</button></div> : loading ? <div className="site-grid skeleton-grid" aria-label="正在加载网站" aria-busy="true">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><i /><b /><span /></div>)}</div> : <>
      {pinned.length > 0 && <section className="site-section"><div className="section-heading"><h2><Pin size={17} />置顶网站<span>{pinned.length}</span></h2><span>常用的，总在手边</span></div><div className="site-grid">{pinned.map(s => <SiteCard key={s.id} site={s} />)}</div></section>}
      {groups.map(group => <section className="site-section" key={group.id}><div className="section-heading"><h2><FolderOpen size={17} />{group.name}<span>{group.sites.length}</span></h2></div><div className="site-grid">{group.sites.map(s => <SiteCard key={s.id} site={s} />)}</div></section>)}
      {!filtered.length && <div className="empty-state"><Search size={32} /><h2>{sites.length ? '还没找到匹配的网站' : '你的导航，从第一个链接开始'}</h2><p>{sites.length ? '试试其他关键词，或切换一个分类。' : '进入管理后台，添加你常用的网站吧。'}</p>{sites.length ? <button className="button secondary" onClick={() => { setSearch(''); setCategory('all'); }}>重置筛选</button> : <a href="/admin" className="button primary">添加网站<ArrowUpRight size={16} /></a>}</div>}
    </>}
    {!personal && sites.length > 0 && <div className="home-bottom-note"><Sparkles size={16} /><span>每一个收藏，都是下一次灵感的入口。</span><a href="/my"><LockKeyhole size={13} />前往我的收藏<ArrowUpRight size={13} /></a></div>}
  </div>;
}
