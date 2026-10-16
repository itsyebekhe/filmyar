import { sendTelegram, checkMembership } from './api.js';
import { getTMDBData, getSimilarFromTMDB } from '../services/tmdb.js';
import { TYPE_EMOJI, VERSION_MAP, ITEMS_PER_PAGE } from '../config/constants.js';
import {
  escapeHTML,
  sanitizeDownloadUrl,
  generateGoogleDorkLinks,
  hasDownloadLinks,
  makeSafeParam
} from '../utils/helpers.js';
import {
  dbGetChannels,
  dbManageChannel,
  dbGetAdminData,
  dbGetStats,
  dbFavToggle,
  dbHistoryAdd,
  dbTrack,
  getMovieById,
  searchMovies,
  dbGetRandom
} from '../db/database.js';

export async function handleTelegramUpdate(update, env, ctx) {
  try {
    const token = env.BOT_TOKEN;
    const db = env.DB;

    if (!token) {
      console.error('❌ Cannot process update: BOT_TOKEN is missing in environment variables.');
      return;
    }

    const user = update.message?.from || update.callback_query?.from || update.inline_query?.from;
    if (user && db) {
      ctx?.waitUntil(
        db.prepare(
          "INSERT INTO users (id, username, first_name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name"
        ).bind(user.id, user.username || null, user.first_name || null).run().catch(err => {
          console.error('User sync warning:', err.message);
        })
      );
    }

    if (update.message?.text) {
      await handleMessage(update.message, env, ctx);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query, env, ctx);
    } else if (update.inline_query) {
      await handleInlineQuery(update.inline_query, env);
    }
  } catch (err) {
    console.error('❌ Error handling Telegram update:', err.stack || err);
  }
}

async function handleMessage(message, env, ctx) {
  const { chat: { id: chatId, type: chatType }, from: { id: userId }, text } = message;
  const token = env.BOT_TOKEN;
  const db = env.DB;
  const adminId = env.ADMIN_CHAT_ID;

  if ((chatType === 'group' || chatType === 'supergroup') && chatId.toString() !== env.REQUEST_GROUP_ID) {
    return;
  }

  if (chatType === 'private') {
    const channels = await dbGetChannels(db);
    const joinCheck = await checkMembership(userId, token, channels);
    if (!joinCheck.ok) {
      return sendForceJoin(chatId, joinCheck.missing, token);
    }
  }

  // Admin Commands
  if (userId.toString() === adminId) {
    if (text === '/panel') {
      const stats = await dbGetStats(db);
      const admin = await dbGetAdminData(db);
      const msg = `📊 <b>پنل مدیریت ربات</b>\n━━━━━━━━━━━━━━━━━━━━\n👥 <b>کل کاربران:</b> ${admin.total_users}\n🎬 <b>آرشیو:</b> ${stats.movies} فیلم | ${stats.series} سریال\n\n⚙️ <code>/addchannel @ch</code> | <code>/delchannel @ch</code>`;
      return sendTelegram('sendMessage', token, { chat_id: chatId, text: msg, parse_mode: 'HTML' });
    }

    if (text.startsWith('/addchannel ')) {
      await dbManageChannel(db, 'add', text.split(' ')[1]);
      return sendTelegram('sendMessage', token, { chat_id: chatId, text: '✅ کانال به قفل اجباری اضافه شد.' });
    }
    if (text.startsWith('/delchannel ')) {
      await dbManageChannel(db, 'del', text.split(' ')[1]);
      return sendTelegram('sendMessage', token, { chat_id: chatId, text: '🗑 کانال از قفل اجباری حذف شد.' });
    }
  }

  if (chatType !== 'private') return;

  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    if (parts.length > 1) {
      const payload = parts[1];
      if (payload.startsWith('tt')) {
        return renderMovieCard(payload, chatId, null, env, ctx);
      }
      if (payload.startsWith('ep_')) {
        return renderEpisodesListPage(payload, chatId, env);
      }
    }
    return sendMainMenu(chatId, null, env);
  }

  const imdbMatch = text.match(/(tt\d+)/);
  if (imdbMatch) {
    return renderMovieCard(imdbMatch[1], chatId, null, env, ctx);
  }

  // Text Search
  await renderSearchList(text, 1, chatId, null, env);
}

async function handleCallback(cb, env, ctx) {
  const { id: cbId, message: { chat: { id: chatId }, message_id: msgId }, data, from: { id: userId } } = cb;
  const token = env.BOT_TOKEN;
  const db = env.DB;

  if (data === 'check_join') {
    const channels = await dbGetChannels(db);
    const joinCheck = await checkMembership(userId, token, channels);
    if (joinCheck.ok) {
      await sendTelegram('deleteMessage', token, { chat_id: chatId, message_id: msgId }).catch(() => {});
      return sendMainMenu(chatId, null, env);
    }
    return sendTelegram('answerCallbackQuery', token, {
      callback_query_id: cbId,
      text: '❌ هنوز در تمام کانال‌ها عضو نشده‌اید!',
      show_alert: true
    });
  }

  if (data === 'home') {
    await sendMainMenu(chatId, msgId, env);
  } else if (data === 'random') {
    const r = await dbGetRandom(db);
    if (r) await renderMovieCard(r[0], chatId, msgId, env, ctx);
  } else if (data.startsWith('dl_')) {
    await renderMovieCard(data.split('_')[1], chatId, msgId, env, ctx);
  } else if (data.startsWith('fav_')) {
    const res = await dbFavToggle(db, userId, data.split('_')[1]);
    await sendTelegram('answerCallbackQuery', token, {
      callback_query_id: cbId,
      text: res.status === 'added' ? '✅ به لیست تماشا اضافه شد.' : '❌ از لیست حذف شد.',
      show_alert: true
    });
  } else if (data.startsWith('similar_')) {
    await renderSimilarMovies(data.split('_')[1], chatId, msgId, env);
  } else if (data.startsWith('ver_')) {
    const [, movieId, verKey] = data.split('_');
    await renderVersionDownloads(movieId, verKey, chatId, msgId, env);
  } else if (data.startsWith('sea_')) {
    const [, movieId, verKey, season] = data.split('_');
    await renderSeasonLinksPage(movieId, verKey, season, chatId, msgId, env);
  } else if (data.startsWith('q_')) {
    const [, movieId, verKey, qIdx] = data.split('_');
    await renderQualityLinks(movieId, verKey, parseInt(qIdx, 10), chatId, msgId, env);
  } else if (data.startsWith('s_')) {
    const parts = data.split('_');
    const page = parseInt(parts[1], 10);
    const query = parts.slice(2).join('_');
    await renderSearchList(query, page, chatId, msgId, env);
  }

  await sendTelegram('answerCallbackQuery', token, { callback_query_id: cbId }).catch(() => {});
}

async function renderMovieCard(movieId, chatId, msgId, env, ctx) {
  const { DB: db, BOT_TOKEN: token, TMDB_API_KEY: tmdbKey } = env;
  const [item, tmdb] = await Promise.all([
    getMovieById(db, movieId, env),
    getTMDBData(movieId, tmdbKey)
  ]);

  if (!item) {
    const notFound = `❌ <b>این عنوان در دیتابیس یافت نشد!</b>\n━━━━━━━━━━━━━━━━━━━━\n🔎 لطفاً نام فیلم را به فارسی یا انگلیسی جستجو کنید.`;
    return sendTelegram('sendMessage', token, {
      chat_id: chatId,
      text: notFound,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'home' }]] }
    });
  }

  ctx?.waitUntil(Promise.all([
    dbTrack(db, movieId),
    dbHistoryAdd(db, chatId, movieId)
  ]));

  const icon = TYPE_EMOJI[item[1]] || '🎬';
  const titleFa = item[3] || item[2];
  const titleEn = item[2] || item[3];

  let text = `${icon} <b>${titleFa}</b>\n`;
  if (titleEn && titleEn !== titleFa) text += `🇬🇧 <i>${titleEn}</i>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `⭐️ <b>امتیاز:</b> <code>${item[5]} / 10</code>\n`;
  text += `🗓 <b>سال ساخت:</b> <code>${item[4]}</code>\n`;
  text += `🎭 <b>نوع:</b> ${item[1] === 'movie' ? 'سینمایی' : 'سریال'}\n`;

  if (tmdb?.genres) text += `🏷 <b>ژانر:</b> ${tmdb.genres}\n`;
  if (tmdb?.overview) text += `\n<blockquote>📖 <b>خلاصه:</b>\n${tmdb.overview}</blockquote>\n`;

  const links = item[7] || {};
  const keyboard = [];

  if (tmdb?.trailer) {
    keyboard.push([{ text: '🎞 تماشای تریلر رسمی', url: tmdb.trailer }]);
  }

  const hasLinks = hasDownloadLinks(links);

  if (hasLinks) {
    for (const vKey in links) {
      keyboard.push([{
        text: `📥 ${VERSION_MAP[vKey] || `نسخه ${vKey}`}`,
        callback_data: `ver_${movieId}_${vKey}`
      }]);
    }
  } else {
    const dorks = generateGoogleDorkLinks(titleEn, item[4]);
    text += `\n⚠️ <i>لینک‌های داخلی در دسترس نیستند. منابع جایگزین مستقیم:</i>`;
    keyboard.push([{ text: '📂 جستجوی دایرکتوری مستقیم در گوگل', url: dorks.indexUrl }]);
    keyboard.push([{ text: '🌐 جستجوی کامل وب در گوگل', url: dorks.generalUrl }]);
  }

  keyboard.push([{ text: '🔄 عناوین مشابه', callback_data: `similar_${movieId}` }]);
  keyboard.push([
    { text: '📌 لیست تماشا', callback_data: `fav_${movieId}` },
    { text: '🏠 منوی اصلی', callback_data: 'home' }
  ]);

  if (msgId) await sendTelegram('deleteMessage', token, { chat_id: chatId, message_id: msgId }).catch(() => {});

  if (tmdb?.poster) {
    await sendTelegram('sendPhoto', token, {
      chat_id: chatId,
      photo: tmdb.poster,
      caption: text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  } else {
    await sendTelegram('sendMessage', token, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

async function renderVersionDownloads(movieId, verKey, chatId, msgId, env) {
  const item = await getMovieById(env.DB, movieId, env);
  if (!item) return;

  const title = item[3] || item[2];
  const vName = VERSION_MAP[verKey] || `نسخه ${verKey}`;
  const keyboard = [];

  if (item[1] === 'movie') {
    const rawLinks = item[7]?.[verKey] || [];
    const grouped = new Map();
    rawLinks.forEach(l => {
      const q = (l.quality || 'سایر کیفیت‌ها').replace(/\./g, ' ').trim();
      if (!grouped.has(q)) grouped.set(q, []);
      grouped.get(q).push(l);
    });

    let idx = 0;
    for (const [qName, files] of grouped.entries()) {
      const countBadge = files.length > 1 ? ` (${files.length} فایل)` : '';
      keyboard.push([{
        text: `🔸 ${qName}${countBadge}`,
        callback_data: `q_${movieId}_${verKey}_${idx++}`
      }]);
    }
  } else {
    const seasons = item[7]?.[verKey] || {};
    let row = [];
    for (const sNum in seasons) {
      row.push({ text: `📁 فصل ${sNum}`, callback_data: `sea_${movieId}_${verKey}_${sNum}` });
      if (row.length === 2) {
        keyboard.push(row);
        row = [];
      }
    }
    if (row.length > 0) keyboard.push(row);
  }

  keyboard.push([
    { text: '🔙 بازگشت به مشخصات', callback_data: `dl_${movieId}` },
    { text: '🏠 منوی اصلی', callback_data: 'home' }
  ]);

  await sendTelegram('editMessageText', env.BOT_TOKEN, {
    chat_id: chatId,
    message_id: msgId,
    text: `🎬 <b>${title}</b>\n🏷 <b>${vName}</b>\n━━━━━━━━━━━━━━━━━━━━\n👇 کیفیت یا فصل مورد نظر را انتخاب کنید:`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function renderQualityLinks(movieId, verKey, qIdx, chatId, msgId, env) {
  const item = await getMovieById(env.DB, movieId, env);
  const rawLinks = item?.[7]?.[verKey] || [];

  const grouped = new Map();
  rawLinks.forEach(l => {
    const q = (l.quality || 'سایر کیفیت‌ها').replace(/\./g, ' ').trim();
    if (!grouped.has(q)) grouped.set(q, []);
    grouped.get(q).push(l);
  });

  const keys = Array.from(grouped.keys());
  const selectedQuality = keys[qIdx];
  const files = grouped.get(selectedQuality) || [];

  const keyboard = [];
  files.forEach(f => {
    const safeUrl = sanitizeDownloadUrl(f.file);
    if (safeUrl) {
      const sizeTag = f.size && f.size !== 'Direct' ? ` (${f.size})` : '';
      keyboard.push([{ text: `📥 دریافت مستقیم${sizeTag}`, url: safeUrl }]);
    }
  });

  keyboard.push([
    { text: '🔙 بازگشت به کیفیت‌ها', callback_data: `ver_${movieId}_${verKey}` },
    { text: '🏠 منوی اصلی', callback_data: 'home' }
  ]);

  await sendTelegram('editMessageText', env.BOT_TOKEN, {
    chat_id: chatId,
    message_id: msgId,
    text: `⚡️ <b>لینک‌های مستقیم نیم‌بها:</b>\n🏷 کیفیت: <code>${escapeHTML(selectedQuality || '')}</code>`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function renderSeasonLinksPage(movieId, verKey, season, chatId, msgId, env) {
  const item = await getMovieById(env.DB, movieId, env);
  if (!item) return;

  const title = item[3] || item[2];
  const vName = VERSION_MAP[verKey] || `نسخه ${verKey}`;
  const seasonLinks = item[7]?.[verKey]?.[season] || [];

  let msg = `📺 <b>${title}</b>\n`;
  msg += `📁 <b>فصل ${season}</b> • <i>${vName}</i>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👇 <i>کیفیت مورد نظر را جهت مشاهده و دانلود قسمت‌ها انتخاب کنید:</i>`;

  const keyboard = [];
  seasonLinks.forEach(l => {
    const epCount = l.episodes ? `${l.episodes.length} قسمت` : `${l.number_of_episodes || 'موجود'} قسمت`;
    keyboard.push([{
      text: `🔸 ${l.quality} (${epCount})`,
      url: l.folder
    }]);
  });

  keyboard.push([
    { text: '🔙 لیست فصل‌ها', callback_data: `ver_${movieId}_${verKey}` },
    { text: '🏠 منوی اصلی', callback_data: 'home' }
  ]);

  await sendTelegram('editMessageText', env.BOT_TOKEN, {
    chat_id: chatId,
    message_id: msgId,
    text: msg,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function renderEpisodesListPage(payload, chatId, env) {
  const parts = payload.split('_');
  const imdbId = parts[1];
  const ver = parts[2];
  const season = parts[3];
  const quality = decodeURIComponent(parts.slice(4).join('_'));

  const item = await getMovieById(env.DB, imdbId, env);
  if (!item) return;

  const title = item[3] || item[2];
  const seasonLinks = item[7]?.[ver]?.[season] || [];
  const linkGroup = seasonLinks.find(l => makeSafeParam(l.quality) === makeSafeParam(quality)) || seasonLinks[0];

  if (!linkGroup || !linkGroup.episodes?.length) {
    return sendTelegram('sendMessage', env.BOT_TOKEN, {
      chat_id: chatId,
      text: '❌ متاسفانه قسمت‌های مربوط به این کیفیت یافت نشد.'
    });
  }

  let msg = `📺 <b>${title}</b>\n`;
  msg += `📁 <b>فصل:</b> <code>${season}</code> | <b>کیفیت:</b> <code>${linkGroup.quality}</code>\n`;
  msg += `🏷 <b>نسخه:</b> ${VERSION_MAP[ver] || `نسخه ${ver}`}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚡️ <i>جهت دریافت، روی شماره هر قسمت کلیک نمایید:</i>\n\n`;

  const keyboard = [];
  let row = [];

  linkGroup.episodes.forEach((ep, idx) => {
    const epNum = String(idx + 1).padStart(2, '0');
    const safeUrl = sanitizeDownloadUrl(ep.url);
    if (safeUrl) {
      row.push({ text: `📥 قسمت ${epNum}`, url: safeUrl });
    }
    if (row.length === 2) {
      keyboard.push(row);
      row = [];
    }
  });
  if (row.length > 0) keyboard.push(row);

  keyboard.push([
    { text: '🔙 بازگشت به فصل‌ها', callback_data: `ver_${imdbId}_${ver}` },
    { text: '🏠 منوی اصلی', callback_data: 'home' }
  ]);

  await sendTelegram('sendMessage', env.BOT_TOKEN, {
    chat_id: chatId,
    text: msg,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function renderSimilarMovies(movieId, chatId, msgId, env) {
  const { DB: db, BOT_TOKEN: token, TMDB_API_KEY: tmdbKey } = env;
  const similarTitles = await getSimilarFromTMDB(movieId, tmdbKey);
  const keyboard = [];

  for (const title of similarTitles) {
    const rows = await searchMovies(db, title, env);
    if (rows[0] && rows[0][0] !== movieId) {
      keyboard.push([{ text: `🎬 ${rows[0][3] || rows[0][2]} (${rows[0][4]})`, callback_data: `dl_${rows[0][0]}` }]);
    }
    if (keyboard.length >= 5) break;
  }

  keyboard.push([{ text: '🔙 بازگشت به مشخصات', callback_data: `dl_${movieId}` }]);

  await sendTelegram('editMessageText', token, {
    chat_id: chatId,
    message_id: msgId,
    text: keyboard.length > 1 ? '🔄 <b>عناوین مشابه پیشنهادی:</b>' : '📭 عنوانی مشابه در دیتابیس یافت نشد.',
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function renderSearchList(query, page, chatId, msgId, env) {
  const results = await searchMovies(env.DB, query, env);
  const keyboard = [];

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE) || 1;
  const start = (page - 1) * ITEMS_PER_PAGE;
  const pageItems = results.slice(start, start + ITEMS_PER_PAGE);

  if (pageItems.length === 0) {
    const dorks = generateGoogleDorkLinks(query, '');
    const notFound = `📭 <b>عنوانی با نام «${escapeHTML(query)}» پیدا نشد!</b>\n━━━━━━━━━━━━━━━━━━━━\n🔍 <i>می‌توانید مستقیم از طریق گوگل جستجو فرمایید:</i>`;
    return sendTelegram(msgId ? 'editMessageText' : 'sendMessage', env.BOT_TOKEN, {
      chat_id: chatId,
      ...(msgId ? { message_id: msgId } : {}),
      text: notFound,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔎 جستجوی فایل مستقیم در وب', url: dorks.indexUrl }],
          [{ text: '🌐 جستجوی صفحات دانلود در گوگل', url: dorks.generalUrl }],
          [{ text: '🏠 منوی اصلی', callback_data: 'home' }]
        ]
      }
    });
  }

  pageItems.forEach((m, idx) => {
    keyboard.push([{
      text: `${start + idx + 1}. ${TYPE_EMOJI[m[1]] || '🍿'} ${m[3]} [${m[4]} • ⭐️${m[5]}]`,
      callback_data: `dl_${m[0]}`
    }]);
  });

  const navRow = [];
  const safeQ = encodeURIComponent(query.substring(0, 30));
  if (page > 1) navRow.push({ text: '◀️ قبلی', callback_data: `s_${page - 1}_${safeQ}` });
  if (page < totalPages) navRow.push({ text: 'بعدی ▶️', callback_data: `s_${page + 1}_${safeQ}` });
  if (navRow.length > 0) keyboard.push(navRow);

  keyboard.push([{ text: '🏠 منوی اصلی', callback_data: 'home' }]);

  await sendTelegram(msgId ? 'editMessageText' : 'sendMessage', env.BOT_TOKEN, {
    chat_id: chatId,
    ...(msgId ? { message_id: msgId } : {}),
    text: `🔎 <b>نتایج جستجو برای:</b> <i>${escapeHTML(query)}</i> (صفحه ${page} از ${totalPages})`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function sendMainMenu(chatId, msgId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🎲 فیلم تصادفی', callback_data: 'random' }],
      [{ text: '🔎 جستجوی اینلاین', switch_inline_query_current_chat: '' }]
    ]
  };
  const text = `🎬 <b>سامانه جامع سینمایی فیلمیار</b>\n━━━━━━━━━━━━━━━━━━━━\n👋 خوش آمدید! فیلم یا سریال دلخواهتان را به <b>فارسی</b> یا <b>انگلیسی</b> ارسال کنید.`;

  if (msgId) await sendTelegram('deleteMessage', env.BOT_TOKEN, { chat_id: chatId, message_id: msgId }).catch(() => {});
  await sendTelegram('sendMessage', env.BOT_TOKEN, { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: keyboard });
}

function sendForceJoin(chatId, missing, token) {
  const keyboard = missing.map((ch, i) => [{ text: `📢 عضویت در کانال ${i + 1}`, url: `https://t.me/${ch.replace('@', '')}` }]);
  keyboard.push([{ text: '✅ عضو شدم', callback_data: 'check_join' }]);
  return sendTelegram('sendMessage', token, {
    chat_id: chatId,
    text: '🔒 <b>کاربر عزیز!</b>\nبرای استفاده از ربات لطفاً ابتدا در کانال‌های زیر عضو شوید:\n━━━━━━━━━━━━━━━━━━━━\n👇 پس از عضویت، روی «عضو شدم» کلیک کنید.',
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handleInlineQuery(iq, env) {
  if (iq.query.trim().length < 2) return;
  const list = await searchMovies(env.DB, iq.query.trim(), env);
  const results = list.slice(0, 10).map((m, i) => ({
    type: 'article',
    id: `${i}_${m[0]}`,
    title: `${m[3]} (${m[4]})`,
    input_message_content: {
      message_text: `🎬 <b>${m[3]}</b>\nhttps://t.me/${env.BOT_USERNAME}?start=${m[0]}`,
      parse_mode: 'HTML'
    }
  }));

  await sendTelegram('answerInlineQuery', env.BOT_TOKEN, { inline_query_id: iq.id, results, cache_time: 300 });
}