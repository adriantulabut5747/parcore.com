"""Turn structure block saves into the JSON the 3D build viewer (site/mc-build.js) reads.

    python _tools/mcbuild/build.py 3x3-piston-door "<structure folder>/3x3door-close.nbt" "<structure folder>/3x3door-open.nbt"

Writes site/mc-build-<id>.json and copies the .nbt files to site/minecrafticons/builds/<id>/
(the article's download buttons). The open file is optional; if it holds the same blocks as
the closed one (saved before the door moved), it is left out and the viewer hides its switch.
Structure files from 26.x name block fields id/properties; older ones Name/Properties.
"""
import json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nbt

SITE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site'))
SKIP = {'minecraft:air', 'minecraft:structure_void'}


def blocks(path, palette, index):
    s = nbt.load(path)
    out = []
    for b in s['blocks']:
        p = s['palette'][b['state']]
        bid = p.get('id') or p.get('Name')
        if bid in SKIP:
            continue
        props = p.get('properties') or p.get('Properties') or {}
        key = json.dumps([bid, props], sort_keys=True)
        if key not in index:
            index[key] = len(palette)
            palette.append({'id': bid, 'props': props} if props else {'id': bid})
        out.append(b['pos'] + [index[key]])
    return s['size'], sorted(out)


def main(bid, closed, opened=None):
    palette, index = [], {}
    size, closed_blocks = blocks(closed, palette, index)
    data = {'id': bid, 'size': size, 'palette': palette, 'states': {'closed': closed_blocks}}
    if opened:
        _, open_blocks = blocks(opened, palette, index)
        if open_blocks != closed_blocks:
            data['states']['open'] = open_blocks
        else:
            print('open file has the same blocks as the closed one: open state left out')
    out = os.path.join(SITE, 'mc-build-%s.json' % bid)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    dl = os.path.join(SITE, 'minecrafticons', 'builds', bid)
    os.makedirs(dl, exist_ok=True)
    for src, name in ((closed, 'closed'), (opened, 'open')):
        if src and (name == 'closed' or 'open' in data['states']):
            shutil.copyfile(src, os.path.join(dl, '%s-%s.nbt' % (bid, name)))
    print(out, len(closed_blocks), 'blocks,', len(palette), 'block states, states:', list(data['states']))


if __name__ == '__main__':
    main(*sys.argv[1:])
