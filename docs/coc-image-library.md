# Clash of Clans image library (for articles)

Every path below is **root-absolute**: write it exactly as shown in `src="..."`.
On disk they live under `site/` (e.g. `/clashofclans/buildings/cannon/5.webp`
is the file `site/clashofclans/buildings/cannon/5.webp`).
Only use files listed here. Never invent a filename: if a picture isn't listed,
leave a `<!-- SHOT: ... -->` comment or use the placeholder instead.

## 1. Troops, heroes, spells, pets, equipment: icon chips

Folder: `/clashofclans/coctools/units/<name>.webp`

Markup (one small row, roughly once every section or two):

```html
<div class="ap-chips"><span class="ap-chip"><img src="/clashofclans/coctools/units/archer-queen.webp" alt="" width="36" height="36" loading="lazy" decoding="async">Archer Queen</span><span class="ap-chip"><img src="/clashofclans/coctools/units/giant-arrow.webp" alt="" width="36" height="36" loading="lazy" decoding="async">Giant Arrow</span></div>
```

**Heroes:** archer-queen, barbarian-king, grand-warden, royal-champion, minion-prince, dragon-duke

**Troops:** archer, baby-dragon, balloon, barbarian, bowler, dragon, dragon-rider,
druid, electro-dragon, electro-titan, furnace, giant, goblin, golem, headhunter,
healer, hog-rider, ice-golem, lava-hound, meteor-golem, miner, minion, p-e-k-k-a,
root-rider, thrower, valkyrie, wall-breaker, witch, wizard, yeti, apprentice-warden

**Super troops:** super-archer, super-barbarian, super-bowler, super-dragon,
super-giant, super-hog-rider, super-miner, super-minion, super-valkyrie,
super-wall-breaker, super-witch, super-wizard, super-yeti, sneaky-goblin,
inferno-dragon, ice-hound, rocket-balloon

**Siege machines:** wall-wrecker, battle-blimp, stone-slammer, siege-barracks,
log-launcher, flame-flinger, battle-drill, troop-launcher

**Spells:** lightning-spell, healing-spell, rage-spell, jump-spell, freeze-spell,
clone-spell, invisibility-spell, recall-spell, revive-spell, poison-spell,
earthquake-spell, haste-spell, skeleton-spell, bat-spell, overgrowth-spell,
ice-block-spell, totem-spell, angry-spell-spell

**Pets:** lassi, electro-owl, mighty-yak, unicorn, frosty, diggy, poison-lizard,
phoenix, spirit-fox, angry-jelly, sneezy, greedy-raven

**Hero equipment:** action-figure, archer-puppet, barbarian-puppet, dark-crown,
dark-orb, earthquake-boots, electro-boots, electro-fangs, eternal-tome,
fire-heart, fireball, flame-blower, frost-flake, frozen-arrow, giant-arrow,
giant-gauntlet, haste-vial, healer-puppet, healing-tome, henchmen-puppet,
heroic-torch, hog-rider-doll, invisibility-vial, lavaloon-puppet, life-gem,
magic-mirror, metal-pants, meteor-staff, monolith-arrow, noble-iron, rage-gem,
rage-vial, revenge-deck, rocket-backpack, rocket-spear, royal-gem, ruin-witch,
seeking-shield, sky-wagon, snake-bracelet, spiky-ball, stick-horse,
stun-blaster, vampstache

**Builder Base (prefix `bb-`):** bb-baby-dragon, bb-battle-copter,
bb-battle-machine, bb-beta-minion, bb-bomber, bb-boxer-giant, bb-cannon-cart,
bb-drop-ship, bb-electrofire-wizard, bb-hog-glider, bb-night-witch,
bb-power-p-e-k-k-a, bb-raged-barbarian, bb-sneaky-archer

## 2. Buildings: renders by level

Folder: `/clashofclans/buildings/<name>/<level>.webp` (levels 1 to the max listed)

| Building | Levels |
|---|---|
| town-hall | 1–18 |
| cannon | 1–21 |
| archer-tower | 1–21 |
| mortar | 1–18 |
| air-defense | 1–16 |
| wizard-tower | 1–17 |
| hidden-tesla | 1–17 |
| air-sweeper | 1–7 |
| bomb-tower | 1–13 |
| x-bow | 1–13 |
| inferno-tower | 1–12 |
| eagle-artillery | 1–7 |
| scattershot | 1–7 |
| monolith | 1–5 |
| spell-tower | 1–4 |
| multi-archer-tower | 1–4 |
| ricochet-cannon | 1–4 |
| multi-gear-tower | 1–3 |
| firespitter | 1–3 |
| revenge-tower | 1–2 |
| super-wizard-tower | 1–2 |
| builders-hut | 1–8 |
| clan-castle | 1–14 |
| gold-storage | 1–19 |
| elixir-storage | 1–19 |
| dark-elixir-storage | 1–13 |

Town Hall heading:

```html
<h2 id="th17" class="ap-th-h"><img src="/clashofclans/buildings/town-hall/17.webp" alt="" width="40" height="40" loading="lazy">Town Hall 17</h2>
```

Building in a table (`.ap-def`): 40px render before the name. Level row
(`.ap-forms`): a building's looks side by side:

```html
<div class="ap-forms"><div><img src="/clashofclans/buildings/cannon/1.webp" alt="Cannon, level 1" loading="lazy" decoding="async"><span>Level 1</span></div><div><img src="/clashofclans/buildings/cannon/21.webp" alt="Cannon, level 21" loading="lazy" decoding="async"><span>Level 21</span></div></div>
```

## 3. Walls and resources

- Walls: `/clashofclans/coctools/walls/wall-1.webp` … `wall-19.webp`, plus
  `wall-ring.webp`, `hammer-jam.webp`, `builder-boost.webp`, `elixir.webp`
- `/clashofclans/coctools/Gold.webp`, `Glowy_Ore.webp`, `Shiny_Ore.webp`,
  `Starry_Ore.webp`, `raidmedals2.webp`
- Event/mode art: `/clashofclans/coctools/battlepass.webp`, `clangames.webp`,
  `cwl.webp`, `raidweekend.webp`, `trader.webp`

## 4. Tool links (icon + link to a site tool)

```html
<a class="ap-tool" href="/coc/tools/walls"><img src="/clashofclans/coctools/th17-wall.webp" alt="" loading="lazy">wall calculator</a>
```

- Wall calculator: `/clashofclans/coctools/th17-wall.webp`
- Army maker: `/clashofclans/coctools/army-camp.webp`
- TH layouts / army pages: `/icons/coc-nav/thNN.webp` and `/icons/coc-nav/barracks-thNN.webp` (TH8–18)

## 5. The article's own photos

Folder per article: `/clashofclans/articles/<id>/` (`<id>` = the article slug)

- `banner.webp` (1920px wide), `thumb.webp` (800px, 16:9, official key art, no text)
- Body photos with plain names (`league-shop.webp`, `heroes.webp`)
- Max 3–4 full-width body photos per article (icons above don't count)
- These don't exist yet for a new article. Mark each slot with a shot note and
  use the placeholder until Adrian sends the screenshot:

```html
<!-- SHOT: the League Shop with Builder Potions boxed in red -->
<figure class="ap-fig"><img src="/clashofclans/articles/placeholder-aqueen.webp" width="1600" height="1000" alt="What the screenshot shows" loading="lazy" decoding="async"><figcaption>One plain line saying what it shows.</figcaption></figure>
```

Existing articles for reference: `hammer-jam`, `upgrade-order`,
`equipment-tier-list`, `crafted-defenses-season-4`.

Avatar for the author block: `/icons/parcore-avatar.webp`.
