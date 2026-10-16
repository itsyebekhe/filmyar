CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER,
  movie_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, movie_id)
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  movie_id TEXT,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channels (
  username TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS movie_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_media (
  imdb_id TEXT PRIMARY KEY,
  type TEXT,
  title_en TEXT,
  title_fa TEXT,
  year TEXT,
  rating TEXT,
  links TEXT,
  views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_type_views ON custom_media(type, views DESC);
CREATE INDEX IF NOT EXISTS idx_media_rating ON custom_media(rating DESC);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_favs_user ON favorites(user_id);
