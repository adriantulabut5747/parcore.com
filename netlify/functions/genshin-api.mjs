// Netlify function: GET /api/genshin?uid=800123456[&info=1]
// The Genshin player lookup's one door to Enka.Network (enka.network/api/uid/<uid>/).
//
// - Enka sends no CORS header, so the browser can't call it directly; this
//   forwards one thing only: a 9-10 digit UID. Nothing else reaches Enka (no
//   open proxy), and no key is needed (Enka is public).
// - Enka asks every client to cache a UID for its `ttl` seconds. Netlify's CDN
//   does that here: one profile opened 50 times inside the ttl costs one Enka
//   call. Netlify-Vary keys the cache on uid + info only, so adding junk to the
//   address can't skip the cache and hammer Enka.
// - Same Request -> Response style as coc-api.mjs.

const ENKA = 'https://enka.network/api/uid/';
const UA = 'ParchromeBot/1.0 (https://parchrome.netlify.app; wildparchrome@gmail.com)';

// Pages on another domain that may call this (GitHub Pages copy).
const ORIGINS = ['https://adriantulabut5747.github.io'];

export default async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  const cors = ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};

  function reply(status, body, cacheSeconds) {
    const headers = { 'Content-Type': 'application/json', ...cors };
    if (cacheSeconds) {
      headers['Cache-Control'] = 'public, max-age=60';
      headers['Netlify-CDN-Cache-Control'] = 'public, s-maxage=' + cacheSeconds; // Netlify's CDN only
      headers['Netlify-Vary'] = 'query=uid|info';
    } else {
      headers['Cache-Control'] = 'no-store';
    }
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
  }

  const uid = url.searchParams.get('uid') || '';
  if (!/^\d{9,10}$/.test(uid)) return reply(400, { error: 'badUid' });
  const info = url.searchParams.get('info') === '1';

  try {
    const res = await fetch(ENKA + uid + '/' + (info ? '?info' : ''), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    // Enka's codes: 400 bad UID, 404 no such player, 424 game maintenance,
    // 429 rate-limited, 500/503 their side. Short cache on "not found" so a
    // typo isn't re-asked every second.
    if (res.status === 400) return reply(400, { error: 'badUid' }, 3600);
    if (res.status === 404) return reply(404, { error: 'notFound' }, 60);
    if (res.status === 424) return reply(503, { error: 'maintenance' }, 60);
    if (res.status === 429) return reply(503, { error: 'busy' });
    if (res.status >= 500) return reply(502, { error: 'enka5xx' });
    if (!res.ok) return reply(502, { error: 'enka' + res.status });
    const text = await res.text();
    let ttl = 60;
    try {
      ttl = Math.min(600, Math.max(60, JSON.parse(text).ttl | 0));
    } catch {
      return reply(502, { error: 'enka5xx' });
    }
    return reply(200, text, ttl);
  } catch {
    return reply(502, { error: 'unreachable' });
  }
};

export const config = { path: '/api/genshin' };
