// Netlify function: GET /api/coc?type=player&tag=ABC123
// The Player Tracker's one door to the Clash of Clans API.
//
// - Same key and proxy as coc.js: COC_API_KEY from Netlify's environment
//   variables, calls go through RoyaleAPI's proxy (fixed IP 45.79.218.79,
//   the IP registered on the key).
// - Only the lookups in ROUTES are allowed, and tags are checked against the
//   game's tag alphabet, so nobody can use this as an open proxy to any
//   endpoint with our key.
// - Answers are cached on Netlify's CDN, so a profile opened 50 times in five
//   minutes costs one API call.
// - Written in the standard Request -> Response style, which Vercel also
//   runs, so moving hosts only changes where this file lives.

const API = 'https://cocproxy.royaleapi.dev/v1/';

// type -> [API path for a tag, CDN cache seconds]. Add a lookup here when a
// page needs it (clan, war, CWL...).
const ROUTES = {
  player: [(tag) => 'players/' + tag, 300],
};

// Pages on another domain that may call this (GitHub Pages copy).
const ORIGINS = ['https://adriantulabut5747.github.io'];

// "#abc 123", "o" for zero... -> "ABC123" if it's a real tag, else null.
// Tags only ever use these 14 characters: 0289PYLQGRJCUV.
export function cleanTag(raw) {
  const t = String(raw || '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[^0-9A-Z]/g, '');
  return /^[0289PYLQGRJCUV]{3,12}$/.test(t) ? t : null;
}

export default async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  const cors = ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};

  function reply(status, body, cacheSeconds) {
    const headers = { 'Content-Type': 'application/json', ...cors };
    if (cacheSeconds) {
      headers['Cache-Control'] = 'public, max-age=60';
      headers['Netlify-CDN-Cache-Control'] = 'public, s-maxage=' + cacheSeconds; // Netlify's CDN only
      headers['Netlify-Vary'] = 'query'; // cache each ?type&tag separately
    } else {
      headers['Cache-Control'] = 'no-store';
    }
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
  }

  const route = ROUTES[url.searchParams.get('type')];
  if (!route) return reply(400, { error: 'badType' });
  const tag = cleanTag(url.searchParams.get('tag'));
  if (!tag) return reply(400, { error: 'badTag' });

  const key = process.env.COC_API_KEY;
  if (!key) return reply(500, { error: 'noKey' });

  try {
    const res = await fetch(API + route[0]('%23' + tag), {
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    });
    // 404 = no such tag, 503 = Supercell maintenance, 429 = we're throttled.
    // Short cache on "not found" so a typo isn't re-asked every second.
    if (res.status === 404) return reply(404, { error: 'notFound' }, 60);
    if (res.status === 503) return reply(503, { error: 'maintenance' });
    if (!res.ok) return reply(502, { error: 'api' + res.status });
    return reply(200, await res.text(), route[1]);
  } catch {
    return reply(502, { error: 'unreachable' });
  }
};

export const config = { path: '/api/coc' };
