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
FX.append(streak_kf('lrh-st', [44.5], 10))
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

# ---------------- Tier lists (shared by Troop + Equipment) ----------------
# 3 rows (S, A, B) x 3 tiles; tile i = row i // 3, col i % 3. Hover: the board
# clears, then tiles drop in B1, A1, S1, B2 ... S3 -- S fills last and
# celebrates. The loop ends with the board full = the idle state.
TL_ORDER = [6, 3, 0, 7, 4, 1, 8, 5, 2]
TL_T0, TL_STEP = 8, 5.5
tl_land = {}
for k, i in enumerate(TL_ORDER):
    t = TL_T0 + k * TL_STEP
    r = i // 3
    tl_land.setdefault(r, []).append(t + 4)
    FX.append(f"@keyframes tlh-t{i} {{ 0% {{ opacity: 1; transform: none; }} 4% {{ opacity: 0; transform: translateY(-8px); }} "
              f"{f(t)}% {{ opacity: 0; transform: translateY({-(r * 28 + 60)}px); animation-timing-function: cubic-bezier(.55,0,.9,.55); }} {f(t + .4)}% {{ opacity: 1; }} "
              f"{f(t + 4)}% {{ opacity: 1; transform: translateY(0); }} {f(t + 5.2)}% {{ transform: translateY(1px) scale(1.14, .82); }} {f(t + 7)}%, 100% {{ opacity: 1; transform: none; }} }}")
for r, lands in tl_land.items():
    fr = ['0% { filter: brightness(1); transform: none; }']
    for t in lands:
        fr += [f'{f(t - .1)}% {{ filter: brightness(1); transform: none; }}', f'{f(t + .6)}% {{ filter: brightness(1.3); transform: scale(1.12); }}', f'{f(t + 4)}% {{ filter: brightness(1); transform: none; }}']
    FX.append(f"@keyframes tlh-lab{r} {{ {' '.join(fr)} 100% {{ filter: brightness(1); transform: none; }} }}")
TL_WIN = max(tl_land[0])  # S row complete
FX.append(streak_kf('tlh-st', [TL_WIN], 10))
FX.append(f"@keyframes tlh-rays {{ 0%, {f(TL_WIN)}% {{ opacity: 0; transform: scale(.4); }} {f(TL_WIN + 4)}% {{ opacity: 1; transform: scale(1.08); }} 80% {{ opacity: .5; transform: scale(1); }} 92%, 100% {{ opacity: 0; transform: scale(1); }} }}")
FX.append(f"@keyframes tlh-srow {{ 0%, {f(TL_WIN)}% {{ box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 2px 0 rgba(0,0,0,.45); background-color: var(--well); }} "
          f"{f(TL_WIN + 1.5)}% {{ box-shadow: inset 0 0 0 1px rgba(224,99,99,.9), 0 0 18px rgba(224,99,99,.55); background-color: rgba(224,99,99,.32); }} "
          f"80% {{ box-shadow: inset 0 0 0 1px rgba(224,99,99,.45), 0 0 10px rgba(224,99,99,.2); background-color: rgba(224,99,99,.12); }} 94%, 100% {{ box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 2px 0 rgba(0,0,0,.45); background-color: var(--well); }} }}")
FX.append(f"@keyframes tlh-glint {{ 0%, {f(TL_WIN + 1)}% {{ transform: translateX(0) skewX(-18deg); opacity: 0; }} {f(TL_WIN + 2)}% {{ opacity: 1; }} {f(TL_WIN + 14)}% {{ transform: translateX(520%) skewX(-18deg); opacity: 1; }} {f(TL_WIN + 15)}%, 100% {{ opacity: 0; transform: translateX(520%) skewX(-18deg); }} }}")


def tl_board(tiles, kind):
    """tiles: 9 (src, class) in reading order S1..S3, A1..A3, B1..B3"""
    rows = ''.join(f'<div class="tl-row tl-r{r}"><b class="tl-lab">{"SAB"[r]}</b></div>' for r in range(3))
    t = ''.join(f'<span class="tl-tile tl-t{i} {c}" style="left:{26 + (i % 3) * 25}px;top:{1 + (i // 3) * 28}px"><img src="{s}" alt=""></span>' for i, (s, c) in enumerate(tiles))
    return (f'<div class="tl-board tl-{kind}"><div class="fx-rays tl-rays"></div>{rows}{t}<i class="tl-glint"></i>'
            f'{streaks("tl-st", 12, 10, 12, 44, seed=11, length=9)}</div>')


UN = f'{U}/clashofclans/coctools/units/'
troop_board = tl_board([(UN + n + '.webp', '') for n in ['rocket-balloon', 'super-minion', 'healer', 'yeti', 'headhunter', 'ice-golem', 'archer', 'minion', 'wall-breaker']], 'troop')

# ---------------- Glossary: an open book ----------------
# One leaf flips per term. Before flip k the leaf shows term k and the page
# under it already shows term k+1; when the leaf lands on the left (its back
# looks like the left page) it jumps home showing k+1 -- invisible, so the
# book seems to turn forever. Idle 12s (4s a term), hover 2.4s.
GL_TERMS = ['Queen Walk', 'Lavaloon', 'Funneling']


def gl_kf(p, flips, dur):
    ends = [a + dur for a in flips]
    leaf = ['0% { transform: rotateY(0deg); }']
    shade = ['0% { opacity: 0; }']
    for a, e in zip(flips, ends):
        leaf += [f'{f(a)}% {{ transform: rotateY(0deg); animation-timing-function: cubic-bezier(.45,.05,.35,1); }}', f'{f(e)}% {{ transform: rotateY(-180deg); }}', f'{f(e + .03)}% {{ transform: rotateY(0deg); }}']
        shade += [f'{f(a)}% {{ opacity: 0; }}', f'{f(a + dur * .5)}% {{ opacity: 1; }}', f'{f(e)}% {{ opacity: 0; }}']
    out = [f"@keyframes {p}-leaf {{ {' '.join(leaf)} 100% {{ transform: rotateY(0deg); }} }}", f"@keyframes {p}-shade {{ {' '.join(shade)} 100% {{ opacity: 0; }} }}"]
    # which term each face shows: leaf = k until flip k lands, page = k + 1.
    # The leaf swaps while it faces away (last third of its turn); the page
    # swaps just after the leaf is home again covering it.
    for face, off, sw in (('lt', 0, [e - dur * .3 for e in ends]), ('pt', 1, [e + .1 for e in ends])):
        b = [0] + sw + [100]
        for k in range(3):
            fr = []
            for s in range(len(b) - 1):
                on = 1 if (s + off) % 3 == k else 0
                fr += [f'{f(b[s])}% {{ opacity: {on}; }}', f'{f(b[s + 1] - .05 if b[s + 1] < 100 else 100)}% {{ opacity: {on}; }}']
            out.append(f"@keyframes {p}-{face}{k} {{ {' '.join(fr)} }}")
    return out


FX += gl_kf('gli', [18, 51.33, 84.67], 7)
FX += gl_kf('glh', [8, 41.33, 74.67], 14)
FX.append(ember_kf('glh-em', [22, 55.33, 88.67], 11, -14))
# per-element animation rules (plain CSS, one per tile / row / term)
for i in range(9):
    FX.append(f'.tl-go .tl-t{i} {{ animation: tlh-t{i} 3.2s linear infinite; }}')
for k, i in enumerate([2, 4, 7]):  # idle: one tile hops in its slot now and then
    a = 14 + k * 30
    FX.append(f"@keyframes tli-hop{i} {{ 0%, {a}% {{ transform: none; }} {a + 2}% {{ transform: translateY(-7px); }} {a + 4}% {{ transform: translateY(0) scale(1.12, .85); }} {a + 6}%, 100% {{ transform: none; }} }}")
    FX.append(f'.tl-t{i} {{ animation: tli-hop{i} 8s ease-out infinite; }}')
for r in range(3):
    FX.append(f'.tl-go .tl-r{r} .tl-lab {{ animation: tlh-lab{r} 3.2s ease-out infinite; }}')
FX.append('.tl-go .tl-r0 { animation: tlh-srow 3.2s ease-out infinite; }')
for face in ('lt', 'pt'):
    for k in range(3):
        FX.append(f'.gl-{face}{k} {{ animation: gli-{face}{k} 12s linear infinite; }}')
        FX.append(f'.gl-go .gl-{face}{k} {{ animation: glh-{face}{k} 2.4s linear infinite; }}')
fx_css = '\n'.join(FX)

# ---------------- Leaderboards: "You" climbs ----------------
# Rank numbers are fixed slots (1-4); the rows move between them like a real
# board. Faceless rows A, B, C sit at 1-3, "You" at 4. Each beat: You goes
# up one slot while the row it passes drops one. P = row pitch (px).
P = 28


def lr_kf(name, moves, reset):
    """moves: {row: [(start%, end%, slots)]} -> one keyframes block per row;
    the rows jump home at reset% while the list is faded out"""
    out = []
    for row, steps in moves.items():
        fr, y = ['0% { transform: translateY(0); }'], 0
        for a, b, d in steps:
            fr += [f'{f(a)}% {{ transform: translateY({y}px); }}']
            y += d * P
            fr += [f'{f(b)}% {{ transform: translateY({y}px); }}']
        if reset:
            fr += [f'{f(reset)}% {{ transform: translateY({y}px); }}', f'{f(reset + .5)}%, 100% {{ transform: translateY(0); }}']
        else:
            fr += ['100% { transform: translateY(0); }']
        out.append(f"@keyframes {name}-{row} {{ {' '.join(fr)} }}")
    return out


# idle 8s: You swaps up with C, holds, swaps back
L = lr_kf('lri', {'you': [(25, 31, -1), (62, 68, 1)], 'c': [(25, 31, 1), (62, 68, -1)]}, None)
# hover 3s: three beats 4 -> 3 -> 2 -> 1, hold on #1, fade, jump home, fade in
L += lr_kf('lrh', {'you': [(12, 20, -1), (24, 32, -1), (36, 44, -1)], 'c': [(12, 20, 1)], 'b': [(24, 32, 1)], 'a': [(36, 44, 1)]}, 85)
lr_kf_css = '\n'.join(L)

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tool cards</title>
<base href="http://localhost:8765/">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Oxanium:wght@500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ min-height: 100vh; padding: 72px 7%; background: #0a0a0b; color: #eff1f4; font-family: 'Oxanium', sans-serif; -webkit-font-smoothing: antialiased; }}
h2 {{ font: 900 37px/1.1 'Orbitron', sans-serif; letter-spacing: -.5px; text-transform: uppercase; }}
.sub {{ margin: 10px 0 32px; font-size: 15px; color: #b5b8c0; }}
/* @@CSS */
/* ===================================================================
   PARCHROME TOOL CARDS (ptc-) -- the /coc/ "Parchrome tools" band.
   GENERATED by _tools/tool-cards/build_cards.py: edit there, not here.
   Each card is a raised-UI box; the art is a right-hand column drawn at
   160px tall and scaled down by --s (so every animation keeps the
   geometry it was designed at), the copy takes the rest.
   The box is the same neutral raised-UI box on every card: a card's colour
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
  display: grid; grid-template-columns: 1fr; gap: 10px;
}}
/* columns follow the band's own width (the /coc/ sidebar eats 245px), not the
   window's: 1 -> 2 (4 x 2) -> 3 (3 + 3 + 2; the last slot is left empty, Adrian's call) */
.ptc-wrap {{ container-type: inline-size; }}
@container (min-width: 620px) {{ .ptc-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }} }}
@container (min-width: 960px) {{ .ptc-grid {{ grid-template-columns: repeat(3, minmax(0, 1fr)); }} }}
.ptc {{ --art-w: 150px; --s: .75; --well-w: 136px; position: relative; isolation: isolate; display: flex; align-items: center;
  min-height: 122px; padding: 15px calc(var(--well-w) + 18px) 15px 20px; overflow: hidden;
  border: 2px solid var(--edge); border-radius: var(--r); background: var(--box); box-shadow: var(--shadow); font-family: 'Oxanium', sans-serif;
  color: #eff1f4; text-decoration: none; transition: background-color .25s, box-shadow .25s; }}
.ptc:hover {{ background: var(--box-h); box-shadow: var(--shadow-h); }}
.ptc:focus-visible {{ outline: 2px solid #e6e8ec; outline-offset: 3px; }}
.ptc-copy {{ position: relative; z-index: 2; }}
/* the hover arrow takes no width (margin-right cancels it), so it never makes a title wrap */
.ptc-name {{ font: 700 16px/1.2 'Oxanium', sans-serif; }}
.ptc-name svg {{ display: inline-block; vertical-align: -2px; margin: 0 -21px 0 6px; width: 15px; height: 15px; fill: none; stroke: #858a92; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; opacity: 0; transform: translateX(-4px); transition: .25s cubic-bezier(.22,1,.36,1); }}
.ptc:hover .ptc-name svg, .ptc:focus-visible .ptc-name svg {{ opacity: 1; transform: none; stroke: #fff; }}
.ptc-desc {{ margin-top: 5px; font-size: 13px; line-height: 1.45; color: #b5b8c0; }}
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
   LEADERBOARDS (lr-; lb- is taken on the live site). A slim board: rank
   slots 1-4 on the left, rows that move between them. Three faceless rows
   and one "You" row -- no names, no scores, so nothing on it can be false.
   Rows wear the game's league-panel blue (Adrian: "game coloured rows"),
   ranks 1-3 are gold / silver / bronze, and You is a brighter blue key.
   Idle (8s): You nudges up past #3 (a green arrow), holds, slips back.
   Hover / focus (.lr-go, 3s): You climbs 4 -> 3 -> 2 -> 1, each row it
   passes drops a place, #1 flashes gold; the list fades, resets, fades in.
   =================================================================== */
.ptc-lr {{ --art-w: 150px; }}
.lr-glow {{ position: absolute; right: 0; top: -20px; width: 150px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(232,182,76,.15), rgba(232,182,76,.04) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; transition: filter .6s; }}
.lr-go .lr-glow {{ filter: brightness(1.5); }}
.lr-board {{ position: absolute; right: 14px; top: 22px; width: 122px; height: 106px; }}
.lr-ranks span {{ position: absolute; left: 0; width: 12px; height: 22px; display: grid; place-items: center; font: 800 10px/1 'Sora', sans-serif; color: #7d86a8; }}
.lr-ranks span:nth-child(1) {{ top: 0; color: #e8b64c; }}
.lr-ranks span:nth-child(2) {{ top: 28px; color: #c9d2e0; }}
.lr-ranks span:nth-child(3) {{ top: 56px; color: #d4874a; }}
.lr-ranks span:nth-child(4) {{ top: 84px; }}
.lr-rows {{ position: absolute; left: 18px; right: 0; top: 0; bottom: 0; }}
.lr-go .lr-rows {{ animation: lrh-fade 3s linear infinite; }}
/* a league-panel row: indigo-blue, a light top edge, a dark ledge under it */
.lr-row {{ position: absolute; left: 0; right: 0; height: 22px; display: flex; align-items: center; gap: 6px; padding: 0 7px; border-radius: 4px;
  background-color: #34407c; background-image: linear-gradient(rgba(255,255,255,.1), rgba(0,0,0,.14));
  box-shadow: inset 0 0 0 1px rgba(150,170,255,.16), inset 0 1px 0 rgba(255,255,255,.2), 0 2px 0 #10132a; }}
.lr-row i {{ display: block; height: 5px; border-radius: 3px; background: rgba(205,215,255,.32); }}
.lr-row .lr-name {{ width: 40%; }}
.lr-row .lr-score {{ width: 18%; margin-left: auto; }}
.lr-a {{ top: 0; }} .lr-b {{ top: 28px; }} .lr-c {{ top: 56px; }}
/* You: the brighter blue key, above the rows it passes */
.lr-you {{ --you: #3d86e6; top: 84px; z-index: 2; background-color: var(--you); box-shadow: var(--ring-btn), 0 6px 12px -6px rgba(0,0,0,.8); }}
.lr-you b {{ font: 700 10.5px/1 'Oxanium', sans-serif; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.45); }}
.lr-you .lr-score {{ background: rgba(255,255,255,.6); }}
.lr-up {{ font: 700 8px/1 'Sora', sans-serif; color: #6fc531; opacity: 0; }}
.lr-c {{ animation: lri-c 8s ease-in-out infinite; }}
.lr-you {{ animation: lri-you 8s ease-in-out infinite; }}
.lr-you .lr-up {{ animation: lri-up 8s linear infinite; }}
.lr-go .lr-a {{ animation: lrh-a 3s ease-in-out infinite; }}
.lr-go .lr-b {{ animation: lrh-b 3s ease-in-out infinite; }}
.lr-go .lr-c {{ animation: lrh-c 3s ease-in-out infinite; }}
.lr-go .lr-you {{ animation: lrh-you 3s ease-in-out infinite, lrh-gold 3s ease-out infinite; }}
.lr-go .lr-you .lr-up {{ animation: lrh-up 3s linear infinite; }}
.lr-go .lr-ranks span:nth-child(1) {{ animation: lrh-one 3s ease-out infinite; }}
@keyframes lri-up {{ 0%, 24% {{ opacity: 0; }} 27%, 40% {{ opacity: 1; }} 46%, 100% {{ opacity: 0; }} }}
@keyframes lrh-up {{ 0%, 11% {{ opacity: 0; }} 14%, 44% {{ opacity: 1; }} 50%, 100% {{ opacity: 0; }} }}
@keyframes lrh-gold {{ 0%, 11% {{ background-color: var(--you); box-shadow: var(--ring-btn), 0 6px 12px -6px rgba(0,0,0,.8); }}
  15%, 42% {{ background-color: var(--you); box-shadow: var(--ring-btn), 0 0 16px rgba(111,197,49,.55); }}
  44% {{ background-color: var(--you); box-shadow: var(--ring-btn), 0 0 10px rgba(243,200,90,.4); }} 47% {{ background-color: #e0ad3a; box-shadow: var(--ring-btn), 0 0 24px rgba(243,200,90,.95); }}
  58%, 82% {{ background-color: #b8862a; box-shadow: var(--ring-btn), 0 0 12px rgba(243,200,90,.35); }} 85%, 100% {{ background-color: var(--you); box-shadow: var(--ring-btn), 0 6px 12px -6px rgba(0,0,0,.8); }} }}
@keyframes lrh-one {{ 0%, 44% {{ color: #e8b64c; text-shadow: none; }} 47% {{ color: #fff3cf; text-shadow: 0 0 8px rgba(232,182,76,.9); }} 60%, 100% {{ color: #e8b64c; text-shadow: none; }} }}
@keyframes lrh-fade {{ 0%, 80% {{ opacity: 1; }} 84%, 87% {{ opacity: 0; }} 94%, 100% {{ opacity: 1; }} }}
{lr_kf_css}

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
{fx_css}

/* Player Tracker extras: the reel blurs at speed (in plh-reel); on landing
   gold rays open behind the badge and streaks burst off it */
.pl-rays {{ --rc: 255,190,90; left: -33px; top: -19px; width: 150px; height: 150px; }}
.pl-go .pl-rays {{ animation: plh-rays 2.8s ease-out infinite; }}
.pl-st {{ --c: #ffd98a; }}
.pl-go .pl-st {{ animation: plh-st 2.8s ease-out infinite; }}
@keyframes plh-rays {{ 0%, 56% {{ opacity: 0; transform: scale(.5); }} 60% {{ opacity: 1; transform: scale(1.08); }} 78% {{ opacity: .55; transform: scale(1); }} 92%, 100% {{ opacity: 0; transform: scale(1); }} }}

/* Leaderboards extras: You glows green while it climbs; at #1 a crown
   drops onto the row, gold rays open behind it and streaks burst */
.lr-rays {{ --rc: 243,200,90; left: 0; top: -59px; width: 140px; height: 140px; }}
.lr-go .lr-rays {{ animation: lrh-rays 3s ease-out infinite; }}
.lr-st {{ --c: #ffe08a; z-index: 3; }}
.lr-go .lr-st {{ animation: lrh-st 3s ease-out infinite; }}
.lr-crown {{ position: absolute; left: -7px; top: -10px; width: 17px; height: 12px; opacity: 0; transform-origin: 50% 100%; overflow: visible; }}
.lr-go .lr-crown {{ animation: lrh-crown 3s cubic-bezier(.2,1.4,.4,1) infinite; }}
@keyframes lrh-crown {{ 0%, 45% {{ opacity: 0; transform: translateY(-16px) rotate(-50deg) scale(.4); }} 50% {{ opacity: 1; transform: translateY(0) rotate(-20deg) scale(1.25); }}
  55%, 82% {{ opacity: 1; transform: rotate(-20deg) scale(1); }} 85%, 100% {{ opacity: 0; transform: rotate(-20deg) scale(1); }} }}
@keyframes lrh-rays {{ 0%, 44% {{ opacity: 0; transform: scale(.4); }} 49% {{ opacity: 1; transform: scale(1.1); }} 75% {{ opacity: .5; transform: scale(1); }} 84%, 100% {{ opacity: 0; transform: scale(1); }} }}

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
   TIER LIST (tl-): the Clash Tier List card (troop and equipment lists are being merged into one).
   S / A / B rows in the tier maker's own colours (PAL in coc-tierlist.js).
   Idle (8s): the board is full; now and then one tile hops in its slot.
   Hover / focus (.tl-go, 3.2s): the board clears and the tiles drop in
   (B, A, S, B, A, S ...), each landing squashes and lights its row's
   label; S fills last: the row glows red, rays and streaks burst from
   the S label and a glint runs across it. Ends full = the idle board.
   =================================================================== */
.ptc-tl {{ --art-w: 136px; }}
.tl-glow {{ position: absolute; right: -8px; top: 14px; width: 140px; height: 140px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(224,99,99,.14), rgba(224,99,99,.04) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; transition: filter .6s; }}
.tl-go .tl-glow {{ filter: brightness(1.6); }}
.tl-board {{ position: absolute; right: 14px; top: 30px; width: 108px; height: 80px; }}
.tl-row {{ position: absolute; left: 22px; right: 0; height: 24px; border-radius: 4px; background-color: var(--well); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 2px 0 rgba(0,0,0,.45); }}
.tl-r0 {{ top: 0; --tl: 224, 99, 99; }} .tl-r1 {{ top: 28px; --tl: 230, 140, 64; }} .tl-r2 {{ top: 56px; --tl: 222, 190, 72; }}
.tl-lab {{ position: absolute; left: -22px; top: 0; width: 20px; height: 24px; display: grid; place-items: center; border-radius: 4px;
  background: rgb(var(--tl)); box-shadow: inset 0 0 0 1.5px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.28); font: 800 12px/1 'Oxanium', sans-serif; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.45); }}
.tl-r0 .tl-lab {{ animation: tli-s 4s ease-in-out infinite; }}
.tl-tile {{ position: absolute; width: 22px; height: 22px; z-index: 2; border-radius: 4px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,.6), 0 2px 3px rgba(0,0,0,.4); }}
.tl-tile img {{ display: block; width: 100%; height: 100%; }}
.tl-rays {{ --rc: 255,160,130; left: -64px; top: -63px; width: 150px; height: 150px; }}
.tl-go .tl-rays {{ animation: tlh-rays 3.2s ease-out infinite; }}
.tl-st {{ --c: #ffc7b0; z-index: 3; }}
.tl-go .tl-st {{ animation: tlh-st 3.2s ease-out infinite; }}
.tl-glint {{ position: absolute; left: 22px; top: 0; width: 20px; height: 24px; z-index: 3; pointer-events: none; opacity: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent); }}
.tl-go .tl-glint {{ animation: tlh-glint 3.2s ease-out infinite; }}
@keyframes tli-s {{ 0%, 100% {{ box-shadow: inset 0 0 0 1.5px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.28); }} 50% {{ box-shadow: inset 0 0 0 1.5px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.28), 0 0 12px rgba(224,99,99,.55); }} }}

/* ===================================================================
   GLOSSARY (gl-). A red-and-gold book (the Book of Everything's colours)
   lies open, tilted toward you. One leaf turns at a time; the right page
   names the term: Queen Walk -> Lavaloon -> Funneling (all three are real
   entries in coc-glossary.json). The turning leaf casts a shadow on the
   page under it. Idle: a turn every 4s. Hover / focus (.gl-go, 2.4s):
   fast turns, the book lifts, rays open behind it and gold motes rise
   off each page as it lands.
   =================================================================== */
.ptc-gl {{ --art-w: 136px; }}
.gl-glow {{ position: absolute; right: -10px; top: 8px; width: 150px; height: 150px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,190,110,.17), rgba(255,190,110,.04) 60%, transparent); animation: dc-glow 5s ease-in-out infinite; transition: filter .6s; }}
.gl-go .gl-glow {{ filter: brightness(1.6); }}
.gl-rays {{ --rc: 255,205,130; right: -7px; top: 4px; width: 150px; height: 150px; transition: opacity .6s; }}
.gl-go .gl-rays {{ opacity: .75; }}
.gl-stage {{ position: absolute; right: 12px; top: 42px; width: 112px; height: 72px; perspective: 420px; }}
.gl-book {{ position: absolute; inset: 0; transform: rotateX(30deg); transform-style: preserve-3d; transform-origin: 50% 100%; transition: transform .6s cubic-bezier(.22,1,.36,1); }}
.gl-go .gl-book {{ transform: rotateX(22deg) translateY(-5px); }}
.gl-cover {{ position: absolute; inset: -4px -5px -6px; border-radius: 4px; background: linear-gradient(#a3342b, #7a231d);
  box-shadow: inset 0 0 0 1.5px #d9a441, inset 0 0 0 3px #5e1a15, 0 16px 18px -8px rgba(0,0,0,.85); }}
.gl-page {{ position: absolute; top: 0; width: 56px; height: 72px; overflow: hidden; }}
.gl-pl {{ left: 0; border-radius: 3px 0 0 3px; background: linear-gradient(90deg, #f3e8cb, #e6d6ae 86%, #c9b484); box-shadow: -1px 1px 0 #d8c79f, -2px 2px 0 #b9a77c; }}
.gl-pr {{ left: 56px; border-radius: 0 3px 3px 0; background: linear-gradient(90deg, #c9b484, #e6d6ae 14%, #f6ecd2); box-shadow: 1px 1px 0 #d8c79f, 2px 2px 0 #b9a77c; }}
.gl-lines {{ position: absolute; left: 8px; right: 8px; top: 34px; height: 30px; background: repeating-linear-gradient(transparent 0 4px, rgba(90,66,36,.28) 4px 5.5px);
  -webkit-mask: linear-gradient(90deg, #000 60%, transparent 98%); mask: linear-gradient(90deg, #000 60%, transparent 98%); }}
.gl-pl .gl-lines, .gl-back .gl-lines {{ top: 12px; height: 52px; }}
.gl-term {{ position: absolute; left: 4px; right: 4px; top: 8px; text-align: center; font: 800 10px/1.12 'Oxanium', sans-serif; color: #3b2a17; opacity: 0; }}
.gl-term::after {{ content: ""; display: block; width: 18px; height: 1.5px; margin: 4px auto 0; background: #b0402f; }}
.gl-lt0, .gl-pt1 {{ opacity: 1; }}
.gl-shade {{ position: absolute; inset: 0; background: linear-gradient(90deg, rgba(40,25,10,.5), rgba(40,25,10,0) 75%); opacity: 0; pointer-events: none; }}
.gl-pr .gl-shade {{ animation: gli-shade 12s linear infinite; }}
.gl-go .gl-pr .gl-shade {{ animation: glh-shade 2.4s linear infinite; }}
.gl-leaf {{ position: absolute; left: 56px; top: 0; width: 56px; height: 72px; transform-origin: 0 50%; transform-style: preserve-3d; animation: gli-leaf 12s linear infinite; }}
.gl-go .gl-leaf {{ animation: glh-leaf 2.4s linear infinite; }}
.gl-face {{ position: absolute; inset: 0; left: 0; -webkit-backface-visibility: hidden; backface-visibility: hidden; }}
.gl-front {{ border-radius: 0 3px 3px 0; background: linear-gradient(90deg, #d4c194, #ebdcb6 14%, #f7eed6); }}
.gl-back {{ transform: rotateY(180deg); border-radius: 3px 0 0 3px; background: linear-gradient(90deg, #f3e8cb, #e6d6ae 86%, #c9b484); }}
.gl-front .gl-shade {{ background: linear-gradient(270deg, rgba(40,25,10,.35), rgba(40,25,10,0)); animation: gli-shade 12s linear infinite; }}
.gl-go .gl-front .gl-shade {{ animation: glh-shade 2.4s linear infinite; }}
.gl-ribbon {{ position: absolute; left: 53px; top: 64px; width: 6px; height: 20px; background: linear-gradient(#e4b14d, #b98a2c); transform-origin: 50% 0;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); animation: gl-sway 4s ease-in-out infinite; }}
.gl-em {{ --c: #ffd98a; z-index: 3; }}
.gl-go .gl-em {{ animation: glh-em 2.4s ease-out infinite; }}
@keyframes gl-sway {{ 0%, 100% {{ transform: rotate(-4deg); }} 50% {{ transform: rotate(5deg); }} }}

@media (prefers-reduced-motion: reduce) {{
  .pl-art {{ --lx: 40px; --ly: 52px; }}
  .ptc-art, .ptc-art * {{ animation: none !important; }}
  .ptc-layer {{ transition: none; }}
}}

@media (max-width: 760px) {{
  .ptc {{ --s: .74; --well-w: 128px; min-height: 118px; padding: 14px calc(var(--well-w) + 14px) 14px 16px; }}
  .ptc-name {{ font-size: 15px; }}
  .ptc-desc {{ font-size: 12.5px; }}
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
    <a class="ptc ptc-army" href="{U}/coc/tools/army-maker">
      <div class="ptc-art am-art" data-go="am-go" data-clock="amh-camp" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="am-light"></div><i class="am-mote"></i><i class="am-mote"></i><i class="am-mote"></i></div>
        <div class="ptc-layer ptc-mid"><div class="am-ring"></div><div class="am-camp"><img src="{U}/clashofclans/coctools/army-camp.webp" alt=""></div></div>
        <div class="ptc-layer ptc-near"><img class="am-t am-t0" src="{U}/clashofclans/coctools/units/rocket-balloon.webp" alt=""><img class="am-t am-t1" src="{U}/clashofclans/coctools/units/super-minion.webp" alt=""><img class="am-t am-t2" src="{U}/clashofclans/coctools/units/healer.webp" alt=""></div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Army Maker<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc">Build an army for TH8 to TH18 and open it straight in the game.</p>
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
        <p class="ptc-desc">See what your spells and equipment leave of any building.</p>
      </div>
    </a>

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
        <div class="ptc-name">Player Tracker<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc">Look up any player or clan by tag.</p>
      </div>
    </a>
    <a class="ptc ptc-lr" href="{U}/coc/tools/leaderboards">
      <div class="ptc-art lr-art" data-go="lr-go" data-clock="lrh-fade" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="lr-glow"></div></div>
        <div class="ptc-layer ptc-mid">
          <div class="lr-board">
            <div class="fx-rays lr-rays"></div>
            <div class="lr-ranks"><span>1</span><span>2</span><span>3</span><span>4</span></div>
            <div class="lr-rows">
              <div class="lr-row lr-a"><i class="lr-name"></i><i class="lr-score"></i></div>
              <div class="lr-row lr-b"><i class="lr-name" style="width:52%"></i><i class="lr-score"></i></div>
              <div class="lr-row lr-c"><i class="lr-name" style="width:34%"></i><i class="lr-score"></i></div>
              <div class="lr-row lr-you"><svg class="lr-crown" viewBox="0 0 20 14"><path d="M1.5 12.5 L2.5 3 L7 7.5 L10 1.5 L13 7.5 L17.5 3 L18.5 12.5 Z" fill="#f3c44e" stroke="#060708" stroke-width="1.6" stroke-linejoin="round"/></svg><b>You</b><span class="lr-up">▲</span><i class="lr-score"></i></div>
            </div>
            {streaks('lr-st', 14, 70, 11, 50, seed=4, length=12)}
          </div>
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Leaderboards<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc">Today’s top 200 in the Philippines and the world.</p>
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
        <p class="ptc-desc">Wall costs, including Gold Pass and Hammer Jam savings.</p>
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
        <div class="ptc-name">Equipment<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc">Stats, ore costs, and tips for all 42 hero items.</p>
      </div>
    </a>

    <a class="ptc ptc-tl" href="{U}/coc/tools/tier-list">
      <div class="ptc-art tl-art" data-go="tl-go" data-clock="tlh-t0" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="tl-glow"></div></div>
        <div class="ptc-layer ptc-mid">{troop_board}</div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Clash Tier List<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc">Rank anything in Clash from S to F and share your list.</p>
      </div>
    </a>

    <a class="ptc ptc-gl" href="{U}/coc/tools/slang">
      <div class="ptc-art gl-art" data-go="gl-go" data-clock="glh-leaf" aria-hidden="true">
        <div class="ptc-layer ptc-far"><div class="gl-glow"></div><div class="fx-rays gl-rays"></div></div>
        <div class="ptc-layer ptc-mid">
          <div class="gl-stage">
            <div class="gl-book">
              <div class="gl-cover"></div>
              <div class="gl-page gl-pl"><i class="gl-lines"></i></div>
              <div class="gl-page gl-pr">{''.join(f'<b class="gl-term gl-pt{k}">{t}</b>' for k, t in enumerate(GL_TERMS))}<i class="gl-lines"></i><i class="gl-shade"></i></div>
              <div class="gl-leaf">
                <div class="gl-face gl-front">{''.join(f'<b class="gl-term gl-lt{k}">{t}</b>' for k, t in enumerate(GL_TERMS))}<i class="gl-lines"></i><i class="gl-shade"></i></div>
                <div class="gl-face gl-back"><i class="gl-lines"></i></div>
              </div>
              <i class="gl-ribbon"></i>
            </div>
            {embers('gl-em', 10, 84, 22, 26, 44, seed=12)}
          </div>
        </div>
      </div>
      <div class="ptc-copy">
        <div class="ptc-name">Glossary<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
        <p class="ptc-desc">Queen Walk, Lavaloon, and 32 more terms in plain English.</p>
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
