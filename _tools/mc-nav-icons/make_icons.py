"""Minecraft top-bar group icons (Nov 2 2026, Adrian): original 16x16 pixel art, not game sprites.
  site/minecrafticons/nav-groups/lobby.png      signpost crossroads
  site/minecrafticons/nav-groups/resources.png  explorer backpack (map roll + bottle)
  site/minecrafticons/nav-groups/tools.png      crossed wrench + hammer
  site/minecrafticons/nav-groups/spin-offs.png  game cartridge
Drawn at 16x16, saved 32x32 with every pixel doubled (crisp at the bar's ~18px on 2x screens).
Run: python _tools/mc-nav-icons/make_icons.py [preview.png]  -> also writes an 8x preview sheet.
"""
import os
import sys

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'site', 'minecrafticons', 'nav-groups')
K = (26, 20, 16, 255)  # outline

PAL = {
    # wood / text
    'W': '#c99456', 'w': '#a0703a', 'd': '#6e4520', 't': '#3d2712',
    # grass
    'g': '#6cc04a', 'G': '#3f8a2c',
    # backpack
    'p': '#efdfae', 'P': '#c4a96a', 'r': '#c23b2e', 'c': '#b07a3e', 'v': '#8fe0f2', 'V': '#3f8fb0',
    'h': '#5a3418', 'L': '#6b3c1a', 'l': '#b5773d', 'm': '#8c5428', 'y': '#f5c542', 'Y': '#a87b1c', 's': '#d49a5a',
    # cartridge
    'B': '#7d8396', 'b': '#585d6d', 'D': '#363a45', 'k': '#2b2f36', 'u': '#62b9ff', 'n': '#8d5a2b',
    # metal (tools)
    '1': '#e3e7ed', '2': '#a4acb7', '3': '#69717d',
}

SIGNPOST = """
................
................
.....WWWWWWWW...
.....wtwttwtww..
.....dddddddd...
.......Wd.......
...WWWWWWWW.....
..wwttwtttw.....
...dddddddd.....
.......Wd.......
.......Wd.......
.......Wd.......
.......Wd.......
....gGgWdgGg....
...gGGGGGGGGg...
................
"""

BACKPACK = """
................
...pP......cc...
...pP......vV...
...rr.hhhh.vV...
...pP.h__h.vV...
...LLLLLLLLLL...
..LLLLLLLLLLLL..
..LLLLLLLLLLLL..
..lLLLLLLLLLLm..
..llLLLLLLLLmm..
..lllLLyyLLlmm..
..lllllYYllllm..
..lssssssssssm..
...mmmmmmmmmm...
................
................
"""

CARTRIDGE = """
................
..BBBBBBBBBB....
..BbDbDbDbDbD...
..BbDbDbDbDbbD..
..BbbbbbbbbbbD..
..BbppppppppbD..
..BbpuuuuyypbD..
..BbpuuGuuupbD..
..BbpGGGuggpbD..
..BbpnnnnnnpbD..
..BbppppppppbD..
..BbbbbbbbbbbD..
..DDDDDDDDDDDD..
....yYyYyYyY....
................
................
"""


def hexrgba(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def from_map(art):
    rows = art.strip('\n').split('\n')
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    grid = [[None] * 16 for _ in range(16)]
    keep_clear = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '_':
                keep_clear.add((x, y))
            elif ch != '.':
                grid[y][x] = hexrgba(PAL[ch])
    return grid, keep_clear


def tools():
    grid = [[None] * 16 for _ in range(16)]
    c = lambda k: hexrgba(PAL[k])
    # hammer: head band across the top-left corner, handle down to the bottom-right. Shifted 1px down-left
    # (Adrian picked it) so both tools cross at their middles; the edge rows stay free for the outline.
    for y in range(1, 15):
        for x in range(1, 15):
            s, d = (x + 1) + (y - 1), (x + 1) - (y - 1)
            if 5 <= s <= 8 and abs(d) <= 4:
                grid[y][x] = c({5: '1', 6: '2', 7: '2', 8: '3'}[s])
            elif d in (0, 1) and 9 <= s <= 25:
                grid[y][x] = c('W' if d == 0 else 'd')
    # wrench, drawn on top. a = x-y runs along it (up-right), b = x+y across it. Handle = lanes b 14-15;
    # head = lanes b 11-18 for a 2..6 with a slot (b 13-16) cut past a 3, corners rounded off.
    wrench = {}
    for y in range(16):
        for x in range(16):
            a, b = x - y, x + y
            head = 11 <= b <= 18 and 2 <= a <= 6 and not (13 <= b <= 16 and a > 3) and not (a in (2, 6) and b in (11, 18))
            if head or (b in (14, 15) and a < 2 and x >= 2):
                wrench[(x, y)] = c('1' if b <= 12 or (b == 14 and not head) else '2' if b <= 16 else '3')
    for (x, y) in wrench:  # dark seam where the wrench crosses the hammer
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < 16 and 0 <= ny < 16 and (nx, ny) not in wrench and grid[ny][nx]:
                grid[ny][nx] = K
    for (x, y), col in wrench.items():
        grid[y][x] = col
    return grid, set()


def outline(grid, keep_clear):
    out = [row[:] for row in grid]
    for y in range(16):
        for x in range(16):
            if grid[y][x] or (x, y) in keep_clear:
                continue
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < 16 and 0 <= ny < 16 and grid[ny][nx] and grid[ny][nx] != K:
                    out[y][x] = K
                    break
    return out


def to_image(grid, scale):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            if grid[y][x]:
                im.putpixel((x, y), grid[y][x])
    return im.resize((16 * scale, 16 * scale), Image.NEAREST)


ICONS = {
    'lobby': from_map(SIGNPOST),
    'resources': from_map(BACKPACK),
    'tools': tools(),
    'spin-offs': from_map(CARTRIDGE),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    finals = {}
    for name, (grid, clear) in ICONS.items():
        finals[name] = outline(grid, clear)
        to_image(finals[name], 2).save(os.path.join(OUT, name + '.png'), optimize=True)
    if len(sys.argv) > 1:  # preview: 8x art on the bar's dark grey, then colour + greyed at 32px
        sheet = Image.new('RGBA', (4 * 150 + 10, 260), (20, 21, 24, 255))
        for i, g in enumerate(finals.values()):
            sheet.alpha_composite(to_image(g, 8), (10 + i * 150, 10))
            small = to_image(g, 2)
            sheet.alpha_composite(small, (10 + i * 150, 150))
            grey = small.convert('LA').convert('RGBA')
            grey.putalpha(small.getchannel('A').point(lambda a: int(a * 0.6)))
            sheet.alpha_composite(grey, (60 + i * 150, 150))
        sheet.save(sys.argv[1])
