# Draws the /articles/ header band: brush streaks + a torn bottom edge (inline SVG).
import random, math
random.seed(11)
W, H, EDGE = 1600, 240, 180          # torn edge sits around y=EDGE (flat, like the reference)
f = lambda v: f'{v:.0f}'

# Bottom edge, modelled on the reference: a flat brush line with long,
# shallow bulges hanging under it; a few bulges have a hairline gap running
# inside them, leaving a thin strand at the bottom. No spikes, no drips.
def base(x):
    return EDGE + 2.5 * math.sin(x / 260) + 1.5 * math.sin(x / 97 + 2)

lobes, x = [], random.uniform(10, 60)
while x < W - 60:
    w = random.uniform(50, 190)
    d = random.uniform(4, 9)
    lobes.append([x, w, d, False])
    x += w + random.uniform(20, 120)
for lb in random.sample(lobes, 6):  # these get the hairline gap
    lb[2], lb[3] = random.uniform(12, 16), True

def bottom(x):
    y = base(x)
    for x0, w, d, _ in lobes:
        if x0 < x < x0 + w:
            t = (x - x0) / w
            y += d * math.sin(math.pi * t) ** 1.4
    return y

pts = [(x, bottom(x)) for x in [i * 8 for i in range(W // 8 + 1)]]
band = 'M0,0 H%d ' % W + ' '.join('L%s,%s' % (f'{x:.0f}', f'{y:.1f}') for x, y in reversed(pts)) + ' Z'
# hairline gaps: thin lenses cut out of the band (evenodd), inside the lobe
for x0, w, d, gap in lobes:
    if not gap:
        continue
    x1, x2 = x0 + w * random.uniform(.22, .32), x0 + w * random.uniform(.68, .78)
    yl = base(x0 + w / 2) + d * .58
    t = random.uniform(1.8, 2.6)
    band += ' M%.0f,%.1f Q%.0f,%.1f %.0f,%.1f Q%.0f,%.1f %.0f,%.1f Z' % (x1, yl, (x1 + x2) / 2, yl - t, x2, yl, (x1 + x2) / 2, yl + t, x1, yl)

def streak(cx, cy, length, width, ang):
    # tapered brush stroke: jagged top and bottom edges, ragged ends
    n = 14
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        taper = math.sin(math.pi * t) ** .6
        w = width * taper * random.uniform(.75, 1.1)
        x = -length / 2 + length * t
        top.append((x + random.uniform(-6, 6), -w / 2 + random.uniform(-3, 3)))
        bot.append((x + random.uniform(-14, 14), w / 2 + random.uniform(-3, 6)))
    pts = top + list(reversed(bot))
    c, s = math.cos(ang), math.sin(ang)
    return 'M' + ' L'.join('%s,%s' % (f(cx + x * c - y * s), f(cy + x * s + y * c)) for x, y in pts) + ' Z'

dark, light, red = [], [], []
for _ in range(44):
    cx, cy = random.uniform(-100, W + 100), random.uniform(-20, EDGE + 10)
    # keep the left (where the text sits on desktop) quieter
    mid = cx < 900 and 30 < cy < 160
    if mid and random.random() < .65:
        continue
    d = streak(cx, cy, random.uniform(160, 520), random.uniform(6, 30) * (.6 if mid else 1), math.radians(random.uniform(-20, -8)))
    r = random.random()
    (dark if r < .6 else light if r < .86 else red).append(d)

svg = f'''<svg class="ah-band-art" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><clipPath id="ahBandClip"><path d="{band}" clip-rule="evenodd"/></clipPath></defs>
      <path d="{band}" fill="#1d1e22" fill-rule="evenodd"/>
      <g clip-path="url(#ahBandClip)">
        <path d="{' '.join(dark)}" fill="#141518"/>
        <path d="{' '.join(light)}" fill="#26272c"/>
        <path d="{' '.join(red)}" fill="#5c1c20" opacity=".75"/>
      </g>
    </svg>'''
print(svg)
