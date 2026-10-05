// Player Tracker history: polls every tracked clan and saves what changed to
// Firestore (project parchrome-tracker). Run every 15 minutes by
// .github/workflows/track.yml. Plan: docs/player-tracker-plan.md.
//
// The Clash API only says what's true right now, so history is built here:
// - members: joins, leaves, promotions, name and Town Hall changes -> events
// - wars: the current war (public war logs only) and every Clan War League
//   war, saved while they run so the attacks survive the war's end
// - once a day: each member's trophies and donations -> days/<date>
// Only changes are written (free plan: 20k writes a day).
//
// Which clans: trackedClans/<TAG>, added by the "Track this clan" button.
// The 100 most recently viewed are polled; one not viewed for 30 days is
// dropped, and a tag that isn't a real clan is deleted.
//
// Needs COC_API_KEY (same key as clan-stats, RoyaleAPI proxy IP) and
// FIREBASE_SERVICE_ACCOUNT (the Firebase admin key's JSON) -- both GitHub
// secrets. The admin key bypasses the Firestore rules; visitors can't write.

import { createHash } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const API = 'https://cocproxy.royaleapi.dev/v1/';
const MAX_CLANS = 100;
const EXPIRE_MS = 30 * 864e5;
const KEEP_WAR_INDEX_MS = 60 * 864e5; // how long a war stays in the clan doc's change index

const key = process.env.COC_API_KEY;
const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!key || !sa) {
  console.error('COC_API_KEY and FIREBASE_SERVICE_ACCOUNT must both be set');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(sa)) });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function coc(path) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } });
  if (res.status === 404) return { notFound: true };
  if (res.status === 403) return { private: true };
  if (!res.ok) throw new Error('Clash API ' + res.status + ' for ' + path);
  return res.json();
}
const enc = (tag) => encodeURIComponent(tag); // "#ABC" -> "%23ABC"
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16);
// "20261004T210926.000Z" -> Date
const apiTime = (s) => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
};
// Same content regardless of key order (the API reorders members by rank).
const stable = (o) =>
  JSON.stringify(
    Object.keys(o || {})
      .sort()
      .map((k) => [k, o[k]]),
  );

// Only what the war view in site/coc-tracker.js (warView) reads.
function slimWar(w) {
  const side = (c) => ({
    tag: c.tag,
    name: c.name,
    clanLevel: c.clanLevel,
    badgeUrls: { small: c.badgeUrls && c.badgeUrls.small },
    attacks: c.attacks || 0,
    stars: c.stars,
    destructionPercentage: c.destructionPercentage,
    members: (c.members || []).map((m) => ({
      tag: m.tag,
      name: m.name,
      townhallLevel: m.townhallLevel,
      mapPosition: m.mapPosition,
      attacks: m.attacks,
      opponentAttacks: m.opponentAttacks,
      bestOpponentAttack: m.bestOpponentAttack,
    })),
  });
  return {
    state: w.state,
    teamSize: w.teamSize,
    attacksPerMember: w.attacksPerMember,
    preparationStartTime: w.preparationStartTime,
    startTime: w.startTime,
    endTime: w.endTime,
    clan: side(w.clan),
    opponent: side(w.opponent),
  };
}

async function pollClan(tag, state) {
  const t = enc(tag);
  const clan = await coc('clans/' + t);
  if (clan.notFound) return 'gone';

  const ref = db.collection('clans').doc(tag.slice(1));
  const batch = db.batch();
  const now = new Date();
  const update = {};
  if (state.name !== clan.name) update.name = clan.name;
  if (state.badge !== clan.badgeUrls.small) update.badge = clan.badgeUrls.small;
  let writes = 0;

  // ---- members -> events
  const members = Object.fromEntries((clan.memberList || []).map((m) => [m.tag, { n: m.name, r: m.role, th: m.townHallLevel }]));
  const old = state.members;
  if (old) {
    const ev = (e) => {
      batch.set(ref.collection('events').doc(), { t: now, ...e });
      writes++;
    };
    for (const [mt, m] of Object.entries(members)) {
      const o = old[mt];
      if (!o) ev({ type: 'join', tag: mt, name: m.n, th: m.th });
      else {
        if (o.r !== m.r) ev({ type: 'role', tag: mt, name: m.n, from: o.r, to: m.r });
        if (o.n !== m.n) ev({ type: 'name', tag: mt, name: m.n, from: o.n });
        if (o.th !== m.th) ev({ type: 'th', tag: mt, name: m.n, from: o.th, to: m.th });
      }
    }
    for (const [mt, o] of Object.entries(old)) if (!members[mt]) ev({ type: 'leave', tag: mt, name: o.n });
  }
  if (stable(members) !== stable(old)) update.members = members;

  // ---- once a day: trophies and donations per member
  const day = now.toISOString().slice(0, 10);
  if (state.day !== day) {
    batch.set(ref.collection('days').doc(day), {
      t: now,
      points: clan.clanPoints,
      warWins: clan.warWins,
      members: Object.fromEntries(
        (clan.memberList || []).map((m) => [
          m.tag,
          { n: m.name, tr: m.trophies, bb: m.builderBaseTrophies, d: m.donations, r: m.donationsReceived },
        ]),
      ),
    });
    update.day = day;
    writes++;
  }

  // ---- wars. state.wars is an index { id: { h: content hash, done, end } }
  // so an unchanged war costs no write and a finished one is never re-fetched.
  const wars = { ...(state.wars || {}) };
  let warsChanged = false;
  const save = (id, kind, w) => {
    const json = JSON.stringify(slimWar(w));
    const h = sha(json);
    if (wars[id] && wars[id].h === h) return;
    const end = apiTime(w.endTime);
    batch.set(ref.collection('wars').doc(id), { kind, state: w.state, end, json });
    wars[id] = { h, done: w.state === 'warEnded', end: end ? end.getTime() : 0 };
    warsChanged = true;
    writes++;
  };

  if (clan.isWarLogPublic) {
    const w = await coc('clans/' + t + '/currentwar');
    if (w.state && w.state !== 'notInWar' && w.preparationStartTime) save('w' + w.preparationStartTime, 'war', w);
  }

  const g = await coc('clans/' + t + '/currentwar/leaguegroup');
  if (g.rounds && g.state !== 'notInWar') {
    // Which war is ours each day, found once per season, then reused.
    const cwl = state.cwl && state.cwl.season === g.season ? { ...state.cwl, days: { ...state.cwl.days } } : { season: g.season, days: {} };
    for (let r = 0; r < g.rounds.length; r++) {
      const tags = g.rounds[r].warTags.filter((x) => x !== '#0');
      if (!tags.length) continue;
      const known = cwl.days[r];
      if (known) {
        const id = 'c' + known.slice(1);
        if (wars[id] && wars[id].done) continue;
        const w = await coc('clanwarleagues/wars/' + enc(known));
        if (w.clan) save(id, 'cwl', w);
        continue;
      }
      for (const x of tags) {
        const w = await coc('clanwarleagues/wars/' + enc(x));
        if (w.clan && (w.clan.tag === tag || w.opponent.tag === tag)) {
          cwl.days[r] = x;
          update.cwl = cwl;
          save('c' + x.slice(1), 'cwl', w);
          break;
        }
      }
    }
  }

  // forget old entries in the index (the war docs themselves stay)
  for (const [id, v] of Object.entries(wars)) {
    if (v.done && v.end && v.end < now - KEEP_WAR_INDEX_MS) {
      delete wars[id];
      warsChanged = true;
    }
  }
  if (warsChanged) update.wars = wars;

  // The clan doc is only written when something in it changed.
  if (Object.keys(update).length) {
    batch.set(ref, update, { mergeFields: Object.keys(update) });
    writes++;
  }
  if (writes) await batch.commit();
  return writes;
}

// ---- main
const snap = await db.collection('trackedClans').get();
const now = Date.now();
const all = snap.docs.map((d) => ({ id: d.id, ref: d.ref, viewed: d.get('lastViewed') ? d.get('lastViewed').toMillis() : 0 }));
for (const c of all.filter((c) => c.viewed < now - EXPIRE_MS)) {
  console.log('expired (not viewed for 30 days):', c.id);
  await c.ref.delete();
}
const live = all
  .filter((c) => c.viewed >= now - EXPIRE_MS)
  .sort((a, b) => b.viewed - a.viewed)
  .slice(0, MAX_CLANS);
if (!live.length) {
  console.log('No tracked clans.');
  process.exit(0);
}

const states = await db.getAll(...live.map((c) => db.collection('clans').doc(c.id)));
let total = 0;
let failed = 0;
// three clans at a time: gentle on the API, done well inside the 15 minutes
let next = 0;
async function worker() {
  while (next < live.length) {
    const i = next++;
    const c = live[i];
    try {
      const r = await pollClan('#' + c.id, states[i].exists ? states[i].data() : {});
      if (r === 'gone') {
        console.log('not a clan, removed:', c.id);
        await c.ref.delete();
      } else {
        total += r;
        console.log(c.id + ': ' + r + ' write(s)');
      }
    } catch (err) {
      failed++;
      console.error(c.id + ': ' + err.message);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`Polled ${live.length} clan(s), ${total} write(s), ${failed} failed.`);
if (failed === live.length) process.exit(1);
