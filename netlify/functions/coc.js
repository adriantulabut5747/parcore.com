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
    // clan info + war log, asked for at the same time
    const [clanRes, logRes] = await Promise.all([
      fetch(API, { headers }),
      fetch(API + '/warlog?limit=100', { headers })
    ]);
    if (!clanRes.ok) return reply(502, { error: 'Clash API answered ' + clanRes.status });
    const c = await clanRes.json();
    const log = logRes.ok ? await logRes.json() : null;

    return reply(200, {
      level: c.clanLevel,
      members: c.members,
      maxMembers: 50,
      warLogPublic: !!c.isWarLogPublic,
      warWins: c.warWins,
      warWinStreak: streakSkippingDraws(log) ?? c.warWinStreak
    }, 600);
  } catch (err) {
    return reply(502, { error: 'Could not reach the Clash API' });
  }
};

// Our win streak, the way the clan counts it: wins since the last LOSS.
// Draws don't break it (they're skipped, not counted), and neither do
// war-log entries without a result (CWL summaries). Newest war first.
// Game's own warWinStreak is only the fallback if the log can't be read
// (it didn't match this count -- 33 vs 36 when this was written).
function streakSkippingDraws(log) {
  if (!log || !Array.isArray(log.items)) return null;
  let streak = 0;
  for (const war of log.items) {
    if (war.result === 'lose') return streak;
    if (war.result === 'win') streak++;
    // 'tie' or no result: skip
  }
  return streak;   // no loss anywhere in the log: every win it holds
}
