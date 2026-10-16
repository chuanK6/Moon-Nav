import { useState } from 'react';
import type { SiteInput } from '../../shared/schema';
import { domainColor, faviconUrl } from '../lib/icon';

export function SiteIcon({ site }: { site: Pick<SiteInput, 'name' | 'url' | 'icon_type' | 'icon_value'> }) {
  const [failedSource, setFailedSource] = useState('');
  const source = site.icon_type === 'favicon' ? faviconUrl(site.url) : site.icon_type === 'url' ? site.icon_value || '' : '';
  const first = (site.icon_type === 'letter' && site.icon_value) || Array.from(site.name)[0]?.toUpperCase() || 'M';
  const color = site.icon_type === 'color' && /^#[0-9a-f]{6}$/i.test(site.icon_value || '') ? site.icon_value! : domainColor(site.url);
  if (source && source !== failedSource) return <span className="site-icon image-icon"><img src={source} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} /></span>;
  if (site.icon_type === 'emoji') return <span className="site-icon emoji-icon" aria-hidden="true">{site.icon_value}</span>;
  return <span className="site-icon letter-icon" style={{ background: color }} aria-hidden="true">{first}</span>;
}
