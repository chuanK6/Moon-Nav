CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  icon_type TEXT NOT NULL DEFAULT 'favicon'
    CHECK (icon_type IN ('favicon','url','letter','color','emoji')),
  icon_value TEXT,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1)),
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0,1)),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_sites_category ON sites(category_id, sort_order);
CREATE INDEX idx_sites_list ON sites(is_visible, visibility, is_pinned, sort_order);
