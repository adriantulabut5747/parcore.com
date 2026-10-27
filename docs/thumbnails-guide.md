# Article thumbnails: what Adrian wants

Rules for every article banner / card thumbnail. These override
`articles-guide.md` 5b's old "no text on thumbnails" rule.

## The goal

- **Short messages.** 2–4 short lines. Long titles are what he disliked
  about the old ones.
- **Consistent but unique.** Same family look, but no two cards alike: each
  gets its own idea that shows the article's point. Only the two tier lists
  are a matched pair.
- **Professional, clean, easy on the eye. No AI slop.** One strong idea,
  no clutter.
- **Go all out.** Search the web for better art and references when it helps.

## The look

- 1920×1080 banner, same image at 800×450 for the card.
- Dark charcoal background with faint diagonal slabs (a full-bleed scene is
  fine when the art earns it, like Hammer Jam).
- Orbitron. Headline on the left, **vertically centred**: grey first line,
  white middle, **key word in red `#c23b3b`** and biggest.
- Small line under the headline at **46px**, readable at card size, carrying
  a real fact from the article.
- Art on the right with soft white/red glow.
- Text never touches the art. Top-left stays calm (site watermark goes there).

## Margins (every card, all four sides)

Adrian's rule (Oct 26 2026): **every thumbnail respects its margins on all sides.** Art
touching or crossing an edge (like the Clan Games Strongman did) is a bug.

- **Safe area on the 1920×1080 artboard:** 96px left, 96px right, 96px top, **150px bottom**
  (= 40 / 40 / 40 / 63px on the 800px card). The headline already starts at x 96.
- **Must stay fully inside:** character and building art, all text, and every drawn graphic
  (rings, bars, frames, tiles, ticks, labels, lines, dots). Measure the *visible* pixels:
  transparent padding in a cutout doesn't count.
- **May bleed (atmosphere only):** the ground, faint slabs, glows, the bottom shade, light
  streaks / beams, and a full-bleed scene used as the background (Hammer Jam).
- **Art that's cut off in its source** (an arm reaching in from above) must not touch the
  edge either: fade it in inside the safe area with a mask (Base building's hand).
- **Check before handing over:** `python _canva/_thumb-builder/margins.py <folder with the
  canvas's .dc.html files>` lists everything outside the safe area. Anything it flags is either
  fixed or one of the bleed cases above.

## Words and facts

- Headline comes from the article's own words ("real secret", title).
- Don't repeat another card's key word or graphic.
- Every number and ranking is real, counted from the article.
- Name characters correctly (big goggled robot = O.T.T.O, small one = B.O.B).

## How to work with him

- Render it, **look at it, fix it** before handing it over.
- Put it on the local site so he can see it live (localhost:8765, Ctrl+F5).
- Ask when it's a real choice (like headline wording). When he says "up to
  you", decide and say why.
- Don't commit or push unless he asks.

## Where the thumbnails live

One Design canvas holds every thumbnail as an artboard (`project/<Name>.dc.html`).
Two links, same canvas (artifact id `0bc90a23-699a-4ebf-8f91-75c972c250c4`):

- https://claude.ai/artifact/2TQdabtGPUQvbdGMMNFQEP#page-dcb81aee8d83
- https://claude.ai/chat/ab0b0218-8b87-4fb6-b67f-ba3c27be509b?artifact=0bc90a23-699a-4ebf-8f91-75c972c250c4

Builder scripts (outside the repo): `Downloads/parcore.com/_canva/_thumb-builder/`
(`build*.py` write a local preview + the canvas `.dc.html`; images go up as canvas assets).