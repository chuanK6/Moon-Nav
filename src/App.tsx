import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
const Admin = lazy(() => import('./pages/Admin'));
const My = lazy(() => import('./pages/My'));

export default function App() {
  return <Layout><Suspense fallback={<div className="page empty-state" aria-busy="true">正在打开你的空间…</div>}><Routes><Route path="/" element={<Home />} /><Route path="/my" element={<My />} /><Route path="/admin" element={<Admin />} /><Route path="*" element={<div className="empty-state"><h1>这里还没有内容</h1><Link to="/" className="button primary">返回导航</Link></div>} /></Routes></Suspense></Layout>;
}
