/* ============================================================
   EVENT TIMERS — Clash of Clans event countdowns
   ------------------------------------------------------------
   Shared by /coc/town-hall-18/layouts (the "Today's Events" card) and
   /coc/ (the hero's event strip). Lived inside
   thz-script.js until /coc/ needed it too -- that file
   also injects a footer, a lightbox and page-specific handlers,
   none of which /coc/ wants, so the timers were split
   out here instead of loading all of it.

   No live Supercell API is publicly available for these timers
   (and the official dev API can't be called client-side without
   a backend/proxy), so this computes every countdown from the
   game's KNOWN, FIXED reset schedule (all times in UTC). This
   is deterministic and won't go stale or break like a random
   fan API might.

   Accuracy notes:
   - Raid Weekend, Clan Games and Season reset are global and
     the same for every player -> these are fully accurate.
   - Clan War League and Trader Shop resets are NOT identical
     for every clan/player (CWL depends on when a clan signs up
     and gets matched; Trader Shop reset can vary). The hours
     below (EVENT_CONFIG) are the common/default reset hours —
     tweak them if your clan's actual reset time differs.

   Markup contract: any element with data-event="<id>" is a row.
   Inside it, [data-timer] gets the countdown, [data-label] gets
   "Time Left:" / "Starts in:", and (season only) [data-name]
   gets "<Month> Battle Pass". Opt-in variants: data-name="short"
   abbreviates the month, data-label="bare" drops the label's
   trailing colon, data-label="phrase" reads as plain words
   ("Ends in" instead of "Time Left:"), and data-timer="long"
   spells the units out ("2 days 4 hours" instead of "2d 4h").
   ============================================================ */

(function () {
  const EVENT_CONFIG = {
    raid:      { startDow: 5, startHour: 7, endDow: 1, endHour: 7 },      // Fri 07:00 UTC -> Mon 07:00 UTC
    cwl:       { startDate: 1, startHour: 8, endDate: 9, endHour: 8 },    // approx sign-up + war days
    trader:    { hour: 8 },                                              // daily reset ~08:00 UTC
    season:    { hour: 8 },                                              // 1st of month, 08:00 UTC
    clangames: { startDate: 22, startHour: 8, endDate: 28, endHour: 8 }   // 22nd -> 28th, 08:00 UTC
  };

  /* Legend League tournaments do NOT follow a calendar-month rule: they
     run in fixed 4-week blocks that end on a Monday at 05:00 UTC, so the
     end date drifts relative to the month and can't be derived from it.
     This steps in 28-day increments from a known end instead. Anchor
     checked against the in-game timer on 2026-09-15, which read 19d 17h
     remaining -> Mon 5 Oct 2026 05:00 UTC. */
  const LEGEND_ANCHOR = Date.UTC(2026, 9, 5, 5, 0, 0);
  const LEGEND_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;

  /* Returns [[value, unit], [value, unit]] rather than a string so the
     caller can put each unit in its own element -- /coc/ accents
     the unit letters to match its stat numerals. */
  function durationParts(ms) {
    if (ms < 0) ms = 0;
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    if (days > 0) return [[days, 'd'], [hours, 'h']];
    return [[hours, 'h'], [mins, 'm']];
  }

  // "2 days 4 hours" / "4 hours 12 mins" / "12 mins".
  function durationLong(ms) {
    if (ms < 0) ms = 0;
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    const unit = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
    if (days > 0) return unit(days, 'day') + ' ' + unit(hours, 'hour');
    if (hours > 0) return unit(hours, 'hour') + ' ' + unit(mins, 'min');
    return unit(mins, 'min');
  }

  // Most recent occurrence of a given UTC weekday+hour that is <= now
  function mostRecentDow(now, dow, hour) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
    let diff = (d.getUTCDay() - dow + 7) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
    if (d > now) d.setUTCDate(d.getUTCDate() - 7);
    return d;
  }

  /* Every getter also returns `from`: the instant the current stretch began,
     so a caller can draw how far through it we are. For a running event
     that's when it started; for one that hasn't begun it's when the wait
     started (the previous occurrence ending). */
  function getWeeklyWindow(now, cfg) {
    const start = mostRecentDow(now, cfg.startDow, cfg.startHour);
    const daysToEnd = (cfg.endDow - cfg.startDow + 7) % 7;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + daysToEnd);
    end.setUTCHours(cfg.endHour, 0, 0, 0);

    if (now >= start && now < end) return { active: true, from: start, target: end };
    const nextStart = new Date(start);
    nextStart.setUTCDate(nextStart.getUTCDate() + 7);
    return { active: false, from: end, target: nextStart };
  }

  function getMonthlyRange(now, cfg) {
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    const start = new Date(Date.UTC(y, m, cfg.startDate, cfg.startHour, 0, 0));
    const end = new Date(Date.UTC(y, m, cfg.endDate, cfg.endHour, 0, 0));

    if (now < start) {
      const prevEnd = new Date(Date.UTC(y, m - 1, cfg.endDate, cfg.endHour, 0, 0));
      return { active: false, from: prevEnd, target: start };
    }
    if (now <= end) return { active: true, from: start, target: end };

    const nextStart = new Date(Date.UTC(y, m + 1, cfg.startDate, cfg.startHour, 0, 0));
    return { active: false, from: end, target: nextStart };
  }

  function getDailyReset(now, hour) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
    if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
    const from = new Date(d);
    from.setUTCDate(from.getUTCDate() - 1);
    return { active: true, from: from, target: d };
  }

  /* Seasons (and with them the Gold Pass) run 1st-to-1st, resetting at
     08:00 UTC. This used to be computed as "last Monday of the month at
     05:00", which was simply wrong -- on 2026-09-15 it produced 12d 17h
     against the game's actual 15d 20h, targeting Mon 28 Sep instead of
     Thu 1 Oct. */
  function getSeasonEnd(now, hour) {
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    let end = new Date(Date.UTC(y, m, 1, hour, 0, 0));
    if (end <= now) end = new Date(Date.UTC(y, m + 1, 1, hour, 0, 0));
    const from = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1, hour, 0, 0));
    return { active: true, from: from, target: end };
  }

  function getLegendEnd(now) {
    const elapsed = now.getTime() - LEGEND_ANCHOR;
    const cycles = Math.ceil(elapsed / LEGEND_CYCLE_MS);
    const target = new Date(LEGEND_ANCHOR + cycles * LEGEND_CYCLE_MS);
    return { active: true, from: new Date(target.getTime() - LEGEND_CYCLE_MS), target: target };
  }

  function computeEvent(id, now) {
    switch (id) {
      case 'raid':
        return getWeeklyWindow(now, EVENT_CONFIG.raid);
      case 'cwl':
        return getMonthlyRange(now, EVENT_CONFIG.cwl);
      case 'trader':
        return getDailyReset(now, EVENT_CONFIG.trader.hour);
      case 'season':
        return getSeasonEnd(now, EVENT_CONFIG.season.hour);
      case 'legend':
        return getLegendEnd(now);
      case 'clangames':
        return getMonthlyRange(now, EVENT_CONFIG.clangames);
      default:
        return null;
    }
  }

  /* Events with a real start and end, as opposed to a recurring reset.
     Only these can be "live": the Trader and the season/Battle Pass are
     always running, so computeEvent always reports them active and
     flagging them live would make the state meaningless. */
  const WINDOWED = { raid: true, cwl: true, clangames: true };

  const LABELS = {
    raid:      { active: 'Time Left:',     upcoming: 'Starts in:' },
    cwl:       { active: 'Time Left:',     upcoming: 'Starts in:' },
    trader:    { active: 'Refreshes in:',  upcoming: 'Refreshes in:' },
    season:    { active: 'Ends in:',       upcoming: 'Ends in:' },
    legend:    { active: 'Resets in:',     upcoming: 'Resets in:' },
    clangames: { active: 'Time Left:',     upcoming: 'Starts in:' }
  };

  function renderEventTimers() {
    const cards = document.querySelectorAll('[data-event]');
    if (!cards.length) return;
    const now = new Date();

    cards.forEach(card => {
      const id = card.getAttribute('data-event');
      const result = computeEvent(id, now);
      if (!result) return;

      const labelEl = card.querySelector('[data-label]');
      const timerEl = card.querySelector('[data-timer]');
      const nameEl = card.querySelector('[data-name]');
      const labelSet = LABELS[id] || { active: 'Time Left:', upcoming: 'Starts in:' };

      // Lets a page style "happening right now" differently from "counting
      // down to". Pages with no .is-live rule are unaffected.
      card.classList.toggle('is-live', !!result.active && !!WINDOWED[id]);
      // The opposite state: counting down to a START (Raid / CWL / Clan
      // Games between runs). Everything else is counting down to an end or
      // reset -- the always-on events too, which never get .is-live.
      // /coc/town-hall-18/layouts's event tags read "starts" / "ends" off this.
      card.classList.toggle('is-upcoming', !result.active);

      if (labelEl) {
        // The stock labels end in ":" because /coc/town-hall-18/layouts prints them
        // in front of the countdown. /coc/ puts them after it, where
        // a trailing colon would dangle -- data-label="bare" drops it.
        const text = result.active ? labelSet.active : labelSet.upcoming;
        const mode = labelEl.getAttribute('data-label');
        labelEl.textContent = mode === 'phrase'
          ? text.replace('Time Left:', 'Ends in').replace(/:$/, '')
          : mode === 'bare' ? text.replace(/:$/, '') : text;
      }

      if (timerEl && timerEl.getAttribute('data-timer') === 'long') {
        timerEl.textContent = durationLong(result.target - now);
      } else if (timerEl) {
        // Built as nodes, not a string, so the unit letters land in their
        // own <span>. An unstyled <span> renders as plain text, so pages
        // that don't target it look exactly as they did before.
        timerEl.textContent = '';
        durationParts(result.target - now).forEach((part, i) => {
          if (i) timerEl.append(' ');
          timerEl.append(String(part[0]));
          const unit = document.createElement('span');
          unit.textContent = part[1];
          timerEl.append(unit);
        });
      }

      /* Both of the below are opt-in: a page only gets them if its markup
         carries the hook, so pages without it render exactly as before. */

      // The wall-clock the countdown is counting to, in the reader's own
      // timezone -- the schedule is reasoned about in UTC, but "Fri, 18 Sep
      // 15:00" is only useful to a player as their own local time.
      const dateEl = card.querySelector('[data-date]');
      if (dateEl) {
        dateEl.textContent = result.target.toLocaleString([], {
          weekday: 'short', day: 'numeric', month: 'short',
          hour: '2-digit', minute: '2-digit'
        });
      }

      // How far through the current stretch we are, as a bar width.
      const barEl = card.querySelector('[data-progress]');
      if (barEl && result.from) {
        const span = result.target - result.from;
        const done = span > 0 ? ((now - result.from) / span) * 100 : 0;
        barEl.style.width = Math.max(0, Math.min(100, done)).toFixed(2) + '%';
      }

      // "Season Challenges" card is labeled "<Month> Battle Pass" and
      // updates automatically as the month changes (e.g. "August Battle Pass").
      if (id === 'season' && nameEl) {
        const month = nameEl.getAttribute('data-name') === 'short' ? 'short' : 'long';
        const monthName = now.toLocaleString('en-US', { month: month, timeZone: 'UTC' });
        nameEl.textContent = monthName + ' Battle Pass';
      }
    });
  }

  renderEventTimers();
  setInterval(renderEventTimers, 30000); // refresh every 30s

  // View More / View Less toggle (mobile only — hidden via CSS on desktop)
  const toggleBtn = document.getElementById('events-toggle-btn');
  const eventsCard = document.getElementById('events-section');
  if (toggleBtn && eventsCard) {
    toggleBtn.addEventListener('click', function () {
      const expanded = eventsCard.classList.toggle('expanded');
      toggleBtn.textContent = expanded ? 'View Less' : 'View More';
    });
  }
})();
