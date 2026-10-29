# Saved: the floating-island 3D hero (Oct 28 2026)

Pulled off /minecraft/ when the lobby hero became the Nether piglin banner. Kept for later use.
Not published (lives outside `site/`).

- `mc-lobby-hero.js` - the three.js scene (Wandy T. + 2 trader llamas at a stall on a floating island).
  Needs `site/mc-mob3d.js` on the page (`MobView.lib()` lends three.js + the mob builder) and the
  block textures in `site/minecrafticons/blocks/`. It also drove the hero's chat line (#mlLine)
  and splash (#mlSplash): strip those parts if reused elsewhere.
- `hero.html` - the hero markup as it was (`#mlHero`, `.ml-sky`, `.ml-poster`, `#mlScene`).
- `hero.css` - mc-lobby.css lines 1-150 at the time (the HERO block + title-screen pieces).
- `hero.webp` / `hero-phone.webp` - the transparent poster stills (shown until WebGL is ready).
- `hero-bg.webp` - the blurred Hardcore Parcore sunset behind it (`../bg.py` bakes it).

Gotchas: block faces are built clockwise and drawn 0-2-1 (FrontSide), flip that and the island
renders inside-out; the awning is stepped (blocks can't tilt); re-render the posters after any
scene change (canvas.toDataURL right after a draw(), 1185x880 + 500x460).
