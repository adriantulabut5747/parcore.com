// Cloudflare Worker: GET https://parchrome-valorant.<account>.workers.dev/api/valorant?type=account&name=Foo&tag=1234
// The site's one door to HenrikDev's Valorant API (the player search, the map
// pool's live rotation) and to VLR.gg's news feed (Latest Updates).
//
// Same setup as cloudflare/coc-api (Oct 29 2026): the key used to be written
// into valorant/index.html + crosshairs.html, where anyone could copy it.
//
// - The key is the Worker secret HENRIK_API_KEY (npx wrangler secret put
//   HENRIK_API_KEY), never this file.
// - Only the lookups below are allowed and every name / tag / region is
//   checked, so nobody can use this as an open proxy with our key.
// - Answers are cached at Cloudflare's edge (X-Cache: HIT / MISS), so the same
//   player searched 20 times in two minutes costs Henrik's 30-a-minute limit
//   four calls, not 80.
// - Errors keep Henrik's shape ({ errors: [{ message }] }): the page shows
//   that message.
// - type=news = VLR.gg's RSS feed as-is (XML); type=og = one VLR article's
//   og:image, for news items the feed sends without a picture. Both replace
//   the free CORS proxies the page used to race.
// - Browsers only get an answer they can read on our own pages (allowedOrigin).
// Deploy: see cloudflare/valorant-api/wrangler.toml.

const API = 'https://api.henrikdev.xyz/valorant/';
const REGIONS = ['na', 'eu', 'ap', 'kr', 'latam', 'br'];

// Same list as cloudflare/coc-api/worker.js: add a new domain to both.
function allowedOrigin(origin) {
  return (
    /^https:\/\/([a-z0-9-]+--)?(parchrome|parchrome3|extraordinary-donut-f21bde)\.netlify\.app$/.test(origin) ||
    origin === 'https://adriantulabut5747.github.io' ||
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):8765$/.test(origin)
  );
}

// Riot ID: name 3-16 characters (letters of any language, spaces), tag 3-5
// letters / digits. Returns null for anything else.
export function cleanName(raw) {
  const s = String(raw || '').trim();
  return /^[\p{L}\p{N} _.-]{3,16}$/u.test(s) ? s : null;
}
export function cleanTag(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/^#/, '');
  return /^[\p{L}\p{N}]{3,5}$/u.test(s) ? s : null;
}

function answer(status, body, cacheSeconds, type = 'application/json') {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': type, 'Cache-Control': cacheSeconds ? 'public, s-maxage=' + cacheSeconds : 'no-store' },
  });
}
const oops = (status, message) => answer(status, { errors: [{ message }] });

// Ask Henrik. 404 = no such player (short cache so a typo isn't re-asked),
// 429 = we're over the 30-a-minute limit.
async function henrik(path, cacheSeconds, key) {
  try {
    const res = await fetch(API + path, { headers: { Authorization: key, Accept: 'application/json' } });
    const text = await res.text();
    if (res.ok) return answer(200, text, cacheSeconds);
    if (res.status === 429) return oops(429, 'Too many searches right now. Try again in a minute.');
    // Henrik's own 4xx message ("Account not found" ...) is what the page shows.
    if (res.status < 500) return answer(res.status, text, res.status === 404 ? 120 : 0);
    return oops(502, 'The Valorant stats service is down right now.');
  } catch {
    return oops(502, 'The Valorant stats service is unreachable.');
  }
}

async function page(url, cacheSeconds, type) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Parchrome)' } });
    if (!res.ok) return oops(502, 'vlr' + res.status);
    return answer(200, await res.text(), cacheSeconds, type);
  } catch {
    return oops(502, 'vlrUnreachable');
  }
}

// The og:image of one VLR article: { img } (null when it has none).
async function ogImage(url, cacheSeconds) {
  const res = await page(url, cacheSeconds, 'text/html');
  if (!res.ok) return res;
  const html = await res.text();
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  // /img/vlr/card.png = VLR's logo card, used when an article has no picture
  // (and browsers block it cross-site): the page's VALORANT tile is better.
  const img = m && /^https?:\/\//.test(m[1]) && !m[1].includes('/img/vlr/') ? m[1] : null;
  return answer(200, { img }, cacheSeconds);
}

// The Ranks page's "Top of the ladder" (Oct 30 2026): one region's leaderboard cut down to what the
// page draws (~2 KB): Immortal 1+ cutoffs, how many players are on the board, and the top 10.
// thresholds[].start_index = the board place where that tier starts, so the gaps are tier sizes.
async function board(region, key) {
  const res = await henrik('v3/leaderboard/' + region + '/pc?size=10', 1800, key);
  if (!res.ok) return res;
  try {
    const { data, results } = await res.json();
    const players = (data.players || []).slice(0, 10).map((p) => ({
      rank: p.leaderboard_rank,
      name: p.is_anonymized ? '' : p.name,
      tag: p.is_anonymized ? '' : p.tag,
      tier: p.tier,
      rr: p.rr,
      wins: p.wins,
      card: p.card,
    }));
    return answer(200, { updated_at: data.updated_at, total: results.total, thresholds: data.thresholds, players }, 1800);
  } catch {
    return oops(502, 'The leaderboard came back in a shape we do not know.');
  }
}

// One answer through the edge cache: the stored copy, or make() and store it.
async function cached(keyUrl, make, ctx) {
  const cacheKey = new Request(keyUrl);
  const hit = await caches.default.match(cacheKey);
  if (hit) return [hit, 'HIT'];
  const res = await make();
  if (res.headers.get('Cache-Control') !== 'no-store') ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return [res, 'MISS'];
}

// Checks the query, then answers it (through the cache). Returns [Response, cache state].
async function route(url, key, ctx) {
  const q = url.searchParams;
  const type = q.get('type');
  const via = (id, make) => cached(url.origin + '/__cache/' + id, make, ctx);

  if (type === 'news') return via('news', () => page('https://www.vlr.gg/rss', 900, 'application/rss+xml'));
  if (type === 'og') {
    const link = String(q.get('url') || '');
    if (!/^https:\/\/(www\.)?vlr\.gg\/\d+\/[a-z0-9-]+$/i.test(link)) return [oops(400, 'badUrl')];
    return via('og/' + link.replace(/^https:\/\/(www\.)?vlr\.gg\//i, ''), () => ogImage(link, 86400));
  }

  const region = q.get('region') || 'ap';
  if (!REGIONS.includes(region)) return [oops(400, 'badRegion')];
  if (!key) return [oops(500, 'noKey')];
  if (type === 'queue') return via('queue/' + region, () => henrik('v1/queue-status/' + region, 600, key));
  if (type === 'leaderboard') return via('leaderboard/' + region, () => board(region, key));

  const name = cleanName(q.get('name'));
  const tag = cleanTag(q.get('tag'));
  if (!name || !tag) return [oops(400, 'Enter a real Riot ID: name 3-16 characters, tag 3-5.')];
  const who = encodeURIComponent(name) + '/' + encodeURIComponent(tag);
  const id = (name + '/' + tag).toLowerCase(); // Riot IDs ignore case: "Foo#ABC" = "foo#abc"

  if (type === 'account') return via('account/' + id, () => henrik('v1/account/' + who, 600, key));
  if (type === 'mmr') return via('mmr/' + region + '/' + id, () => henrik('v2/mmr/' + region + '/' + who, 300, key));
  if (type === 'matches') {
    const start = q.get('start') || '0';
    if (start !== '0' && start !== '10') return [oops(400, 'badStart')];
    return via('matches/' + region + '/' + id + '/' + start, () =>
      henrik('v4/matches/' + region + '/pc/' + who + '?size=10&start=' + start, 120, key),
    );
  }
  return [oops(400, 'badType')];
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';

    let [res, cacheState = 'BYPASS'] = req.method === 'GET' ? await route(url, env.HENRIK_API_KEY, ctx) : [oops(405, 'badMethod')];

    // What the browser gets: its own 1-minute cache, CORS for our pages only.
    res = new Response(res.body, res);
    if (res.ok) res.headers.set('Cache-Control', 'public, max-age=60');
    else if (res.status !== 404) res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Cache', cacheState);
    if (allowedOrigin(origin)) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    return res;
  },
};
