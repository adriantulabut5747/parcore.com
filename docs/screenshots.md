# Screenshotting pages

Moved out of CLAUDE.md on Nov 1 2026, unchanged. Paths like `parcore.com/docs/x.md` are relative to the outer folder.

## Screenshotting these pages (headless Chrome)

Serve the folder first (`python _tools/serve.py`, port 8765; plain `http.server`
can't resolve clean URLs like `/valorant/crosshairs`) — opening
pages via `file://` breaks the JSON fetches. Then, five things that will otherwise
produce screenshots that look like bugs but aren't:

**1. The viewport has a 500px floor.** Headless Chrome clamps to `innerWidth: 500`
no matter what you pass. `--window-size=430,880` still *renders* at 500px but writes
a 430px-wide PNG, so the right edge looks cropped — layout cards, the last nav tab,
the last bottom-nav item. That is not overflow. **Shoot mobile at `500,900` or
wider.** To check for real overflow, compare `document.documentElement.scrollWidth`
against `window.innerWidth` instead of eyeballing the image.

**2. CSS transitions never run.** Under `--virtual-time-budget` a transition stays
parked at its start values. The More sheet is the clearest case: adding `.open` to
`#moreOverlay` leaves it at `opacity: 0` with `.more-sheet` at `translateY(644px)`,
i.e. invisible and off-screen. To capture it, force the end state:

```js
overlay.classList.add('open');
overlay.style.transition = 'none'; overlay.style.opacity = '1';
sheet.style.transition = 'none';   sheet.style.transform = 'translateY(0)';
```

Also prefer setting the open state directly over calling `toggleMoreMenu()` — it is
a toggle, so it flips back if anything else fires it.

**3. `requestAnimationFrame` does not tick reliably.** Anything that defers work to
rAF appears frozen — the hero parallax in `hwr-js.js`, count-up stat numbers. Not a
bug in the page. Patch it in an inline script placed *before* the deferred script
that uses it: `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0)`.

**4. Scroll events do not fire for programmatic scrolls.** Setting `scrollTop` or
calling `scrollTo()` moves the element but dispatches no `scroll` event, so
scroll-driven features (parallax, the nav-bar auto-hide) cannot be verified this
way at all. Verify them by tracing that the listener attaches, then check the motion
in a real browser. Related: `.coc-main` has `scroll-behavior: smooth`, which
silently swallows `scrollTop` assignments — set `el.style.scrollBehavior = 'auto'`
first, or the element just never moves.

**5. Probe at the real address.** Active-nav state compares the full path
(`/coc/town-hall-18/layouts`), so a copy at any other address matches nothing and
every chip reads inactive. To inject test code, temporarily edit the real file and
restore it afterwards (back it up first), rather than making a copy elsewhere.

**6. `--disable-gpu` can drop big pictures.** On Nov 1 2026 the Valorant lobby's open map slice and the 705x640 agent
render came out blank at 1440px even though `complete`, `naturalWidth`, size and opacity were all fine; the same shot
without `--disable-gpu` drew them. If a large image is blank, reshoot without that flag before calling it a bug.
