import { BASE_SCRAPER_URL, MAX_CRAWL_FETCHES } from '../config/constants.js';
import { cleanUpLinksObject } from '../utils/helpers.js';
import { findByImdbId } from './tmdb.js';

function isTitleMatch(t1, t2) {
  if (!t1 || !t2) return false;
  const clean = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\b\d{4}\b/g, "").trim().replace(/\s+/g, " ");
  const c1 = clean(t1);
  const c2 = clean(t2);
  if (c1 === c2) return true;
  const w1 = c1.split(' ');
  const w2 = c2.split(' ');
  return w1.length === w2.length && w1.every(w => w2.includes(w));
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
    const hrefMatch = match[1].match(/<a href="([^"]+)"/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href === '../' || href === '/' || href.startsWith('http')) continue;
    items.push({ name: href });
  }

  for (const item of items) {
    const itemUrl = currentUrl + item.name;
    if (item.name.endsWith('/')) {
      await crawlDirectory(itemUrl, rootUrl, list, state);
    } else {
      const meta = extractFileMetadata(item.name, itemUrl.replace(rootUrl, ""));
      list.push({
        name: decodeURIComponent(item.name),
        url: itemUrl,
        size: "Direct",
        ...meta
      });
    }
  }
}

function extractFileMetadata(filename, path) {
  let subType = "NoSub";
  if (path.includes("SoftSub/") || filename.includes("SoftSub") || filename.includes("Farsi.Sub")) subType = "SoftSub";
  else if (path.includes("HardSub/") || filename.includes("HardSub") || filename.includes("Subbed")) subType = "HardSub";
  else if (filename.includes("Dubbed") || filename.includes("Farsi.Dub") || path.includes(".Farsi/")) subType = "Dubbed";

  let season = "Season 1";
  const seasonMatch = path.match(/Season[._\-\s]*(\d+)/i) || filename.match(/Season[._\-\s]*(\d+)/i) || path.match(/[\/\._\-\s]S(\d+)/i) || filename.match(/S(\d+)/i);
  if (seasonMatch) season = `Season ${parseInt(seasonMatch[1], 10)}`;

  let quality = "720p";
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
  const state = { fetchCount: 0 };

  if (foundOnServer) {
    const flatList = [];
    await crawlDirectory(serverUrl, serverUrl, flatList, state);
    structuredFiles = groupFiles(flatList, tmdbData.type);
  }

  const links = mapFilesToLinks(structuredFiles, tmdbData.type, imdbId, botUsername);
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

function mapFilesToLinks(filesObj, mediaType, imdbId, botUsername) {
  const links = {};
  if (!filesObj) return links;

  const mapSub = (s) => (s === "SoftSub" || s === "HardSub" ? "1" : (s === "Dubbed" ? "2" : "3"));

  if (mediaType === "movie") {
    for (const sub in filesObj) {
      const ver = mapSub(sub);
      if (!links[ver]) links[ver] = [];
      for (const q in filesObj[sub]) {
        for (const f of filesObj[sub][q]) {
          links[ver].push({ quality: `${q} ${sub}`, size: f.size || "Direct", file: f.url });
        }
      }
    }
  } else {
    for (const sName in filesObj) {
      const sNum = (sName.match(/\d+/) || ["1"])[0];
      for (const sub in filesObj[sName]) {
        const ver = mapSub(sub);
        if (!links[ver]) links[ver] = {};
        if (!links[ver][sNum]) links[ver][sNum] = [];

        for (const q in filesObj[sName][sub]) {
          const episodes = filesObj[sName][sub][q];
          links[ver][sNum].push({
            quality: `${q} ${sub}`,
            number_of_episodes: episodes.length.toString(),
            avg_episode_size: 350 * 1024 * 1024,
            folder: `https://t.me/${botUsername}?start=ep_${imdbId}_${ver}_${sNum}_${q}`,
            episodes: episodes.map(e => ({ name: e.name, url: e.url, size: e.size }))
          });
        }
      }
    }
  }
  return links;
}
