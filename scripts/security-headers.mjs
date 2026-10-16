import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const THEME_SCRIPT = "try{document.documentElement.dataset.theme=localStorage.getItem('moon-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{document.documentElement.dataset.theme='light'}";
function contentSecurityPolicy(hashes) {
  return `default-src 'self'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline'; img-src 'self' https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
}

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
if (!hashes.length) throw new Error('Theme initialization script is missing');
if (!html.includes(THEME_SCRIPT)) throw new Error('Theme script and private page security policy have drifted');
const template = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
await writeFile(new URL('../dist/_headers', import.meta.url), template.replace(/Content-Security-Policy: .*/, `Content-Security-Policy: ${contentSecurityPolicy(hashes.join(' '))}`));
console.log('CSP generated for inline theme initialization.');
