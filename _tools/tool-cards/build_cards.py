# Writes tool-cards.html (the preview) and, without --preview, the live
# site/tool-cards.css + .js and the cards in site/coc/index.html. Nine
# laby-style cards: one subject on a soft glow each, a slow idle, the same
# motion bigger / faster on hover. Numbers are real (see each card's notes).


def f(x):
    return ('%.2f' % x).rstrip('0').rstrip('.')


U = ''  # root-absolute; the preview resolves it with <base href="http://localhost:8765/">

# ---------------- Army Maker keyframes ----------------
# One subject (the Army Camp) like every other card. A troop drops in from
# above and sinks into the camp, which gives a little squash on each landing.
# Idle 8s: Rocket Balloon, Super Minion, Healer one at a time (the TH18 #1
# army's three biggest stacks). Hover 3s: the same three in quick succession,
# then the camp hops and a ring ripples off it.
A = []


def am_drop(name, t, fall, sink):
    """one troop: falls (accelerating) from above the stage onto the camp, then shrinks into it"""
    return (f"@keyframes {name} {{ 0%, {f(t)}% {{ opacity: 0; transform: translateY(-10px) rotate(-8deg); animation-timing-function: cubic-bezier(.55,0,.85,.4); }} "
            f"{f(t + fall * .3)}% {{ opacity: 1; }} {f(t + fall)}% {{ opacity: 1; transform: translateY(56px) rotate(0deg) scale(1); animation-timing-function: ease-out; }} "
            f"{f(t + fall + sink)}%, 100% {{ opacity: 0; transform: translateY(64px) scale(.3); }} }}")


def am_camp(name, lands, hop=None):
    fr = ['0% { transform: none; filter: none; }']
    for L in lands:
        fr += [f"{f(L - .1)}% {{ transform: none; filter: none; }}", f"{f(L + .8)}% {{ transform: scale(1.06, .92); filter: brightness(1.25); }}",
               f"{f(L + 5)}% {{ transform: none; filter: none; }}"]
    if hop:
        fr += [f"{f(hop)}% {{ transform: none; filter: none; }}", f"{f(hop + 4)}% {{ transform: translateY(-7px) scale(1.04, .97); filter: brightness(1.4); }}",
               f"{f(hop + 8)}% {{ transform: translateY(0) scale(1.05, .93); filter: brightness(1.2); }}", f"{f(hop + 14)}% {{ transform: none; filter: none; }}"]
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ transform: none; filter: none; }} }}"


AM_IDLE, AM_HOVER = [12, 40, 68], [6, 20, 34]
for i, t in enumerate(AM_IDLE):
    A.append(am_drop(f'ami-t{i}', t, 7, 2.5))
for i, t in enumerate(AM_HOVER):
    A.append(am_drop(f'amh-t{i}', t, 11, 4))
A.append(am_camp('ami-camp', [t + 7 for t in AM_IDLE]))
A.append(am_camp('amh-camp', [t + 11 for t in AM_HOVER], hop=50))
army_kf = '\n'.join(A)

# ---------------- Damage Calculator keyframes ----------------
# Monolith 1 = 4747 HP, Lightning 13 = 720 (coc-damage-calc.json): each bolt
# takes 15.2% of the bar, so it takes 7 bolts (5040) to destroy it.
# idle 8s: a bolt at 2.4s, a pause, a second at 4.4s, then the bar grows
# back (4747 -> 4027 -> 3307); hover 4s: seven bolts 0.34s apart -> 0, DESTROYED
D = []


def strike_set(name, hits, dur, regrow, steps):
    """bolt / flash / ring / health keyframes for a list of hit % marks"""
    bolt = ['0% { opacity: 0; stroke-dashoffset: 1; }']
    flash = ['0% { filter: brightness(1); }']
    ring = ['0% { opacity: 0; transform: scale(.4); }']
    for h in hits:
        bolt += [f"{f(h)}% {{ opacity: 0; stroke-dashoffset: 1; }}", f"{f(h+.8)}% {{ opacity: 1; stroke-dashoffset: 0; }}",
                 f"{f(h+2)}% {{ opacity: .35; }}", f"{f(h+2.8)}% {{ opacity: 1; }}", f"{f(h+4.5)}% {{ opacity: 0; stroke-dashoffset: 0; }}"]
        flash += [f"{f(h+.6)}% {{ filter: brightness(1); }}", f"{f(h+1.2)}% {{ filter: brightness(1.9); }}", f"{f(h+4)}% {{ filter: brightness(1); }}"]
        ring += [f"{f(h+.8)}% {{ opacity: 0; transform: scale(.4); }}", f"{f(h+1.4)}% {{ opacity: .7; transform: scale(.6); }}", f"{f(h+7)}% {{ opacity: 0; transform: scale(1.4); }}"]
    bolt.append('100% { opacity: 0; stroke-dashoffset: 1; }')
    flash.append('100% { filter: brightness(1); }')
    ring.append('100% { opacity: 0; transform: scale(.4); }')
    hp = ['0% { --dc-p: 100; }']
    gh = ['0% { --dc-g: 100; }']
    prev = 100
    for h, v in zip(hits, steps):
        hp += [f"{f(h+.8)}% {{ --dc-p: {prev}; }}", f"{f(h+2.4)}% {{ --dc-p: {v}; }}"]
        gh += [f"{f(h+3.5)}% {{ --dc-g: {prev}; }}", f"{f(h+7)}% {{ --dc-g: {v}; }}"]
        prev = v
    hp += [f"{f(regrow[0])}% {{ --dc-p: {prev}; }}", f"{f(regrow[1])}%, 100% {{ --dc-p: 100; }}"]
    gh += [f"{f(regrow[0])}% {{ --dc-g: {prev}; }}", f"{f(regrow[1])}%, 100% {{ --dc-g: 100; }}"]
    # floating damage number per hit: pops beside the bar, rises, fades
    dmg = []
    span = (1.6 if name == 'dci' else .9) / dur * 100  # 1.6s at rest, 0.9s on hover
    for i, h in enumerate(hits):
        dmg.append(f"@keyframes {name}-d{i} {{ 0%, {f(h+.6)}% {{ opacity: 0; transform: translateY(4px) scale(.7); }} {f(h+.6+span*.12)}% {{ opacity: 1; transform: translateY(-2px) scale(1.12); }} "
                   f"{f(h+.6+span*.25)}% {{ opacity: 1; transform: translateY(-5px) scale(1); }} {f(h+.6+span)}%, 100% {{ opacity: 0; transform: translateY(-20px) scale(1); }} }}")
    return dmg + [f"@keyframes {name}-bolt {{ {' '.join(bolt)} }}", f"@keyframes {name}-hit {{ {' '.join(flash)} }}",
            f"@keyframes {name}-ring {{ {' '.join(ring)} }}", f"@keyframes {name}-hp {{ {' '.join(hp)} }}",
            f"@keyframes {name}-gh {{ {' '.join(gh)} }}"]


DC_HP, DC_HIT = 4747, 720
DC_HOVER = [6 + k * 8.5 for k in range(7)]


def dc_steps(n):
    return [round(max(0, DC_HP - DC_HIT * (k + 1)) / DC_HP * 100, 2) for k in range(n)]


D += strike_set('dci', [30, 55], 8, (84, 98), dc_steps(2))
D += strike_set('dch', DC_HOVER, 4, (86, 96), dc_steps(7))
# destroyed: the page's stamp presses in after the seventh bolt, the Monolith goes a step darker
D.append('@keyframes dch-stamp { 0%, 59% { opacity: 0; filter: blur(3px); transform: rotate(-17deg) scale(1.9); } 62% { opacity: 1; filter: blur(0); transform: rotate(-9deg) scale(.94); } 64%, 82% { opacity: 1; filter: blur(0); transform: rotate(-9deg) scale(1); } 86%, 100% { opacity: 0; filter: blur(0); transform: rotate(-9deg) scale(1); } }')
D.append('@keyframes dch-dead { 0%, 58.5% { filter: brightness(1) saturate(1); } 60%, 83% { filter: brightness(.68) saturate(.85); } 90%, 100% { filter: brightness(1) saturate(1); } }')
dc_kf = '\n'.join(D)
# the seven hover numbers take turns between three spots beside the Monolith
DC_SPOTS = [(4, 46), (4, 64), (4, 82)]  # (right, top)
dc_dmg_css = '\n'.join(f'.dc-go .dc-dmg:nth-of-type({k + 1}) {{ right: {DC_SPOTS[k % 3][0]}px; top: {DC_SPOTS[k % 3][1]}px; animation: dch-d{k} 4s ease-out infinite; }}'
                       for k in range(7))

# ---------------- Player Tracker: league reel ----------------
# Shuffled on purpose (not Skeleton -> Legend) so the spin reads as
# "searching", not "climbing"; starts and ends on Legend so the loop is seamless.
LG = ['legend', 'pekka', 'wizard', 'dragon', 'skeleton', 'titan', 'valkyrie', 'electro', 'archer', 'witch', 'golem', 'barbarian', 'legend']
PITCH = 114  # 84px badge + 30px gap: neighbours sit outside the 112px window at rest
END = -(len(LG) - 1) * PITCH
reel = ''.join(f'<img src="{U}/clashofclans/leagues/{n}.webp" alt="">' for n in LG)
pl_kf = (f"@keyframes plh-reel {{ 0%, 12% {{ transform: translateY(0); filter: blur(0); animation-timing-function: cubic-bezier(.3,0,.15,1); }} "
         f"20% {{ filter: blur(1.6px); }} 42% {{ filter: blur(.4px); }} "
         f"52% {{ transform: translateY({END - 7}px); filter: blur(0); animation-timing-function: ease-in-out; }} 58%, 100% {{ transform: translateY({END}px); filter: blur(0); }} }}")

# ---------------- shared effects (fx-) ----------------
# Bursts are plain elements placed by Python with their own angle/distance in
# inline custom properties; one keyframes block per card times them, so every
# burst stays locked to its card's loop. Seeded, so rebuilds don't reshuffle.
import random
import sys


def streaks(cls, n, cx, cy, d, seed=1, length=10):
    """light streaks flying out of (cx, cy), each on its own angle"""
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        a = i * 360 / n + rnd.uniform(-9, 9)
        out.append(f'<i class="fx-st {cls}" style="left:{cx}px;top:{cy}px;width:{length}px;--r:{a:.0f}deg;--d:{d * rnd.uniform(.65, 1):.0f}px"></i>')
    return ''.join(out)


def streak_kf(name, hits, span):
    rest = 'opacity: 0; transform: rotate(var(--r)) translateX(3px) scaleX(.3);'
    fr = [f'0% {{ {rest} }}']
    for h in hits:
        fr += [f'{f(h)}% {{ {rest} }}', f'{f(h + .6)}% {{ opacity: 1; transform: rotate(var(--r)) translateX(calc(var(--d) * .3)) scaleX(1); }}',
               f'{f(h + span)}% {{ opacity: 0; transform: rotate(var(--r)) translateX(var(--d)) scaleX(.5); }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ {rest} }} }}"


def embers(cls, n, cx, cy, spread, rise, seed=2, src=''):
    """particles thrown up from (cx, cy); with src they're pictures (coins)"""
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        st = f'left:{cx}px;top:{cy}px;--dx:{rnd.uniform(-spread, spread):.0f}px;--dy:{-rnd.uniform(rise * .55, rise):.0f}px'
        if src:
            out.append(f'<img class="fx-em {cls}" src="{src}" alt="" style="{st}">')
        else:
            s = rnd.choice([2, 3, 3, 4])
            out.append(f'<i class="fx-em {cls}" style="{st};width:{s}px;height:{s}px"></i>')
    return ''.join(out)


def ember_kf(name, hits, span, fall):
    """up and out, then gravity (fall px; negative = keeps rising)"""
    rest = 'opacity: 0; transform: translate(0, 0) scale(1);'
    fr = [f'0% {{ {rest} }}']
    for h in hits:
        fr += [f'{f(h)}% {{ {rest} }}', f'{f(h + .6)}% {{ opacity: 1; }}',
               f'{f(h + span * .45)}% {{ opacity: 1; transform: translate(calc(var(--dx) * .6), var(--dy)) scale(1); }}',
               f'{f(h + span)}% {{ opacity: 0; transform: translate(var(--dx), calc(var(--dy) + {fall}px)) scale(.4); }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ {rest} }} }}"


FX = []  # generated keyframes, written into the page's <style>
FX.append(streak_kf('plh-st', [57.5], 10))
FX.append(streak_kf('wch-st', [13.2], 6))
FX.append(ember_kf('wch-coin', [41.5], 16, 34))
FX.append(ember_kf('wch-em', [58], 24, -12))

# ---------------- Equipment: a falling Fireball ----------------
# The Grand Warden's Fireball holds still while the air rushes up past it
# (wind streaks) and it sheds embers and ash upward -- so it reads as
# falling, forever. Ball centre ~(68, 94) in the 136 x 160 stage.
# Hover: it heats up (white-hot core, brighter glow, a tremor) and a second,
# faster set of streaks / embers fades in. Each particle loops on its own
# duration (inline --t / --d), so nothing lines up into a visible pattern.
EQ_C = (68, 94)


def eq_particles(n, seed, t, hot=False):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        ash = rnd.random() < (.3 if hot else .45)
        x = EQ_C[0] + rnd.uniform(-20, 20)
        y = EQ_C[1] + rnd.uniform(-22, 10)
        dur = rnd.uniform(*t)
        st = (f'left:{x:.0f}px;top:{y:.0f}px;--dx:{rnd.uniform(-16, 16):.0f}px;--dy:{-rnd.uniform(70, 110):.0f}px;'
              f'--rot:{rnd.uniform(-200, 200):.0f}deg;--t:{dur:.2f}s;--d:{-rnd.uniform(0, dur):.2f}s')
        if ash:
            out.append(f'<i class="eq-ash" style="{st};width:{rnd.choice([2, 3, 3])}px;height:{rnd.choice([1.5, 2])}px"></i>')
        else:
            s = rnd.choice([1.5, 2, 2, 2.5]) if not hot else rnd.choice([2, 2.5, 3])
            out.append(f'<i class="eq-em" style="{st};width:{s}px;height:{s}px"></i>')
    return ''.join(out)


def eq_wind(n, seed, t):
    rnd = random.Random(seed)
    return ''.join(f'<i class="eq-wind" style="left:{EQ_C[0] + rnd.uniform(-34, 34):.0f}px;height:{rnd.uniform(14, 30):.0f}px;'
                   f'--t:{rnd.uniform(*t):.2f}s;--d:{-rnd.uniform(0, 2):.2f}s"></i>' for _ in range(n))

# ---------------- Tier List: one tier row ----------------
# One focal point (Adrian, Oct 25 2026: the 3 x 3 board had none): a single
# tier row up close -- the tier maker's big S label with a Dragon card
# docked beside it (the Dragon is also the nav icon). Idle 6s: the Dragon
# bobs, a glint runs over the S. Hover 2.4s: the Dragon is picked up, the
# label spins through the tiers like a reel (F, E, D, C, B, A) and lands on
# S; the Dragon drops back into its slot, sparkles pop. The reel starts and
# ends on S, so the loop is seamless and leaving never snaps.
TL_TIERS = 'SABCDEF'
TL_PAL = ['224, 99, 99', '230, 140, 64', '222, 190, 72', '120, 194, 92', '64, 184, 140', '84, 156, 232', '160, 116, 232']  # coc-tierlist.js PAL
TL_REEL = [0, 6, 5, 4, 3, 2, 1, 0]  # S, F, E, D, C, B, A, S
TL_H = 56
reel_end = -(len(TL_REEL) - 1) * TL_H
FX.append(f"@keyframes tlh-reel {{ 0%, 8% {{ transform: translateY(0); filter: blur(0); animation-timing-function: cubic-bezier(.3,0,.15,1); }} "
          f"16% {{ filter: blur(1.6px); }} 40% {{ filter: blur(.3px); }} "
          f"50% {{ transform: translateY({reel_end - 6}px); filter: blur(0); animation-timing-function: ease-in-out; }} 55%, 100% {{ transform: translateY({reel_end}px); filter: blur(0); }} }}")
tl_reel = ''.join(f'<b style="--tl:{TL_PAL[i]}">{TL_TIERS[i]}</b>' for i in TL_REEL)

# ---------------- shared: 4-point glints ----------------
# Gold sparkles in the game's style (a 4-point star that spins open and
# shut). No rays or sunbursts behind the art (Adrian, Oct 25 2026).
def sparks(cls, pts):
    """pts: (x, y, size px[, delay s]) -- delay staggers one burst"""
    return ''.join(f'<i class="fx-spark {cls}" style="left:{p[0]}px;top:{p[1]}px;--z:{p[2]}px'
                   + (f';animation-delay:{p[3]}s' if len(p) > 3 else '') + '"></i>' for p in pts)


def spark_kf(name, hits, span):
    rest = 'opacity: 0; transform: scale(0) rotate(0deg);'
    fr = [f'0% {{ {rest} }}']
    for h in hits:
        fr += [f'{f(h)}% {{ {rest} }}', f'{f(h + span * .35)}% {{ opacity: 1; transform: scale(1) rotate(45deg); }}',
               f'{f(h + span)}% {{ opacity: 0; transform: scale(.2) rotate(90deg); }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ {rest} }} }}"


# ---------------- Leaderboards: the trophy ----------------
# The nav's own Leaderboards picture (icons/leaderboards.webp: the gold cup on
# its rubble). Idle 6s: a glint runs over the cup, sparkles wink on it. Hover
# 2.4s: the game's tap bounce (squash, stretch, settle, a flash), a ring of
# sparkles pops round the cup and the glint runs again.
FX.append(spark_kf('lri-tw', [8], 12))
FX.append(spark_kf('lrh-sp', [4], 26))
FX.append(spark_kf('tlh-sp', [52], 24))

# ---------------- Legend Tracker: the Legend Trophy ----------------
# The game's Legend Trophy (icons/legend-trophy.webp, also the nav icon) on a
# purple glow. A Legend League attack wins up to +40 trophies (three stars),
# so the only number shown is +40. Idle 6s: one hit, a +40 rises off the cup.
# Hover 2.4s: three hits in a row, each a bounce, a +40 and sparkles.
def lgt_chip(name, hits, span):
    rest = 'opacity: 0; transform: translateY(6px) scale(.7);'
    fr = [f'0% {{ {rest} }}']
    for h in hits:
        fr += [f'{f(h)}% {{ {rest} }}', f'{f(h + span * .14)}% {{ opacity: 1; transform: translateY(-2px) scale(1.12); }}',
               f'{f(h + span * .3)}% {{ opacity: 1; transform: translateY(-6px) scale(1); }}', f'{f(h + span)}% {{ opacity: 0; transform: translateY(-24px) scale(1); }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ {rest} }} }}"


def lgt_cup(name, hits):
    fr = ['0% { transform: none; filter: none; }']
    for h in hits:
        fr += [f'{f(h - .1)}% {{ transform: none; filter: none; }}', f'{f(h + 2.5)}% {{ transform: scale(1.07, .88); filter: brightness(1.3); }}',
               f'{f(h + 7)}% {{ transform: translateY(-3px) scale(.95, 1.07); filter: brightness(1.15); }}', f'{f(h + 12)}% {{ transform: scale(1.02, .98); filter: none; }}',
               f'{f(h + 17)}% {{ transform: none; filter: none; }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ transform: none; filter: none; }} }}"


LGT_HOVER = [4, 34, 64]
FX.append(lgt_chip('lgti-chip', [40], 22))
FX.append(lgt_cup('lgti-cup', [40]))
FX += [lgt_chip(f'lgth-c{k}', [h], 30) for k, h in enumerate(LGT_HOVER)]
FX.append(lgt_cup('lgth-cup', LGT_HOVER))
FX.append(spark_kf('lgth-sp', LGT_HOVER, 16))

# ---------------- War Planner: crossed swords ----------------
# Two swords (clashofclans/coctools/sword.webp, the second mirrored) crossed
# like the game's war icon. They swing back on their grips and clash: a flash,
# sparkles and streaks where the blades meet. Idle 6s: one clash. Hover 2.4s:
# two clashes, harder. Both swords share one keyframes block: the second is
# mirrored, so the same rotation opens it the other way.
def ws_swing(name, hits, back):
    """hits = impact %; each swing: pull back over 9%, snap in over 2.5%, settle"""
    fr = ['0% { rotate: 0deg; }']
    for h in hits:
        fr += [f'{f(h - 12)}% {{ rotate: 0deg; animation-timing-function: cubic-bezier(.2,.7,.3,1); }}', f'{f(h - 3)}% {{ rotate: {back}deg; animation-timing-function: cubic-bezier(.7,0,1,.6); }}',
               f'{f(h)}% {{ rotate: -5deg; }}', f'{f(h + 3)}% {{ rotate: 2deg; }}', f'{f(h + 7)}% {{ rotate: 0deg; }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ rotate: 0deg; }} }}"


def ws_flash(name, hits, span):
    rest = 'opacity: 0; transform: scale(.3);'
    fr = [f'0% {{ {rest} }}']
    for h in hits:
        fr += [f'{f(h)}% {{ {rest} }}', f'{f(h + span * .2)}% {{ opacity: 1; transform: scale(1); }}', f'{f(h + span)}% {{ opacity: 0; transform: scale(1.5); }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ {rest} }} }}"


WS_IDLE, WS_HOVER = [70], [30, 76]
FX.append(ws_swing('wsi-sw', WS_IDLE, 14))
FX.append(ws_swing('wsh-sw', WS_HOVER, 20))
FX.append(ws_flash('wsi-fl', WS_IDLE, 8))
FX.append(ws_flash('wsh-fl', WS_HOVER, 14))
FX.append(spark_kf('wsi-sp', WS_IDLE, 12))
FX.append(spark_kf('wsh-sp', WS_HOVER, 18))
FX.append(streak_kf('wsh-st', WS_HOVER, 14))

# ---------------- Glossary: the Book of Everything ----------------
# The nav's Glossary picture (icons/Book_of_Everything.webp) drawn in CSS so
# it can open: red leather, gold frame, gold hourglass, cream pages. It lies
# tilted toward you. Three leaves sit on the right page (top one carries the
# term, the two under it are blank); the page under them shows the next term.
# A leaf that lands on the left jumps home unseen (its back looks exactly like
# the cover's inside), so the book seems to turn forever.
# Idle 12s: open on Queen Walk, a leaf turns (Lavaloon), another (Funneling),
# the cover swings shut (the hourglass shows, the book slides to the middle),
# then it opens again on Queen Walk.
# Hover 3.6s: three riffles (three leaves in quick succession), each lands on
# the next term with a little thump and gold sparkles. Starts and ends open
# on Queen Walk, the idle's first frame, so leaving never snaps.
GL_TERMS = ['Queen Walk', 'Lavaloon', 'Funneling']
GL_EASE = 'animation-timing-function: cubic-bezier(.45,.05,.35,1);'


def gl_rot(name, r0, moves, jumps=()):
    """rotateY keyframes from r0: moves = [(a%, b%, from, to)] eased; jumps = [(t%, from, to)] instant"""
    fr = [f'0% {{ transform: rotateY({r0}deg); }}']
    for a, b, x, y in moves:
        fr += [f'{f(a)}% {{ transform: rotateY({x}deg); {GL_EASE} }}', f'{f(b)}% {{ transform: rotateY({y}deg); }}']
    for t, x, y in jumps:
        fr += [f'{f(t - .05)}% {{ transform: rotateY({x}deg); }}', f'{f(t)}% {{ transform: rotateY({y}deg); }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ transform: rotateY({r0}deg); }} }}"


def gl_steps(name, sw):
    """term k on one face: sw = [(from%, term)], the first at 0"""
    out = []
    for k in range(3):
        fr = []
        for i, (a, t) in enumerate(sw):
            b = sw[i + 1][0] - .05 if i + 1 < len(sw) else 100
            fr += [f'{f(a)}% {{ opacity: {int(t == k)}; }}', f'{f(b)}% {{ opacity: {int(t == k)}; }}']
        out.append(f"@keyframes {name}{k} {{ {' '.join(fr)} }}")
    return out


def gl_shade(name, spans):
    fr = ['0% { opacity: 0; }']
    for a, b in spans:
        fr += [f'{f(a)}% {{ opacity: 0; }}', f'{f((a + b) / 2)}% {{ opacity: 1; }}', f'{f(b)}% {{ opacity: 0; }}']
    return f"@keyframes {name} {{ {' '.join(fr)} 100% {{ opacity: 0; }} }}"


# idle
FX.append(gl_rot('gli-l0', 0, [(14, 23, 0, -180), (38, 47, 0, -180)], [(23.1, -180, 0), (47.1, -180, 0)]))
FX.append(gl_rot('gli-cover', -180, [(60, 70, -180, 0), (84, 94, 0, -180)]))
FX += gl_steps('gli-lt', [(0, 0), (21, 1), (45, 2), (76, 0)])
FX += gl_steps('gli-pt', [(0, 1), (23.2, 2), (47.2, 0), (76, 1)])
FX.append(gl_shade('gli-shade', [(14, 23), (38, 47)]))
FX.append('@keyframes gli-slide { 0%, 60% { translate: 0 0; } 70%, 84% { translate: -27px 0; } 94%, 100% { translate: 0 0; } }')
# hover: riffle r starts at s; leaf i turns s+3i -> s+3i+10; all jump home after the last lands
GL_S = [4 + r * 100 / 3 for r in range(3)]
for i in range(3):
    FX.append(gl_rot(f'glh-l{i}', 0, [(s + 3 * i, s + 3 * i + 10, 0, -180) for s in GL_S], [(s + 16.1, -180, 0) for s in GL_S]))
FX += gl_steps('glh-lt', [(0, 0)] + [(s + 12, (r + 1) % 3) for r, s in enumerate(GL_S)])
FX += gl_steps('glh-pt', [(0, 1)] + [(s + 16.2, (r + 2) % 3) for r, s in enumerate(GL_S)])
FX.append(gl_shade('glh-shade', [(s, s + 16) for s in GL_S]))
FX.append(spark_kf('glh-sp', [s + 15 for s in GL_S], 11))
FX.append('@keyframes glh-thump { ' + ' '.join(f'{f(s + 15.9)}% {{ scale: 1; }} {f(s + 17.5)}% {{ scale: 1.035 .95; }} {f(s + 20)}% {{ scale: .99 1.02; }} {f(s + 23)}% {{ scale: 1; }}' for s in GL_S) + ' }')
for k in range(3):
    FX.append(f'.gl-l0 .gl-t{k} {{ animation: gli-lt{k} 12s linear infinite; }}')
    FX.append(f'.gl-pr .gl-t{k}, .gl-l1 .gl-t{k} {{ animation: gli-pt{k} 12s linear infinite; }}')
    FX.append(f'.gl-go .gl-l0 .gl-t{k} {{ animation: glh-lt{k} 3.6s linear infinite; }}')
    FX.append(f'.gl-go .gl-pr .gl-t{k} {{ animation: glh-pt{k} 3.6s linear infinite; }}')
for i in range(3):
    FX.append(f'.gl-go .gl-l{i} {{ animation: glh-l{i} 3.6s linear infinite; }}')
fx_css = '\n'.join(FX)


html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tool cards</title>
<base href="http://localhost:8765/">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@900&family=Orbitron:wght@900&family=Oxanium:wght@500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ min-height: 100vh; padding: 72px 7%; background: #0a0a0b; color: #eff1f4; font-family: 'Oxanium', sans-serif; -webkit-font-smoothing: antialiased; }}
h2 {{ font: 900 37px/1.1 'Orbitron', sans-serif; letter-spacing: -.5px; text-transform: uppercase; }}
.sub {{ margin: 10px 0 32px; font-size: 15px; color: #b5b8c0; }}
/* @@CSS */
/* ===================================================================
   PARCHROME TOOL CARDS (ptc-) -- the /coc/ "Parchrome tools" band.
   GENERATED by _tools/tool-cards/build_cards.py: edit there, not here.
   Each card is a raised-UI WELL (Oct 24 2026, Adrian: sunken, was a raised
   box): the art sits in it like a display case. The art is a right-hand
   column drawn at 160px tall and scaled down by --s (so every animation keeps
   the geometry it was designed at), the copy takes the rest.
   The well is the same neutral one on every card: a card's colour
   lives only in its art's own glow. Art and copy share the one surface (no
   panel between them, Adrian's call). The art gets a column of the same
   width (--well-w) on every card, centred in it, so it lines up down the grid;
   the copy fills the rest via padding-right, so the two can never overlap.
   =================================================================== */
.ptc-grid {{
  --box: var(--lb-box, #141518); --box-h: var(--lb-box-hover, #1c1d23); --well: #0e0f12; --raise: var(--lb-raise, #2a2c35); --edge: var(--lb-edge, #060708); --r: var(--lb-r, 6px);
  --shadow: var(--lb-shadow, inset 0 0 0 1px rgba(255,255,255,.06), inset 0 1px 0 rgba(255,255,255,.09), 0 10px 24px -12px rgba(0,0,0,.85));
  --shadow-h: var(--lb-shadow-hover, inset 0 0 0 1px rgba(255,255,255,.11), inset 0 1px 0 rgba(255,255,255,.14), 0 16px 30px -14px rgba(0,0,0,.9));
  --ring-btn: inset 0 0 0 2px var(--edge), inset 0 3px 0 rgba(255,255,255,.1), inset 0 -5px 0 rgba(0,0,0,.3);
  /* the well: dark fill, shadow inside the top edge, a faint light line under the bottom one */
  --sunk: #0d0e11; --sunk-h: #131418;
  --sink: inset 0 3px 0 rgba(0,0,0,.4), inset 0 14px 22px -14px rgba(0,0,0,.7), 0 1px 0 rgba(255,255,255,.05);
  --sink-h: inset 0 3px 0 rgba(0,0,0,.4), inset 0 14px 22px -14px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.05), 0 1px 0 rgba(255,255,255,.07);
  display: grid; grid-template-columns: 1fr; gap: 8px;
}}
/* columns follow the band's own width (the /coc/ sidebar eats 245px), not the
   window's: 1 -> 2 (4 x 2) -> 3 (3 + 3 + 2; the last slot is left empty, Adrian's call) */
.ptc-wrap {{ container-type: inline-size; }}
@container (min-width: 620px) {{ .ptc-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }} }}
@container (min-width: 960px) {{ .ptc-grid {{ grid-template-columns: repeat(3, minmax(0, 1fr)); }} }}
.ptc {{ --art-w: 150px; --s: .66; --well-w: 122px; position: relative; isolation: isolate; display: flex; align-items: center;
  min-height: 104px; padding: 12px calc(var(--well-w) + 14px) 12px 18px; overflow: hidden;
  border: 2px solid var(--edge); border-radius: var(--r); background: var(--sunk); box-shadow: var(--sink); font-family: 'Oxanium', sans-serif;
  color: #eff1f4; text-decoration: none; transition: background-color .25s, box-shadow .25s; }}
.ptc:hover {{ background: var(--sunk-h); box-shadow: var(--sink-h); }}
.ptc:focus-visible {{ outline: 2px solid #e6e8ec; outline-offset: 3px; }}
.ptc-copy {{ position: relative; z-index: 2; }}
/* the hover arrow takes no width (margin-right cancels it), so it never makes a title wrap */
.ptc-name {{ font: 700 18px/1.15 'Oxanium', sans-serif; }}
.ptc-name svg {{ display: inline-block; vertical-align: -2px; margin: 0 -21px 0 6px; width: 15px; height: 15px; fill: none; stroke: #858a92; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; opacity: 0; transform: translateX(-4px); transition: .25s cubic-bezier(.22,1,.36,1); }}
.ptc:hover .ptc-name svg, .ptc:focus-visible .ptc-name svg {{ opacity: 1; transform: none; stroke: #fff; }}
/* Two blurbs per card (Oct 24 2026, Adrian): desktop = the long one, never past
   2 lines; phones = the short one (~34 letters, the Player Tracker's length),
   always 1 line. Either is cut with an ellipsis if it runs over. */
.ptc-copy {{ flex: 1; min-width: 0; }}
.ptc-desc {{ max-width: 31ch; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-top: 4px; font-size: 12px; line-height: 1.4; color: #a4a8b0; }}
.ptc-short {{ display: none; }}
/* HOT tag (Oct 25 2026, Adrian): the TH layouts pages' .base-tag--hot look,
   a red key with a flame. Desktop: its own line above the name (the copy column gets as narrow as
   155px, too narrow for name + tag); tiles: the top-left corner. */
.ptc-hot {{ display: flex; width: max-content; align-items: center; gap: 3px; margin: 0 0 5px; padding: 3px 6px 3px 5px; border-radius: 4px;
  border: 1.5px solid var(--lb-red-edge, #5c1515); background: var(--lb-red, #c73a3a); box-shadow: var(--lb-btn-red, inset 0 1px 0 rgba(255,255,255,.25), inset 0 -2px 0 rgba(0,0,0,.25));
  font: 800 9px/1 'Oxanium', sans-serif; letter-spacing: 1.2px; text-transform: uppercase; color: #fff; }}
.ptc-hot::before {{ content: ""; width: 7px; height: 9px; background: #fff;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 20'%3E%3Cpath d='M8 0c1 3.5 6 6 6 11.5A6 6 0 0 1 2 11.5c0-2.6 1.3-4.3 2.6-5.6.2 1.9 1 3 2.2 3.6C6.4 6.2 6.9 3 8 0z'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 20'%3E%3Cpath d='M8 0c1 3.5 6 6 6 11.5A6 6 0 0 1 2 11.5c0-2.6 1.3-4.3 2.6-5.6.2 1.9 1 3 2.2 3.6C6.4 6.2 6.9 3 8 0z'/%3E%3C/svg%3E") center / contain no-repeat; }}
/* the art column: a 160px stage centred on the card, scaled by --s from its
   right edge; three depths inside lean toward the pointer */
.ptc-art {{ position: absolute; top: 50%; right: calc((var(--well-w) - var(--art-w) * var(--s)) / 2); width: var(--art-w); height: 160px; margin-top: -80px; pointer-events: none; --mx: 0; --my: 0; }}
.ptc-art:not(.is-on), .ptc-art * {{ animation-play-state: paused; }}
.ptc-art.is-on * {{ animation-play-state: running; }}
.ptc-layer {{ position: absolute; inset: 0; transform-origin: 100% 50%; scale: var(--s); transition: transform .6s cubic-bezier(.22,1,.36,1); }}
.ptc-far  {{ transform: translate(calc(var(--mx) * -3px), calc(var(--my) * -2px)); }}
.ptc-mid  {{ transform: translate(calc(var(--mx) * 4px),  calc(var(--my) * 3px)); }}
.ptc-near {{ transform: translate(calc(var(--mx) * 7px),  calc(var(--my) * 4px)); }}

/* ===================================================================
   ARMY MAKER (am-), laby-style like the rest: the Army Camp on a soft blue
   glow. Idle (8s): a troop drops in from above and sinks into the camp,
   which squashes as it lands -- Rocket Balloon, Super Minion, Healer, one
   at a time. Hover / focus (.am-go, 3s): the same three in quick
   succession, then the camp hops and a ring ripples off it (army full).
   Leaving finishes the loop (JS waits for amh-camp).
   =================================================================== */
.ptc-army {{ --art-w: 136px; }}
.am-light {{ position: absolute; left: -12px; top: 26px; width: 160px; height: 140px;
  background: radial-gradient(closest-side, rgba(84,168,255,.22), rgba(84,168,255,.06) 55%, transparent); animation: am-breathe 4s ease-in-out infinite; transition: filter .6s; }}
.am-go .am-light {{ filter: brightness(1.5); }}
.am-mote {{ position: absolute; width: 2px; height: 2px; background: #a8d4ff; opacity: 0; animation: am-mote 7s linear infinite; }}
.am-mote:nth-child(2) {{ left: 22px; bottom: 34px; animation-delay: -1s; }}
.am-mote:nth-child(3) {{ left: 104px; bottom: 26px; animation-delay: -3.4s; animation-duration: 8.5s; }}
.am-mote:nth-child(4) {{ left: 116px; bottom: 50px; animation-delay: -5.2s; }}
/* camp: 96px, centred in the column; top-anchored so a taller card can't bend the drops */
.am-camp {{ position: absolute; left: 20px; top: 58px; width: 96px; height: 96px; }}
.am-camp::before {{ content: ""; position: absolute; left: 10%; right: 10%; bottom: 14%; height: 18%; border-radius: 50%; background: rgba(0,0,0,.6); filter: blur(5px); }}
.am-camp img {{ position: relative; width: 100%; height: 100%; object-fit: contain; transform-origin: 50% 80%; animation: ami-camp 8s ease-out infinite; }}
.am-go .am-camp img {{ animation: amh-camp 3s ease-out infinite; }}
/* troops: card-style portraits, dark edge like the in-game army tiles */
.am-t {{ position: absolute; left: 54px; top: 14px; width: 28px; height: 28px; border-radius: 6px; opacity: 0;
  outline: 1.5px solid #060708; box-shadow: 0 4px 8px rgba(0,0,0,.55); }}
.am-t0 {{ animation: ami-t0 8s linear infinite; }} .am-t1 {{ animation: ami-t1 8s linear infinite; }} .am-t2 {{ animation: ami-t2 8s linear infinite; }}
.am-go .am-t0 {{ animation: amh-t0 3s linear infinite; }} .am-go .am-t1 {{ animation: amh-t1 3s linear infinite; }} .am-go .am-t2 {{ animation: amh-t2 3s linear infinite; }}
.am-ring {{ position: absolute; left: 24px; top: 118px; width: 88px; height: 26px; border-radius: 50%; border: 1.5px solid rgba(168,212,255,.8); opacity: 0; }}
.am-go .am-ring {{ animation: amh-ring 3s ease-out infinite; }}
@keyframes am-breathe {{ 0%, 100% {{ opacity: .75; transform: scale(1); }} 50% {{ opacity: 1; transform: scale(1.06); }} }}
@keyframes am-mote {{ 0% {{ opacity: 0; transform: translateY(0); }} 15% {{ opacity: .45; }} 85% {{ opacity: .2; }} 100% {{ opacity: 0; transform: translateY(-90px); }} }}
@keyframes amh-ring {{ 0%, 53% {{ opacity: 0; transform: scale(.4); }} 55% {{ opacity: .8; transform: scale(.6); }} 75%, 100% {{ opacity: 0; transform: scale(1.4); }} }}
{army_kf}

/* ===================================================================
   DAMAGE CALCULATOR (dc-), laby-style: one subject, one motion.
   A level 1 Monolith (4747 HP) on a soft violet glow, a dark purple
   health bar above it (Adrian's call: like the game's). At rest (8s): a
   bolt, a pause, a second bolt -- each time the Monolith flashes, a ring
   ripples on the ground, a -720 pops up and the bar loses 15% (white chip,
   then gone); then it grows back. Hover / focus (.dc-go, 4s): seven bolts
   (7 x 720 = 5040 >= 4747) take it to 0 and the page's DESTROYED stamp
   presses in (hover only), then it grows back. Leaving finishes the loop
   first (JS waits for dch-hp's animationiteration).
   =================================================================== */
@property --dc-p {{ syntax: '<number>'; inherits: true; initial-value: 100; }}
@property --dc-g {{ syntax: '<number>'; inherits: true; initial-value: 100; }}
.ptc-dc {{ --art-w: 136px; }}
.dc-art {{ animation: dci-hp 8s ease-out infinite, dci-gh 8s ease-in-out infinite; }}
.dc-art.dc-go {{ animation: dch-hp 4s ease-out infinite, dch-gh 4s ease-in-out infinite; }}
.dc-glow {{ position: absolute; right: -6px; top: 26px; width: 136px; height: 136px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(150,110,235,.22), rgba(150,110,235,.06) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; transition: filter .6s; }}
.dc-go .dc-glow {{ filter: brightness(1.5); }}
.dc-star {{ position: absolute; width: 2px; height: 2px; background: #a9bde6; opacity: .1; animation: dc-tw 5.5s ease-in-out infinite; }}
.dc-star:nth-child(2) {{ right: 112px; top: 30px; }}
.dc-star:nth-child(3) {{ right: 18px; top: 22px; animation-delay: -1.8s; }}
.dc-star:nth-child(4) {{ right: 104px; top: 122px; animation-delay: -3.2s; }}
.dc-star:nth-child(5) {{ right: 10px; top: 132px; animation-delay: -4.4s; }}
.dc-ring {{ position: absolute; right: 26px; top: 128px; width: 80px; height: 26px; border-radius: 50%; border: 1.5px solid rgba(200,220,255,.75); opacity: 0;
  animation: dci-ring 8s ease-out infinite; }}
.dc-go .dc-ring {{ animation: dch-ring 4s ease-out infinite; }}
.dc-mono {{ position: absolute; right: 16px; top: 46px; width: 104px; height: 104px; }}
.dc-mono::before {{ content: ""; position: absolute; left: 22%; right: 22%; bottom: 0; height: 14%; border-radius: 50%; background: rgba(0,0,0,.55); filter: blur(5px); }}
.dc-mono img {{ position: relative; width: 100%; height: 100%; object-fit: contain; animation: dci-hit 8s linear infinite; }}
.dc-go .dc-mono img {{ animation: dch-hit 4s linear infinite; }}
.dc-go .dc-mono {{ animation: dch-dead 4s linear infinite; }}
/* DESTROYED -- the Damage Calculator page's stamp (coc-damage-calc.css .dc-stamp), hover only */
.dc-stamp {{ position: absolute; right: 24px; top: 82px; width: 86px; display: flex; justify-content: center; opacity: 0; }}
.dc-stamp span {{ display: block; padding: .42em .8em .36em; border: 2px solid currentColor; outline: 1px solid currentColor; outline-offset: -5px;
  background: rgba(16,17,20,.62); color: #ef6461; font: 800 9.5px/1 'Oxanium', sans-serif; letter-spacing: .18em; text-transform: uppercase; white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0,0,0,.35); }}
.dc-go .dc-stamp {{ animation: dch-stamp 4s cubic-bezier(.16,1,.3,1) infinite; }}
/* the bolt comes in from the top-left so it never crosses the bar */
.dc-bolt {{ position: absolute; right: 70px; top: 0; width: 50px; height: 76px; overflow: visible; }}
.dc-bolt path {{ fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; animation: dci-bolt 8s linear infinite; }}
.dc-go .dc-bolt path {{ animation: dch-bolt 4s linear infinite; }}
.dc-bolt .glow {{ stroke: rgba(170,180,255,.45); stroke-width: 4.5; }}
.dc-bolt .core {{ stroke: #f5f9ff; stroke-width: 1.5; }}
/* -720 (Lightning 13) beside the bar's right end, away from the bolt; on
   hover the seven take turns between three spots (each is gone before its
   spot comes round again), clear of the DESTROYED stamp */
.dc-dmg {{ position: absolute; right: 4px; top: 54px; font: 800 12px/1 'Oxanium', sans-serif; color: #fff; opacity: 0; white-space: nowrap;
  text-shadow: 0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000; }}
.dc-dmg:nth-of-type(1) {{ animation: dci-d0 8s ease-out infinite; }}
.dc-dmg:nth-of-type(2) {{ animation: dci-d1 8s ease-out infinite; }}
{dc_dmg_css}
/* the building health bar as in a battle: black outline, dark well, a
   dark purple fill with a lighter top half; what was just lost flashes white */
.dc-bar {{ position: absolute; right: 42px; top: 30px; width: 46px; height: 8px; border-radius: 4px; overflow: hidden;
  background: #17111f; box-shadow: 0 0 0 2px #050406, 0 3px 0 1px rgba(0,0,0,.35); }}
.dc-bar i {{ position: absolute; top: 0; bottom: 0; left: 0; }}
.dc-ghost {{ width: calc(var(--dc-g) * 1%); background: #fff; }}
.dc-fill {{ width: calc(var(--dc-p) * 1%); background: linear-gradient(#9a63d8 0 42%, #6b35a8 42% 100%); box-shadow: inset -1px 0 0 rgba(0,0,0,.35); }}
@keyframes dc-glow {{ 0%, 100% {{ opacity: .8; transform: scale(1); }} 50% {{ opacity: 1; transform: scale(1.05); }} }}
@keyframes dc-tw {{ 0%, 100% {{ opacity: .08; }} 50% {{ opacity: .35; }} }}
{dc_kf}

/* ===================================================================
   PLAYER TRACKER (pl-), laby-style: a Legend League badge on a warm glow.
   Idle (8s): a magnifier drifts across the badge; inside the lens the badge
   shows bigger and brighter (a second copy, clipped to the lens circle).
   Hover / focus (.pl-go, 2.8s): the lens settles on the badge, the badge
   slot-spins through the leagues (shuffled) and lands on Legend with a
   shine, then the lens drifts back to rest. --lx/--ly (the lens centre,
   scene px) drive the lens, its clip circle and the zoom origin together.
   No numbers: the card never shows a made-up player.
   =================================================================== */
@property --lx {{ syntax: '<length>'; inherits: true; initial-value: 16px; }}
@property --ly {{ syntax: '<length>'; inherits: true; initial-value: 82px; }}
.ptc-pl {{ --art-w: 136px; }}
.pl-art {{ --lx: 16px; --ly: 82px; animation: pli-lens 8s ease-in-out infinite; }}
.pl-art.pl-go {{ animation: plh-lens 2.8s ease-in-out infinite; }}
.pl-glow {{ position: absolute; right: -8px; top: 22px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,150,80,.17), rgba(255,150,80,.05) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; transition: filter .6s; }}
.pl-go .pl-glow {{ filter: brightness(1.5); }}
.pl-scene {{ position: absolute; right: 26px; top: 24px; width: 84px; height: 112px; }}
.pl-scene::before {{ content: ""; position: absolute; left: 16%; right: 16%; top: 96px; height: 12px; border-radius: 50%; background: rgba(0,0,0,.55); filter: blur(5px); }}
.pl-win {{ position: absolute; inset: 0; overflow: hidden;
  -webkit-mask: linear-gradient(transparent, #000 18px, #000 94px, transparent); mask: linear-gradient(transparent, #000 18px, #000 94px, transparent); }}
.pl-reel {{ position: absolute; left: 0; top: 14px; display: flex; flex-direction: column; gap: 30px; }}
.pl-reel img {{ display: block; width: 84px; height: 84px; }}
.pl-go .pl-reel {{ animation: plh-reel 2.8s linear infinite; }}
.pl-base {{ filter: brightness(.82); }}
.pl-mag {{ position: absolute; inset: 0; clip-path: circle(20px at var(--lx) var(--ly)); }}
.pl-mag .pl-win {{ transform: scale(1.4); transform-origin: var(--lx) var(--ly); filter: brightness(1.12); }}
/* landing: the badge pops and a glint runs across it -- a bleached copy of
   the badge (so the glint keeps the badge's shape) seen through a moving band */
.pl-go .pl-scene {{ animation: plh-pop 2.8s ease-out infinite; }}
.pl-shine {{ position: absolute; left: 0; top: 14px; width: 84px; height: 84px; opacity: 0; filter: brightness(2.4) saturate(.3);
  -webkit-mask: linear-gradient(105deg, transparent 40%, #000 50%, transparent 60%) 100% 0 / 300% 100% no-repeat;
  mask: linear-gradient(105deg, transparent 40%, #000 50%, transparent 60%) 100% 0 / 300% 100% no-repeat; }}
.pl-go .pl-shine {{ animation: plh-shine 2.8s ease-out infinite; }}
/* the magnifier: centred on (--lx, --ly); the ring is drawn round that point */
.pl-lens {{ position: absolute; left: var(--lx); top: var(--ly); width: 0; height: 0; }}
.pl-lens svg {{ position: absolute; left: -24px; top: -24px; width: 60px; height: 60px; overflow: visible; filter: drop-shadow(0 3px 4px rgba(0,0,0,.6)); }}
@keyframes pli-lens {{
  0%, 12% {{ --lx: 16px; --ly: 82px; }}
  30% {{ --lx: 26px; --ly: 48px; }}
  46%, 56% {{ --lx: 58px; --ly: 46px; }}
  74% {{ --lx: 40px; --ly: 68px; }}
  88%, 100% {{ --lx: 16px; --ly: 82px; }}
}}
@keyframes plh-lens {{
  0% {{ --lx: 16px; --ly: 82px; }}
  11%, 80% {{ --lx: 42px; --ly: 54px; }}
  96%, 100% {{ --lx: 16px; --ly: 82px; }}
}}
@keyframes plh-pop {{ 0%, 56% {{ transform: none; }} 61% {{ transform: scale(1.08); }} 70%, 100% {{ transform: none; }} }}
@keyframes plh-shine {{ 0%, 57% {{ opacity: 0; -webkit-mask-position: 100% 0; mask-position: 100% 0; }} 58% {{ opacity: .8; }}
  76% {{ opacity: .8; -webkit-mask-position: 0 0; mask-position: 0 0; }} 77%, 100% {{ opacity: 0; -webkit-mask-position: 0 0; mask-position: 0 0; }} }}
{pl_kf}

/* ===================================================================
   LEADERBOARDS (lr-; lb- is taken on the live site). The nav's own
   Leaderboards picture: the gold cup on its rubble, on a soft gold glow.
   Idle (6s): a glint runs over the cup and sparkles wink on it, one at a
   time. Hover / focus (.lr-go, 2.4s): the game's tap bounce (squash,
   stretch, settle, a flash) and a ring of sparkles pops round the cup, then
   the glint runs. No numbers: nothing on it can be false.
   =================================================================== */
.ptc-lr {{ --art-w: 136px; }}
.lr-glow {{ position: absolute; right: -6px; top: 22px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(240,190,80,.17), rgba(240,190,80,.05) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; }}
.lr-cup {{ position: absolute; right: 22px; top: 38px; width: 92px; height: 101px; transform-origin: 50% 86%; }}
.lr-cup::before {{ content: ""; position: absolute; left: 6%; right: 6%; bottom: 8%; height: 16%; border-radius: 50%; background: rgba(0,0,0,.55); filter: blur(5px); }}
.lr-cup img {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
.lr-go .lr-cup {{ animation: lrh-cup 2.4s linear infinite; }}
/* the glint: a bleached copy of the picture seen through a moving band, cut to the cup (not the rubble) */
.lr-shine {{ opacity: 0; filter: brightness(2.6) saturate(.25); clip-path: inset(0 26% 32% 14%);
  -webkit-mask: linear-gradient(105deg, transparent 40%, #000 50%, transparent 60%) 100% 0 / 300% 100% no-repeat;
  mask: linear-gradient(105deg, transparent 40%, #000 50%, transparent 60%) 100% 0 / 300% 100% no-repeat; animation: lri-shine 6s ease-in-out infinite; }}
.lr-go .lr-shine {{ animation: lrh-shine 2.4s ease-out infinite; }}
.lr-tw {{ animation: lri-tw 6s ease-out infinite; }}
.lr-go .lr-sp {{ animation: lrh-sp 2.4s ease-out infinite; }}
@keyframes lrh-cup {{ 0% {{ transform: none; filter: none; }} 5% {{ transform: scale(1.08, .86); filter: brightness(1.35); }}
  12% {{ transform: translateY(-4px) scale(.94, 1.09); filter: brightness(1.2); }} 19% {{ transform: scale(1.04, .96); }} 26% {{ transform: scale(.99, 1.01); filter: none; }} 32%, 100% {{ transform: none; filter: none; }} }}
@keyframes lri-shine {{ 0%, 54% {{ opacity: 0; -webkit-mask-position: 100% 0; mask-position: 100% 0; }} 55% {{ opacity: .7; }}
  70% {{ opacity: .7; -webkit-mask-position: 0 0; mask-position: 0 0; }} 71%, 100% {{ opacity: 0; -webkit-mask-position: 0 0; mask-position: 0 0; }} }}
@keyframes lrh-shine {{ 0%, 14% {{ opacity: 0; -webkit-mask-position: 100% 0; mask-position: 100% 0; }} 15% {{ opacity: .85; }}
  40% {{ opacity: .85; -webkit-mask-position: 0 0; mask-position: 0 0; }} 41%, 100% {{ opacity: 0; -webkit-mask-position: 0 0; mask-position: 0 0; }} }}

/* ===================================================================
   LEGEND TRACKER (lgt-; lg- is the tracker page's own). The game's Legend
   Trophy on a purple glow. A Legend League attack wins up to +40 trophies
   (three stars), so +40 is the one number on it. Idle (6s): one hit, the
   trophy gives the tap bounce and a +40 rises off it. Hover / focus
   (.lgt-go, 2.4s): three hits in a row, each with a +40 and sparkles.
   =================================================================== */
.ptc-lgt {{ --art-w: 136px; }}
.lgt-glow {{ position: absolute; right: -6px; top: 22px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(170,110,255,.2), rgba(170,110,255,.05) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; }}
.lgt-cup {{ position: absolute; right: 22px; top: 46px; width: 90px; height: 96px; transform-origin: 50% 88%; animation: lgti-cup 6s linear infinite; }}
.lgt-cup::before {{ content: ""; position: absolute; left: 10%; right: 10%; bottom: 6%; height: 16%; border-radius: 50%; background: rgba(0,0,0,.55); filter: blur(5px); }}
.lgt-cup img {{ position: relative; width: 100%; height: 100%; }}
.lgt-go .lgt-cup {{ animation: lgth-cup 2.4s linear infinite; }}
/* +40: the trophy icon and the number in the game's white-on-black, like the Damage Calculator's -720 */
.lgt-chip {{ position: absolute; right: 38px; top: 30px; display: flex; align-items: center; gap: 2px; opacity: 0; white-space: nowrap;
  font: 800 13px/1 'Oxanium', sans-serif; color: #fff; text-shadow: 0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000; }}
.lgt-chip img {{ width: 15px; height: 15px; filter: drop-shadow(0 1px 0 #000); }}
.lgt-c0 {{ animation: lgti-chip 6s ease-out infinite; }}
.lgt-go .lgt-c0 {{ animation: lgth-c0 2.4s ease-out infinite; }}
.lgt-go .lgt-c1 {{ right: 64px; top: 40px; animation: lgth-c1 2.4s ease-out infinite; }}
.lgt-go .lgt-c2 {{ right: 14px; top: 44px; animation: lgth-c2 2.4s ease-out infinite; }}
.lgt-go .lgt-sp {{ animation: lgth-sp 2.4s ease-out infinite; }}

/* ===================================================================
   WAR PLANNER (ws-; wp- is the planner page's own). Two swords crossed
   like the game's war icon (the second is a mirrored copy), on a red
   glow. They swing back on their grips and clash: a flash, sparkles and
   streaks where the blades meet. Idle (6s): one clash. Hover / focus
   (.ws-go, 2.4s): two clashes, swung harder. Leaving finishes the loop.
   =================================================================== */
.ptc-ws {{ --art-w: 136px; }}
.ws-glow {{ position: absolute; right: -6px; top: 22px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(230,90,80,.17), rgba(230,90,80,.04) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; }}
.ws-x {{ position: absolute; left: 22px; top: 36px; width: 92px; height: 92px; filter: drop-shadow(0 6px 6px rgba(0,0,0,.6)); }}
.ws-b {{ position: absolute; inset: 0; }}
.ws-b + .ws-b {{ transform: scaleX(-1); }}
.ws-b img {{ position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: 12% 88%; animation: wsi-sw 6s linear infinite; }}
.ws-go .ws-b img {{ animation: wsh-sw 2.4s linear infinite; }}
/* where the blades meet */
.ws-hit {{ position: absolute; left: 68px; top: 82px; width: 0; height: 0; }}
.ws-flash {{ position: absolute; left: -16px; top: -16px; width: 32px; height: 32px; border-radius: 50%; opacity: 0; mix-blend-mode: screen;
  background: radial-gradient(closest-side, rgba(255,255,240,.95), rgba(255,220,150,.45) 45%, transparent); animation: wsi-fl 6s ease-out infinite; }}
.ws-go .ws-flash {{ animation: wsh-fl 2.4s ease-out infinite; }}
.ws-sp {{ animation: wsi-sp 6s ease-out infinite; }}
.ws-go .ws-sp {{ animation: wsh-sp 2.4s ease-out infinite; }}
.ws-st {{ --c: #fff1c8; z-index: 3; }}
.ws-go .ws-st {{ animation: wsh-st 2.4s ease-out infinite; }}

/* ===================================================================
   WALL CALCULATOR (wc-). Real numbers (coc-guides.js COST): one wall
   18 -> 19 costs 10M gold; Hammer Jam halves it (5M), the Gold Pass then
   takes 20% of what's left (4M) -- the page's own order and rounding.
   Idle (8s): the level 18 wall upgrades to 19 (flash, dust, hop), holds,
   fades back. Hover / focus (.wc-go, 3.2s): the Hammer Jam hammer slams
   the price tag (10M -> 5M), the Gold Pass builder stamps it (-> 4M,
   green), then the wall upgrades with a glint; all fades and resets.
   =================================================================== */
@property --wc {{ syntax: '<integer>'; inherits: true; initial-value: 10; }}
.ptc-wc {{ --art-w: 136px; }}
.wc-glow {{ position: absolute; right: -8px; top: 30px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(240,196,90,.15), rgba(240,196,90,.04) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; transition: filter .6s; }}
.wc-go .wc-glow {{ filter: brightness(1.5); }}
.wc-wall {{ position: absolute; right: 26px; top: 58px; width: 84px; height: 84px; }}
.wc-wall::before {{ content: ""; position: absolute; left: 14%; right: 14%; bottom: 4%; height: 18%; border-radius: 50%; background: rgba(0,0,0,.55); filter: blur(5px); }}
.wc-wall img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; transform-origin: 50% 90%; }}
.wc-18 {{ animation: wci-18 8s ease-out infinite; }}
.wc-19 {{ opacity: 0; animation: wci-19 8s ease-out infinite; }}
.wc-go .wc-18 {{ animation: wch-18 3.2s ease-out infinite; }}
.wc-go .wc-19 {{ animation: wch-19 3.2s ease-out infinite; }}
.wc-shine {{ opacity: 0; filter: brightness(2.4) saturate(.3);
  -webkit-mask: linear-gradient(105deg, transparent 40%, #000 50%, transparent 60%) 100% 0 / 300% 100% no-repeat;
  mask: linear-gradient(105deg, transparent 40%, #000 50%, transparent 60%) 100% 0 / 300% 100% no-repeat; }}
.wc-go .wc-shine {{ animation: wch-shine 3.2s ease-out infinite; }}
.wc-dust {{ position: absolute; left: 4px; right: 4px; bottom: -4px; height: 22px; border-radius: 50%; border: 1.5px solid rgba(240,220,180,.7); opacity: 0; animation: wci-dust 8s ease-out infinite; }}
.wc-go .wc-dust {{ animation: wch-dust 3.2s ease-out infinite; }}
/* the price tag: a raised key, gold coin + the cost in millions (an
   @property integer, so it ticks 10 -> 5 -> 4) */
.wc-tag {{ position: absolute; right: 18px; top: 20px; width: 62px; height: 24px; display: flex; align-items: center; justify-content: center; gap: 4px; border-radius: 5px;
  background: var(--raise); box-shadow: var(--ring-btn), 0 6px 12px -6px rgba(0,0,0,.8); transform-origin: 50% 100%; }}
.wc-tag img {{ width: 14px; height: 14px; }}
.wc-num {{ display: inline-block; min-width: 26px; font: 700 12px/1 'Sora', sans-serif; color: #fff; font-variant-numeric: tabular-nums; counter-reset: m var(--wc); }}
.wc-num::before {{ content: counter(m) "M"; }}
.wc-go .wc-tag {{ animation: wch-tag 3.2s ease-out infinite; }}
.wc-go .wc-num {{ animation: wch-num 3.2s linear infinite; }}
/* Hammer Jam: pivots on the end of its handle, head lands on the tag */
.wc-jam {{ position: absolute; left: 20px; top: 18px; width: 30px; height: 39px; opacity: 0; transform-origin: 50% 100%; filter: drop-shadow(0 3px 3px rgba(0,0,0,.6)); }}
.wc-go .wc-jam {{ animation: wch-jam 3.2s cubic-bezier(.5,0,.2,1) infinite; }}
/* Gold Pass builder: pops in beside the tag and bumps it */
.wc-gp {{ position: absolute; left: 22px; top: 12px; width: 28px; height: 32px; opacity: 0; filter: drop-shadow(0 3px 3px rgba(0,0,0,.6)); }}
.wc-go .wc-gp {{ animation: wch-gp 3.2s ease-out infinite; }}
@keyframes wci-18 {{ 0%, 30% {{ opacity: 1; filter: brightness(1); transform: none; }} 32% {{ filter: brightness(2); }} 34%, 74% {{ opacity: 0; }} 82%, 100% {{ opacity: 1; filter: brightness(1); transform: none; }} }}
@keyframes wci-19 {{ 0%, 32% {{ opacity: 0; transform: none; }} 34% {{ opacity: 1; transform: translateY(-6px) scale(1.04, .97); }} 38% {{ transform: translateY(1px) scale(1.03, .96); }} 41%, 74% {{ opacity: 1; transform: none; }} 82%, 100% {{ opacity: 0; transform: none; }} }}
@keyframes wci-dust {{ 0%, 33% {{ opacity: 0; transform: scale(.5); }} 35% {{ opacity: .7; transform: scale(.7); }} 44%, 100% {{ opacity: 0; transform: scale(1.35); }} }}
@keyframes wch-jam {{ 0% {{ opacity: 0; transform: rotate(-60deg); }} 6% {{ opacity: 1; transform: rotate(-35deg); }} 13% {{ transform: rotate(62deg); }} 16% {{ transform: rotate(52deg); }}
  22% {{ opacity: 1; transform: rotate(40deg); }} 28%, 100% {{ opacity: 0; transform: rotate(-20deg); }} }}
@keyframes wch-gp {{ 0%, 30% {{ opacity: 0; transform: scale(.3); }} 35% {{ opacity: 1; transform: scale(1.15); }} 38% {{ transform: scale(1); }} 41% {{ transform: translateX(7px) rotate(8deg); }}
  44% {{ transform: none; }} 50% {{ opacity: 1; transform: none; }} 56%, 100% {{ opacity: 0; transform: scale(.8); }} }}
@keyframes wch-tag {{ 0%, 12.5% {{ transform: none; }} 13.5% {{ transform: translateY(2px) scale(1.08, .82); }} 17% {{ transform: scale(.97, 1.04); }} 20%, 40.5% {{ transform: none; }}
  41.5% {{ transform: translateX(3px) scale(.92, 1.06); }} 45%, 100% {{ transform: none; }} }}
@keyframes wch-num {{ 0%, 13.4% {{ --wc: 10; color: #fff; opacity: 1; transform: none; }} 13.5% {{ --wc: 5; opacity: 0; transform: scale(1.5); }} 17% {{ opacity: 0; transform: scale(1.5); }} 19.5% {{ opacity: 1; transform: none; }} 41.4% {{ --wc: 5; color: #fff; opacity: 1; transform: none; }}
  41.5% {{ --wc: 4; color: #8fe04a; opacity: 0; transform: scale(1.5); }} 45% {{ opacity: 0; transform: scale(1.5); }} 47.5%, 86% {{ --wc: 4; color: #8fe04a; opacity: 1; transform: none; }} 86.1%, 100% {{ --wc: 10; color: #fff; opacity: 1; transform: none; }} }}
@keyframes wch-18 {{ 0%, 54% {{ opacity: 1; filter: brightness(1); }} 56% {{ filter: brightness(2.1); }} 58%, 86% {{ opacity: 0; }} 92%, 100% {{ opacity: 1; filter: brightness(1); }} }}
@keyframes wch-19 {{ 0%, 56% {{ opacity: 0; transform: none; }} 58% {{ opacity: 1; transform: translateY(-9px) scale(1.06, .96); }} 63% {{ transform: translateY(1px) scale(1.04, .95); }}
  67%, 84% {{ opacity: 1; transform: none; }} 90%, 100% {{ opacity: 0; transform: none; }} }}
@keyframes wch-dust {{ 0%, 57% {{ opacity: 0; transform: scale(.5); }} 59% {{ opacity: .8; transform: scale(.7); }} 70%, 100% {{ opacity: 0; transform: scale(1.45); }} }}
@keyframes wch-shine {{ 0%, 63% {{ opacity: 0; -webkit-mask-position: 100% 0; mask-position: 100% 0; }} 64% {{ opacity: .8; }}
  79% {{ opacity: .8; -webkit-mask-position: 0 0; mask-position: 0 0; }} 80%, 100% {{ opacity: 0; -webkit-mask-position: 0 0; mask-position: 0 0; }} }}

/* ===================================================================
   SHARED EFFECTS (fx-): light streaks, thrown particles (or coins), slow
   light rays. Python places them (streaks()/embers()); each card's
   keyframes time them, so they stay locked to that card's loop.
   =================================================================== */
.fx-st {{ position: absolute; height: 2px; margin-top: -1px; border-radius: 2px; transform-origin: 0 50%; background: linear-gradient(90deg, transparent, var(--c, #fff)); opacity: 0; pointer-events: none; }}
.fx-em {{ position: absolute; margin: -1.5px 0 0 -1.5px; border-radius: 50%; background: var(--c, #ffd27a); box-shadow: 0 0 6px var(--c, #ffd27a); opacity: 0; pointer-events: none; }}
img.fx-em {{ width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; border-radius: 0; background: none; box-shadow: none; filter: drop-shadow(0 1px 1px rgba(0,0,0,.6)); }}
.fx-rays {{ position: absolute; border-radius: 50%; opacity: 0; pointer-events: none; }}
.fx-rays::before {{ content: ""; position: absolute; inset: 0; border-radius: 50%;
  background: repeating-conic-gradient(rgba(var(--rc),0) 0deg 8deg, rgba(var(--rc),.5) 11deg 13deg, rgba(var(--rc),0) 16deg 22.5deg);
  -webkit-mask: radial-gradient(closest-side, #000 12%, transparent); mask: radial-gradient(closest-side, #000 12%, transparent); animation: fx-spin 14s linear infinite; }}
@keyframes fx-spin {{ to {{ transform: rotate(360deg); }} }}
.fx-spark {{ position: absolute; width: var(--z); height: var(--z); margin: calc(var(--z) / -2) 0 0 calc(var(--z) / -2); opacity: 0; pointer-events: none; z-index: 3;
  background: radial-gradient(closest-side, #fff 25%, #ffe9a8 60%, #f2b53c);
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); }}
{fx_css}

/* Player Tracker extras: the reel blurs at speed (in plh-reel); on landing
   gold rays open behind the badge and streaks burst off it */
.pl-rays {{ --rc: 255,190,90; left: -33px; top: -19px; width: 150px; height: 150px; }}
.pl-go .pl-rays {{ animation: plh-rays 2.8s ease-out infinite; }}
.pl-st {{ --c: #ffd98a; }}
.pl-go .pl-st {{ animation: plh-st 2.8s ease-out infinite; }}
@keyframes plh-rays {{ 0%, 56% {{ opacity: 0; transform: scale(.5); }} 60% {{ opacity: 1; transform: scale(1.08); }} 78% {{ opacity: .55; transform: scale(1); }} 92%, 100% {{ opacity: 0; transform: scale(1); }} }}

/* Wall Calculator extras: the hammer's hit shakes the scene and throws
   sparks; each old price falls off struck through; the Gold Pass cut
   sprays gold coins; the upgrade fires a light pillar, rays and rising dust */
.wc-art.wc-go {{ animation: wch-shake 3.2s linear infinite; }}
.wc-old {{ position: absolute; right: 26px; top: 26px; font: 700 12px/1 'Sora', sans-serif; color: #fff; opacity: 0;
  text-decoration: line-through 2px #ef6461; text-shadow: 0 1px 0 #000; }}
.wc-go .wc-old1 {{ animation: wch-old1 3.2s ease-in infinite; }}
.wc-go .wc-old2 {{ animation: wch-old2 3.2s ease-in infinite; }}
.wc-st {{ --c: #fff3c4; z-index: 3; }}
.wc-go .wc-st {{ animation: wch-st 3.2s ease-out infinite; }}
.wc-go .wc-coin {{ animation: wch-coin 3.2s ease-out infinite; }}
.wc-rays {{ --rc: 255,214,120; left: -7px; top: 21px; width: 150px; height: 150px; }}
.wc-go .wc-rays {{ animation: wch-rays 3.2s ease-out infinite; }}
.wc-beam {{ position: absolute; left: 46px; top: -30px; width: 44px; height: 166px; transform-origin: 50% 100%; opacity: 0; mix-blend-mode: screen; pointer-events: none;
  background: linear-gradient(to top, rgba(255,226,140,0), rgba(255,226,140,.7) 22%, rgba(255,240,200,.25) 70%, transparent); filter: blur(3px); }}
.wc-go .wc-beam {{ animation: wch-beam 3.2s ease-out infinite; }}
.wc-em {{ --c: #ffd27a; }}
.wc-go .wc-em {{ animation: wch-em 3.2s ease-out infinite; }}
@keyframes wch-shake {{ 0%, 13% {{ translate: 0 0; }} 13.6% {{ translate: -2px 2px; }} 14.3% {{ translate: 2px -1px; }} 15% {{ translate: -1px 1px; }} 16%, 41.3% {{ translate: 0 0; }}
  41.9% {{ translate: 1px 1px; }} 42.6% {{ translate: -1px 0; }} 43.3%, 100% {{ translate: 0 0; }} }}
@keyframes wch-old1 {{ 0%, 13.4% {{ opacity: 0; transform: none; }} 13.5% {{ opacity: 1; transform: none; }} 25%, 100% {{ opacity: 0; transform: translate(-8px, 34px) rotate(-30deg); }} }}
@keyframes wch-old2 {{ 0%, 41.4% {{ opacity: 0; transform: none; }} 41.5% {{ opacity: 1; transform: none; }} 53%, 100% {{ opacity: 0; transform: translate(-8px, 34px) rotate(-30deg); }} }}
@keyframes wch-rays {{ 0%, 56% {{ opacity: 0; transform: scale(.4); }} 61% {{ opacity: 1; transform: scale(1.05); }} 80% {{ opacity: .45; transform: scale(1); }} 90%, 100% {{ opacity: 0; transform: scale(1); }} }}
@keyframes wch-beam {{ 0%, 56.5% {{ opacity: 0; transform: scaleX(.3) scaleY(0); }} 59% {{ opacity: 1; transform: scaleX(1) scaleY(1); }} 66% {{ opacity: .6; transform: scaleX(.6) scaleY(1); }} 76%, 100% {{ opacity: 0; transform: scaleX(.2) scaleY(1); }} }}

/* ===================================================================
   EQUIPMENT (eq-), laby-style: the Grand Warden's Fireball, falling.
   It holds still (a slow wobble, a flicker) while wind streaks and its own
   embers and ash rush up past it, so it reads as a fireball mid-fall.
   Hover / focus (.eq-go, 3s loop): it heats up -- a white-hot core, the
   glow swells, a fine tremor, and a second, faster set of streaks and
   embers fades in. Leaving finishes the loop (JS waits for eqh-heat).
   =================================================================== */
.ptc-eq {{ --art-w: 136px; }}
.eq-glow {{ position: absolute; left: -12px; top: 14px; width: 160px; height: 160px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,140,40,.3), rgba(255,90,20,.08) 55%, transparent); animation: eq-flicker 2.3s ease-in-out infinite;
  transition: filter .6s, transform .6s cubic-bezier(.22,1,.36,1); }}
.eq-go .eq-glow {{ filter: brightness(1.7) saturate(1.2); transform: scale(1.18); }}
/* wind: thin streaks sliding up past the ball */
.eq-wind {{ position: absolute; top: 160px; width: 1px; border-radius: 1px; opacity: 0;
  background: linear-gradient(rgba(255,226,190,0), rgba(255,226,190,.24) 40%, rgba(255,226,190,0)); animation: eq-wind var(--t) linear var(--d) infinite; }}
.eq-hot {{ position: absolute; inset: 0; opacity: 0; transition: opacity .5s; }}
.eq-go .eq-hot {{ opacity: 1; }}
.eq-hot .eq-wind {{ width: 1.5px; background: linear-gradient(rgba(255,236,200,0), rgba(255,236,200,.55) 40%, rgba(255,236,200,0)); }}
/* the trail: the flame it leaves behind, streaming up off the ball (it falls, so the fire trails above it) */
.eq-trail {{ position: absolute; left: 50px; top: 0; width: 36px; height: 78px; border-radius: 50% 50% 45% 45%; filter: blur(6px); transform-origin: 50% 100%;
  background: linear-gradient(to top, rgba(255,160,60,.6), rgba(255,110,30,.22) 55%, rgba(255,90,20,0)); animation: eq-trail .9s ease-in-out infinite alternate;
  transition: opacity .6s, height .6s, top .6s; opacity: .75; }}
.eq-go .eq-trail {{ opacity: 1; top: -14px; height: 92px; background: linear-gradient(to top, rgba(255,220,130,.75), rgba(255,140,40,.3) 55%, rgba(255,90,20,0)); }}
@keyframes eq-trail {{ from {{ transform: scaleX(.86) scaleY(.94) skewX(-2deg); }} to {{ transform: scaleX(1) scaleY(1.06) skewX(2deg); }} }}
/* the ball: wobble + flicker at rest; on hover it swells a touch (transition, so heating up is smooth) */
.eq-ball {{ position: absolute; left: 30px; top: 46px; width: 76px; height: 76px; transition: transform .7s cubic-bezier(.22,1,.36,1); }}
.eq-go .eq-ball {{ transform: scale(1.07); }}
.eq-ball img {{ position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 0 10px rgba(255,120,30,.45)); animation: eqi-fall 1.8s ease-in-out infinite; }}
.eq-go .eq-ball img {{ animation: eqh-heat 3s linear infinite; }}
/* white-hot core: screen-blended light over the ball, only on hover */
.eq-core {{ position: absolute; left: 22px; top: 24px; width: 34px; height: 34px; border-radius: 50%; mix-blend-mode: screen; opacity: 0;
  background: radial-gradient(closest-side, rgba(255,252,230,.95), rgba(255,214,120,.55) 50%, transparent); transition: opacity .6s; }}
.eq-go .eq-core {{ opacity: 1; animation: eqh-core 3s ease-in-out infinite; }}
/* embers glow, ash doesn't: both shed upward, turning as they go */
.eq-em, .eq-ash {{ position: absolute; opacity: 0; pointer-events: none; animation: eq-shed var(--t) cubic-bezier(.2,.6,.4,1) var(--d) infinite; }}
.eq-em {{ border-radius: 50%; background: #ffc46b; box-shadow: 0 0 4px #ff8a2a, 0 0 8px rgba(255,120,30,.6); }}
.eq-hot .eq-em {{ background: #fff0c2; box-shadow: 0 0 5px #ffb347, 0 0 10px rgba(255,150,40,.8); }}
.eq-ash {{ border-radius: 1px; background: #8a817b; }}
@keyframes eq-flicker {{ 0%, 100% {{ opacity: .85; }} 30% {{ opacity: 1; }} 55% {{ opacity: .7; }} 75% {{ opacity: .95; }} }}
@keyframes eq-wind {{ 0% {{ opacity: 0; transform: translateY(0); }} 20% {{ opacity: 1; }} 80% {{ opacity: .8; }} 100% {{ opacity: 0; transform: translateY(-190px); }} }}
@keyframes eq-shed {{ 0% {{ opacity: 0; transform: translate(0, 0) rotate(0deg); }} 12% {{ opacity: 1; }} 70% {{ opacity: .7; }}
  100% {{ opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(.5); }} }}
@keyframes eqi-fall {{ 0%, 100% {{ transform: translateX(0) rotate(-2deg); filter: drop-shadow(0 0 10px rgba(255,120,30,.45)) brightness(1); }}
  25% {{ filter: drop-shadow(0 0 12px rgba(255,120,30,.55)) brightness(1.08); }} 50% {{ transform: translateX(1px) rotate(2deg); filter: drop-shadow(0 0 9px rgba(255,120,30,.4)) brightness(.96); }}
  75% {{ filter: drop-shadow(0 0 12px rgba(255,120,30,.55)) brightness(1.1); }} }}
@keyframes eqh-heat {{ 0%, 100% {{ transform: translate(0, 0) rotate(-1deg); filter: drop-shadow(0 0 16px rgba(255,150,40,.8)) brightness(1.25) saturate(1.2); }}
  10% {{ transform: translate(-1px, 1px) rotate(1deg); }} 20% {{ transform: translate(1px, 0) rotate(-1deg); filter: drop-shadow(0 0 20px rgba(255,170,60,.9)) brightness(1.4) saturate(1.25); }}
  30% {{ transform: translate(0, -1px) rotate(1.5deg); }} 40% {{ transform: translate(-1px, 0) rotate(-1deg); filter: drop-shadow(0 0 15px rgba(255,150,40,.75)) brightness(1.22) saturate(1.2); }}
  50% {{ transform: translate(1px, 1px) rotate(1deg); }} 60% {{ transform: translate(0, 0) rotate(-1.5deg); filter: drop-shadow(0 0 22px rgba(255,180,70,.95)) brightness(1.45) saturate(1.25); }}
  70% {{ transform: translate(-1px, -1px) rotate(1deg); }} 80% {{ transform: translate(1px, 0) rotate(-1deg); filter: drop-shadow(0 0 17px rgba(255,150,40,.8)) brightness(1.3) saturate(1.2); }}
  90% {{ transform: translate(0, 1px) rotate(1deg); }} }}
@keyframes eqh-core {{ 0%, 100% {{ transform: scale(1); }} 20% {{ transform: scale(1.15); }} 40% {{ transform: scale(.95); }} 60% {{ transform: scale(1.2); }} 80% {{ transform: scale(1.02); }} }}

/* ===================================================================
   TIER LIST (tl-): one tier row up close, so the card has one focal point
   (Adrian, Oct 25 2026, replacing the 3 x 3 board): the tier maker's big S
   label (its colours, PAL in coc-tierlist.js) with a Dragon card docked
   beside it in a sunken row. Idle (6s): the Dragon bobs, a glint runs over
   the S. Hover / focus (.tl-go, 2.4s): the Dragon is picked up, the label
   spins through F, E, D, C, B, A like a reel and lands on S, the Dragon
   drops back into its slot and sparkles pop. Leaving finishes the loop.
   =================================================================== */
.ptc-tl {{ --art-w: 136px; }}
.tl-glow {{ position: absolute; right: -6px; top: 22px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(224,99,99,.17), rgba(224,99,99,.04) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; }}
/* the row: a sunken well like the tier maker's, label left, card right */
.tl-row {{ position: absolute; left: 6px; top: 46px; width: 124px; height: 66px; border-radius: 9px; background: #0b0c0f;
  box-shadow: inset 0 0 0 2px #060708, inset 0 3px 0 rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.06); }}
.tl-lab {{ position: absolute; left: 5px; top: 5px; width: {TL_H}px; height: {TL_H}px; border-radius: 7px; overflow: hidden;
  box-shadow: 0 0 0 2px #060708, 0 6px 12px -6px rgba(0,0,0,.8); }}
.tl-go .tl-lab {{ animation: tlh-lab 2.4s ease-out infinite; }}
.tl-reel {{ position: absolute; left: 0; top: 0; width: 100%; }}
.tl-go .tl-reel {{ animation: tlh-reel 2.4s linear infinite; }}
.tl-reel b {{ display: grid; place-items: center; height: {TL_H}px; background: rgb(var(--tl)) linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,0) 48%, rgba(0,0,0,.14));
  box-shadow: inset 0 2px 0 rgba(255,255,255,.3), inset 0 -3px 0 rgba(0,0,0,.18); font: 900 34px/1 'Figtree', 'Oxanium', sans-serif; color: #fff;
  text-shadow: 0 2px 0 rgba(0,0,0,.55), 1.5px 0 0 rgba(0,0,0,.4), -1.5px 0 0 rgba(0,0,0,.4), 0 -1px 0 rgba(0,0,0,.35); }}
/* the glint: a bright band across the label */
.tl-glint {{ position: absolute; inset: 0; pointer-events: none; opacity: 0; background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.55) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;
  animation: tli-glint 6s ease-in-out infinite; }}
.tl-go .tl-glint {{ animation: tlh-glint 2.4s ease-out infinite; }}
.tl-card {{ position: absolute; left: 65px; top: 5px; width: {TL_H}px; height: {TL_H}px; border-radius: 7px; overflow: hidden; z-index: 2;
  box-shadow: 0 0 0 2px #060708, 0 6px 12px -6px rgba(0,0,0,.8); animation: tli-bob 3s ease-in-out infinite alternate; }}
.tl-card img {{ display: block; width: 100%; height: 100%; }}
.tl-go .tl-card {{ animation: tlh-card 2.4s linear infinite; }}
.tl-go .tl-sp {{ animation: tlh-sp 2.4s ease-out infinite; }}
@keyframes tli-bob {{ from {{ transform: translateY(0); }} to {{ transform: translateY(-2px); }} }}
@keyframes tli-glint {{ 0%, 58% {{ opacity: 0; background-position: 100% 0; }} 60% {{ opacity: 1; }} 74% {{ opacity: 1; background-position: 0 0; }} 76%, 100% {{ opacity: 0; background-position: 0 0; }} }}
@keyframes tlh-glint {{ 0%, 55% {{ opacity: 0; background-position: 100% 0; }} 57% {{ opacity: 1; }} 74% {{ opacity: 1; background-position: 0 0; }} 76%, 100% {{ opacity: 0; background-position: 0 0; }} }}
@keyframes tlh-lab {{ 0%, 49.5% {{ transform: none; filter: none; }} 52% {{ transform: scale(1.12); filter: brightness(1.3); }} 58% {{ transform: scale(.97); filter: none; }} 64%, 100% {{ transform: none; filter: none; }} }}
@keyframes tlh-card {{ 0% {{ transform: none; box-shadow: 0 0 0 2px #060708, 0 6px 12px -6px rgba(0,0,0,.8); animation-timing-function: cubic-bezier(.2,.8,.3,1); }}
  7%, 47% {{ transform: translateY(-13px) rotate(-6deg) scale(1.08); box-shadow: 0 0 0 2px #060708, 0 16px 16px -8px rgba(0,0,0,.75); animation-timing-function: cubic-bezier(.6,0,.9,.5); }}
  53% {{ transform: translateY(1px) scale(1.1, .86); box-shadow: 0 0 0 2px #060708, 0 6px 12px -6px rgba(0,0,0,.8); }} 59% {{ transform: scale(.97, 1.04); }} 65%, 100% {{ transform: none; }} }}

/* ===================================================================
   GLOSSARY (gl-): the Book of Everything (the nav's Glossary picture),
   drawn in CSS so it can open. Red leather with a dark edge, a gold frame
   and hourglass on the cover, cream pages; it lies tilted toward you.
   Idle (12s): open on Queen Walk, a leaf turns to Lavaloon, another to
   Funneling (all real entries in coc-glossary.json), the cover swings shut
   and the book slides to the middle, then it opens on Queen Walk again.
   Hover / focus (.gl-go, 3.6s): the book lifts and riffles (three leaves in
   quick succession) to each term in turn; every landing gives a thump and
   gold sparkles. No glow change, no rays behind it (Adrian, Oct 25 2026).
   =================================================================== */
.ptc-gl {{ --art-w: 136px; --red: #a8352b; --red-d: #6e1d17; --ink: #2a0907; --gold: #f0bb48; --gold-d: #9c6618;
  --paper: #f6ead0; --paper-d: #dcc79a; }}
.gl-glow {{ position: absolute; right: -10px; top: 12px; width: 150px; height: 150px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(220,90,70,.16), rgba(220,90,70,.04) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; }}
.gl-stage {{ position: absolute; right: 12px; top: 46px; width: 112px; height: 72px; perspective: 420px; }}
.gl-book {{ position: absolute; inset: 0; transform: rotateX(30deg); transform-style: preserve-3d; transform-origin: 50% 100%;
  transition: transform .6s cubic-bezier(.22,1,.36,1); animation: gli-slide 12s cubic-bezier(.45,.05,.35,1) infinite; }}
.gl-go .gl-book {{ transform: rotateX(22deg) translateY(-5px); animation: glh-thump 3.6s linear infinite; }}
/* back board (right half) + the page block's cream edge showing under the pages */
.gl-board {{ position: absolute; left: 53px; top: -5px; width: 65px; height: 86px; border-radius: 2px 7px 7px 2px;
  background: linear-gradient(var(--red), var(--red-d)); box-shadow: inset 0 0 0 2px var(--ink), 0 14px 16px -8px rgba(0,0,0,.85); }}
.gl-page {{ position: absolute; top: 0; width: 56px; height: 72px; overflow: hidden; }}
.gl-pr {{ left: 56px; border-radius: 0 3px 3px 0; background: linear-gradient(90deg, var(--paper-d), #eadbb7 14%, var(--paper));
  box-shadow: 0 1.5px 0 #e3d1a6, 0 3px 0 #c9b182, 0 4px 0 var(--ink); overflow: visible; }}
.gl-lines {{ position: absolute; left: 8px; right: 8px; top: 34px; height: 30px; background: repeating-linear-gradient(transparent 0 4px, rgba(110,60,30,.26) 4px 5.5px);
  -webkit-mask: linear-gradient(90deg, #000 60%, transparent 98%); mask: linear-gradient(90deg, #000 60%, transparent 98%); }}
.gl-back .gl-lines, .gl-cb .gl-lines, .gl-blank .gl-lines {{ top: 12px; height: 52px; }}
.gl-term {{ position: absolute; left: 3px; right: 3px; top: 8px; text-align: center; font: 900 10px/1.1 'Figtree', 'Oxanium', sans-serif; color: #4a1c10; opacity: 0; }}
.gl-term::after {{ content: ""; display: block; width: 18px; height: 2px; margin: 4px auto 0; border-radius: 1px; background: var(--red); }}
.gl-l0 .gl-t0, .gl-pr .gl-t1, .gl-l1 .gl-t1 {{ opacity: 1; }}
.gl-go .gl-l1 .gl-term {{ animation: none; opacity: 0; }}
/* leaves: hinged on the spine; front = a right page, back = a left page */
.gl-leaf {{ position: absolute; left: 56px; top: 0; width: 56px; height: 72px; transform-origin: 0 50%; transform-style: preserve-3d; }}
.gl-l0 {{ animation: gli-l0 12s linear infinite; }}
.gl-face {{ position: absolute; inset: 0; overflow: hidden; -webkit-backface-visibility: hidden; backface-visibility: hidden; }}
.gl-front {{ border-radius: 0 3px 3px 0; background: linear-gradient(90deg, #d8c393, #ecdcb4 14%, var(--paper)); }}
.gl-back {{ transform: rotateY(180deg); border-radius: 3px 0 0 3px; background: linear-gradient(90deg, var(--paper), #eadbb7 86%, var(--paper-d)); }}
/* the shadow a lifting leaf throws on whatever lies under it */
.gl-shade {{ position: absolute; left: 56px; top: 0; width: 56px; height: 72px; pointer-events: none; opacity: 0;
  background: linear-gradient(90deg, rgba(50,20,8,.5), rgba(50,20,8,0) 75%); animation: gli-shade 12s linear infinite; }}
.gl-go .gl-shade {{ animation: glh-shade 3.6s linear infinite; }}
/* the front cover: hinged on the spine; open = lying on the left (its inside is the left page) */
.gl-cover {{ position: absolute; left: 56px; top: -5px; width: 62px; height: 86px; transform-origin: 0 50%; transform-style: preserve-3d; transform: rotateY(-180deg);
  animation: gli-cover 12s linear infinite; }}
.gl-go .gl-cover {{ animation: none; }}
.gl-cf, .gl-cb {{ position: absolute; inset: 0; -webkit-backface-visibility: hidden; backface-visibility: hidden; }}
.gl-cf {{ border-radius: 2px 7px 7px 2px; background: linear-gradient(170deg, #c4473a, var(--red) 35%, var(--red-d));
  box-shadow: inset 0 0 0 2px var(--ink), inset 0 4px 0 rgba(255,255,255,.14), inset 6px 0 0 rgba(0,0,0,.22); }}
.gl-cf::before {{ content: ""; position: absolute; inset: 7px 7px 8px 11px; border-radius: 3px; box-shadow: 0 0 0 1.5px var(--gold), inset 0 0 0 1.5px rgba(0,0,0,.3); }}
.gl-cf svg {{ position: absolute; left: 21px; top: 21px; width: 30px; height: 40px; overflow: visible; filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }}
.gl-cb {{ transform: rotateY(180deg); border-radius: 7px 2px 2px 7px; background: linear-gradient(var(--red), var(--red-d)); box-shadow: inset 0 0 0 2px var(--ink); }}
.gl-cb i:first-child {{ position: absolute; left: 6px; right: 0; top: 5px; bottom: 9px; border-radius: 3px 0 0 3px; background: linear-gradient(90deg, var(--paper), #eadbb7 86%, var(--paper-d)); }}
.gl-cb .gl-lines {{ left: 14px; right: 8px; top: 17px; }}
.gl-ribbon {{ position: absolute; left: 53px; top: 66px; width: 6px; height: 20px; background: linear-gradient(var(--gold), var(--gold-d)); transform-origin: 50% 0;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); animation: gl-sway 4s ease-in-out infinite; }}
.gl-go .gl-sp {{ animation: glh-sp 3.6s ease-out infinite; }}
@keyframes gl-sway {{ 0%, 100% {{ transform: rotate(-4deg); }} 50% {{ transform: rotate(5deg); }} }}

@media (prefers-reduced-motion: reduce) {{
  .pl-art {{ --lx: 40px; --ly: 52px; }}
  .ptc-art, .ptc-art * {{ animation: none !important; }}
  /* still frames: Army Maker = the camp with its three troop cards round it,
     Damage Calculator = the Monolith destroyed (stamp on, no bar) */
  .am-t {{ width: 40px; height: 40px; margin: -6px 0 0 -6px; opacity: 1; border-radius: 8px; outline-width: 2px; }}
  .am-t0 {{ transform: translate(-50px, 50px) rotate(-10deg); }}
  .am-t1 {{ transform: translate(44px, 46px) rotate(9deg); }}
  .am-t2 {{ transform: translate(0, 10px) rotate(-3deg); }}
  .dc-bar, .dc-dmg {{ display: none; }}
  .dc-mono {{ filter: brightness(.68) saturate(.85); }}
  .dc-stamp {{ opacity: 1; transform: rotate(-9deg); }}
  .ptc-layer {{ transition: none; }}
}}

@media (max-width: 760px) {{
  .ptc {{ --s: .6; --well-w: 108px; min-height: 92px; padding: 10px calc(var(--well-w) + 10px) 10px 15px; }}
  .ptc-name {{ font-size: 17px; }}
  .ptc-desc {{ display: block; margin-top: 3px; font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }}
  .ptc-long {{ display: none; }}
  .ptc-short {{ display: inline; }}
  /* /coc/ phones: the reduced-motion still frames (Oct 25 2026, Adrian: the
     animations lagged there). /coc/tools/ (no .coc-home) keeps them. */
  .coc-home .pl-art {{ --lx: 40px; --ly: 52px; }}
  .coc-home .ptc-art, .coc-home .ptc-art * {{ animation: none !important; }}
  .coc-home .am-t {{ width: 40px; height: 40px; margin: -6px 0 0 -6px; opacity: 1; border-radius: 8px; outline-width: 2px; }}
  .coc-home .am-t0 {{ transform: translate(-50px, 50px) rotate(-10deg); }}
  .coc-home .am-t1 {{ transform: translate(44px, 46px) rotate(9deg); }}
  .coc-home .am-t2 {{ transform: translate(0, 10px) rotate(-3deg); }}
  .coc-home .dc-bar, .coc-home .dc-dmg {{ display: none; }}
  .coc-home .dc-mono {{ filter: brightness(.68) saturate(.85); }}
  .coc-home .dc-stamp {{ opacity: 1; transform: rotate(-9deg); }}
}}
/* Phones and narrow bands (Oct 25 2026, Adrian): two cards a row as tiles --
   the art on top, centred (scaled from its top centre instead of its right
   edge), the name and short blurb under it. A container query, so it follows
   the band's width like the column rules above. */
@container (max-width: 619px) {{
  .ptc-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }}
  .ptc {{ --s: .5; flex-direction: column; align-items: stretch; justify-content: flex-start; min-height: 0; padding: 82px 10px 11px; text-align: center; }}
  .ptc-art {{ top: 2px; right: auto; left: 50%; margin: 0 0 0 calc(var(--art-w) / -2); }}
  .ptc-layer {{ transform-origin: 50% 0; }}
  .ptc-name {{ font-size: 14px; line-height: 1.2; }}
  .ptc-name svg {{ display: none; }}
  .ptc-copy {{ position: static; }}  /* so the HOT tag sits in the tile's corner, not the copy's */
  .ptc-hot {{ position: absolute; top: 7px; left: 7px; margin: 0; z-index: 3; }}
  .ptc-desc {{ display: -webkit-box; -webkit-line-clamp: 2; margin: 2px auto 0; font-size: 11px; line-height: 1.35; white-space: normal; text-wrap: balance; }}
  .ptc-long {{ display: none; }}
  .ptc-short {{ display: inline; }}
}}
/* @@CSS-END */
@media (max-width: 760px) {{
  body {{ padding: 48px 5%; }}
  h2 {{ font-size: 15px; letter-spacing: 0; }}
  .sub {{ font-size: 12.5px; margin: 6px 0 20px; }}
}}
</style>
</head>
<body>
  <h2>Parchrome tools.</h2>
  <p class="sub">Plan attacks, price upgrades, compare gear, and track players.</p>

  <div class="ptc-wrap"><div class="ptc-grid">
<!-- @@CARDS -->
    <a class="ptc ptc-pl" href="{U}/coc/tools/player-tracker">
      <div class="ptc-art pl-art" data-go="pl-go" data-clock="plh-lens" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="pl-glow"></div><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i></div>
        <div class="ptc-layer ptc-mid">
          <div class="pl-scene">
            <div class="fx-rays pl-rays"></div>
            <div class="pl-win pl-base"><div class="pl-reel">{reel}</div></div>
            <img class="pl-shine" src="{U}/clashofclans/leagues/legend.webp" alt="">
            {streaks('pl-st', 12, 42, 56, 52, seed=3)}
            <div class="pl-mag"><div class="pl-win"><div class="pl-reel">{reel}</div></div></div>
            <div class="pl-lens"><svg viewBox="0 0 60 60">
              <path d="M40 40 L55 55" stroke="#060708" stroke-width="9" stroke-linecap="round"/>
              <path d="M40 40 L55 55" stroke="#5b4636" stroke-width="5.5" stroke-linecap="round"/>
              <circle cx="24" cy="24" r="21" fill="rgba(190,210,255,.07)" stroke="#060708" stroke-width="6"/>
              <circle cx="24" cy="24" r="21" fill="none" stroke="#d6d9df" stroke-width="3"/>
              <path d="M11 17 A14 14 0 0 1 20 10" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linecap="round"/>
            </svg></div>
          </div>
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name"><b class="ptc-hot">Hot</b>Player Tracker<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Any player or clan by tag, live from the game.</span><span class="ptc-short">Look up any player or clan by their tag.</span></p>
      </div>
    </a>

    <a class="ptc ptc-eq" href="{U}/coc/tools/equipment">
      <div class="ptc-art eq-art" data-go="eq-go" data-clock="eqh-heat" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="eq-glow"></div>{eq_wind(5, 21, (1.3, 1.9))}<div class="eq-hot">{eq_wind(7, 22, (.55, .85))}</div></div>
        <div class="ptc-layer ptc-mid">
          <i class="eq-trail"></i>
          <div class="eq-ball"><img src="{U}/clashofclans/coctools/units/fireball.webp" alt=""><i class="eq-core"></i></div>
        </div>
        <div class="ptc-layer ptc-near">{eq_particles(14, 23, (1.6, 2.8))}<div class="eq-hot">{eq_particles(14, 24, (.8, 1.4), hot=True)}</div></div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name"><b class="ptc-hot">Hot</b>Equipment<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Stats, ore costs and tips for all 42 hero items.</span><span class="ptc-short">All 42 hero items: stats, ore and tips.</span></p>
      </div>
    </a>

    <a class="ptc ptc-army" href="{U}/coc/tools/army-maker">
      <div class="ptc-art am-art" data-go="am-go" data-clock="amh-camp" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="am-light"></div><i class="am-mote"></i><i class="am-mote"></i><i class="am-mote"></i></div>
        <div class="ptc-layer ptc-mid"><div class="am-ring"></div><div class="am-camp"><img src="{U}/clashofclans/coctools/army-camp.webp" alt=""></div></div>
        <div class="ptc-layer ptc-near"><img class="am-t am-t0" src="{U}/clashofclans/coctools/units/rocket-balloon.webp" alt=""><img class="am-t am-t1" src="{U}/clashofclans/coctools/units/super-minion.webp" alt=""><img class="am-t am-t2" src="{U}/clashofclans/coctools/units/healer.webp" alt=""></div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Army Maker<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Build an army for TH8 to TH18, open it in game.</span><span class="ptc-short">Build an army and open it in the game.</span></p>
      </div>
    </a>

    <a class="ptc ptc-dc" href="{U}/coc/tools/damage-calculator">
      <div class="ptc-art dc-art" data-go="dc-go" data-clock="dch-hp" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="dc-glow"></div><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i></div>
        <div class="ptc-layer ptc-mid">
          <div class="dc-ring"></div>
          <div class="dc-mono"><img src="{U}/clashofclans/buildings/monolith/1.webp" alt=""></div>
          <svg class="dc-bolt" viewBox="0 0 50 76">
            <path class="glow" pathLength="1" d="M4 0 L15 19 L9 25 L25 45 L19 51 L42 74"/>
            <path class="core" pathLength="1" d="M4 0 L15 19 L9 25 L25 45 L19 51 L42 74"/>
          </svg>
        </div>
        <div class="ptc-layer ptc-near"><div class="dc-bar"><i class="dc-ghost"></i><i class="dc-fill"></i></div>{'<b class="dc-dmg">−720</b>' * 7}<div class="dc-stamp"><span>Destroyed</span></div></div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Damage Calculator<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Spell and equipment damage on any building.</span><span class="ptc-short">Spell and equipment damage on any building.</span></p>
      </div>
    </a>

    <a class="ptc ptc-lgt" href="{U}/coc/tools/legend-tracker">
      <div class="ptc-art lgt-art" data-go="lgt-go" data-clock="lgth-cup" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="lgt-glow"></div><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i></div>
        <div class="ptc-layer ptc-mid">
          <div class="lgt-cup"><img src="{U}/icons/legend-trophy.webp" alt="">{sparks('lgt-sp', [(14, 20, 9), (74, 14, 10, -.05), (82, 52, 7, -.1), (8, 58, 7, -.08)])}</div>
        </div>
        <div class="ptc-layer ptc-near">{''.join(f'<span class="lgt-chip lgt-c{k}"><img src="{U}/clashofclans/coctools/trophy.webp" alt="">+40</span>' for k in range(3))}</div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Legend Tracker<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Every Legend attack and defense, trophies each.</span><span class="ptc-short">Every Legend attack, with trophies each.</span></p>
      </div>
    </a>

    <a class="ptc ptc-ws" href="{U}/coc/tools/war-planner">
      <div class="ptc-art ws-art" data-go="ws-go" data-clock="wsh-sw" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="ws-glow"></div><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i></div>
        <div class="ptc-layer ptc-mid">
          <div class="ws-x"><div class="ws-b"><img src="{U}/clashofclans/coctools/sword.webp" alt=""></div><div class="ws-b"><img src="{U}/clashofclans/coctools/sword.webp" alt=""></div></div>
          <div class="ws-hit"><i class="ws-flash"></i>{sparks('ws-sp', [(-14, -12, 10), (12, -16, 8, -.04), (16, 8, 7, -.08), (-12, 12, 6, -.06)])}{streaks('ws-st', 10, 0, 0, 34, seed=13, length=9)}</div>
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">War Planner<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Give every attacker a target and share the plan.</span><span class="ptc-short">Give every attacker a target, share the plan.</span></p>
      </div>
    </a>

    <a class="ptc ptc-lr" href="{U}/coc/tools/leaderboards">
      <div class="ptc-art lr-art" data-go="lr-go" data-clock="lrh-cup" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="lr-glow"></div><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i></div>
        <div class="ptc-layer ptc-mid">
          <div class="lr-cup">
            <img src="{U}/icons/leaderboards.webp" alt="">
            <img class="lr-shine" src="{U}/icons/leaderboards.webp" alt="">
            {sparks('lr-tw', [(26, 12, 9, 0), (60, 4, 7, -2), (22, 44, 6, -4)])}
            {sparks('lr-sp', [(10, 18, 10), (68, 2, 11, -.06), (80, 34, 8, -.12), (2, 50, 7, -.09), (40, -4, 8, -.03), (76, 66, 7, -.15), (30, 70, 6, -.18)])}
          </div>
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Leaderboards<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">This week’s top 200, Philippines and world.</span><span class="ptc-short">This week’s top 200 in PH and the world.</span></p>
      </div>
    </a>

    <a class="ptc ptc-wc" href="{U}/coc/tools/walls">
      <div class="ptc-art wc-art" data-go="wc-go" data-clock="wch-num" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="wc-glow"></div></div>
        <div class="ptc-layer ptc-mid">
          <div class="fx-rays wc-rays"></div>
          <div class="wc-wall">
            <i class="wc-dust"></i>
            <img class="wc-18" src="{U}/clashofclans/coctools/walls/wall-18.webp" alt="">
            <img class="wc-19" src="{U}/clashofclans/coctools/walls/wall-19.webp" alt="">
            <img class="wc-shine" src="{U}/clashofclans/coctools/walls/wall-19.webp" alt="">
          </div>
          <div class="wc-beam"></div>
          {embers('wc-em', 9, 68, 128, 30, 70, seed=5)}
        </div>
        <div class="ptc-layer ptc-near">
          <div class="wc-tag"><img src="{U}/clashofclans/coctools/Gold.webp" alt=""><span class="wc-num"></span></div>
          <span class="wc-old wc-old1">10M</span><span class="wc-old wc-old2">5M</span>
          {streaks('wc-st', 10, 62, 24, 28, seed=6, length=8)}
          {embers('wc-coin', 7, 87, 32, 50, 20, seed=7, src=U + '/clashofclans/coctools/Gold.webp')}
          <img class="wc-jam" src="{U}/clashofclans/coctools/walls/hammer-jam.webp" alt="">
          <img class="wc-gp" src="{U}/clashofclans/coctools/walls/builder-boost.webp" alt="">
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Wall Calculator<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Wall costs with Gold Pass and Hammer Jam savings.</span><span class="ptc-short">Wall upgrade costs with Hammer Jam savings.</span></p>
      </div>
    </a>

    <a class="ptc ptc-tl" href="{U}/coc/tools/tier-list">
      <div class="ptc-art tl-art" data-go="tl-go" data-clock="tlh-reel" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="tl-glow"></div><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i><i class="dc-star"></i></div>
        <div class="ptc-layer ptc-mid">
          <div class="tl-row">
            <div class="tl-lab"><div class="tl-reel">{tl_reel}</div><i class="tl-glint"></i></div>
            <div class="tl-card"><img src="{U}/clashofclans/coctools/units/dragon.webp" alt=""></div>
            {sparks('tl-sp', [(4, 2, 11), (58, -4, 9, -.05), (62, 40, 8, -.1), (2, 58, 8, -.08), (30, -10, 7, -.03)])}
          </div>
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Clash Tier List<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Rank anything in Clash from S to F and share it.</span><span class="ptc-short">Rank anything in Clash from S to F, share it.</span></p>
      </div>
    </a>

    <a class="ptc ptc-gl" href="{U}/coc/tools/slang">
      <div class="ptc-art gl-art" data-go="gl-go" data-clock="glh-l0" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="gl-glow"></div></div>
        <div class="ptc-layer ptc-mid">
          <div class="gl-stage">
            <div class="gl-book">
              <i class="gl-board"></i>
              <div class="gl-page gl-pr">{''.join(f'<b class="gl-term gl-t{k}">{t}</b>' for k, t in enumerate(GL_TERMS))}<i class="gl-lines"></i></div>
              <div class="gl-leaf gl-l2"><div class="gl-face gl-front gl-blank"><i class="gl-lines"></i></div><div class="gl-face gl-back"><i class="gl-lines"></i></div></div>
              <div class="gl-leaf gl-l1"><div class="gl-face gl-front">{''.join(f'<b class="gl-term gl-t{k}">{t}</b>' for k, t in enumerate(GL_TERMS))}<i class="gl-lines"></i></div><div class="gl-face gl-back"><i class="gl-lines"></i></div></div>
              <div class="gl-leaf gl-l0"><div class="gl-face gl-front">{''.join(f'<b class="gl-term gl-t{k}">{t}</b>' for k, t in enumerate(GL_TERMS))}<i class="gl-lines"></i></div><div class="gl-face gl-back"><i class="gl-lines"></i></div></div>
              <i class="gl-shade"></i>
              <div class="gl-cover"><div class="gl-cf"><svg viewBox="0 0 24 32"><defs><linearGradient id="glHg" x1="0" x2="1"><stop offset="0" stop-color="#ffd978"/><stop offset=".55" stop-color="#f0bb48"/><stop offset="1" stop-color="#b77d22"/></linearGradient></defs><path d="M2 1h20v3.5h-2.2L14 14v4l5.8 9.5H22V31H2v-3.5h2.2L10 18v-4L4.2 4.5H2Z" fill="url(#glHg)" stroke="#2a0907" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 3h9" stroke="rgba(255,255,255,.7)" stroke-width="1.2" stroke-linecap="round"/></svg></div><div class="gl-cb"><i></i><i class="gl-lines"></i></div></div>
              <i class="gl-ribbon"></i>
            </div>
            {sparks('gl-sp', [(30, -6, 10), (82, -12, 12, -.08), (108, 10, 8, -.15), (4, 16, 8, -.05), (60, -20, 7, -.12), (100, 44, 7, -.2)])}
          </div>
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Glossary<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc"><span class="ptc-long">Queen Walk, Lavaloon and 32 more terms, explained.</span><span class="ptc-short">Clash slang and terms in plain English.</span></p>
      </div>
    </a>
<!-- @@CARDS-END -->
  </div></div>

{open('cards.js.html', encoding='utf-8').read().strip()}
</body>
</html>
'''
open('tool-cards.html', 'w', encoding='utf-8').write(html)
print('ok', len(html))
if '--preview' in sys.argv:  # preview only: leave the live site alone until Adrian signs off
    raise SystemExit

# ---------------- the live site ----------------
# site/tool-cards.css + .js, and the cards spliced into every page in PAGES
# between the TOOL CARDS markers. Paths are root-absolute (U = ''). The
# ?v= on each page's tool-cards links is set to a hash of the two files, so
# a rebuild that changes them busts the cache without a manual bump.
import hashlib
import os
import re
PAGES = ['coc/index.html', 'coc/tools/index.html']
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site')
css = html.split('/* @@CSS */', 1)[1].split('/* @@CSS-END */', 1)[0].strip()
open(os.path.join(SITE, 'tool-cards.css'), 'w', encoding='utf-8', newline='\r\n').write(css + '\n')
js = open('cards.js.html', encoding='utf-8').read().strip()
js = js.removeprefix('<script>').removesuffix('</script>').strip()
open(os.path.join(SITE, 'tool-cards.js'), 'w', encoding='utf-8', newline='\r\n').write(
    '// GENERATED by _tools/tool-cards/build_cards.py (from cards.js.html): edit there, not here.\n' + js + '\n')
cards = html.split('<!-- @@CARDS -->', 1)[1].split('<!-- @@CARDS-END -->', 1)[0].strip('\n')
cards = cards.replace('<img src=', '<img loading="lazy" decoding="async" src=')
ver = hashlib.md5((css + js).encode()).hexdigest()[:8]
block = '<!-- TOOL CARDS: generated by _tools/tool-cards/build_cards.py -->\n    <div class="ptc-wrap"><div class="ptc-grid">\n' + cards + '\n    </div></div>\n    <!-- /TOOL CARDS -->'
for rel in PAGES:
    page = os.path.join(SITE, *rel.split('/'))
    src = open(page, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in src else '\n'
    src, n = re.subn(r'<!-- TOOL CARDS:.*?<!-- /TOOL CARDS -->', lambda m: block.replace('\n', nl), src, flags=re.S)
    assert n == 1, 'TOOL CARDS markers missing in ' + rel
    src, n = re.subn(r'/tool-cards\.(css|js)\?v=[\w.-]*', lambda m: f'/tool-cards.{m[1]}?v={ver}', src)
    assert n == 2, 'tool-cards.css / .js links missing in ' + rel
    open(page, 'w', encoding='utf-8', newline='').write(src)
print('site: tool-cards.css', len(css), 'tool-cards.js', len(js), 'v=' + ver, '->', ', '.join(PAGES))
