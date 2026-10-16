import { test, expect, type APIRequestContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const origin = 'http://127.0.0.1:8788';
async function api(request: APIRequestContext, path: string, method = 'GET', data?: unknown) {
  const response = await request.fetch(`/api${path}`, { method, data, headers: { Origin: origin, 'Content-Type': 'application/json' } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).data;
}
test.beforeAll(async ({ request }) => {
  const names = [
    ['GitHub', 'https://github.com', '代码与灵感，在这里相遇', 2, 'letter', 'G'],
    ['ChatGPT', 'https://chatgpt.com', '随时开启一场有用的对话', 3, 'letter', 'C'],
    ['Figma', 'https://figma.com', '把想法变成看得见的设计', 4, 'emoji', '🎨'],
    ['Cloudflare', 'https://dash.cloudflare.com', '连接、安全与边缘计算', 1, 'emoji', '☁️'],
    ['Notion', 'https://notion.so', '笔记、计划与生活的第二大脑', 1, 'letter', 'N'],
    ['DeepL', 'https://deepl.com', '让文字跨越语言的边界', 1, 'letter', 'D'],
    ['Excalidraw', 'https://excalidraw.com', '简单画几笔，把思路理清楚', 1, 'emoji', '✏️'],
    ['TinyPNG', 'https://tinypng.com', '为图片减负，为网页提速', 1, 'emoji', '🐼'],
    ['MDN Web Docs', 'https://developer.mozilla.org', 'Web 开发的可靠参考手册', 2, 'letter', 'M'],
    ['Vercel', 'https://vercel.com', '让创意快速上线', 2, 'letter', 'V'],
    ['Stack Overflow', 'https://stackoverflow.com', '开发问题，总能找到一些线索', 2, 'letter', 'S'],
    ['Can I use', 'https://caniuse.com', '浏览器兼容性，一查就知道', 2, 'letter', '?'],
    ['Claude', 'https://claude.ai', '陪你一起思考、写作和创造', 3, 'letter', 'C'],
    ['Hugging Face', 'https://huggingface.co', '探索开放模型与 AI 社区', 3, 'emoji', '🤗'],
    ['Unsplash', 'https://unsplash.com', '寻找下一张打动你的照片', 4, 'letter', 'U'],
    ['Dribbble', 'https://dribbble.com', '看看世界各地的设计灵感', 4, 'emoji', '🏀'],
    ['Hacker News', 'https://news.ycombinator.com', '科技、创业和有意思的讨论', 5, 'letter', 'Y'],
    ['哔哩哔哩', 'https://bilibili.com', '学习、生活与一点点快乐', 6, 'emoji', '📺'],
    ['私有工作台', 'https://example.com/private', '仅自己可见', 7, 'emoji', '🌙'],
    ['隐藏链接', 'https://example.com/hidden', '隐藏项', 7, 'letter', 'H'],
  ];
  const backup = {
    version: 1,
    categories: ['常用工具', '开发资源', 'AI 工具', '设计素材', '新闻资讯', '娱乐网站', '个人收藏'].map((name, i) => ({ id: i + 1, name, sort_order: i })),
    sites: names.map(([name, url, description, category_id, icon_type, icon_value], i) => ({ id: i + 1, name, url, description, category_id, icon_type, icon_value, sort_order: i, is_pinned: i < 4 ? 1 : 0, is_visible: i === 19 ? 0 : 1, visibility: i === 18 ? 'private' : 'public' })),
  };
  const preview = await api(request, '/admin/import', 'POST', { mode: 'replace', backup });
  await api(request, '/admin/import', 'POST', { mode: 'replace', backup, preview: false, revision: preview.revision });
  await mkdir('artifacts', { recursive: true });
});

test('公开页搜索、分类、私有过滤与桌面布局', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.site-card')).toHaveCount(18);
  await expect(page.getByText('私有工作台')).toHaveCount(0);
  await expect(page.getByText('隐藏链接')).toHaveCount(0);
  await expect(page.locator('.category-tabs').getByText('个人收藏')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/preview-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: '搜索网站', exact: true }).fill('代码');
  await expect(page.locator('.site-card')).toHaveCount(1);
  await expect(page.locator('.site-card')).toContainText('GitHub');
  await expect(page.locator('.site-card')).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('button', { name: '清空搜索' }).click();
  await page.getByRole('textbox', { name: '搜索网站', exact: true }).fill('p');
  expect(await page.locator('.site-card').count()).toBeGreaterThan(0);
  expect(await page.locator('.site-card').count()).toBeLessThan(18);
  await page.getByRole('textbox', { name: '搜索网站', exact: true }).fill('c');
  await expect.poll(() => page.locator('.site-card').count()).toBeGreaterThan(0);
  expect(await page.locator('.site-card').count()).toBeLessThan(18);
  await page.getByRole('button', { name: '清空搜索' }).click();
  await page.locator('.category-tabs').getByRole('button', { name: /AI 工具/ }).click();
  await expect(page.locator('.site-card')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('深浅主题保留、手机无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.site-card')).toHaveCount(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/preview-mobile.png', fullPage: true });
  const initial = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: initial === 'dark' ? '切换浅色主题' : '切换深色主题' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initial === 'dark' ? 'light' : 'dark');
  await page.screenshot({ path: 'artifacts/preview-mobile-theme.png', fullPage: true });
});

test('图标加载失败回退为首字母', async ({ page, request }) => {
  const site = await api(request, '/admin/sites', 'POST', { name: 'Fallback 测试', url: 'https://fallback.example.com', icon_type: 'favicon' });
  await page.route('https://www.google.com/**', route => route.abort());
  await page.goto('/');
  const card = page.locator('.site-card').filter({ hasText: 'Fallback 测试' });
  await expect(card.locator('.letter-icon')).toHaveText('F');
  await api(request, `/admin/sites/${site.id}`, 'DELETE', {});
});

test('后台完成分类及网站 CRUD，私有页显示私有和隐藏项', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('local@moon.nav')).toBeVisible();
  await expect(page.locator('.site-table tbody tr')).toHaveCount(20);
  await page.screenshot({ path: 'artifacts/preview-admin.png', fullPage: true });
  await page.getByRole('tab', { name: '分类管理' }).click();
  await page.getByRole('button', { name: '添加分类' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '分类名称' }).fill('端到端测试');
  await page.getByRole('button', { name: '保存分类' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: '网站管理' }).click();
  await page.getByRole('button', { name: '添加网站' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: /网站名称/ }).fill('我的测试网站');
  await dialog.getByRole('textbox', { name: /网站地址/ }).fill('https://e2e.example.com/');
  await dialog.getByLabel('所属分类').selectOption({ label: '端到端测试' });
  await dialog.getByLabel('图标方案').selectOption('emoji');
  await dialog.getByRole('textbox', { name: 'Emoji', exact: true }).fill('🚀');
  await dialog.getByLabel('可见性', { exact: true }).selectOption('private');
  await page.getByRole('button', { name: '保存网站' }).click();
  await expect(dialog).toHaveCount(0);
  const row = page.locator('.site-table tbody tr').filter({ hasText: '我的测试网站' });
  await expect(row).toContainText('私有');
  await row.getByRole('button', { name: '编辑 我的测试网站' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: /网站名称/ }).fill('更新后的测试网站');
  await page.getByRole('button', { name: '保存网站' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.site-table')).toContainText('更新后的测试网站');
  await page.getByRole('tab', { name: '分类管理' }).click();
  await page.getByRole('button', { name: '删除分类 端到端测试' }).click();
  await expect(page.getByRole('dialog')).toContainText('移动到「未分类」');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除分类 端到端测试' })).toBeVisible();
  await page.getByRole('button', { name: '删除分类 端到端测试' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/my');
  await expect(page.locator('.site-card').filter({ hasText: '私有工作台' })).toBeVisible();
  await expect(page.locator('.site-card').filter({ hasText: '隐藏链接' })).toBeVisible();
  await expect(page.locator('.site-card').filter({ hasText: '更新后的测试网站' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('更新后的测试网站')).toHaveCount(0);
  await page.goto('/admin');
  await page.getByRole('button', { name: '删除 更新后的测试网站' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.site-table tbody tr')).toHaveCount(20);
});

test('后台批量操作、JSON 导出与覆盖预览确认', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('checkbox', { name: '选择 GitHub', exact: true }).check();
  await page.getByRole('checkbox', { name: '选择 ChatGPT', exact: true }).check();
  await page.locator('.batch-toolbar').getByRole('button', { name: '隐藏', exact: true }).click();
  await expect(page.locator('.batch-toolbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '显示 GitHub', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '选择 GitHub', exact: true }).check();
  await page.getByRole('checkbox', { name: '选择 ChatGPT', exact: true }).check();
  await page.locator('.batch-toolbar').getByRole('button', { name: '显示', exact: true }).click();
  await expect(page.locator('.batch-toolbar')).toHaveCount(0);
  await page.getByRole('tab', { name: '数据备份' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/moon-nav-.*\.json/);
  const path = await download.path();
  await page.getByLabel('选择 JSON 备份文件').setInputFiles(path!);
  await page.getByRole('radio', { name: /覆盖/ }).check();
  await page.getByRole('button', { name: '预览导入差异' }).click();
  await expect(page.getByRole('heading', { name: '导入差异预览' })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认导入' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /我已导出当前数据/ }).check();
  await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByRole('status').filter({ hasText: '导入完成' })).toBeVisible();
});
