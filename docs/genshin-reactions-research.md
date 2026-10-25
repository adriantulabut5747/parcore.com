# Reactions chart: research notes (Oct 26 2026)

Source for the planned `/genshin-impact/reactions` page (handoff 7, page 24). Facts from the Fandom wiki
(read through its API: `api.php?action=parse&page=<Page>&prop=wikitext`, WebFetch gets HTTP 402), the in-game
tutorial text the wiki quotes, and two community guides. Formulas for the new reactions are community-tested
(Bilibili frame tests the wiki cites), not published by HoYoverse. **Adrian's fact-check is final.**

Game is on **7.1** ("A Rekviem for the Underworld", Sep 23 2026). Snezhnaya started in 7.0 (Aug 12 2026).

## Timeline of the new reactions

| Version | Date | Added |
|---|---|---|
| 5.8 | Jul 30 2025 | Lunar reactions + Moonsign, first one: **Lunar-Charged** (Ineffa) |
| Luna I (6.0) | Sep 10 2025 | **Lunar-Bloom** (Lauma, Nefer); Nod-Krai opens |
| Luna IV (6.3) | Jan 14 2026 | **Lunar-Crystallize** (Columbina, Zibai) |
| Luna VIII (6.7) | Jul 1 2026 | **Stellar-Conduct**, first Stellar Glimmer reaction (Snezhnaya preview) |
| 7.0 | Aug 12 2026 | **Stellar Swirl** |

Version names: 6.0-6.7 are called Luna I-VIII in game, then back to numbers at 7.0.

## The big idea (what players get wrong)

A Lunar / Stellar reaction is **not a new element pair**. It's an existing pair that gets **swapped** for a
stronger version when a specific character is in the party. Same elements, different result:

| Elements | Normal | Swapped to | Swapped when the party has |
|---|---|---|---|
| Hydro + Electro | Electro-Charged | **Lunar-Charged** | Ineffa, Flins, Columbina |
| Hydro + Dendro | Bloom | **Lunar-Bloom** | Lauma, Nefer, Columbina |
| Hydro + Geo | Crystallize (Hydro shard) | **Lunar-Crystallize** | Zibai, Linnea, Columbina |
| Cryo + Electro | Superconduct | **Stellar-Conduct** | Sandrone, Odette, Traveler (Cryo) |
| Cryo + Anemo | Swirl (Cryo) | **Stellar Swirl** | Sandrone, Odette, Traveler (Cryo), Vesna |

- All three Lunar reactions involve **Hydro**. No Hydro = no Lunar reaction.
- Both Stellar reactions involve **Cryo**.
- Lunar enablers = **Moon Wheel** users (Nod-Krai's Vision-like gem; Zibai is the one from Liyue) + Columbina.
  Their passive is a "Moonsign Benediction" that converts the reaction.
- Stellar enablers = **Stellar Linchpin** users (Snezhnaya's Vision-like gem) + Cryo Traveler.
  Their passive is a "Stellar Jubilee".
- Columbina converts all three Lunar reactions (+7% base bonus); the others convert one (+14%).
  Traveler (Cryo) gives +7%, the others +14%. Vesna: Stellar Swirl only.

## What each new reaction does

**Lunar-Charged** (Hydro + Electro). In-game: "a thundercloud forms. This thundercloud will continuously
release bursts of lightning at nearby targets who are affected by both Electro and Hydro, dealing Electro DMG.
This DMG can trigger CRIT Hits, and the DMG dealt is based on all characters who have applied elements during
the reaction." Wiki: hits every Wet + Electro enemy within ~5 m every 2 s; each hit eats 0.4 gauge of both
auras; cloud lasts 6 s, re-triggering resets it; one cloud on the field at a time.

**Lunar-Bloom** (Hydro + Dendro). In-game: "In addition to the standard Bloom reaction effects, this also
provides the party with valuable Verdant Dew. Certain characters can consume Verdant Dew or utilize their
Talents to deal Lunar-Bloom DMG." It does **no damage by itself**: the Dendro Cores are normal Bloom cores
(their damage is normal Bloom). Verdant Dew: 1 every 2.5 s for 2.5 s after the reaction, max 3, never
expires (survives teleports, team swaps, daily reset, closing the game).

**Lunar-Crystallize** (Hydro + Geo). In-game: "three Moondrifts will form near the target. Triggering the
Lunar-Crystallize reaction three times will initiate Moondrift Harmony, which deals Geo DMG to nearby
opponents. This DMG can trigger CRIT Hits." Moondrifts count as Geo constructs, so Geo resonance (Enduring
Rock) turns on its +15% DMG / -20% Geo RES when they're near, even without a shield.

**Stellar-Conduct** (Cryo + Electro). Makes a **Starlight Prism** (7 s) with a **Polestar Field** around it.
In the field: Cryo + Electro DMG +20%, enemies Physical RES -40%. Every 4 s the field counts Cryo/Electro hits
(up to 12) and boosts: DMG bonus 29% + 1%/hit (max 40%), Stellar-Conduct coefficient 1.45 + 0.05/hit (max 2).
No damage by itself: characters deal Stellar-Conduct DMG through their talents. Open-world extras in
Snezhnaya (keeps warmth / Eye of Graeae energy, buffs Prime Ice constructs and firearms).

**Stellar Swirl** (Cryo + Anemo). Deals Anemo damage, then makes a **Stellar Vortex** (3 s) that explodes for
AoE Cryo. Trigger 3 times: Vortex goes Lv. 2 (bigger, more damage). 3 more: it explodes right away. After an
explosion your next jump goes higher (5 s). Some characters make a Wandering Vortex instead (-35% Anemo RES 6 s).

## Moonsign (team bonus, Nod-Krai)

Moonsign characters: Aino, Columbina, Flins, Illuga, Ineffa, Jahoda, Lauma, Linnea, Nefer, Zibai.
**Every** Moonsign character raises the level; only Moon Wheel users + Columbina also **enable** reactions
(Aino, Jahoda, Illuga raise the level but don't convert anything).

| Level | Moonsign characters | Effect |
|---|---|---|
| Nascent Gleam | 1 | Everyone gets "Nascent Gleam" (talents read it) |
| Ascendant Gleam | 2+ | Moonsign characters' talents get stronger, plus: for 20 s after a **non-Moonsign** character uses Skill or Burst, Lunar Reaction DMG +X% for the party (max 36%, no stacking) |

Ascendant Gleam X by the non-Moonsign character's element (stat for the 36% cap):
- Pyro / Electro / Cryo: 0.9% per 100 ATK (4,000 ATK)
- Hydro: 0.6% per 1,000 Max HP (60,000 HP)
- Geo: 1% per 100 DEF (3,600 DEF)
- Anemo / Dendro: 2.25% per 100 EM (1,600 EM)

(Also on the same Team Bonus screen now: Hexerei, 2+ Hexerei characters = "Secret Rite". Not a reaction.)

## How the damage works (the part nobody understands)

**Everyone who applied an element contributes.** For Lunar-Charged / Lunar-Crystallize / Stellar Swirl
(the ones that deal damage by themselves), the game works out a separate hit for every character who put
one of the two elements on the enemy, using that character's own level, EM and **CRIT**, then ranks them:

> best × 60% + 2nd × 30% + 3rd × 5% + 4th × 5%

Fewer than 4 contributors: missing slots are just dropped (not re-weighted). Whether it counts as a crit
(Favonius etc.) = whether the **best** one crit.

Per contributor:
`coefficient × level multiplier × (1 + base bonus) × (1 + EM bonus + reaction bonus) × RES × CRIT`

Coefficients: Lunar-Charged 3 · Lunar-Crystallize 1.6 · Stellar Swirl first hit 0.75, Vortex Lv1 2, Lv2 3 ·
direct Lunar-Bloom 1 · direct Stellar-Conduct 1-2 (Prism). (Old ones for comparison: Electro-Charged 2,
Bloom 2, Superconduct 1.5, Swirl 0.6, Overloaded 2.75, Hyperbloom/Burgeon/Shatter 3, Burning 0.25.)

**Direct** Lunar/Stellar damage: some talents deal it straight from a stat (e.g. Lauma, Nefer, Illuga,
Columbina's kits). Still counts as reaction damage (EM + reaction bonus apply).

Rules shared by all Lunar + Stellar damage:
- **Can CRIT** (normal crit stats). Old transformative reactions can't (except Nahida C2, Lauma A1, Mizuki C6).
- **Ignores enemy DEF** and **ignores normal DMG Bonus** (Furina/Yelan % buffs, goblets don't help).
- Affected by enemy RES (shred works).

**EM bonus by family** (what the stat sheet shows):
- Lunar / Stellar: 6 × EM / (EM + 2000) → 200 EM 55%, 400 100%, 600 138%, 800 171%, 1000 200%
- Transformative: 16 × EM / (EM + 2000)
- Melt / Vaporize: 2.78 × EM / (EM + 1400)
- Aggravate / Spread: 5 × EM / (EM + 1200)

## Old reactions (for the full chart): numbers to show

- Vaporize: Hydro on Pyro 2×, Pyro on Hydro 1.5×. Melt: Pyro on Cryo 2×, Cryo on Pyro 1.5×.
- Aggravate coefficient 1.15, Spread 1.25 (added flat damage).
- Transformative: can't crit, ignore DEF, only level + EM matter.
- High Voltage (2 Electro) and Sprawling Greenery (2 Dendro) resonances now list the Lunar/Stellar reactions too.

## Sources
- Wiki pages: Lunar Reaction, Lunar-Charged, Lunar-Bloom, Lunar-Crystallize, Stellar-Conduct, Stellar Swirl,
  Moonsign (Team Bonuses), Damage ("Lunar and Stellar Glimmer Reaction Damage"), Moon Wheel, Stellar Linchpin,
  Elemental Reaction, Version/* pages.
- timesaver.gg "Genshin Lunar Reactions Explained", game8 Lunar-Charged guide, genshinteambuilder.com
  (cross-checks only; never credited on the page).
