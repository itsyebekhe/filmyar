import { BASE_SCRAPER_URL, MAX_CRAWL_FETCHES } from '../config/constants.js';
import { cleanUpLinksObject, makeSafeParam } from '../utils/helpers.js';
import { findByImdbId } from './tmdb.js';

function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/^the\s+|^a\s+|^an\s+/i, '') // Remove leading English articles
    .replace(/[^a-z0-9\s]/g, ' ') // Strip punctuation
    .trim()
    .replace(/\s+/g, ' ');
}

function parseFilm2MediaEntry(rawTitle, entryHtml) {
  const cleanText = rawTitle.replace(/<[^>]+>/g, '').trim();

  // 1. Detect Movie vs Series
  const isSeries = /سریال|مجموعه|فصل/i.test(cleanText);

  // 2. Extract Year from calendar badge or title (19xx or 20xx)
  const calendarYearMatch = entryHtml.match(/icon-calendar[\s\S]*?<\/svg>\s*(\d{4})/i);
  const titleYearMatch = cleanText.match(/\b(19\d\d|20\d\d)\b/);
  const year = calendarYearMatch ? calendarYearMatch[1] : (titleYearMatch ? titleYearMatch[1] : null);

  // 3. Extract purely the English title portion
  let enTitle = cleanText
    .replace(/^دانلود\s+(?:فیلم|سریال|انیمیشن|مینی\s*سریال|فیلم\s*سینمایی)\s*/i, '')
    .replace(/\s*(?:با\s+)?(?:دوبله|زیرنویس|سانسور|فارسی|چسبیده|کامل|بدون\s*سانسور).*$/i, '')
    .replace(/\b(19\d\d|20\d\d)\b.*$/, '')
    .trim();

  return {
    rawTitle: cleanText,
    enTitle,
    year,
    isSeries
  };
}

function isStrictMatch(f2mEntry, targetTitle, targetYear, targetType) {
  // A. Strict Type Match (Movie vs Series)
  if (targetType === 'movie' && f2mEntry.isSeries) return false;
  if (targetType === 'series' && !f2mEntry.isSeries) return false;

  // B. Exact Normalized Title Match
  const normF2M = normalizeTitle(f2mEntry.enTitle);
  const normTarget = normalizeTitle(targetTitle);

  if (!normF2M || !normTarget) return false;
  if (normF2M !== normTarget) return false;

  // C. Year Match (Tolerance of ±1 year for global vs domestic release variance)
  if (targetYear && f2mEntry.year) {
    const tYr = parseInt(targetYear, 10);
    const fYr = parseInt(f2mEntry.year, 10);
    if (!isNaN(tYr) && !isNaN(fYr)) {
      if (Math.abs(tYr - fYr) > 1) {
        return false;
      }
    }
  }

  return true;
}

async function searchFilm2Media(query) {
  // Search using exact title to minimize broad fuzzy results
  const cleanQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const url = `https://www.f2mc.top/?s=${encodeURIComponent(cleanQuery)}&type=both`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return [];
    const html = await res.text();

    const entries = [];
    const entryRegex = /<article class="entry">([\s\S]*?)<\/article>/gi;
    let match;

    while ((match = entryRegex.exec(html)) !== null) {
      const entryHtml = match[1];
      const titleMatch = entryHtml.match(/<h2 class="entry-title">([\s\S]*?)<\/h2>/i);
      const linkMatch = entryHtml.match(/<a href="([^"]+)"[^>]*class="stretched-link"/i);

      if (titleMatch && linkMatch) {
        const parsed = parseFilm2MediaEntry(titleMatch[1].trim(), entryHtml);
        entries.push({
          ...parsed,
          link: linkMatch[1]
        });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

async function verifyPath(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function crawlDirectory(currentUrl, rootUrl, list, state) {
  if (state.fetchCount >= MAX_CRAWL_FETCHES) return;
  const res = await fetch(currentUrl);
  state.fetchCount++;
  if (!res.ok) return;

  const html = await res.text();
  const items = [];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowContent = match[1];
    const hrefMatch = rowContent.match(/<a href="([^"]+)"/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href === '../' || href === '/' || href.startsWith('http')) continue;

    let size = "-";
    const sizeMatch = rowContent.match(/<td class="s">[\s\S]*?<code>([\s\S]*?)<\/code>/i);
    if (sizeMatch) size = sizeMatch[1].trim();

    items.push({ name: href, size });
  }

  for (const item of items) {
    const itemUrl = currentUrl + item.name;
    if (item.name.endsWith('/')) {
      await crawlDirectory(itemUrl, rootUrl, list, state);
    } else {
      const relativePath = itemUrl.replace(rootUrl, "");
      const meta = extractFileMetadata(item.name, relativePath);
      list.push({
        name: decodeURIComponent(item.name),
        url: itemUrl,
        size: item.size,
        ...meta
      });
    }
  }
}

async function extractF2mDirectLinks(postUrl) {
  const links = [];
  try {
    const res = await fetch(postUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return [];
    let html = await res.text();
    html = html.replace(/&#13;&#10;|&#13;|&#10;/gi, '\n');

    const urlRegex = /https?:\/\/[^\s'"<>]+\.(?:mkv|mp4)/gi;
    let match;
    const seen = new Set();

    while ((match = urlRegex.exec(html)) !== null) {
      const rawUrl = match[0];
      const parts = rawUrl.split(/(?:\r\n|\r|\n|%0[Dd]%0[Aa]|%0[Dd]|%0[Aa]|%20|\s)+/);
      for (const part of parts) {
        const url = part.trim();
        if (!url || !url.startsWith('http') || seen.has(url)) continue;
        seen.add(url);
        const filename = url.substring(url.lastIndexOf('/') + 1);
        const meta = extractFileMetadata(filename, url);
        links.push({
          name: decodeURIComponent(filename),
          url: url,
          size: "Direct",
          ...meta
        });
      }
    }
  } catch {}
  return links;
}

function extractFileMetadata(filename, path) {
  let subType = "NoSub";
  if (path.includes("SoftSub/") || filename.includes("SoftSub") || filename.includes("Farsi.Sub")) subType = "SoftSub";
  else if (path.includes("HardSub/") || filename.includes("HardSub") || filename.includes("Subbed")) subType = "HardSub";
  else if (filename.includes("Dubbed") || filename.includes("Farsi.Dub") || path.includes(".Farsi/")) subType = "Dubbed";

  let season = "Season 1";
  const seasonMatch = 
    path.match(/Season[._\-\s]*(\d+)/i) || 
    filename.match(/Season[._\-\s]*(\d+)/i) || 
    path.match(/[\/\._\-\s]S(\d+)/i) || 
    filename.match(/S(\d+)/i);

  if (seasonMatch) season = `Season ${parseInt(seasonMatch[1], 10)}`;

  let quality = "Unknown";
  const qualityMatch = filename.match(/(\d{3,4}p)/i) || path.match(/(\d{3,4}p)/i);
  if (qualityMatch) quality = qualityMatch[1].toLowerCase();

  return { season, subType, quality };
}

function groupFiles(files, mediaType) {
  const result = {};
  for (const f of files) {
    const { season, subType, quality } = f;
    if (mediaType === "series") {
      if (!result[season]) result[season] = {};
      if (!result[season][subType]) result[season][subType] = {};
      if (!result[season][subType][quality]) result[season][subType][quality] = [];
      result[season][subType][quality].push({ name: f.name, url: f.url, size: f.size });
    } else {
      if (!result[subType]) result[subType] = {};
      if (!result[subType][quality]) result[subType][quality] = [];
      result[subType][quality].push({ name: f.name, url: f.url, size: f.size });
    }
  }
  return result;
}

export async function scrapeMovieByImdbId(imdbId, tmdbKey, botUsername) {
  const tmdbData = await findByImdbId(imdbId, tmdbKey);
  if (!tmdbData) return null;

  const f2mSearchResults = await searchFilm2Media(tmdbData.title);
  const f2mMatches = f2mSearchResults.filter(item =>
    isStrictMatch(item, tmdbData.title, tmdbData.year, tmdbData.type)
  );

  let serverUrl = "";
  let foundOnServer = false;
  if (tmdbData.type === "movie" && tmdbData.year) {
    serverUrl = `${BASE_SCRAPER_URL}/movie4/${tmdbData.year}/${imdbId}/`;
    foundOnServer = await verifyPath(serverUrl);
  } else if (tmdbData.type === "series") {
    serverUrl = `${BASE_SCRAPER_URL}/series4/${imdbId}/`;
    foundOnServer = await verifyPath(serverUrl);
  }

  let structuredFiles = null;
  let f2mDownloads = null;
  const state = { fetchCount: 0 };

  const serverPromise = foundOnServer ? (async () => {
    const flatList = [];
    await crawlDirectory(serverUrl, serverUrl, flatList, state);
    structuredFiles = groupFiles(flatList, tmdbData.type);
  })() : Promise.resolve();

  const f2mPromise = (f2mMatches.length > 0) ? (async () => {
    const allLinks = [];
    for (const match of f2mMatches) {
      if (match.link) {
        const raw = await extractF2mDirectLinks(match.link);
        allLinks.push(...raw);
      }
    }
    f2mDownloads = groupFiles(allLinks, tmdbData.type);
  })() : Promise.resolve();

  await Promise.all([serverPromise, f2mPromise]);

  const links = mapFilesToLinks(structuredFiles, f2mDownloads, tmdbData.type, imdbId, botUsername);

  return {
    imdbId,
    type: tmdbData.type,
    title_en: tmdbData.title,
    title_fa: tmdbData.title,
    year: tmdbData.year || "2024",
    rating: tmdbData.rating || "0.0",
    links: cleanUpLinksObject(links)
  };
}

function mapFilesToLinks(serverFiles, f2mFiles, mediaType, imdbId, botUsername) {
  const links = {};
  const mapSub = (s) => (s === "SoftSub" || s === "HardSub" ? "1" : (s === "Dubbed" ? "2" : "3"));

  if (mediaType === "movie") {
    const addMovie = (filesObj) => {
      if (!filesObj) return;
      for (const sub in filesObj) {
        const ver = mapSub(sub);
        if (!links[ver]) links[ver] = [];
        for (const q in filesObj[sub]) {
          for (const f of filesObj[sub][q]) {
            if (!links[ver].some(x => x.file === f.url)) {
              links[ver].push({
                quality: `${q} ${sub}`,
                size: f.size || "Direct",
                file: f.url
              });
            }
          }
        }
      }
    };
    addMovie(serverFiles);
    addMovie(f2mFiles);
  } else {
    const addSeries = (filesObj) => {
      if (!filesObj) return;
      for (const sName in filesObj) {
        const sNum = (sName.match(/\d+/) || ["1"])[0];
        for (const sub in filesObj[sName]) {
          const ver = mapSub(sub);
          if (!links[ver]) links[ver] = {};
          if (!links[ver][sNum]) links[ver][sNum] = [];

          for (const q in filesObj[sName][sub]) {
            const episodes = filesObj[sName][sub][q];
            if (!episodes || episodes.length === 0) continue;

            const qName = `${q} ${sub}`;
            let existingGroup = links[ver][sNum].find(x => x.quality === qName);

            if (!existingGroup) {
              existingGroup = {
                quality: qName,
                number_of_episodes: episodes.length.toString(),
                avg_episode_size: 350 * 1024 * 1024,
                folder: `https://t.me/${botUsername}?start=ep_${imdbId}_${ver}_${sNum}_${makeSafeParam(qName)}`,
                episodes: []
              };
              links[ver][sNum].push(existingGroup);
            }

            for (const ep of episodes) {
              if (!existingGroup.episodes.some(e => e.url === ep.url)) {
                existingGroup.episodes.push({ name: ep.name, url: ep.url, size: ep.size });
              }
            }
            existingGroup.number_of_episodes = existingGroup.episodes.length.toString();
          }
        }
      }
    };
    addSeries(serverFiles);
    addSeries(f2mFiles);
  }

  return links;
}