import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { THEME_SCRIPT, contentSecurityPolicy } from '../shared/security.ts';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
if (!hashes.length) throw new Error('Theme initialization script is missing');
if (!html.includes(THEME_SCRIPT)) throw new Error('Theme script and private page security policy have drifted');
const template = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
await writeFile(new URL('../dist/_headers', import.meta.url), template.replace(/Content-Security-Policy: .*/, `Content-Security-Policy: ${contentSecurityPolicy(hashes.join(' '))}`));
console.log('CSP generated for inline theme initialization.');
