import {
  ensureTables,
  getMovieById,
  searchMovies,
  dbFavToggle,
  dbHistoryAdd,
  dbTrack,
  dbGetFavList,
  dbGetHistoryList,
  dbGetRandom
} from './db/database.js';
import { fetchImdbMediaList } from './services/tmdb.js';
import { handleTelegramUpdate } from './telegram/bot.js';
import { renderWebApp } from './views/webApp.js';

let tablesInitialized = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!tablesInitialized) {
      await ensureTables(env.DB);
      tablesInitialized = true;
    }

    // 1. Mini App HTML
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(renderWebApp(env.BOT_USERNAME, env.TMDB_API_KEY), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // 2. REST API Endpoints for Mini App
    if (request.method === 'GET' && url.pathname.startsWith('/api/')) {
      const action = url.pathname.replace('/api/', '');
      const page = parseInt(url.searchParams.get('page'), 10) || 1;
      const uid = url.searchParams.get('uid');
      const q = url.searchParams.get('q');
      const id = url.searchParams.get('id');

      try {
        if (action === 'random') {
          const rnd = await dbGetRandom(env.DB);
          return new Response(JSON.stringify(rnd ? [rnd] : []), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'get') {
          const item = await getMovieById(env.DB, id, env);
          return new Response(JSON.stringify(item), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'search') {
          const results = await searchMovies(env.DB, q, env);
          return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'trending') {
          const list = await fetchImdbMediaList('trending', page, env.DB, 12, env.TMDB_API_KEY);
          return new Response(JSON.stringify(list), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'fav_toggle') {
          const mid = url.searchParams.get('mid');
          const res = await dbFavToggle(env.DB, uid, mid);
          return new Response(JSON.stringify(res), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'favs') {
          const favs = await dbGetFavList(env.DB, uid);
          const start = (page - 1) * 12;
          return new Response(JSON.stringify(favs.slice(start, start + 12)), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'history') {
          const hist = await dbGetHistoryList(env.DB, uid);
          const start = (page - 1) * 12;
          return new Response(JSON.stringify(hist.slice(start, start + 12)), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'history_add') {
          const mid = url.searchParams.get('mid');
          const res = await dbHistoryAdd(env.DB, uid, mid);
          return new Response(JSON.stringify(res), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (action === 'track') {
          const res = await dbTrack(env.DB, id);
          return new Response(JSON.stringify(res), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        return new Response('[]', {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response('[]', {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 3. Telegram Webhook (POST)
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        ctx.waitUntil(handleTelegramUpdate(update, env, ctx));
      } catch (err) {
        console.error('Update error:', err);
      }
      return new Response('OK', { status: 200 });
    }

    return new Response('Bot is running', { status: 200 });
  }
};