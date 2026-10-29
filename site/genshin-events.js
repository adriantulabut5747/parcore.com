// Genshin Impact events timeline (Oct 23 2026; /timeline Oct 24; since Oct 27 2026 the top of /genshin-impact/all-events,
// with the endgame sections under it: genshin-endgame.js). Everything
// running this version on one chart: wishes (this version's phases from
// /genshin-history.json + the live weapon wish), events and endgame (the feed), in
// three lanes on a shared date axis with a red "today" line. Hover / tap a bar for
// its details. Phones get a list, ending soonest first. Shared helpers:
// genshin-core.js. Styles: genshin-events.css.
(function () {
  const { $, esc, now, MONTHS, SERVERS, server, srvEnd, countdowns, pad, PRIMO } = window.GI;
  const DAY = 86400;
  const ROW = 48; // px per bar row, matches .ev-bar's height + gap in genshin-events.css

  // seelie.me's traces of the in-game menu icons (_tools/genshin/seelie-icons.json):
  // planner = Events (the nav's Live icon), tracker = Wishes, weapons = Endgame.
  const ICON = {
    planner:
      '<path opacity=".5" d="M4 22.5C3.5 22.4 3.5 23.2 3.5 13.7C3.5 5.3 3.5 5.3 3.4 5.1C3.2 4.9 3.2 4.9 2.6 4.7C2.2 4.5 2.1 4.3 2.1 3.7C2 2.7 2.2 2.3 2.9 2.2C3.2 2.1 3.5 2 3.7 1.9C3.8 1.8 4 1.7 4.1 1.6C4.4 1.5 19.6 1.5 19.9 1.6C20 1.7 20.2 1.8 20.4 1.9C20.6 2 20.9 2.1 21.1 2.2C21.9 2.3 22 2.7 22 3.7C21.9 4.3 21.8 4.5 21.4 4.7C20.9 4.9 20.8 4.9 20.7 5.1C20.6 5.3 20.6 5.3 20.6 13.7C20.5 23.3 20.6 22.4 20.1 22.5C19.7 22.6 19.9 22.7 14.7 20.1C11.9 18.7 12.2 18.7 9.3 20.1C4.2 22.7 4.3 22.6 4 22.5Z"/><path d="M4.2 22.2C3.9 22.1 3.9 22.4 3.9 13.3C3.8 4.8 3.8 4.8 3.7 4.6C3.6 4.5 3.3 4.4 3 4.3C2.4 4.2 2.1 3.6 2.3 3.1C2.5 2.8 2.6 2.7 3.1 2.6C3.4 2.5 3.5 2.4 3.9 2C4.3 1.7 4.4 1.6 4.7 1.6C5.4 1.5 19.5 1.6 19.6 1.7C19.7 1.7 20 1.9 20.2 2.1C20.5 2.4 20.6 2.5 21 2.6C22 2.9 22 4.1 21 4.2C20.6 4.3 20.4 4.4 20.3 4.7C20.2 4.9 20.2 5.6 20.1 13.4C20.1 21.5 20.1 21.9 20 22C19.8 22.3 19.4 22.2 18.6 21.6C18.5 21.5 18.2 21.4 17.9 21.3C16.9 20.9 16.3 20.6 16 20.4C15.7 20.2 14.8 19.7 13.8 19.3C12.5 18.7 11.5 18.6 10.5 19.2C10.2 19.3 9.8 19.5 9.6 19.6C9.3 19.7 8.6 20.1 8.1 20.4C7.9 20.5 7.6 20.7 7.5 20.7C7.4 20.7 7.1 20.9 6.8 21C6.6 21.1 6.2 21.2 6 21.3C5.8 21.4 5.4 21.6 5.2 21.8C4.6 22.2 4.4 22.3 4.2 22.2ZM12.4 15.7C13 15.5 13.4 14.6 13.1 14.1C12.7 13.1 11.4 13 10.9 14C10.4 14.9 11.4 16.1 12.4 15.7ZM12.3 11.4C12.5 11.3 12.5 11.1 12.8 10.2C12.9 9.7 13.1 9.1 13.2 8.8C14.3 6.3 14.3 5.1 13.3 4.2C12.3 3.4 10.8 3.6 10.3 4.8C9.8 5.7 9.9 6.6 10.7 8.5C10.9 8.9 11.1 9.7 11.2 10.2C11.6 11.5 11.8 11.7 12.3 11.4Z"/>',
    tracker:
      '<path opacity=".5" d="M16.9 22.5C16.7 22.4 16.5 22.3 16.5 22.2C16.5 22.1 16.4 21.9 16.3 21.7C16.2 21.5 16.1 21.3 16.1 21.2C16.1 21 16 20.8 15.9 20.7C15.9 20.5 15.8 20.3 15.8 20.1C15.6 19.5 15.4 19.2 14.7 18.9C14.2 18.7 14.1 18.6 13.9 18.7C13.8 18.8 13.7 18.9 13.3 20C12.9 21.5 12.7 21.8 12.3 21.9C11.7 22.1 11.2 21.8 10.9 21.2C10.6 20.6 10.5 20.4 10.5 20.1C10.4 20 10.3 19.7 10.3 19.6C10.2 19.5 10.2 19.3 10.1 19.1C10.1 18.9 10 18.7 9.9 18.5C9.8 18.3 9.4 17 9.4 17C9.4 17 9.3 16.7 9.2 16.5C9.1 16.1 8.9 15.9 8.5 15.4C8.2 15 7.5 14.6 6.9 14.4C6.7 14.4 6.5 14.3 6.4 14.3C6.2 14.2 6 14.1 5.8 14.1C5.7 14 5.5 14 5.4 13.9C5.3 13.9 5 13.8 4.8 13.7C4.6 13.7 4.3 13.6 4.2 13.5C4.1 13.4 3.8 13.3 3 13.1C2.2 12.8 1.9 12.5 1.9 11.9C1.9 11.5 2.1 11.3 2.4 11C2.6 10.9 3.4 10.6 3.7 10.5C3.9 10.4 4.1 10.4 4.3 10.3C4.4 10.2 4.6 10.2 4.8 10.1C4.9 10.1 5.1 10 5.3 10C5.4 9.9 5.7 9.8 5.8 9.8C6 9.7 6.2 9.6 6.4 9.6C6.5 9.5 6.7 9.5 6.8 9.4C8.2 9.1 9 8.2 9.4 6.9C9.5 6.7 9.5 6.4 9.6 6.3C9.7 6.2 9.7 6 9.8 5.8C9.9 5.5 10.2 4.5 10.3 4.2C10.3 4.1 10.4 3.9 10.5 3.8C10.8 2.4 11.3 1.8 12 1.9C12.5 1.9 12.8 2.3 13 2.9C13.2 3.3 13.4 4 13.5 4.3C13.6 4.4 13.7 4.7 13.7 4.8C13.8 5 13.8 5.2 13.9 5.4C14 5.5 14 5.7 14.1 5.8C14.1 5.9 14.2 6.2 14.2 6.4C14.3 6.6 14.4 6.8 14.5 7C14.8 8.2 15.7 9.1 17 9.4C17.1 9.5 17.4 9.5 17.5 9.6C17.6 9.6 17.8 9.7 18 9.8C18.2 9.8 18.4 9.9 18.6 10C18.7 10 18.9 10.1 19 10.1C19.2 10.1 19.4 10.2 19.6 10.3C19.7 10.4 20 10.4 20.1 10.5C20.8 10.6 21.7 11.1 21.8 11.4C22.1 12 21.8 12.6 21.2 12.9C20.7 13.2 20.4 13.3 20.1 13.4C19.9 13.4 19.7 13.5 19.6 13.6C19.5 13.6 19.3 13.7 19.2 13.7C18.5 13.9 18.5 13.9 18.9 14.7C19.2 15.4 19.6 15.7 20.1 15.8C20.2 15.8 20.4 15.8 20.6 15.9C20.8 16 21 16.1 21.2 16.1C21.4 16.2 21.6 16.2 21.7 16.3C21.8 16.4 22 16.4 22.1 16.5C22.6 16.7 22.7 17.4 22.3 17.9C22 18.1 21.8 18.2 21.5 18.3C21.4 18.3 21.1 18.4 21 18.5C20.8 18.5 20.6 18.6 20.4 18.6C20 18.7 19.3 19.1 19 19.4C18.8 19.6 18.7 19.7 18.7 20.1C18.6 20.2 18.5 20.5 18.5 20.6C18.4 20.7 18.3 21 18.3 21.2C18.2 21.4 18.2 21.6 18.1 21.7C18 21.8 18 22 17.9 22.1C17.8 22.5 17.4 22.6 16.9 22.5ZM4.7 8.5C4.3 8.3 4.2 8.2 4.1 7.7C3.9 6.6 3.8 6.5 2.6 6.1C1.8 5.8 1.8 5.8 1.6 5.4C1.3 4.9 1.7 4.3 2.3 4.2C3.5 3.8 3.7 3.6 3.8 3C3.9 2.7 4.3 1.9 4.4 1.8C4.7 1.5 5.1 1.4 5.4 1.6C5.8 1.7 5.9 1.9 6 2.4C6.2 3 6.4 3.4 6.5 3.6C6.7 3.7 7.3 4 7.8 4.1C8.1 4.2 8.2 4.3 8.4 4.4C8.9 5 8.6 5.8 7.8 6C7.4 6.1 6.7 6.4 6.6 6.6C6.4 6.8 6.1 7.4 6 8C5.9 8.2 5.7 8.4 5.5 8.5C5.2 8.7 5 8.7 4.7 8.5Z"/><path d="M11.8 21.1C11.5 21 11.1 19.8 10.6 18.4C10.6 18.2 10.5 18 10.5 17.9C10.4 17.8 10.3 17.6 10.3 17.4C10.2 17.2 10.2 17 10.1 16.8C10 16.7 9.9 16.4 9.9 16.3C9.6 15.2 8.6 14.2 7.3 13.8C7.1 13.8 6.9 13.7 6.8 13.6C6.7 13.6 6.5 13.5 6.3 13.5C5.9 13.3 4.9 13 4.5 12.8C4.2 12.7 3.9 12.6 3.8 12.6C3.5 12.5 2.9 12.2 2.8 12.1C2.5 11.8 2.9 11.5 3.9 11.2C4.1 11.1 4.5 11 4.7 10.9C4.8 10.9 5.2 10.7 5.4 10.7C5.6 10.6 6 10.5 6.4 10.3C6.8 10.2 7.2 10 7.5 10C8.7 9.5 9.5 8.7 9.9 7.6C10 7.3 10.2 6.9 10.3 6.6C10.4 6.3 10.5 5.8 10.6 5.6C10.6 5.4 10.7 5.2 10.8 5C10.8 4.9 10.9 4.7 10.9 4.6C11.2 3.5 11.7 2.7 11.9 2.7C12.1 2.7 12.4 3.1 12.6 3.7C12.6 3.9 12.7 4.1 12.8 4.3C12.9 4.6 13.2 5.4 13.7 7.1C14.2 8.3 14.2 8.4 14.8 9C15.4 9.6 15.7 9.8 16.6 10.1C18.6 10.7 20.6 11.4 20.8 11.5C21.5 12 21.2 12.3 19.7 12.7C19.4 12.8 18.1 13.3 17.9 13.4C17.8 13.4 17.7 13.5 17.6 13.7C17.2 14 17 14 16.5 14.1C15.9 14.1 15.7 14.2 15.1 14.7C14.8 14.9 14.6 15.1 14.3 15.5C14.1 15.9 14 16 14 16.4C14 17.1 13.9 17.3 13.6 17.5C13.4 17.7 13.4 17.8 13.3 18C13.2 18.1 13.2 18.3 13.1 18.4C13.1 18.6 13 18.8 12.9 19C12.9 19.1 12.8 19.4 12.8 19.5C12.7 19.7 12.6 19.9 12.6 20.1C12.5 20.6 12.1 21.2 11.9 21.2C11.9 21.2 11.8 21.1 11.8 21.1ZM5 7.4C5 7.4 4.9 7.1 4.8 6.8C4.5 6 4.2 5.7 3.4 5.5C2.4 5.2 2.4 5 3.4 4.6C4.1 4.4 4.5 4 4.7 3.3C4.9 2.3 5.1 2.3 5.4 3.3C5.7 4.1 6 4.5 6.7 4.7C7 4.8 7.5 4.9 7.5 5C7.6 5.1 7.4 5.2 6.6 5.5C6.1 5.7 5.8 6.1 5.6 6.5C5.4 7.1 5.2 7.5 5.1 7.5C5.1 7.5 5 7.5 5 7.4Z"/>',
    weapons:
      '<path opacity=".5" d="M10.4 22.1C8.7 21.2 8.2 20.5 8.6 19.8C8.9 19.4 15.3 13.1 15.5 12.9C15.9 12.7 16.2 12.8 16.9 13.4C17.6 14.2 18.1 14.3 18.7 13.8C19.1 13.6 19.3 13.6 19.5 13.8C19.7 14 19.7 14.6 19.5 15.1C19.4 15.2 19.3 15.6 19.3 15.8C19 16.9 18.7 17.3 17 19C15.7 20.3 15.5 20.5 15 20.8C14.7 20.9 14.3 21.2 14.1 21.4C13.9 21.5 13.6 21.8 13.4 21.8C12.8 22.1 12.5 22.2 12.2 22.4C11.7 22.7 11.5 22.6 10.4 22.1ZM1.8 22.2C1.3 21.8 1.7 20.6 3.2 17.9C3.4 17.5 3.6 17.2 4.1 16.7C4.5 16.3 4.9 15.9 5 15.7C5.3 15.4 11.2 9.4 11.8 9C12.7 8.2 12.7 8 11.6 6.9C10.9 6.1 10.8 6 10.9 5.6C11 5.3 11 5.3 10.8 5.3C10.5 5.4 10.4 6.8 10.7 7.2C11.2 7.9 11.3 8.4 11 9.1C10.8 9.5 5.1 15.2 4.8 15.3C4 15.5 3.7 15.1 3.7 14C3.6 13.4 3.6 13.2 3.4 12.8C3.1 12.1 3.1 11.5 3.4 10.9C3.6 10.5 3.6 10.5 3.6 7.4C3.7 3.6 3.6 3.9 5 3.8C5.6 3.8 5.7 3.7 6.1 3.5C6.4 3.3 6.4 3.3 8.2 3.3C9.9 3.3 9.9 3.3 10.3 3.1C10.7 2.9 10.8 2.9 11.5 2.8C12.4 2.8 12.4 2.8 13.3 3.2C13.5 3.3 13.8 3.3 15 3.3C16.6 3.3 16.7 3.4 17 3.8C17.2 4.2 17.1 4.5 16.6 5.1C15.8 5.9 16.1 6 16.9 5.2C17.1 5 17.3 4.9 17.6 4.8C18.3 4.5 19 3.8 19.1 3.1C19.5 1.5 21 1 22 2.1C22.9 3.1 22.4 4.5 20.9 4.8C20.2 5 19.5 5.6 19.1 6.3C19 6.6 18.7 7 18.3 7.4C17.5 8.3 17.3 8.5 17.3 9.1C17.3 9.9 17.5 10.2 17.8 10.2C18.1 10.1 18.1 9.9 18.2 9.4C18.3 8.2 19.3 7.5 19.6 8.4C19.8 8.7 19.7 10 19.5 10.4C19.4 10.6 19.3 10.9 19.3 11.1C19.2 11.5 18.7 12.6 18.5 12.8C18.1 13.2 17.8 13.1 17 12.3C16.6 11.9 16.2 11.6 16.1 11.6C15.7 11.4 15.8 11.3 11 16.1C6.8 20.3 6.6 20.5 6.1 20.8C4 21.9 3.1 22.3 2.3 22.4C2 22.4 1.9 22.4 1.8 22.2ZM13.7 5.1C13.6 5 13.4 4.8 13.3 4.8C13.3 4.8 13.3 5 13.5 5.2C13.6 5.5 13.8 5.4 13.7 5.1Z"/><path d="M11.4 22C11 21.9 10.8 21.9 10.4 21.6C10.2 21.5 9.9 21.3 9.7 21.2C8.8 20.7 8.7 20.3 9.3 19.6C9.5 19.4 9.7 19.1 9.8 18.9C10 18.7 10.3 18.5 10.5 18.3C10.6 18.2 11.2 17.7 11.6 17.2C12.1 16.7 12.6 16.1 12.9 15.9C13.2 15.7 13.6 15.3 13.7 15.1C14.2 14.5 14.4 14.3 14.9 13.9C15.8 13.2 16 13.2 16.7 13.8C17.2 14.3 17.4 14.4 18.1 14.3C19.2 14.2 19.4 14.3 19.1 15C19 15.2 18.9 15.5 18.8 15.8C18.8 16 18.6 16.4 18.5 16.5C18.5 16.7 18.3 17 18.2 17.2C18 17.7 16.2 19.5 15.5 20C14.7 20.6 13.8 21.1 13.4 21.3C13.2 21.4 12.8 21.7 12.6 21.8C12.4 22 12.2 22.1 12.1 22.1C12 22.1 11.9 22.1 11.9 22.1C11.9 22.1 11.6 22.1 11.4 22ZM2.4 21.8C2 21.6 2 21.2 2.6 20C2.8 19.5 3.1 19 3.2 18.9C3.3 18.6 3.5 18.2 3.9 17.6C4.1 17.3 10.8 10.5 12 9.4C13.1 8.3 13.1 8.2 12.1 7C11.3 6.2 11.3 6 11.8 5.6C12.5 5.1 12.9 5.2 13.2 6C13.5 6.9 13.7 7 14.6 7C15.3 7.1 15.5 7 16.2 6.3C16.5 6.1 17.1 5.6 17.5 5.4C18.6 4.7 19.3 3.9 19.4 3.5C19.6 2.8 19.7 2.6 20 2.3C20.5 1.7 20.9 1.6 21.6 2.2C22.4 2.9 22.3 3.5 21.4 4.1C21.2 4.3 20.9 4.4 20.6 4.5C20.2 4.6 20.2 4.6 19.6 5.2C19.3 5.6 18.8 6.1 18.6 6.5C18.3 6.9 17.9 7.4 17.6 7.7C16.9 8.4 16.8 8.8 16.9 9.6C17 10.3 17.3 10.5 17.9 10.7C18.9 10.8 19 11.6 18.3 12.3C17.9 12.7 17.8 12.7 16.8 11.8C15.8 10.9 15.5 10.9 14.6 11.9C14.4 12.2 12.5 14.1 10.4 16.2C6.4 20.2 6.2 20.4 5.2 20.8C5 20.8 4.5 21.1 4 21.4C2.9 21.9 2.7 21.9 2.4 21.8ZM4.2 14.6C3.8 14.4 3.8 14.2 3.8 11.9C3.8 6.2 3.8 4.7 3.9 4.5C4.1 4.1 4.2 4.1 6.2 3.9C8.2 3.8 9.2 3.7 10.1 3.5C11 3.4 11.8 3.3 12.2 3.5C12.6 3.6 12.6 3.7 12.1 3.9C10.4 4.7 9.9 5.2 9.8 6.1C9.8 6.7 9.9 7 10.3 7.4C10.9 8.1 11 8.3 10.6 8.8C10.4 9.1 7.2 12.4 6.4 13.1C6.1 13.4 5.7 13.7 5.5 14C4.9 14.7 4.6 14.9 4.2 14.6ZM18.7 9.7C18.2 9.5 18.4 8.8 19 8.6C19.3 8.6 19.5 9 19.3 9.4C19.2 9.7 18.9 9.9 18.7 9.7ZM14.5 5.1C13.5 4 13.6 3.7 14.8 3.8C16.7 3.8 17 4.4 15.7 5.2C15.1 5.5 14.8 5.5 14.5 5.1Z"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor" stroke="none">${ICON[k]}</g></svg>`;
  const LANES = [
    { id: 'wish', name: 'Wishes', icon: 'tracker' },
    { id: 'event', name: 'Events', icon: 'planner' },
    { id: 'end', name: 'Endgame', icon: 'weapons' },
  ];
  const LANE_NAME = Object.fromEntries(LANES.map((l) => [l.id, l.name]));
  const LANE_ICON = Object.fromEntries(LANES.map((l) => [l.id, l.icon]));
  // In-game shots, same as the Lobby's Endgame cards (images/genshin/endgame/).
  const ENDGAME_ART = { ActTypeTower: '/images/genshin/endgame/abyss.webp', ActTypeRoleCombat: '/images/genshin/endgame/theater.webp' };

  // Feed and history times are the Asia server's clock (UTC+8). Most things start and
  // end at the same *server* time everywhere (srvEnd moves them to the picked server);
  // a version update starts at the same moment worldwide, and those are the only ones
  // at 06:00 / 07:00 Asia time.
  // ponytail: hour-of-day heuristic; switch to a per-item flag if ennead ever sends one.
  const isUpdate = (t) => [6, 7].includes(new Date((t + 8 * 3600) * 1000).getUTCHours());
  const local = (t) => (isUpdate(t) ? +t : srvEnd(t));
  // "Oct 21, 10:00" on the picked server's clock, for a moment already made local.
  const clock = (t) => new Date((t + SERVERS[server()] * 3600) * 1000);
  const when = (t) => {
    const d = clock(t);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  };
  const day = (t) => {
    const d = clock(t);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  };

  let raw = [];
  let phases = [];
  let items = [];
  let T0 = 0;
  let T1 = 0;

  // Everything dated, as one list: {lane, name, s, e (Asia), art, faces[], desc, primos}.
  function collect(feed, hist) {
    const roster = Object.fromEntries((feed.characters || []).map((c) => [c.name, c]));
    const live = feed.banners || [];
    const splash = {};
    live.forEach((b) => (b.characters || []).forEach((c) => c.splash && (splash[c.name] = c.splash)));
    const events = (feed.events || []).filter((e) => e.start && e.end);
    const out = [];
    events.forEach((e) =>
      out.push(
        e.type === 'ActTypeHardChallenge'
          ? { lane: 'end', name: e.name, s: e.start, e: e.end, art: e.image, desc: e.description }
          : { lane: 'event', name: e.name, s: e.start, e: e.end, art: e.image, desc: e.description },
      ),
    );
    (feed.challenges || []).forEach((c) =>
      out.push({ lane: 'end', name: c.name, s: c.start, e: c.end, art: ENDGAME_ART[c.type] || '', primos: c.primos }),
    );
    // The version's window = what the feed knows about; wish phases from the history
    // that overlap it (this version's earlier phase too).
    const start = Math.min(...out.map((x) => x.s), ...live.map((b) => b.start));
    phases = (hist.banners || []).filter((b) => b.end > start);
    phases.forEach((b) => {
      const five = b.five.map((n) => roster[n]).filter(Boolean);
      out.push({
        lane: 'wish',
        name: (b.kind === 'chronicled' ? 'Chronicled Wish: ' : '') + b.five.join(' & '),
        s: b.start,
        e: b.end,
        art: b.five.map((n) => splash[n]).find(Boolean) || '',
        faces: five.map((c) => ({ icon: c.icon, rarity: 5, name: c.name })),
        desc: `5★ ${b.five.join(', ')}${b.four.length ? ' · 4★ ' + b.four.join(', ') : ''}`,
      });
    });
    // History has no weapon wishes: the live one only.
    live
      .filter((b) => (b.weapons || []).length && !(b.characters || []).length)
      .forEach((b) => {
        const five = b.weapons.filter((w) => w.rarity === 5);
        out.push({
          lane: 'wish',
          name: 'Weapon Wish: ' + five.map((w) => w.name).join(' & '),
          s: b.start,
          e: b.end,
          art: (five.find((w) => w.splash) || {}).splash || '',
          weapon: true,
          faces: five.map((w) => ({ icon: w.icon, rarity: 5, name: w.name })),
          desc: `5★ ${five.map((w) => w.name).join(', ')} · 4★ ${b.weapons
            .filter((w) => w.rarity === 4)
            .map((w) => w.name)
            .join(', ')}`,
        });
      });
    return out;
  }

  const faces = (list) =>
    `<span class="ev-faces">${list.map((f) => `<img src="${esc(f.icon)}" alt="" title="${esc(f.name)}" loading="lazy">`).join('')}</span>`;
  const art = (x, cls, eager) =>
    x.art
      ? `<img class="${cls}" src="${esc(x.art)}" alt=""${eager ? '' : ' loading="lazy"'} decoding="async" onerror="this.remove()">`
      : '';
  const pct = (t) => (((t - T0) / (T1 - T0)) * 100).toFixed(3) + '%';
  const state = (x, t) => (t < x.s ? 'next' : t >= x.e ? 'ended' : 'live');
  // "Ends in 3d 4h" / "Starts in ..." / "Ended": the span is filled by GI.countdowns().
  const left = (x, t) =>
    state(x, t) === 'next'
      ? `<span class="ev-in">Starts in</span><span class="gi-ends" data-end="${x.s}"></span>`
      : `<span class="gi-ends" data-end="${x.e}"></span>`;

  function render() {
    if (!raw.length) return; // a server pick before the data arrives
    const t = now();
    items = raw.map((x) => Object.assign({}, x, { s: local(x.s), e: local(x.e) }));
    T0 = Math.min(...items.map((x) => x.s)) - DAY / 2;
    T1 = Math.max(...items.map((x) => x.e)) + DAY / 2;
    const order = items.map((x, i) => i).sort((a, b) => items[a].s - items[b].s || items[a].e - items[b].e);

    // Axis: a tick per server day, a date every Monday, the version / phase starts.
    const off = SERVERS[server()] * 3600;
    let scale = '';
    for (let d = Math.ceil((T0 + off) / DAY) * DAY - off; d < T1; d += DAY) {
      const mon = clock(d).getUTCDay() === 1 && d < T1 - 3 * DAY; // no date squeezed against the right edge
      scale += `<i class="ev-day${mon ? ' is-mon' : ''}" style="left:${pct(d)}"></i>${mon ? `<span class="ev-date" style="left:${pct(d)}">${day(d)}</span>` : ''}`;
    }
    const marks = phases
      .filter((b) => local(b.start) > T0)
      .map((b) => {
        const first = !phases.some((p) => p.version === b.version && p.start < b.start);
        return { t: local(b.start), label: first ? 'v' + b.version : 'Phase 2' };
      });
    const lines = marks.map((m) => `<i class="ev-mark" style="left:${pct(m.t)}"></i>`).join('');
    scale += marks.map((m) => `<span class="ev-ver" style="left:${pct(m.t)}">${esc(m.label)}</span>`).join('');
    scale += t > T0 && t < T1 ? `<span class="ev-today" style="left:${pct(t)}">Today</span>` : '';

    let html = `<div class="ev-row ev-axis"><span class="ev-lane-h"></span><div class="ev-track">${scale}</div></div>`;
    LANES.forEach((lane) => {
      // Pack bars into rows: each goes in the first row it doesn't overlap.
      const ends = [];
      const bars = order
        .filter((i) => items[i].lane === lane.id)
        .map((i) => {
          const x = items[i];
          let r = ends.findIndex((end) => end <= x.s);
          if (r < 0) r = ends.push(0) - 1;
          ends[r] = x.e;
          const st = state(x, t);
          const done = st === 'live' ? ((t - x.s) / (x.e - x.s)) * 100 : st === 'ended' ? 100 : 0;
          return `<button type="button" class="ev-bar is-${st}${x.art ? ' has-art' : ''}" data-i="${i}" style="left:${pct(x.s)};width:calc(${pct(x.e)} - ${pct(x.s)});top:${r * ROW}px">
            ${art(x, 'ev-bar-art')}<i class="ev-bar-done" style="width:${done.toFixed(1)}%"></i>
            ${x.faces ? faces(x.faces) : ''}<span class="ev-bar-name">${esc(x.name)}</span><span class="ev-bar-left">${left(x, t)}</span></button>`;
        })
        .join('');
      html += `<div class="ev-row ev-lane"><div class="ev-lane-h">${svg(lane.icon)}<span>${lane.name}</span></div><div class="ev-track" style="height:${Math.max(1, ends.length) * ROW + 8}px">${lines}${bars}</div></div>`;
    });
    const chart = $('evChart');
    chart.innerHTML = html;
    chart.style.setProperty('--now', t > T0 && t < T1 ? pct(t) : '-10%');

    // Phones: what's still running or to come, ending soonest first.
    $('evList').innerHTML = order
      .filter((i) => state(items[i], t) !== 'ended')
      .sort((a, b) => items[a].e - items[b].e)
      .map((i) => {
        const x = items[i];
        const done = state(x, t) === 'live' ? ((t - x.s) / (x.e - x.s)) * 100 : 0;
        return `<article class="gi-box ev-item"><div class="ev-item-art${x.weapon ? ' is-weapon' : ''}">${x.faces ? faces(x.faces) : art(x, '') + svg(LANE_ICON[x.lane])}</div>
          <div class="ev-item-body"><b>${esc(x.name)}</b><small>${LANE_NAME[x.lane]} &middot; ${day(x.s)} – ${day(x.e)}</small></div>
          <div class="ev-item-left">${left(x, t)}</div><i class="ev-item-bar" style="width:${done.toFixed(1)}%"></i></article>`;
      })
      .join('');

    // Header chips.
    const running = items.filter((x) => state(x, t) === 'live');
    const week = running.filter((x) => x.e - t < 7 * DAY);
    $('evFacts').innerHTML =
      `<li><b>${running.length}</b>running now</li><li><b>${week.length}</b>end this week</li>` +
      (phases.length ? `<li>version <b>${esc(phases[phases.length - 1].version)}</b></li>` : '');
    // Klee's line under "This version." (Oct 27 2026): the same two counts, in her voice.
    $('evKlee').textContent =
      `Klee counted ${running.length} things running right now! ` + (week.length ? `${week.length} of them end this week, so hurry.` : 'None of them end this week.');

    // The details panel starts on what ends soonest.
    const first = running.sort((a, b) => a.e - b.e)[0];
    show(first ? items.indexOf(first) : order[0]);
    countdowns();
  }

  let shown = -1;
  function show(i) {
    const x = items[i];
    if (!x) return;
    shown = i;
    $('evChart')
      .querySelectorAll('.ev-bar')
      .forEach((b) => b.classList.toggle('is-picked', +b.dataset.i === i));
    const t = now();
    const label = state(x, t) === 'next' ? 'Starts in' : 'Ends in';
    // The lane icon always rides along: CSS shows it (on a namecard) only when there's no picture, or it failed to load.
    const media = (x.art ? art(x, 'ev-d-img', true) : x.faces ? faces(x.faces) : '') + svg(LANE_ICON[x.lane]);
    const d = $('evDetail');
    d.hidden = false;
    d.innerHTML = `<div class="ev-d-art${x.lane === 'wish' ? ' is-wish' : ''}${x.weapon ? ' is-weapon' : ''}">${media}</div>
      <div class="ev-d-body"><span class="gi-label">${LANE_NAME[x.lane]}</span><h2 class="ev-d-name">${esc(x.name)}</h2>
      <p class="ev-d-when">${when(x.s)} – ${when(x.e)} <small>server time</small></p>
      ${x.desc ? `<p class="ev-d-desc">${esc(x.desc)}</p>` : ''}
      <div class="ev-d-foot"><div><span class="gi-label">${label}</span><span class="gi-ends" data-end="${label === 'Ends in' ? x.e : x.s}"></span></div>
      ${x.primos ? `<div><span class="gi-label">Reward</span><span class="gi-primo">${PRIMO}${x.primos.toLocaleString()}</span></div>` : ''}</div></div>`;
    countdowns();
  }

  const pick = (e) => {
    const b = e.target.closest('.ev-bar');
    if (b && +b.dataset.i !== shown) show(+b.dataset.i);
  };
  ['mouseover', 'focusin', 'click'].forEach((ev) => $('evChart').addEventListener(ev, pick));

  GI.serverTray($('evServer'), render);

  Promise.all([
    GI.feed,
    fetch('/genshin-history.json').then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }),
  ])
    .then(([feed, hist]) => {
      raw = collect(feed, hist);
      // Undated extras (e.g. a double-rewards event) can't be bars: named above the chart.
      const extra = (feed.events || []).filter((e) => !e.start || !e.end);
      if (extra.length) {
        $('evExtra').hidden = false;
        $('evExtra').innerHTML =
          `<span class="gi-label">Also running</span>${extra.map((e) => `<b>${esc(e.name)}</b>`).join('')}<small>no end date given</small>`;
      }
      if (!raw.length) throw new Error('nothing dated in the feed');
      render();
      setInterval(countdowns, 1000);
    })
    .catch((err) => {
      console.error('Events timeline failed to load:', err);
      $('evChart').innerHTML = '<p class="gi-empty">Couldn\'t load this version\'s events right now. Try again in a bit.</p>';
    });
})();
