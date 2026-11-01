// Cloudflare Worker: GET https://parchrome-valorant.<account>.workers.dev/api/valorant?type=account&name=Foo&tag=1234
// The site's one door to HenrikDev's Valorant API (the player search + player page, the map
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
// 429 = we're over the 30-a-minute limit. key = { secret, spend }: spend() asks the Gate for one call.
async function henrik(path, cacheSeconds, key) {
  if (!(await key.spend())) return oops(429, 'busy');
  try {
    const res = await fetch(API + path, { headers: { Authorization: key.secret, Accept: 'application/json' } });
    const text = await res.text();
    // Henrik's own count (x-ratelimit-*), passed on as X-Henrik-Limit so we can see the key's real limit
    const limit = [...res.headers].filter(([k]) => /ratelimit|retry-after/i.test(k)).map((h) => h.join('=')).join('; ');
    const tagged = (r) => (limit && r.headers.set('X-Henrik-Limit', limit), r);
    if (res.ok) return tagged(answer(200, text, cacheSeconds));
    if (res.status === 429) return tagged(oops(429, 'Too many searches right now. Try again in a minute.'));
    // Henrik's own 4xx message ("Account not found" ...) is what the page shows.
    if (res.status < 500) return answer(res.status, text, res.status === 404 ? 120 : 0);
    return oops(502, 'The Valorant stats service is down right now.');
  } catch {
    return oops(502, 'The Valorant stats service is unreachable.');
  }
}

// a trimmed answer keeps Henrik's count (X-Henrik-Limit) from the one it was made from
const keep = (from, to) => (from.headers.has('X-Henrik-Limit') && to.headers.set('X-Henrik-Limit', from.headers.get('X-Henrik-Limit')), to);

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

const slimRow = (p) => ({
  rank: p.leaderboard_rank,
  name: p.is_anonymized ? '' : p.name,
  tag: p.is_anonymized ? '' : p.tag,
  tier: p.tier,
  rr: p.rr,
  wins: p.wins,
  card: p.card,
});

// The Ranks page's "Top of the ladder" (Oct 30 2026): one region's leaderboard cut down to what the
// page draws (~2 KB): Immortal 1+ cutoffs, how many players are on the board, and the top 10.
// thresholds[].start_index = the board place where that tier starts, so the gaps are tier sizes.
async function board(region, key) {
  const res = await henrik('v3/leaderboard/' + region + '/pc?size=10', 1800, key);
  if (!res.ok) return res;
  try {
    const { data, results } = await res.json();
    const players = (data.players || []).slice(0, 10).map(slimRow);
    return keep(res, answer(200, { updated_at: data.updated_at, total: results.total, thresholds: data.thresholds, players }, 1800));
  } catch {
    return oops(502, 'The leaderboard came back in a shape we do not know.');
  }
}

// The Leaderboard page (/valorant/leaderboard, Nov 1 2026): one page of 100 places, or (name + tag) where one
// player stands. Same trim as board(): only what the page draws, plus the cutoffs so every page can label tiers.
export const LADDER_SIZE = 100;
async function ladder(region, query, key) {
  const res = await henrik('v3/leaderboard/' + region + '/pc?' + query, 1800, key);
  if (!res.ok) return res;
  try {
    const { data, results } = await res.json();
    const players = (data.players || []).slice(0, LADDER_SIZE).map(slimRow);
    const body = { updated_at: data.updated_at, total: results.total, size: LADDER_SIZE, thresholds: data.thresholds, players };
    return keep(res, answer(200, body, 1800));
  } catch {
    return oops(502, 'The leaderboard came back in a shape we do not know.');
  }
}

// The player page's match list (Oct 30 2026): Henrik's 10 matches are ~4 MB, mostly every player's position at
// every kill. Same field names (the page reads Henrik's full shape too), minus positions, names inside kills /
// rounds (the page finds them in players[]), damage_events, coaches and observers. Each kill keeps its distance
// (killer to victim, metres on the map plane: 100 units = 1 m), the one thing the positions were for.
const ref = (p) => (p ? { puuid: p.puuid, team: p.team } : null);
export function slimMatch(m) {
  return {
    metadata: m.metadata,
    players: (m.players || []).map((p) => ({
      puuid: p.puuid,
      name: p.name,
      tag: p.tag,
      team_id: p.team_id,
      party_id: p.party_id,
      agent: p.agent,
      stats: p.stats,
      ability_casts: p.ability_casts,
      tier: p.tier,
      account_level: p.account_level,
      economy: p.economy,
      behavior: p.behavior && { afk_rounds: p.behavior.afk_rounds },
      card: p.customization && p.customization.card,
    })),
    teams: (m.teams || []).map((t) => ({ team_id: t.team_id, rounds: t.rounds, won: t.won, placement: t.placement })),
    rounds: (m.rounds || []).map((r) => ({
      id: r.id,
      result: r.result,
      winning_team: r.winning_team,
      winning_team_role: r.winning_team_role,
      plant: r.plant && { round_time_in_ms: r.plant.round_time_in_ms, site: r.plant.site, player: ref(r.plant.player) },
      defuse: r.defuse && { round_time_in_ms: r.defuse.round_time_in_ms, player: ref(r.defuse.player) },
      stats: (r.stats || []).map((s) => ({
        player: ref(s.player),
        economy: s.economy && {
          loadout_value: s.economy.loadout_value,
          remaining: s.economy.remaining,
          weapon: s.economy.weapon,
          armor: s.economy.armor,
        },
        stats: s.stats,
        was_afk: s.was_afk,
      })),
    })),
    kills: (m.kills || []).map((k) => {
      const at = (k.player_locations || []).find((l) => l.player && k.killer && l.player.puuid === k.killer.puuid);
      const d = at && k.location ? Math.hypot(at.location.x - k.location.x, at.location.y - k.location.y) / 100 : null;
      return {
        round: k.round,
        time_in_round_in_ms: k.time_in_round_in_ms,
        killer: ref(k.killer),
        victim: ref(k.victim),
        assistants: (k.assistants || []).map(ref),
        weapon: k.weapon,
        distance: d == null ? null : Math.round(d * 10) / 10,
      };
    }),
  };
}
async function matchList(path, key) {
  const res = await henrik(path, 120, key);
  if (!res.ok) return res;
  try {
    const j = await res.json();
    return keep(res, answer(200, { status: j.status, data: (j.data || []).map(slimMatch) }, 120));
  } catch {
    return oops(502, 'The match list came back in a shape we do not know.');
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

// THE LINE (Nov 1 2026, Adrian: show their place in line while they wait, never an error).
// One Durable Object (GATE, name 'henrik') sees every call to Henrik, so it can count them for everyone:
// - used = when each call of the last minute went out; at most PER_MIN in any 60 s.
// - The player page / leaderboard first take a ticket for the calls they'll need (type=ticket&cost=N). With room
//   the ticket is a pass right away; otherwise it waits in line and the page polls it (type=ticket&id=) to show
//   its place. A pass holds its calls (reserved, nobody else takes them) until the page says done or 60 s pass.
// - A call with a pass spends from it; a call without one (lobby, Ranks, map pool) goes only when nobody waits.
// - A page that stops polling for 20 s (tab closed) leaves the line. Memory only: an idle Gate forgets, which is fine.
export const PER_MIN = 28; // Henrik's Basic key = 30 a minute, 2 spare for clock drift. Enhanced key: 88.
const SEEN_MS = 20000;
const PASS_MS = 60000;
export class Gate {
  constructor() {
    this.used = [];
    this.line = []; // { id, cost, seen }, first come first served
    this.passes = new Map(); // id -> { left, until }
  }
  tidy(now) {
    this.used = this.used.filter((t) => now - t < 60000);
    for (const [id, p] of this.passes) if (now > p.until || p.left <= 0) this.passes.delete(id);
    this.line = this.line.filter((t) => now - t.seen < SEEN_MS);
  }
  reserved() {
    let n = 0;
    for (const p of this.passes.values()) n += p.left;
    return n;
  }
  free() {
    return PER_MIN - this.used.length - this.reserved();
  }
  grant(now) {
    while (this.line.length && this.free() >= this.line[0].cost) {
      const t = this.line.shift();
      this.passes.set(t.id, { left: t.cost, until: now + PASS_MS });
    }
  }
  // seconds until `need` more calls fit: calls leave the minute as they age; reserved ones count as spent now
  eta(need, now) {
    if (need <= 0) return 0;
    const out = [...this.used, ...Array(this.reserved()).fill(now)].sort((a, b) => a - b);
    if (need <= out.length) return Math.max(1, Math.ceil((out[need - 1] + 60000 - now) / 1000));
    return Math.ceil(60 + ((need - out.length) / PER_MIN) * 60);
  }
  view(id, now) {
    if (this.passes.has(id)) return { id, state: 'go' };
    const i = this.line.findIndex((t) => t.id === id);
    if (i < 0) return { id, state: 'gone' };
    this.line[i].seen = now;
    const need = this.line.slice(0, i + 1).reduce((n, t) => n + t.cost, 0) - Math.max(0, this.free());
    return { id, state: 'wait', place: i + 1, line: this.line.length, wait: this.eta(need, now) };
  }
  ticket(cost, now, id = crypto.randomUUID()) {
    this.tidy(now);
    this.line.push({ id, cost: Math.min(cost, PER_MIN), seen: now });
    this.grant(now);
    return this.view(id, now);
  }
  poll(id, now) {
    this.tidy(now);
    this.grant(now);
    return this.view(id, now);
  }
  done(id, now) {
    this.passes.delete(id);
    this.tidy(now);
    this.grant(now);
  }
  spend(pass, now) {
    this.tidy(now);
    const p = pass && this.passes.get(pass);
    if (p && p.left > 0) p.left--;
    else if (this.line.length || this.free() <= 0) return false;
    this.used.push(now);
    return true;
  }
  async fetch(req) {
    const q = new URL(req.url).searchParams;
    const now = Date.now();
    const act = q.get('do');
    if (act === 'ticket') return Response.json(this.ticket(Number(q.get('cost')), now));
    if (act === 'poll') return Response.json(this.poll(q.get('id'), now));
    if (act === 'done') return Response.json((this.done(q.get('id'), now), { ok: true }));
    // counts only (no ticket ids): what the Gate holds right now
    if (act === 'peek') {
      this.tidy(now);
      return Response.json({ used: this.used.length, reserved: this.reserved(), passes: this.passes.size, line: this.line.map((t) => t.cost) });
    }
    return Response.json({ ok: this.spend(q.get('pass'), now) });
  }
}

// Checks the query, then answers it (through the cache). Returns [Response, cache state].
async function route(url, key, ctx, gate) {
  const q = url.searchParams;
  const type = q.get('type');
  const via = (id, make) => cached(url.origin + '/__cache/' + id, make, ctx);

  if (type === 'ticket') {
    if (!gate) return [answer(200, { id: '', state: 'go' })]; // no Gate bound (tests): everyone goes
    if (q.has('peek')) return [answer(200, await gate('peek', ''))];
    const id = q.get('id');
    if (id) {
      if (!/^[0-9a-f-]{36}$/.test(id)) return [oops(400, 'badTicket')];
      return [answer(200, await gate(q.has('done') ? 'done' : 'poll', 'id=' + id))];
    }
    const cost = q.get('cost') || '';
    if (!/^([1-9]|1[0-2])$/.test(cost)) return [oops(400, 'badCost')];
    return [answer(200, await gate('ticket', 'cost=' + cost))];
  }

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
  if (type === 'ladder') {
    if (q.has('name') || q.has('tag')) {
      if (!name || !tag) return [oops(400, 'Enter a real Riot ID: name 3-16 characters, tag 3-5.')];
      const who = 'name=' + encodeURIComponent(name) + '&tag=' + encodeURIComponent(tag);
      return via('ladder/' + region + '/find/' + (name + '/' + tag).toLowerCase(), () => ladder(region, who, key));
    }
    const pg = q.get('page') || '1';
    // up to page 999 = 99,900 places; Henrik answers an empty page past the end
    if (!/^[1-9]\d{0,2}$/.test(pg)) return [oops(400, 'badPage')];
    return via('ladder/' + region + '/' + pg, () => ladder(region, 'size=' + LADDER_SIZE + '&page=' + pg, key));
  }
  if (!name || !tag) return [oops(400, 'Enter a real Riot ID: name 3-16 characters, tag 3-5.')];
  const who = encodeURIComponent(name) + '/' + encodeURIComponent(tag);
  const id = (name + '/' + tag).toLowerCase(); // Riot IDs ignore case: "Foo#ABC" = "foo#abc"

  if (type === 'account') return via('account/' + id, () => henrik('v1/account/' + who, 600, key));
  if (type === 'mmr') return via('mmr/' + region + '/' + id, () => henrik('v2/mmr/' + region + '/' + who, 300, key));
  // The player page (/valorant/player/<name>-<tag>, Oct 30 2026): every act's wins / games / end rank (v3),
  // the RR each ranked game moved (live + Henrik's stored copy, the page merges them by match_id) and the
  // stored match list (one line per game: the player's own stats only, so 100 of them stay small).
  if (type === 'mmr3') return via('mmr3/' + region + '/' + id, () => henrik('v3/mmr/' + region + '/pc/' + who, 300, key));
  if (type === 'rr') return via('rr/' + region + '/' + id, () => henrik('v2/mmr-history/' + region + '/pc/' + who, 300, key));
  if (type === 'rrstored')
    return via('rrstored/' + region + '/' + id, () => henrik('v2/stored-mmr-history/' + region + '/pc/' + who + '?size=100', 900, key));
  if (type === 'stored') {
    const mode = q.get('mode') || '';
    if (!['', 'competitive'].includes(mode)) return [oops(400, 'badMode')];
    return via('stored/' + region + '/' + id + '/' + mode, () =>
      henrik('v1/stored-matches/' + region + '/' + who + '?size=100' + (mode ? '&mode=' + mode : ''), 900, key),
    );
  }
  if (type === 'matches') {
    const start = q.get('start') || '0';
    // pages of 10: the player page loads the last 20 by default, 50 on ?n=50
    if (!['0', '10', '20', '30', '40'].includes(start)) return [oops(400, 'badStart')];
    return via('matches/' + region + '/' + id + '/' + start, () =>
      matchList('v4/matches/' + region + '/pc/' + who + '?size=10&start=' + start, key),
    );
  }
  return [oops(400, 'badType')];
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';

    // the Gate (THE LINE above); if it can't be reached, calls go through as they did before it
    const stub = env.GATE && env.GATE.get(env.GATE.idFromName('henrik'));
    const gate = stub && ((act, query) => stub.fetch('https://gate/?do=' + act + '&' + query).then((r) => r.json()));
    const pass = /^[0-9a-f-]{36}$/.test(url.searchParams.get('pass') || '') ? url.searchParams.get('pass') : '';
    const spend = () =>
      gate
        ? gate('spend', 'pass=' + pass).then(
            (r) => r.ok,
            () => true,
          )
        : Promise.resolve(true);
    const key = env.HENRIK_API_KEY && { secret: env.HENRIK_API_KEY, spend };

    let [res, cacheState = 'BYPASS'] = req.method === 'GET' ? await route(url, key, ctx, gate) : [oops(405, 'badMethod')];

    // What the browser gets: its own 1-minute cache (never a ticket), CORS for our pages only.
    res = new Response(res.body, res);
    if (res.ok && url.searchParams.get('type') === 'ticket') res.headers.set('Cache-Control', 'no-store');
    else if (res.ok) res.headers.set('Cache-Control', 'public, max-age=60');
    else if (res.status !== 404) res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Cache', cacheState);
    if (allowedOrigin(origin)) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    return res;
  },
};
