import { dbGetByType } from '../db/database.js';

const imdbIdCache = new Map();
const tmdbCache = new Map();

export async function fetchImdbMediaList(category, page = 1, db, limit = 12, tmdbKey, genre = '') {
  try {
    let endpoint = '';
    let defaultType = 'movie';
    const genreParam = genre ? `&with_genres=${genre}` : '';

    if (category === 'trending') {
      endpoint = `https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbKey}&page=${page}&language=fa-IR`;
    } else if (category === 'movie') {
      defaultType = 'movie';
      endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&sort_by=popularity.desc&vote_count.gte=100&page=${page}&language=fa-IR${genreParam}`;
    } else if (category === 'series') {
      defaultType = 'series';
      endpoint = `https://api.themoviedb.org/3/discover/tv?api_key=${tmdbKey}&sort_by=popularity.desc&vote_count.gte=50&page=${page}&language=fa-IR${genreParam}`;
    } else if (category === 'top_movie') {
      defaultType = 'movie';
      endpoint = `https://api.themoviedb.org/3/movie/top_rated?api_key=${tmdbKey}&page=${page}&language=fa-IR${genreParam}`;
    } else if (category === 'top_series') {
      defaultType = 'series';
      endpoint = `https://api.themoviedb.org/3/tv/top_rated?api_key=${tmdbKey}&page=${page}&language=fa-IR${genreParam}`;
    }

    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('TMDb failed: ' + res.status);

    const data = await res.json();
    const rawResults = (data.results || []).slice(0, limit);

    const resolved = await Promise.all(
      rawResults.map(async (item) => {
        try {
          const mediaType = item.media_type ? (item.media_type === 'tv' ? 'series' : 'movie') : defaultType;
          const tmdbId = item.id;
          const titleEn = item.original_title || item.original_name || item.title || item.name || '';
          const titleFa = item.title || item.name || titleEn;
          const year = (item.release_date || item.first_air_date || '2024').substring(0, 4);
          const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : '7.0';

          let imdbId = imdbIdCache.get(`${mediaType}_${tmdbId}`);

          let localRow = null;
          if (db) {
            localRow = await db.prepare(
              "SELECT * FROM custom_media WHERE title_en = ? OR title_fa = ? LIMIT 1"
            ).bind(titleEn, titleFa).first();
            if (localRow?.imdb_id) {
              imdbId = localRow.imdb_id;
              imdbIdCache.set(`${mediaType}_${tmdbId}`, imdbId);
            }
          }

          if (!imdbId) {
            const extUrl = `https://api.themoviedb.org/3/${mediaType === 'series' ? 'tv' : 'movie'}/${tmdbId}/external_ids?api_key=${tmdbKey}`;
            const extRes = await fetch(extUrl);
            if (extRes.ok) {
              const extData = await extRes.json();
              if (extData.imdb_id) {
                imdbId = extData.imdb_id;
                imdbIdCache.set(`${mediaType}_${tmdbId}`, imdbId);
              }
            }
          }

          if (!imdbId) return null;

          let links = {};
          let views = 0;
          if (localRow) {
            views = localRow.views || 0;
            try { links = JSON.parse(localRow.links || '{}'); } catch {}
          }

          return [imdbId, mediaType, titleEn, titleFa, year, rating, views, links];
        } catch {
          return null;
        }
      })
    );

    const filtered = resolved.filter(Boolean);
    if (filtered.length > 0) return filtered;
    throw new Error('No items resolved');
  } catch (err) {
    if (db && (category === 'movie' || category === 'series')) {
      return await dbGetByType(db, category, page, limit);
    }
    return [];
  }
}

export async function getTMDBData(imdbId, tmdbKey) {
  if (tmdbCache.has(imdbId)) return tmdbCache.get(imdbId);
  try {
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbKey}&external_source=imdb_id`);
    const findData = await findRes.json();
    let tmdbId = null, mediaType = null;
    if (findData.movie_results?.length > 0) { tmdbId = findData.movie_results[0].id; mediaType = 'movie'; } 
    else if (findData.tv_results?.length > 0) { tmdbId = findData.tv_results[0].id; mediaType = 'tv'; }
    if (!tmdbId) { tmdbCache.set(imdbId, null); return null; }

    const detailRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}&append_to_response=credits,videos&language=fa-IR`);
    const detailData = await detailRes.json();
    let overview = detailData.overview;
    
    if (!overview) {
      const enRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}&append_to_response=credits,videos`);
      const enData = await enRes.json();
      overview = enData.overview || '';
      if (!detailData.genres?.length) detailData.genres = enData.genres;
    }
    if (overview.length > 350) overview = overview.substring(0, 350) + '...';

    const poster = detailData.poster_path ? `https://image.tmdb.org/t/p/w500${detailData.poster_path}` : null;
    const cast = detailData.credits?.cast ? detailData.credits.cast.slice(0, 3).map(c => c.name).join('، ') : '';
    let trailer = null;
    const video = detailData.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
    if (video) trailer = `https://www.youtube.com/watch?v=${video.key}`;

    const genres = detailData.genres ? detailData.genres.slice(0, 3).map(g => g.name).join('، ') : '';

    const result = { poster, overview, cast, trailer, genres };
    tmdbCache.set(imdbId, result);
    if (tmdbCache.size > 200) tmdbCache.delete(tmdbCache.keys().next().value);
    return result;
  } catch {
    return null;
  }
}

export async function getSimilarFromTMDB(imdbId, tmdbKey) {
  try {
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbKey}&external_source=imdb_id`);
    const findData = await findRes.json();
    
    let tmdbId = null, mediaType = null;
    if (findData.movie_results?.length > 0) { tmdbId = findData.movie_results[0].id; mediaType = 'movie'; } 
    else if (findData.tv_results?.length > 0) { tmdbId = findData.tv_results[0].id; mediaType = 'tv'; }
    if (!tmdbId) return [];

    let simRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/recommendations?api_key=${tmdbKey}&page=1`);
    let simData = await simRes.json();
    
    if (!simData.results?.length) {
      simRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/similar?api_key=${tmdbKey}&page=1`);
      simData = await simRes.json();
    }

    if (!simData.results?.length) return [];
    return simData.results.slice(0, 10).map(m => m.title || m.name).filter(Boolean);
  } catch {
    return [];
  }
}

export async function findByImdbId(imdbId, tmdbKey) {
  const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbKey}&external_source=imdb_id`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const m = data.movie_results?.[0];
  const t = data.tv_results?.[0];
  const item = m || t;
  if (!item) return null;

  return {
    id: item.id,
    imdbId,
    title: item.title || item.name,
    type: m ? 'movie' : 'series',
    year: (item.release_date || item.first_air_date || '').substring(0, 4),
    rating: item.vote_average ? item.vote_average.toFixed(1) : '0.0'
  };
}

export async function searchByTitle(title, tmdbKey) {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
}
