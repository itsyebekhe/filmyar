import { ensureTables, getMovieById, searchMovies, dbFavToggle, dbGetFavList, dbGetHistoryList, dbGetRandom } from './db/database.js';
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

    // 1. Mini App UI
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(renderWebApp(env.BOT_USERNAME, env.TMDB_API_KEY), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // 2. REST API for WebApp
    if (request.method === 'GET' && url.pathname.startsWith('/api/')) {
      const action = url.pathname.replace('/api/', '');
      const page = parseInt(url.searchParams.get('page')) || 1;
      const uid = url.searchParams.get('uid');
      const q = url.searchParams.get('q');
      const id = url.searchParams.get('id');

      let responseData = [];

      if (action === 'random') {
        const rnd = await dbGetRandom(env.DB);
        responseData = rnd ? [rnd] : [];
      } else if (action === 'get') {
        responseData = await getMovieById(env.DB, id, env);
      } else if (action === 'search') {
        responseData = await searchMovies(env.DB, q, env);
      } else if (action === 'trending') {
        responseData = await fetchImdbMediaList('trending', page, env.DB, 12, env.TMDB_API_KEY);
      } else if (action === 'fav_toggle') {
        responseData = await dbFavToggle(env.DB, uid, url.searchParams.get('mid'));
      } else if (action === 'favs') {
        responseData = await dbGetFavList(env.DB, uid);
      } else if (action === 'history') {
        responseData = await dbGetHistoryList(env.DB, uid);
      }

      return new Response(JSON.stringify(responseData), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 3. Telegram Webhook Entry Point
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        ctx.waitUntil(handleTelegramUpdate(update, env, ctx));
      } catch (err) {
        console.error('Webhook Error:', err);
      }
      return new Response('OK', { status: 200 });
    }

    return new Response('Bot Running', { status: 200 });
  }
};

    if (!tablesInitialized) {
      await ensureTables(env.DB);
      tablesInitialized = true;
    }

    // 1. Mini App UI
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(renderWebApp(mergedEnv.BOT_USERNAME, mergedEnv.TMDB_API_KEY), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // 2. REST API for WebApp
    if (request.method === 'GET' && url.pathname.startsWith('/api/')) {
      const action = url.pathname.replace('/api/', '');
      const page = parseInt(url.searchParams.get('page')) || 1;
      const uid = url.searchParams.get('uid');
      const q = url.searchParams.get('q');
      const id = url.searchParams.get('id');

      let responseData = [];

      if (action === 'random') {
        const rnd = await dbGetRandom(env.DB);
        responseData = rnd ? [rnd] : [];
      } else if (action === 'get') {
        responseData = await getMovieById(env.DB, id, mergedEnv);
      } else if (action === 'search') {
        responseData = await searchMovies(env.DB, q, mergedEnv);
      } else if (action === 'trending') {
        responseData = await fetchImdbMediaList('trending', page, env.DB, 12, mergedEnv.TMDB_API_KEY);
      } else if (action === 'fav_toggle') {
        responseData = await dbFavToggle(env.DB, uid, url.searchParams.get('mid'));
      } else if (action === 'favs') {
        responseData = await dbGetFavList(env.DB, uid);
      } else if (action === 'history') {
        responseData = await dbGetHistoryList(env.DB, uid);
      }

      return new Response(JSON.stringify(responseData), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 3. Telegram Webhook Entry Point
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        ctx.waitUntil(handleTelegramUpdate(update, mergedEnv, ctx));
      } catch (err) {
        console.error('Webhook Error:', err);
      }
      return new Response('OK', { status: 200 });
    }

    return new Response('Bot Running', { status: 200 });
  }
};
