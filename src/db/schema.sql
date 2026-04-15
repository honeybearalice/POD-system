-- AI-POD 数据库 schema
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  query TEXT,
  url TEXT,
  status TEXT DEFAULT 'pending',
  total_images INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  scrape_job_id TEXT,
  path TEXT NOT NULL,
  thumbnail_path TEXT,
  source_url TEXT,
  platform TEXT,
  category TEXT,
  width INTEGER,
  height INTEGER,
  risk_level TEXT DEFAULT 'unchecked',
  risk_details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  source_image_id TEXT,
  path TEXT NOT NULL,
  method TEXT,
  prompt TEXT,
  resolution TEXT,
  dpi INTEGER DEFAULT 300,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mockups (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  design_id TEXT,
  title TEXT,
  description TEXT,
  tags TEXT,
  price REAL,
  mockup_ids TEXT,
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  shop_id TEXT,
  platform_listing_id TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  listed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  shop_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discovery_jobs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  platforms TEXT NOT NULL,
  status TEXT DEFAULT 'searching',
  total_results INTEGER DEFAULT 0,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discovery_results (
  id TEXT PRIMARY KEY,
  discovery_job_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  product_url TEXT NOT NULL,
  title TEXT,
  thumbnail_url TEXT,
  price TEXT,
  reviews_count INTEGER,
  sales_count INTEGER,
  rating REAL,
  rank INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
