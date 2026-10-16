-- 仅用于本地演示，需在迁移之后手动执行。不会作为正式环境迁移自动导入。
INSERT OR IGNORE INTO categories (id,name,sort_order,created_at,updated_at) VALUES
  (1,'常用工具',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  (2,'开发资源',1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  (3,'AI 工具',2,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  (4,'设计素材',3,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  (5,'新闻资讯',4,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  (6,'娱乐网站',5,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  (7,'个人收藏',6,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO sites (name,url,icon_type,icon_value,description,category_id,sort_order,is_pinned,is_visible,visibility,created_at,updated_at)
SELECT name,url,icon_type,icon_value,description,category_id,sort_order,is_pinned,1,visibility,
strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM (
 SELECT 'GitHub' name,'https://github.com' url,'letter' icon_type,'G' icon_value,'代码与灵感，在这里相遇' description,2 category_id,0 sort_order,1 is_pinned,'public' visibility
 UNION ALL SELECT 'ChatGPT','https://chatgpt.com','letter','C','随时开启一场有用的对话',3,1,1,'public'
 UNION ALL SELECT 'Figma','https://www.figma.com','emoji','🎨','把想法变成看得见的设计',4,2,1,'public'
 UNION ALL SELECT 'Cloudflare','https://dash.cloudflare.com','emoji','☁️','连接、安全与边缘计算',1,3,1,'public'
 UNION ALL SELECT 'Notion','https://www.notion.so','letter','N','笔记、计划与生活的第二大脑',1,0,0,'public'
 UNION ALL SELECT 'DeepL','https://www.deepl.com','letter','D','让文字跨越语言的边界',1,1,0,'public'
 UNION ALL SELECT 'Excalidraw','https://excalidraw.com','emoji','✏️','简单画几笔，把思路理清楚',1,2,0,'public'
 UNION ALL SELECT 'TinyPNG','https://tinypng.com','emoji','🐼','为图片减负，为网页提速',1,3,0,'public'
 UNION ALL SELECT 'MDN Web Docs','https://developer.mozilla.org','letter','M','Web 开发的可靠参考手册',2,0,0,'public'
 UNION ALL SELECT 'Vercel','https://vercel.com','letter','V','让创意快速上线',2,1,0,'public'
 UNION ALL SELECT 'Stack Overflow','https://stackoverflow.com','letter','S','开发问题，总能找到一些线索',2,2,0,'public'
 UNION ALL SELECT 'Can I use','https://caniuse.com','letter','?','浏览器兼容性，一查就知道',2,3,0,'public'
 UNION ALL SELECT 'Claude','https://claude.ai','letter','C','陪你一起思考、写作和创造',3,0,0,'public'
 UNION ALL SELECT 'Hugging Face','https://huggingface.co','emoji','🤗','探索开放模型与 AI 社区',3,1,0,'public'
 UNION ALL SELECT 'Unsplash','https://unsplash.com','letter','U','寻找下一张打动你的照片',4,0,0,'public'
 UNION ALL SELECT 'Dribbble','https://dribbble.com','emoji','🏀','看看世界各地的设计灵感',4,1,0,'public'
 UNION ALL SELECT 'Hacker News','https://news.ycombinator.com','letter','Y','科技、创业和有意思的讨论',5,0,0,'public'
 UNION ALL SELECT '哔哩哔哩','https://www.bilibili.com','emoji','📺','学习、生活与一点点快乐',6,0,0,'public'
 UNION ALL SELECT '我的工作台','https://example.com/workspace','emoji','🌙','本地演示私有网站，仅自己可见',7,0,0,'private'
);
