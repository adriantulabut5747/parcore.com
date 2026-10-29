// Builds site/valorant-weapons.json for /valorant/weapons: every buyable gun + its stats, the patch,
// the acts (banner clock), the skin tiers, and a log of every stat change between patches.
//
// Run once a day by .github/workflows/valorant-feed.yml. No keys: valorant-api.com is public and is
// rebuilt from the game files each patch. Its full /weapons answer is 3.6 MB (every skin, chroma and
// level), too heavy for phones, so the page reads this slim copy and fetches one gun's skins
// (/v1/weapons/<uuid>) only when its panel opens.
//
// If valorant-api fails, the old file is kept as it is.
//
// Local test:  node scripts/valorant-feed.mjs

import { writeFile, readFile } from 'node:fs/promises';

const OUT = new URL('../site/valorant-weapons.json', import.meta.url);
const API = 'https://valorant-api.com/v1/';
const UA = 'ParchromeBot/1.0 (https://parchrome.netlify.app; wildparchrome@gmail.com)';

const get = async (p) => {
  const r = await fetch(API + p, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return (await r.json()).data;
};
const tail = (s) => (s ? String(s).split('::').pop() : null);
const n = (v) => (v == null || v < 0 ? null : Math.round(v * 100) / 100); // -1 = "not used" in the game files
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function gun(w) {
  const s = w.weaponStats;
  const ads = s.adsStats;
  return {
    id: slug(w.displayName),
    uuid: w.uuid,
    name: w.displayName,
    type: tail(w.category).toLowerCase(), // sidearm | smg | shotgun | rifle | sniper | heavy
    shop: w.shopData.categoryText, // "Assault Rifles" etc., the buy menu's own words
    cost: w.shopData.cost,
    icon: w.displayIcon,
    kill: w.killStreamIcon,
    fire: n(s.fireRate),
    mag: s.magazineSize,
    reload: n(s.reloadTimeSeconds),
    equip: n(s.equipTimeSeconds),
    run: n(s.runSpeedMultiplier),
    spread: n(s.firstBulletAccuracy),
    pellets: s.shotgunPelletCount > 1 ? s.shotgunPelletCount : 1,
    pen: tail(s.wallPenetration),
    feature: tail(s.feature),
    semi: tail(s.fireMode) === 'SemiAutomatic',
    alt: tail(s.altFireType),
    ads: ads ? { zoom: n(ads.zoomMultiplier), fire: n(ads.fireRate), run: n(ads.runSpeedMultiplier), burst: n(ads.burstCount), spread: n(ads.firstBulletAccuracy) } : null,
    altShotgun: s.altShotgunStats ? { pellets: s.altShotgunStats.shotgunPelletCount, rate: n(s.altShotgunStats.burstRate) } : null,
    airBurst: s.airBurstStats ? { pellets: s.airBurstStats.shotgunPelletCount, at: n(s.airBurstStats.burstDistance) } : null,
    ranges: s.damageRanges.map((r) => ({ from: r.rangeStartMeters, to: r.rangeEndMeters, head: n(r.headDamage), body: n(r.bodyDamage), leg: n(r.legDamage) })),
    skins: w.skins.filter(isSkin).length,
  };
}
// the default look and the "random favourite" slot aren't skins you can own
const isSkin = (k) => !/^(Standard |Random Favorite)/.test(k.displayName) && k.displayName !== 'Melee';

// what the log compares, as text (a range table reads "0-30: 78/26/22.1")
const LOGGED = {
  cost: (g) => g.cost,
  'fire rate': (g) => g.fire,
  magazine: (g) => g.mag,
  reload: (g) => g.reload,
  'equip time': (g) => g.equip,
  'run speed': (g) => g.run,
  'first-shot spread': (g) => g.spread,
  'aimed fire rate': (g) => g.ads && g.ads.fire,
  pellets: (g) => g.pellets,
  damage: (g) => g.ranges.map((r) => `${r.from}-${r.to} m: ${r.head}/${r.body}/${r.leg}`).join(', '),
};

async function main() {
  let old = null;
  try {
    old = JSON.parse(await readFile(OUT, 'utf8'));
  } catch (e) {}

  let weapons, version, seasons, tiers;
  try {
    [weapons, version, seasons, tiers] = await Promise.all([get('weapons'), get('version'), get('seasons'), get('contenttiers')]);
  } catch (e) {
    console.error('valorant-api failed, keeping the old file:', e.message);
    return;
  }

  // buy menu order: cheapest first inside each type
  const ORDER = ['sidearm', 'smg', 'shotgun', 'rifle', 'sniper', 'heavy'];
  const guns = weapons
    .filter((w) => w.shopData && w.weaponStats)
    .map(gun)
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.cost - b.cost);

  const patch = version.branch.replace(/^release-/, '');
  const byUuid = Object.fromEntries(seasons.map((s) => [s.uuid, s]));
  // the acts still to come or running (the banner shows the running one; the next takes over when it ends)
  const acts = seasons
    .filter((s) => tail(s.type) === 'Act' && Date.parse(s.endTime) > Date.now())
    .map((s) => ({ name: s.displayName.replace(/^ACT/i, 'Act'), ep: (byUuid[s.parentUuid] || {}).displayName || null, start: s.startTime, end: s.endTime }));

  // the change log: every LOGGED value that differs from yesterday's file, tagged with the patch
  const log = (old && old.log) || [];
  const day = new Date().toISOString().slice(0, 10);
  if (old && old.guns) {
    const was = Object.fromEntries(old.guns.map((g) => [g.id, g]));
    for (const g of guns) {
      const o = was[g.id];
      if (!o) {
        log.unshift({ day, patch, gun: g.name, what: 'New gun' });
        continue;
      }
      for (const [what, f] of Object.entries(LOGGED)) {
        const a = f(o);
        const b = f(g);
        if (String(a) !== String(b)) log.unshift({ day, patch, gun: g.name, what, from: a ?? null, to: b ?? null });
      }
    }
  }

  const out = {
    updated: old && JSON.stringify(old.guns) === JSON.stringify(guns) && old.patch && old.patch.branch === patch ? old.updated : new Date().toISOString(),
    patch: { branch: patch, version: version.version, built: version.buildDate },
    acts,
    tiers: Object.fromEntries(tiers.map((t) => [t.uuid, { name: t.devName, rank: t.rank, icon: t.displayIcon }])),
    guns,
    log: log.slice(0, 300),
    since: (old && old.since) || day,
  };
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`${guns.length} guns, patch ${patch}, ${acts.length} acts, ${out.log.length} log entries`);
}

main();
