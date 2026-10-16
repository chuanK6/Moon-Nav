// 与 index.html 中的首屏脚本保持一致。构建脚本会验证，避免私有页面 CSP 哈希漂移。
export const THEME_SCRIPT = "try{document.documentElement.dataset.theme=localStorage.getItem('moon-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{document.documentElement.dataset.theme='light'}";
export function contentSecurityPolicy(hashes: string) {
  return `default-src 'self'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline'; img-src 'self' https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
}
let themePolicy: Promise<string> | undefined;
export function privatePagePolicy() {
  return themePolicy ??= crypto.subtle.digest('SHA-256', new TextEncoder().encode(THEME_SCRIPT)).then(hash => {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return contentSecurityPolicy(`'sha256-${base64}'`);
  });
}
