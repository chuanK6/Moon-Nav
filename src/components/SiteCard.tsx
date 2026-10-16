import { ArrowUpRight, EyeOff, LockKeyhole, Pin } from 'lucide-react';
import type { Site } from '../../shared/schema';
import { SiteIcon } from './SiteIcon';
import { hostname } from '../lib/icon';

export function SiteCard({ site }: { site: Site }) {
  return <a className="site-card" href={site.url} target="_blank" rel="noopener noreferrer">
    <div className="card-top"><SiteIcon site={site} /><ArrowUpRight size={17} className="card-arrow" /></div>
    <div className="card-title"><h3>{site.name}</h3>{site.is_pinned === 1 && <Pin size={12} className="muted" />}{site.visibility === 'private' && <LockKeyhole size={12} aria-label="私有" />}{site.is_visible === 0 && <EyeOff size={12} aria-label="已隐藏" />}</div>
    <p>{site.description || hostname(site.url)}</p>
    <span className="card-domain">{hostname(site.url)}</span>
  </a>;
}
