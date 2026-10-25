// Cloudflare Worker: GET https://parchrome-coc.<account>.workers.dev/api/coc?type=player&tag=ABC123
// The site's one door to the Clash of Clans API (Player Tracker, clan pages,
// /coc/'s player search and war tile).
//
// Moved here from netlify/functions/coc-api.mjs (Oct 24 2026): Netlify's free
// plan ran out of function calls. Workers' free plan allows 100,000 a day.
//
// - The key is the Worker secret COC_API_KEY (npx wrangler secret put
//   COC_API_KEY), never this file.
// - Supercell keys only work from the IPs registered on them and Workers have
//   no fixed IP, so calls go through RoyaleAPI's proxy (fixed IP 45.79.218.79,
//   the IP registered on the key) -- same as scripts/track.mjs.
// - Only the lookups in ROUTES are allowed and tags are checked against the
//   game's tag alphabet, so nobody can use this as an open proxy with our key.
// - Answers are cached at Cloudflare's edge (X-Cache: HIT / MISS says which),
//   so a profile opened 50 times in five minutes costs one API call.
// - type=warcard is a summary for /coc/'s phone (warCard below), not a raw
//   API answer.
// - Browsers only get an answer they can read on our own pages (allowedOrigin),
//   so other sites can't spend our daily quota through their visitors.
// Deploy: see cloudflare/coc-api/wrangler.toml.

const API = 'https://cocproxy.royaleapi.dev/v1/';

// type -> [API path for a tag, edge cache seconds]. Add a lookup here when a
// page needs it.
const ROUTES = {
  player: [(tag) => 'players/' + tag, 300],
  // The player's recent battles (attacks + defenses, with army codes): the
  // profile's Attacks > Classic and Stats tabs.
  battlelog: [(tag) => 'players/' + tag + '/battlelog', 300],
  clan: [(tag) => 'clans/' + tag, 300],
  warlog: [(tag) => 'clans/' + tag + '/warlog?limit=30', 600],
  // War report: the clan's current war, its Clan War League group, and one
  // CWL war by its war tag. Short caches -- attacks land all the time.
  war: [(tag) => 'clans/' + tag + '/currentwar', 60],
  cwlgroup: [(tag) => 'clans/' + tag + '/currentwar/leaguegroup', 300],
  cwlwar: [(tag) => 'clanwarleagues/wars/' + tag, 60],
  // The clan page's Raid weekends tab: the last 10 weekends.
  raids: [(tag) => 'clans/' + tag + '/capitalraidseasons?limit=10', 600],
};

// The live site + its deploy previews, the test site, the GitHub Pages copy,
// and _tools/serve.py (localhost or a phone on the same Wi-Fi).
function allowedOrigin(origin) {
  return (
    /^https:\/\/([a-z0-9-]+--)?(parchrome|extraordinary-donut-f21bde)\.netlify\.app$/.test(origin) ||
    origin === 'https://adriantulabut5747.github.io' ||
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):8765$/.test(origin)
  );
}

// "#abc 123", "o" for zero... -> "ABC123" if it's a real tag, else null.
// Tags only ever use these 14 characters: 0289PYLQGRJCUV.
export function cleanTag(raw) {
  const t = String(raw || '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[^0-9A-Z]/g, '');
  return /^[0289PYLQGRJCUV]{3,12}$/.test(t) ? t : null;
}

// The answer as it's stored in the edge cache: no CORS header (that depends on
// who asks), s-maxage = how long the cache keeps it.
function answer(status, body, cacheSeconds) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheSeconds ? 'public, s-maxage=' + cacheSeconds : 'no-store',
    },
  });
}

// Ask the API. 404 = no such tag, 503 = Supercell maintenance, 429 = we're
// throttled. Short cache on "not found" so a typo isn't re-asked every second.
async function lookup(path, type, cacheSeconds, key) {
  try {
    const res = await fetch(API + path, {
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    });
    if (res.status === 404) return answer(404, { error: 'notFound' }, 60);
    if (res.status === 503) return answer(503, { error: 'maintenance' });
    // 403 "accessDenied" = the clan keeps its war log private (a key/IP
    // problem says "accessDenied.invalidIp" and falls through to api403).
    if (res.status === 403) {
      const why = await res.json().catch(() => ({}));
      if (why.reason === 'accessDenied') return answer(403, { error: 'private' }, 300);
    }
    if (!res.ok) return answer(502, { error: 'api' + res.status });
    const text = await res.text();
    // A finished CWL war never changes again: keep it a day, not a minute.
    // (A clan's CWL page asks for every war in its group, up to 28.)
    if (type === 'cwlwar' && text.includes('"state":"warEnded"')) cacheSeconds = 86400;
    return answer(200, text, cacheSeconds);
  } catch {
    return answer(502, { error: 'unreachable' });
  }
}

// One answer through the edge cache: the stored copy, or make() and store it.
// Keyed on the API path, so "#abc" and "ABC" share one entry.
async function cached(keyUrl, make, ctx) {
  const cacheKey = new Request(keyUrl);
  const hit = await caches.default.match(cacheKey);
  if (hit) return [hit, 'HIT'];
  const res = await make();
  if (res.headers.get('Cache-Control') !== 'no-store') ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return [res, 'MISS'];
}

// "20261024T101010.000Z" (the API's time format) -> ms, 0 if missing.
function apiTime(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : 0;
}

// A side's #1: most stars from its attacks (then most destruction). Before
// anyone has attacked, the base on top of the map (#1 = its strongest).
function topPlayer(members) {
  let best = null;
  for (const m of members) {
    const hits = m.attacks || [];
    if (!hits.length) continue;
    const stars = hits.reduce((n, a) => n + a.stars, 0);
    const pct = hits.reduce((n, a) => n + a.destructionPercentage, 0);
    if (!best || stars > best.stars || (stars === best.stars && pct > best.pct)) best = { name: m.name, th: m.townhallLevel, stars, pct, hits: hits.length };
  }
  if (best) return { name: best.name, th: best.th, stars: best.stars, hits: best.hits };
  const first = members.reduce((a, m) => (!a || m.mapPosition < a.mapPosition ? m : a), null);
  return first && { name: first.name, th: first.townhallLevel, base: true };
}

function warSide(c) {
  return {
    name: c.name,
    badge: c.badgeUrls.medium,
    stars: c.stars,
    pct: Math.round(c.destructionPercentage * 10) / 10,
    top: topPlayer(c.members || []),
  };
}

// WAR CARD (Oct 24 2026): the /coc/ phone's war in ONE request instead of
// 3-10 (CWL group, its wars, the regular war, the clan), trimmed to what the
// card shows (~1 KB instead of ~50 KB). Same choice as coc-tracker.js liveWar():
// during CWL the newest drawn day the clan is in (battle day first, else
// preparation), otherwise the regular war; no war = the clan's own card.
async function warCard(tag, get) {
  const call = async (path, type, ttl) => {
    const [res] = await get(path, type, ttl);
    return { status: res.status, data: res.ok ? await res.json() : null };
  };
  const json = async (path, type, ttl) => (await call(path, type, ttl)).data;
  // Only a clear answer counts. A failed call (throttled, maintenance, network)
  // must never read as "No war right now", so it fails the whole card (502,
  // not cached) and the page keeps the last good one. 404 = not in CWL,
  // 403 = private war log: both are real answers.
  const broken = (r) => r.status !== 200 && r.status !== 404 && r.status !== 403;
  // 503 = Supercell's maintenance break: its own answer, so the page can say so.
  const fail = (r) => (r && r.status === 503 ? answer(503, { error: 'maintenance' }) : answer(502, { error: 'unavailable' }));
  const me = '#' + tag;
  const t = '%23' + tag;
  let found = null;
  let hidden = false; // 403 on the regular war = the clan's war log is private

  const g = await call('clans/' + t + '/currentwar/leaguegroup', 'cwlgroup', 300);
  if (broken(g)) return fail(g);
  const group = g.data;
  if (group && group.rounds) {
    const days = group.rounds
      .map((r, i) => ({ day: i + 1, tags: r.warTags.filter((x) => x !== '#0') }))
      .filter((d) => d.tags.length)
      .slice(-2); // the newest is often preparation, the one before it the battle
    const wars = await Promise.all(
      days.map(async (d) => {
        const all = await Promise.all(d.tags.map((x) => json('clanwarleagues/wars/%23' + x.slice(1), 'cwlwar', 60)));
        const w = all.find((w) => w && (w.clan.tag === me || w.opponent.tag === me));
        return w && { w, label: 'CWL day ' + d.day };
      }),
    );
    const pick = (s) => wars.find((f) => f && f.w.state === s);
    found = pick('inWar') || pick('preparation') || null;
  }
  if (!found) {
    const r = await call('clans/' + t + '/currentwar', 'war', 60);
    if (broken(r)) return fail(r);
    hidden = r.status === 403;
    const w = r.data;
    if (w && w.state && w.state !== 'notInWar') found = { w, label: 'Clan war' };
  }
  if (found) {
    const { w, label } = found;
    const us = w.clan.tag === me ? w.clan : w.opponent;
    const them = us === w.clan ? w.opponent : w.clan;
    return answer(200, { state: w.state, label, start: apiTime(w.startTime), end: apiTime(w.endTime), us: warSide(us), them: warSide(them) }, 60);
  }

  const cr = await call('clans/' + t, 'clan', 300);
  const c = cr.data;
  if (!c) return fail(cr);
  const best = (c.memberList || []).find((m) => m.clanRank === 1);
  return answer(
    200,
    {
      state: 'notInWar',
      private: hidden,
      us: {
        name: c.name,
        badge: c.badgeUrls.medium,
        level: c.clanLevel,
        members: c.members,
        wins: c.warWins,
        streak: c.warWinStreak,
        top: best ? { name: best.name, th: best.townHallLevel } : null,
      },
    },
    120,
  );
}

// Checks the query, then answers it (through the cache). Returns [Response, cache state].
async function route(url, key, ctx) {
  const type = url.searchParams.get('type');
  const get = (path, t, ttl) => cached(url.origin + '/__cache/' + path, () => lookup(path, t, ttl, key), ctx);

  if (type === 'clansearch') {
    // Clan search by name: the API wants at least 3 characters.
    const name = String(url.searchParams.get('name') || '').trim();
    if (name.length < 3 || name.length > 50) return [answer(400, { error: 'badName' })];
    if (!key) return [answer(500, { error: 'noKey' })];
    return get('clans?limit=20&name=' + encodeURIComponent(name), type, 600);
  }
  if (type !== 'warcard' && !ROUTES[type]) return [answer(400, { error: 'badType' })];
  const tag = cleanTag(url.searchParams.get('tag'));
  if (!tag) return [answer(400, { error: 'badTag' })];
  if (!key) return [answer(500, { error: 'noKey' })];
  if (type === 'warcard') return cached(url.origin + '/__cache/warcard/' + tag, () => warCard(tag, get), ctx);
  const [path, ttl] = ROUTES[type];
  return get(path('%23' + tag), type, ttl);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';

    let [res, cacheState = 'BYPASS'] = req.method === 'GET' ? await route(url, env.COC_API_KEY, ctx) : [answer(405, { error: 'badMethod' })];

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
