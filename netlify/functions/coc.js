// Netlify function: GET /.netlify/functions/coc
// Returns a few public stats about our clan (#2GYPGPJP9) for the clan card
// on th18-layouts.html: members, clan level, war wins / streak.
//
// Why it looks like this:
// - The API key is NOT in this file. It comes from the COC_API_KEY
//   environment variable, set in Netlify (Site configuration ->
//   Environment variables). Never paste a key into code: anything
//   committed to GitHub stays in its history for good.
// - Supercell keys only work from IP addresses registered on the key, and
//   Netlify functions don't have a fixed IP. So the request goes through
//   RoyaleAPI's free proxy, which always calls from 45.79.218.79 -- that's
//   the IP to register when creating the key on developer.clashofclans.com.
// - Only the fields the card needs are passed on, and the answer is cached
//   for 10 minutes, so a busy page doesn't hammer the API.
// (Replaces netlify/functions/coc.js.txt, which had a key written into it.)

const CLAN_TAG = '%232GYPGPJP9';            // "#2GYPGPJP9", URL-encoded
const API = 'https://cocproxy.royaleapi.dev/v1/clans/' + CLAN_TAG;

function reply(status, body, cacheSeconds) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheSeconds
        ? 'public, max-age=60, s-maxage=' + cacheSeconds   // browsers 1 min, Netlify's CDN 10 min
        : 'no-store'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function () {
  const key = process.env.COC_API_KEY;
  if (!key) return reply(500, { error: 'COC_API_KEY is not set in Netlify' });

  const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };
  try {
    const res = await fetch(API, { headers });
    if (!res.ok) return reply(502, { error: 'Clash API answered ' + res.status });
    const c = await res.json();

    // Streak = the game's own warWinStreak, so it matches what players see
    // in-game (same choice as scripts/clan-stats.mjs).
    return reply(200, {
      level: c.clanLevel,
      members: c.members,
      maxMembers: 50,
      warLogPublic: !!c.isWarLogPublic,
      warWins: c.warWins,
      warWinStreak: c.warWinStreak
    }, 600);
  } catch (err) {
    return reply(502, { error: 'Could not reach the Clash API' });
  }
};
