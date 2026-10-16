import { sendTelegram, checkMembership } from './api.js';
import { getTMDBData, getSimilarFromTMDB } from '../services/tmdb.js';
import { TYPE_EMOJI, VERSION_MAP, ITEMS_PER_PAGE } from '../config/constants.js';
import { escapeHTML, sanitizeDownloadUrl, safeButtonUrl, generateGoogleDorkLinks, hasDownloadLinks } from '../utils/helpers.js';
import {
  dbGetChannels,
  dbManageChannel,
  dbGetAdminData,
  dbGetStats,
  dbAddCustom,
  dbFavToggle,
  dbGetFavList,
  dbGetHistoryList,
  dbHistoryAdd,
  dbTrack,
  getMovieById,
  searchMovies,
  dbGetRandom
} from '../db/database.js';

export async function handleTelegramUpdate(update, env, ctx) {
  const token = env.BOT_TOKEN;
  const db = env.DB;

  const user = update.message?.from || update.callback_query?.from || update.inline_query?.from;
  if (user) {
    ctx.waitUntil(env.DB.prepare(
      "INSERT INTO users (id, username, first_name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name"
    ).bind(user.id, user.username || null, user.first_name || null).run());
  }

  if (update.message?.text) {
    await handleMessage(update.message, env, ctx);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query, env, ctx);
  } else if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env);
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
      return sendTelegram('sendMessage', token, { chat_id: chatId, text: '✅ کانال اضافه شد.' });
    }
    if (text.startsWith('/delchannel ')) {
      await dbManageChannel(db, 'del', text.split(' ')[1]);
      return sendTelegram('sendMessage', token, { chat_id: chatId, text: '🗑 کانال حذف شد.' });
    }
  }

  if (chatType !== 'private') return;

  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    if (parts[1]?.startsWith('tt')) {
      return renderMovieCard(parts[1], chatId, null, env, ctx);
    }
    return sendMainMenu(chatId, null, env);
  }

  const imdbMatch = text.match(/(tt\d+)/);
  if (imdbMatch) {
    return renderMovieCard(imdbMatch[1], chatId, null, env, ctx);
  }

  // Search Flow
  await renderSearchList(text, 1, chatId, null, env);
}

async function handleCallback(cb, env, ctx) {
  const { id: cbId, message: { chat: { id: chatId }, message_id: msgId }, data, from: { id: userId } } = cb;
  const token = env.BOT_TOKEN;
  const db = env.DB;

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
  } else if (data.startsWith('q_')) {
    const [, movieId, verKey, qIdx] = data.split('_');
    await renderQualityLinks(movieId, verKey, parseInt(qIdx, 10), chatId, msgId, env);
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
    return sendTelegram('sendMessage', token, { chat_id: chatId, text: '❌ این عنوان در دیتابیس یافت نشد.' });
  }

  ctx?.waitUntil(Promise.all([
    dbTrack(db, movieId),
    dbHistoryAdd(db, chatId, movieId)
  ]));

  const icon = TYPE_EMOJI[item[1]] || '🎬';
  let text = `${icon} <b>${item[3] || item[2]}</b>\n`;
  if (item[2] && item[2] !== item[3]) text += `🇬🇧 <i>${item[2]}</i>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n⭐️ امتیاز: ${item[5]} | 🗓 سال: ${item[4]}\n`;
  if (tmdb?.genres) text += `🏷 ژانر: ${tmdb.genres}\n`;
  if (tmdb?.overview) text += `\n<blockquote>${tmdb.overview}</blockquote>\n`;

  const links = item[7] || {};
  const keyboard = [];

  if (tmdb?.trailer) keyboard.push([{ text: '🎞 تماشای تریلر رسمی', url: tmdb.trailer }]);
  for (const vKey in links) {
    keyboard.push([{ text: `📥 ${VERSION_MAP[vKey] || `نسخه ${vKey}`}`, callback_data: `ver_${movieId}_${vKey}` }]);
  }

  keyboard.push([{ text: '🔄 عناوین مشابه', callback_data: `similar_${movieId}` }]);
  keyboard.push([
    { text: '📌 لیست تماشا', callback_data: `fav_${movieId}` },
    { text: '🏠 منوی اصلی', callback_data: 'home' }
  ]);

  if (msgId) await sendTelegram('deleteMessage', token, { chat_id: chatId, message_id: msgId }).catch(() => {});

  if (tmdb?.poster) {
    await sendTelegram('sendPhoto', token, { chat_id: chatId, photo: tmdb.poster, caption: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
  } else {
    await sendTelegram('sendMessage', token, { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
  }
}

async function renderVersionDownloads(movieId, verKey, chatId, msgId, env) {
  const item = await getMovieById(env.DB, movieId, env);
  if (!item) return;

  const title = item[3] || item[2];
  const links = item[7]?.[verKey];
  const keyboard = [];

  if (item[1] === 'movie') {
    const grouped = new Map();
    (links || []).forEach(l => {
      const q = l.quality || 'سایر';
      if (!grouped.has(q)) grouped.set(q, []);
      grouped.get(q).push(l);
    });

    let idx = 0;
    for (const [qName, files] of grouped.entries()) {
      keyboard.push([{ text: `🔸 ${qName} (${files.length})`, callback_data: `q_${movieId}_${verKey}_${idx++}` }]);
    }
  } else {
    for (const season in links || {}) {
      keyboard.push([{ text: `📁 فصل ${season}`, callback_data: `sea_${movieId}_${verKey}_${season}` }]);
    }
  }

  keyboard.push([{ text: '🔙 بازگشت', callback_data: `dl_${movieId}` }]);

  await sendTelegram('editMessageText', env.BOT_TOKEN, {
    chat_id: chatId,
    message_id: msgId,
    text: `📥 <b>دانلود ${title}</b>\nنسخه: ${VERSION_MAP[verKey] || verKey}`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function renderQualityLinks(movieId, verKey, qIdx, chatId, msgId, env) {
  const item = await getMovieById(env.DB, movieId, env);
  const links = item?.[7]?.[verKey] || [];
  const grouped = Array.from(
    links.reduce((acc, l) => {
      const k = l.quality || 'Standard';
      acc.set(k, [...(acc.get(k) || []), l]);
      return acc;
    }, new Map()).values()
  );

  const selected = grouped[qIdx] || [];
  const keyboard = [];

  selected.forEach((f, i) => {
    const url = sanitizeDownloadUrl(f.file);
    if (url) keyboard.push([{ text: `📥 دانلود مستقیم (${f.size || 'نیم‌بها'})`, url }]);
  });

  keyboard.push([{ text: '🔙 بازگشت به کیفیت‌ها', callback_data: `ver_${movieId}_${verKey}` }]);

  await sendTelegram('editMessageText', env.BOT_TOKEN, {
    chat_id: chatId,
    message_id: msgId,
    text: `⚡️ لینک‌های مستقیم نیم‌بها:`,
    parse_mode: 'HTML',
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

  keyboard.push([{ text: '🔙 بازگشت', callback_data: `dl_${movieId}` }]);
  await sendTelegram('editMessageText', token, {
    chat_id: chatId,
    message_id: msgId,
    text: keyboard.length > 1 ? '🔄 عناوین مشابه پیشنهادی:' : '📭 عنوانی یافت نشد.',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function renderSearchList(query, page, chatId, msgId, env) {
  const results = await searchMovies(env.DB, query, env);
  const keyboard = [];

  results.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).forEach(m => {
    keyboard.push([{ text: `${TYPE_EMOJI[m[1]] || '🍿'} ${m[3]} (${m[4]}) - ⭐️${m[5]}`, callback_data: `dl_${m[0]}` }]);
  });

  keyboard.push([{ text: '🏠 منوی اصلی', callback_data: 'home' }]);

  await sendTelegram(msgId ? 'editMessageText' : 'sendMessage', env.BOT_TOKEN, {
    chat_id: chatId,
    ...(msgId ? { message_id: msgId } : {}),
    text: `🔎 <b>نتایج برای:</b> <i>${query}</i>`,
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
  const text = `🎬 <b>سامانه جامع فیلمیار</b>\nبرای شروع، نام فیلم یا شناسه IMDb را ارسال کنید.`;

  if (msgId) await sendTelegram('deleteMessage', env.BOT_TOKEN, { chat_id: chatId, message_id: msgId }).catch(() => {});
  await sendTelegram('sendMessage', env.BOT_TOKEN, { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: keyboard });
}

function sendForceJoin(chatId, missing, token) {
  const keyboard = missing.map((ch, i) => [{ text: `📢 عضویت در کانال ${i + 1}`, url: `https://t.me/${ch.replace('@', '')}` }]);
  keyboard.push([{ text: '✅ عضو شدم', callback_data: 'check_join' }]);
  return sendTelegram('sendMessage', token, { chat_id: chatId, text: '🔒 لطفا جهت حمایت ابتدا در کانال‌های زیر عضو شوید:', reply_markup: { inline_keyboard: keyboard } });
}

async function handleInlineQuery(iq, env) {
  if (iq.query.trim().length < 2) return;
  const list = await searchMovies(env.DB, iq.query.trim(), env);
  const results = list.slice(0, 10).map((m, i) => ({
    type: 'article',
    id: `${i}_${m[0]}`,
    title: `${m[3]} (${m[4]})`,
    input_message_content: { message_text: `🎬 <b>${m[3]}</b>\nhttps://t.me/${env.BOT_USERNAME}?start=${m[0]}`, parse_mode: 'HTML' }
  }));

  await sendTelegram('answerInlineQuery', env.BOT_TOKEN, { inline_query_id: iq.id, results, cache_time: 300 });
}
