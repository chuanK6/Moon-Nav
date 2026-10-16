import { NavLink, useLocation } from 'react-router-dom';
import { Compass, FolderHeart, LayoutGrid, LockKeyhole, Moon, Settings2, ShieldCheck, Sun } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next); document.documentElement.dataset.theme = next;
    try { localStorage.setItem('moon-theme', next); } catch { /* 存储禁用仍可切换 */ }
  }
  const admin = location.pathname.startsWith('/admin');
  const personal = location.pathname.startsWith('/my');
  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink className="brand" to="/" aria-label="Moon Nav 首页"><span className="brand-mark"><Moon size={23} fill="currentColor" /></span><span>Moon<span className="brand-light"> Nav</span><small>我的导航空间</small></span></NavLink>
      <div className="sidebar-label">工作空间</div>
      <nav aria-label="主导航">
        <NavLink to="/" end aria-label="探索导航" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Compass size={19} /><span>探索导航</span><span className="nav-dot" /></NavLink>
        <a href="/my" aria-label="我的收藏" className={`nav-item ${personal ? 'active' : ''}`}><FolderHeart size={19} /><span>我的收藏</span><LockKeyhole size={13} className="nav-lock" /></a>
        <a href="/admin" aria-label="管理后台" className={`nav-item ${admin ? 'active' : ''}`}><Settings2 size={19} /><span>管理后台</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-orbit">✦</span><strong>为好用的网站，留个位置。</strong><p>收集灵感，也收集效率。</p></div><div className="sidebar-status"><span className="status-dot" /> 个人导航 · Cloudflare</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><LayoutGrid size={16} /><span>我的空间</span><span>/</span><strong>{admin ? '管理后台' : personal ? '我的收藏' : '探索导航'}</strong></div><div className="topbar-actions">{(admin || personal) && <span className="protected-label"><ShieldCheck size={14} /> Access 保护</span>}<button className="icon-button theme-button" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><span className="avatar" aria-hidden="true">M</span></div></header>
      <main>{children}</main>
      <footer><span>Moon Nav <span className="footer-dot">·</span> 让常用的网站，触手可及</span><span>Built on Cloudflare <span className="footer-spark">✦</span></span></footer>
    </div>
  </div>;
}
