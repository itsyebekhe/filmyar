export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sanitizeDownloadUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) return '';
  try {
    url = encodeURI(url);
  } catch {
    url = url.replace(/\s/g, '%20');
  }
  return url.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
}

export function safeButtonUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;
  try {
    return encodeURI(trimmed);
  } catch {
    return trimmed.replace(/\s/g, '%20');
  }
}

export function makeSafeParam(str) {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
}

export function extractEpTag(filenameOrUrl) {
  if (!filenameOrUrl) return null;
  const decoded = decodeURIComponent(filenameOrUrl);
  const match = decoded.match(/S\d+E(\d+)/i) || decoded.match(/E(\d+)/i) || decoded.match(/episode[._\-\s]*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function generateGoogleDorkLinks(titleEn, year) {
  const cleanTitle = titleEn.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const searchYear = year ? ` ${year}` : '';
  const directIndexDork = `intitle:"index of" "${cleanTitle}"${searchYear} (mkv|mp4)`;
  const generalDork = `"${cleanTitle}"${searchYear} "دانلود" (mkv|mp4)`;

  return {
    indexUrl: `https://www.google.com/search?q=${encodeURIComponent(directIndexDork)}`,
    generalUrl: `https://www.google.com/search?q=${encodeURIComponent(generalDork)}`
  };
}

export function isFilenameMatch(filename, targetTitle, targetYear) {
  if (!filename || !targetTitle) return false;

  const cleanFile = decodeURIComponent(filename)
    .toLowerCase()
    .replace(/\.[a-z0-9]{3,4}$/i, '')
    .replace(/[._\-\+]/g, ' ')
    .trim();

  const cleanTarget = targetTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 1 && !['the', 'a', 'an'].includes(w));

  if (targetWords.length === 0) return true;

  const fileWords = cleanFile.split(/\s+/);
  const allWordsPresent = targetWords.every(tw => fileWords.includes(tw));
  if (!allWordsPresent) return false;

  // Guard against prefixes (e.g. "Blade Runner" or "Maze Runner" when target is "Runner")
  const firstTargetWord = targetWords[0];
  const targetIdx = fileWords.indexOf(firstTargetWord);
  if (targetIdx > 0) {
    const priorWord = fileWords[targetIdx - 1];
    const allowedPrefixes = ['the', 'a', 'an', 'film', 'movie'];
    if (!allowedPrefixes.includes(priorWord) && !/^\d+$/.test(priorWord)) {
      return false;
    }
  }

  // Guard against year mismatch if both exist
  if (targetYear) {
    const fileYearMatch = cleanFile.match(/\b(19\d\d|20\d\d)\b/);
    if (fileYearMatch) {
      const fileYr = parseInt(fileYearMatch[1], 10);
      const targetYr = parseInt(targetYear, 10);
      if (!isNaN(fileYr) && !isNaN(targetYr)) {
        if (Math.abs(fileYr - targetYr) > 1) {
          return false;
        }
      }
    }
  }

  return true;
}

export function isCachedLinksValid(links, titleEn, year) {
  if (!links || typeof links !== 'object') return false;
  for (const ver in links) {
    const list = links[ver];
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item.file) {
          const fname = item.file.substring(item.file.lastIndexOf('/') + 1);
          if (!isFilenameMatch(fname, titleEn, year)) return false;
        }
      }
    } else if (typeof list === 'object' && list !== null) {
      for (const s in list) {
        if (Array.isArray(list[s])) {
          for (const q of list[s]) {
            if (q.episodes) {
              for (const ep of q.episodes) {
                if (ep.url) {
                  const fname = ep.url.substring(ep.url.lastIndexOf('/') + 1);
                  if (!isFilenameMatch(fname, titleEn, year)) return false;
                }
              }
            }
          }
        }
      }
    }
  }
  return true;
}

export async function verifyTelegramAuth(authData, botToken) {
  if (!authData || !authData.hash || !botToken) return false;

  const { hash, ...data } = authData;

  // Reject replay attacks older than 24 hours
  const now = Math.floor(Date.now() / 1000);
  if (data.auth_date && now - Number(data.auth_date) > 86400) {
    return false;
  }

  const checkString = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');

  const encoder = new TextEncoder();
  const secretKeyHash = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretKeyHash,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(checkString));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hexSignature.toLowerCase() === hash.toLowerCase();
}

export function hasDownloadLinks(links) {
  if (!links || typeof links !== 'object') return false;
  let totalLinks = 0;

  for (const ver in links) {
    const val = links[ver];
    if (Array.isArray(val)) {
      val.forEach(q => { if (q.file) totalLinks++; });
    } else if (typeof val === 'object' && val !== null) {
      for (const season in val) {
        if (Array.isArray(val[season])) {
          val[season].forEach(q => {
            if (q.episodes && Array.isArray(q.episodes)) {
              totalLinks += q.episodes.length;
            } else if (q.folder) {
              totalLinks++;
            }
          });
        }
      }
    }
  }
  return totalLinks > 0;
}

export function cleanUpLinksObject(links) {
  if (!links || typeof links !== 'object') return links;

  const getEpNum = (name) => {
    if (!name) return 0;
    const match = name.match(/E(\d+)/i) || name.match(/episode\s*(\d+)/i) || name.match(/[\s\._](\d+)[\s\._]/);
    return match ? parseInt(match[1], 10) : 0;
  };

  for (const ver in links) {
    if (!links[ver] || typeof links[ver] !== 'object' || Array.isArray(links[ver])) continue;

    for (const season in links[ver]) {
      const qualityList = links[ver][season];
      if (!Array.isArray(qualityList)) continue;

      for (const q of qualityList) {
        if (!q || !Array.isArray(q.episodes)) continue;

        let newEpisodes = [];
        for (const ep of q.episodes) {
          if (!ep?.url) continue;
          if (/(?:%0[Dd]%0[Aa]|%0[Dd]|%0[Aa]|\r\n|\r|\n|<br\s*\/?>|&#13;&#10;)/i.test(ep.url)) {
            const parts = ep.url.split(/(?:%0[Dd]%0[Aa]|%0[Dd]|%0[Aa]|\r\n|\r|\n|<br\s*\/?>|&#13;&#10;)/i);
            for (const p of parts) {
              const url = p.trim();
              if (url?.startsWith('http')) {
                newEpisodes.push({
                  name: decodeURIComponent(url.substring(url.lastIndexOf('/') + 1)),
                  url,
                  size: ep.size
                });
              }
            }
          } else {
            newEpisodes.push(ep);
          }
        }

        const deduped = [];
        const seenUrls = new Set();
        const seenNums = new Set();

        newEpisodes.forEach(ep => {
          if (seenUrls.has(ep.url)) return;
          seenUrls.add(ep.url);
          const num = getEpNum(ep.name);
          if (num > 0) {
            if (seenNums.has(num)) return;
            seenNums.add(num);
          }
          deduped.push(ep);
        });

        deduped.sort((a, b) => {
          const aNum = getEpNum(a.name);
          const bNum = getEpNum(b.name);
          if (aNum !== bNum) return aNum - bNum;
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        q.episodes = deduped;
        q.number_of_episodes = deduped.length.toString();
      }
    }
  }
  return links;
}
