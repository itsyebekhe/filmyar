import { scrapeMovieByImdbId } from '../services/scraper.js';
import { searchByTitle } from '../services/tmdb.js';
import { cleanUpLinksObject, hasDownloadLinks, isCachedLinksValid } from '../utils/helpers.js';

export async function ensureTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id INTEGER, user_data TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS favorites (user_id INTEGER, movie_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, movie_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, movie_id TEXT, viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS channels (username TEXT UNIQUE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS movie_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, user_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS custom_media (imdb_id TEXT PRIMARY KEY, type TEXT, title_en TEXT, title_fa TEXT, year TEXT, rating TEXT, links TEXT, views INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_media_type_views ON custom_media(type, views DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_media_rating ON custom_media(rating DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, viewed_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_favs_user ON favorites(user_id)`)
  ]);
}

export async function dbCreateAuthSession(db, sessionId) {
  await db.prepare("INSERT INTO auth_sessions (id, status) VALUES (?, 'pending')").bind(sessionId).run();
}

export async function dbApproveAuthSession(db, sessionId, user) {
  await db.prepare("UPDATE auth_sessions SET status = 'approved', user_id = ?, user_data = ? WHERE id = ?")
    .bind(user.id, JSON.stringify(user), sessionId).run();
}

export async function dbGetAuthSession(db, sessionId) {
  return await db.prepare("SELECT * FROM auth_sessions WHERE id = ?").bind(sessionId).first();
}

export async function dbUserSync(db, userId, username, firstName) {
  await db.prepare(`
    INSERT INTO users (id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = COALESCE(?, username),
      first_name = COALESCE(?, first_name)
  `).bind(userId, username || null, firstName || null, username || null, firstName || null).run();
}

export async function dbGetAdminData(db) {
  const total = await db.prepare("SELECT COUNT(*) as count FROM users").first("count") || 0;
  const today = await db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= date('now', 'start of day')").first("count") || 0;
  return { total_users: total, new_today: today };
}

export async function dbGetStats(db) {
  const movies = await db.prepare("SELECT COUNT(*) as count FROM custom_media WHERE type = 'movie'").first("count") || 0;
  const series = await db.prepare("SELECT COUNT(*) as count FROM custom_media WHERE type = 'series'").first("count") || 0;
  return { movies, series };
}

export async function dbGetChannels(db) {
  const { results } = await db.prepare("SELECT username FROM channels").all();
  return results.map(r => r.username);
}

export async function dbManageChannel(db, type, ch) {
  if (type === 'add') {
    await db.prepare("INSERT OR IGNORE INTO channels (username) VALUES (?)").bind(ch).run();
  } else if (type === 'del') {
    await db.prepare("DELETE FROM channels WHERE username = ?").bind(ch).run();
  }
}

export async function dbFavToggle(db, userId, movieId) {
  const exists = await db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND movie_id = ?").bind(userId, movieId).first();
  if (exists) {
    await db.prepare("DELETE FROM favorites WHERE user_id = ? AND movie_id = ?").bind(userId, movieId).run();
    return { status: 'removed' };
  } else {
    await db.prepare("INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)").bind(userId, movieId).run();
    return { status: 'added' };
  }
}

export async function dbGetFavList(db, userId) {
  const { results } = await db.prepare(`
    SELECT c.imdb_id, c.type, c.title_en, c.title_fa, c.year, c.rating, c.views, c.links
    FROM favorites f
    JOIN custom_media c ON f.movie_id = c.imdb_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).bind(userId).all();

  return (results || []).map(row => {
    let parsed = {};
    try { parsed = JSON.parse(row.links); } catch {}
    return [row.imdb_id, row.type, row.title_en, row.title_fa || row.title_en, row.year, row.rating, row.views, cleanUpLinksObject(parsed)];
  });
}

export async function dbGetHistoryList(db, userId) {
  const { results } = await db.prepare(`
    SELECT c.imdb_id, c.type, c.title_en, c.title_fa, c.year, c.rating, c.views, c.links
    FROM history h
    JOIN custom_media c ON h.movie_id = c.imdb_id
    WHERE h.user_id = ?
    ORDER BY h.viewed_at DESC LIMIT 50
  `).bind(userId).all();

  return (results || []).map(row => {
    let parsed = {};
    try { parsed = JSON.parse(row.links); } catch {}
    return [row.imdb_id, row.type, row.title_en, row.title_fa || row.title_en, row.year, row.rating, row.views, cleanUpLinksObject(parsed)];
  });
}

export async function dbHistoryAdd(db, userId, movieId) {
  if (!userId || !movieId) return { success: false };
  await db.prepare("DELETE FROM history WHERE user_id = ? AND movie_id = ?").bind(userId, movieId).run();
  await db.prepare("INSERT INTO history (user_id, movie_id) VALUES (?, ?)").bind(userId, movieId).run();
  return { success: true };
}

export async function dbTrack(db, movieId) {
  await db.prepare("UPDATE custom_media SET views = views + 1 WHERE imdb_id = ?").bind(movieId).run();
  return { success: true };
}

export async function dbAddCustom(db, payload) {
  const imdbId = payload.imdb_id || payload.imdbId || null;
  const type = payload.type || 'movie';
  const titleEn = payload.title_en || payload.title || 'Unknown';
  const titleFa = payload.title_fa || titleEn;
  const year = String(payload.year || '2024');
  const rating = String(payload.rating || '0.0');
  const linksJson = JSON.stringify(payload.links || {});

  await db.prepare(`
    INSERT INTO custom_media (imdb_id, type, title_en, title_fa, year, rating, links)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(imdb_id) DO UPDATE SET
      type = excluded.type,
      title_en = excluded.title_en,
      title_fa = excluded.title_fa,
      year = excluded.year,
      rating = excluded.rating,
      links = excluded.links
  `).bind(
    imdbId,
    type,
    titleEn,
    titleFa,
    year,
    rating,
    linksJson
  ).run();
  return { success: true };
}

export async function getMovieById(db, movieId, env) {
  const row = await db.prepare("SELECT * FROM custom_media WHERE imdb_id = ?").bind(movieId).first();
  if (row) {
    let parsed = {};
    try { parsed = JSON.parse(row.links); } catch {}
    const cleaned = cleanUpLinksObject(parsed);

    // Only return cached links if they actually match the title/year and aren't contaminated
    const isValid = isCachedLinksValid(cleaned, row.title_en || row.title_fa, row.year);
    if (isValid && hasDownloadLinks(cleaned)) {
      return [row.imdb_id, row.type, row.title_en, row.title_fa || row.title_en, row.year, row.rating, row.views, cleaned];
    }
  }

  // Missing, empty, or contaminated links: re-scrape with strict matcher
  const tmdbKey = env?.TMDB_API_KEY;
  const botName = env?.BOT_USERNAME;
  if (!tmdbKey) return null;

  const scraped = await scrapeMovieByImdbId(movieId, tmdbKey, botName);
  if (scraped) {
    await dbAddCustom(db, scraped);
    return [
      scraped.imdb_id || scraped.imdbId,
      scraped.type,
      scraped.title_en,
      scraped.title_fa,
      scraped.year,
      scraped.rating,
      row ? row.views : 0,
      scraped.links
    ];
  }

  if (row) {
    return [row.imdb_id, row.type, row.title_en, row.title_fa || row.title_en, row.year, row.rating, row.views, {}];
  }

  return null;
}

export async function searchMovies(db, query, env) {
  const results = [];
  const seen = new Set();

  const dbRows = await db.prepare("SELECT * FROM custom_media WHERE title_en LIKE ? OR title_fa LIKE ?").bind(`%${query}%`, `%${query}%`).all();
  if (dbRows?.results) {
    for (const r of dbRows.results) {
      if (!seen.has(r.imdb_id)) {
        seen.add(r.imdb_id);
        let parsed = {};
        try { parsed = JSON.parse(r.links); } catch {}
        results.push([r.imdb_id, r.type, r.title_en, r.title_fa || r.title_en, r.year, r.rating, r.views, cleanUpLinksObject(parsed)]);
      }
    }
  }

  if (/^tt\d+$/i.test(query)) {
    const item = await getMovieById(db, query.toLowerCase(), env);
    if (item && !seen.has(item[0])) results.push(item);
  } else if (env?.TMDB_API_KEY) {
    const tmdbResults = await searchByTitle(query, env.TMDB_API_KEY);
    for (const t of tmdbResults.slice(0, 3)) {
      const ext = await fetch(`https://api.themoviedb.org/3/${t.media_type}/${t.id}/external_ids?api_key=${env.TMDB_API_KEY}`).then(r => r.json()).catch(() => ({}));
      if (ext.imdb_id && !seen.has(ext.imdb_id)) {
        seen.add(ext.imdb_id);
        const item = await getMovieById(db, ext.imdb_id, env);
        if (item) results.push(item);
      }
    }
  }
  return results;
}

export async function dbGetRandom(db) {
  const { results } = await db.prepare("SELECT * FROM custom_media WHERE links IS NOT NULL AND links != '{}' ORDER BY RANDOM() LIMIT 10").all();
  for (const row of results || []) {
    let parsed = {};
    try { parsed = JSON.parse(row.links); } catch {}
    const cleaned = cleanUpLinksObject(parsed);
    if (hasDownloadLinks(cleaned)) {
      return [row.imdb_id, row.type, row.title_en, row.title_fa || row.title_en, row.year, row.rating, row.views, cleaned];
    }
  }
  return null;
}
