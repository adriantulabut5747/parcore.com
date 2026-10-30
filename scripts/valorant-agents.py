# Agents pages (Oct 30 2026): /valorant/agents/ + one static page per agent (/valorant/agents/<slug>), so every
# ability and release fact is in the page for Google. Edit THIS script or scripts/valorant-agents.json and rerun --
# never the pages it writes. Live part: none (valorant-agents.js only filters / sorts what's on the page).
#
# Sources: valorant-api.com /v1/agents (pictures, colours, role, bio, abilities); the hand-written
# scripts/valorant-agents.json (release date + patch, real name, origin, Protocol number, voice: from the wiki).
# The page shell (head, bars, sidebar, footer, More sheet) is the Weapons page's, swapped in at build time.
# Pictures are baked once into site/images/valorant/agents/ (WebP; valorant-api's portraits are 2048px PNGs).
# Also writes site/valorant-roster.json (id, slug, role, colours) for the player page.
#
# Run:  python scripts/valorant-agents.py            (--images re-bakes the pictures, --cards only the card crops)
# Needs Pillow.

import datetime
import importlib.util
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('valorant_maps', HERE / 'valorant-maps.py')
vm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vm)  # only for get / bake / e / MONTHS / JETT: its main() doesn't run
get, bake, e, MONTHS, JETT = vm.get, vm.bake, vm.e, vm.MONTHS, vm.JETT

ROOT = HERE.parent / 'site'
OUT = ROOT / 'valorant' / 'agents'
IMG = ROOT / 'images' / 'valorant' / 'agents'
SHELL = ROOT / 'valorant' / 'weapons.html'
DATA = HERE / 'valorant-agents.json'
# Cache version for valorant-agents.css / .js and the card crops on every agents page: bump it when any of them change, then rerun.
ASSET_V = '20261030c'
VALORANT_CSS_V = vm.VALORANT_CSS_V

ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel']
# valorant-api slot -> the key it sits on in game + its kind (E is every agent's signature)
SLOTS = [('Grenade', 'C', 'Basic'), ('Ability1', 'Q', 'Basic'), ('Ability2', 'E', 'Signature'),
         ('Ultimate', 'X', 'Ultimate'), ('Passive', '', 'Passive')]
AGENT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/></svg>'


def slug_of(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def day(iso, long=False):
    y, m, d = (int(x) for x in iso.split('-'))
    mon = MONTHS[m - 1] if long else MONTHS[m - 1][:3]
    return f'{mon} {d}, {y}'


def patch_txt(a):
    return f"Patch {a['patch']}" if a['patch'][:1].isdigit() else a['patch']


def bake_card(url, out, x=None, force=False):
    """The roster card's 3:4 crop of a full portrait, head to waist, centred on the head: x = where it sits across the
    picture (scripts/valorant-agents.json card_x). Without one, the middle of the solid body between the shoulders and
    the waist (see-through effects left out; solid ones can still pull it, so set card_x for every agent)."""
    if out.exists() and not force:
        return
    im = Image.open(io.BytesIO(get(url))).convert('RGBA')
    alpha = im.getchannel('A')
    l, t, r, b = alpha.getbbox()
    h = b - t
    if x is not None:
        cx = x * im.width
    else:
        band = alpha.crop((0, t + int(h * 0.12), im.width, t + int(h * 0.45))).resize((im.width // 4, 40))
        cols = [sum(1 for y in range(band.height) if band.getpixel((c, y)) > 250) for c in range(band.width)]
        half, acc, cx = sum(cols) / 2, 0, im.width / 2
        for c, n in enumerate(cols):
            acc += n
            if acc >= half:
                cx = c * 4
                break
    ch = int(h * 0.74)
    cw = int(ch * 3 / 4)
    x0 = int(min(max(cx - cw / 2, 0), im.width - cw))
    y0 = max(t - int(h * 0.04), 0)
    im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((480, 640), Image.LANCZOS)
    im.save(out, 'WEBP', quality=86, method=6)
    print('  baked', out.name, f'{out.stat().st_size // 1024} KB')


def ability_html(t):
    """valorant-api's ability text -> our markup: <whitebold> = the thing's name, <debuffred> = what it does to
    enemies, <teal> = what it does for you; ALL-CAPS game verbs (EQUIP, FIRE, ALT FIRE) become key labels."""
    t = e(t.replace('\r\n', '\n').strip())
    t = re.sub(r'&lt;whitebold&gt;(.*?)&lt;/&gt;', r'<b>\1</b>', t)
    t = re.sub(r'&lt;debuffred&gt;(.*?)&lt;/&gt;', r'<em class="va-bad">\1</em>', t)
    t = re.sub(r'&lt;teal&gt;(.*?)&lt;/&gt;', r'<em class="va-good">\1</em>', t)
    t = re.sub(r'&lt;/?\w*&gt;', '', t)  # any tag Riot adds later: dropped, never shown raw
    t = re.sub(r'(?<![\w/])([A-Z]{3,}(?: [A-Z]{3,})*)(?![\w/])', r'<span class="va-verb">\1</span>', t)
    return ''.join(f'<p>{p.strip()}</p>' for p in re.split(r'\n\s*\n', t) if p.strip()).replace('\n', '<br>')


def shell(title, desc, body_html, page_class):
    src = SHELL.read_text(encoding='utf-8')
    head = src[: src.index('<header class="cb"')]
    tail = src[src.index('  <footer class="pf-footer">'):]
    head = re.sub(r'<title>.*?</title>', f'<title>{e(title)}</title>', head)
    head = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + e(desc), head)
    head = re.sub(r'/valorant\.css\?v=\w+', f'/valorant.css?v={VALORANT_CSS_V}', head)
    head = re.sub(r'<link rel="stylesheet" href="/valorant-weapons\.css\?v=\w+">',
                  f'<link rel="stylesheet" href="/valorant-agents.css?v={ASSET_V}">', head)
    assert 'valorant-agents.css' in head, 'shell changed: the Weapons page no longer links valorant-weapons.css'
    assert '<body class="vl-ground" data-game-nav="valorant"' in head, 'shell changed: the Weapons page body tag'
    head = head.replace('<body class="vl-ground"', f'<body class="vl-ground va-page {page_class}"', 1)
    return head + body_html + f'\n<script src="/valorant-agents.js?v={ASSET_V}"></script>\n' + tail


def banner(kicker, title, text, a, facts, ico):
    strip = ''.join(
        f'<span class="cb-fact"><small>{e(k)}</small><b>{b}</b><em>{e(sub)}</em></span>' for k, b, sub in facts)
    return f'''<header class="cb" aria-labelledby="cbTitle" style="--ac:{a['c1']}">
  <span class="cb-art" aria-hidden="true" style="--art:url('/images/valorant/agents/{a['slug']}.webp')"></span>
  <span class="cb-ico" aria-hidden="true"><img src="{ico}" alt="" width="160" height="160" decoding="async"></span>
  <div class="cb-copy">
    <p class="cb-kicker">{e(kicker)}</p>
    <h1 class="cb-title" id="cbTitle">{e(title)}</h1>
    <p class="cb-text">{e(text)}</p>
    <div class="cb-strip">{strip}</div>
  </div>
</header>
'''


def section(sid, title, jett, inner, last=False, extra=''):
    return f'''
<section class="ct-sec{' ct-sec--last' if last else ''}" aria-labelledby="{sid}"{extra}>
  <header class="ct-head">
    <h2 class="ct-title" id="{sid}">{e(title)}</h2>
    {JETT.format(jett)}
  </header>
{inner}
</section>
'''


def role_img(role, size=20):
    return f'<img src="/images/valorant/agents/role-{role.lower()}.webp" alt="" width="{size}" height="{size}" loading="lazy" decoding="async">'


def icon_img(a, size=40, lazy=True):
    return (f'<img src="/images/valorant/agents/{a["slug"]}-icon.webp" alt="" width="{size}" height="{size}"'
            f'{" loading=" + chr(34) + "lazy" + chr(34) if lazy else ""} decoding="async">')


def card(a, newest=False):
    abs_ = ''.join(f'<img src="/images/valorant/agents/{a["slug"]}-{ab["key"].lower() or "p"}.webp" alt="" width="24" height="24" loading="lazy" decoding="async">'
                   for ab in a['abilities'] if ab['key'])
    new = '<span class="va-new">Newest</span>' if newest else ''
    return f'''<a class="va-card" href="/valorant/agents/{a['slug']}" data-role="{a['role'].lower()}" data-name="{e(a['name'].lower())}" data-i="{a['i']}" style="--ac:{a['c1']};--ac2:{a['c2']}">
  <span class="va-pic">
    <img class="va-bgtxt" src="/images/valorant/agents/{a['slug']}-bg.webp" alt="" width="420" height="614" loading="lazy" decoding="async">
    <img class="va-por" src="/images/valorant/agents/{a['slug']}-card.webp?v={ASSET_V}" alt="" width="480" height="640" loading="lazy" decoding="async">
    <span class="va-role" title="{a['role']}">{role_img(a['role'])}</span>{new}
  </span>
  <span class="va-plate">
    <span class="va-head"><span class="va-name"><b>{e(a['name'])}</b><small>{a['role']}</small></span><span class="va-date"><b>{day(a['released'])}</b>{e(patch_txt(a))}</span></span>
    <span class="va-abs" aria-hidden="true">{abs_}</span>
  </span>
</a>'''


def index_page(agents, roles, data):
    newest = agents[-1]
    by_role = {r: [a for a in agents if a['role'] == r] for r in ROLES}
    facts = [
        ('Agents', str(len(agents)), f'{len(ROLES)} roles'),
        ('Newest', e(newest['name']), f"{day(newest['released'])} · {patch_txt(newest)}"),
        ('Free from the start', str(len(data['starters'])), 'Starter agents'),
    ]
    body = banner('Valorant', 'Agents', f'All {len(agents)} agents: every ability, role and release date, from the closed beta to {newest["name"]}.',
                  newest, facts, f'/images/valorant/agents/{newest["slug"]}-icon.webp')
    tabs = [f'<button type="button" role="tab" data-role="" aria-selected="true">{AGENT_ICON}All<span class="cb-n">{len(agents)}</span></button>'] + [
        f'<button type="button" role="tab" data-role="{r.lower()}" aria-selected="false">{role_img(r, 18)}{r}s<span class="cb-n">{len(by_role[r])}</span></button>'
        for r in ROLES]
    body += f'<div class="cb-tabs" id="vaTabs" role="tablist" aria-label="Roles">{"".join(tabs)}</div>\n'

    cards = '\n'.join(card(a, a is newest) for a in reversed(agents))
    bar = '''  <div class="va-bar">
    <label class="lb-search va-find" for="vaQ">
      <input class="lb-search-input" id="vaQ" type="search" placeholder="Find an agent" autocomplete="off" spellcheck="false" maxlength="20">
      <span class="lb-search-btn" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2.2"/><line x1="15.3" y1="15.3" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>
    </label>
    <div class="gs-seg" id="vaSort" role="group" aria-label="Order">
      <button type="button" data-sort="new" aria-pressed="true">Newest</button>
      <button type="button" data-sort="old" aria-pressed="false">Oldest</button>
      <button type="button" data-sort="az" aria-pressed="false">A-Z</button>
    </div>
  </div>'''
    body += section('vaRosterTitle', 'The roster',
                    'Every agent, newest first, with the day they dropped. Click a card for their abilities and file. Pick me, obviously.',
                    f'{bar}\n  <div class="va-grid" id="vaGrid">\n{cards}\n  </div>\n  <p class="va-none" id="vaNone" hidden>No agent by that name. Yet.</p>')

    # release years as columns of faces: each column is as tall as that year's intake, so it reads as a chart
    years = {}
    for a in agents:
        years.setdefault(a['released'][:4], []).append(a)
    cols = ''
    for y, lst in years.items():
        rows = ''.join(
            f'<a class="va-yr-a" href="/valorant/agents/{a["slug"]}" data-role="{a["role"].lower()}" style="--ac:{a["c1"]}">{icon_img(a, 32)}'
            f'<span><b>{e(a["name"])}</b><small>{day(a["released"])}</small></span></a>' for a in reversed(lst))
        cols += (f'<div class="va-yr" style="--n:{len(lst)}"><div class="va-yr-list">{rows}</div>'
                 f'<div class="va-yr-foot"><b>{y}</b><small>{len(lst)} agent{"s" if len(lst) > 1 else ""}</small></div></div>')
    body += section('vaYearsTitle', 'Release timeline',
                    f'How the roster grew, year by year: {len(years["2020"])} agents in 2020, then a few each year. Taller column, busier year. Still none faster than me.',
                    f'  <div class="va-years" style="--years:{len(years)}">{cols}</div>')

    rows = ''
    for a in agents:
        rows += (f'<tr data-role="{a["role"].lower()}" data-name="{e(a["name"].lower())}">'
                 f'<td data-v="{a["i"]}">{a["i"]}</td>'
                 f'<td data-v="{e(a["name"].lower())}"><a class="va-t-agent" href="/valorant/agents/{a["slug"]}">{icon_img(a, 32)}<b>{e(a["name"])}</b></a></td>'
                 f'<td data-v="{a["role"]}"><span class="va-t-role">{role_img(a["role"], 16)}{a["role"]}</span></td>'
                 f'<td data-v="{e(a["real_name"] or "~")}">{e(a["real_name"]) or "<small>Not revealed</small>"}</td>'
                 f'<td data-v="{e(a["origin"] or "~")}">{e(a["origin"]) or "<small>Not revealed</small>"}</td>'
                 f'<td data-v="{a["i"]}">{day(a["released"])}</td>'
                 f'<td data-v="{a["i"]}">{e(a["patch"])}</td></tr>')
    heads = ''.join(f'<th scope="col"{" aria-sort=" + chr(34) + "ascending" + chr(34) if k == "i" else ""}><button type="button" data-col="{n}">{lab}</button></th>'
                    for n, (k, lab) in enumerate([('i', '#'), ('name', 'Agent'), ('role', 'Role'), ('real', 'Real name'),
                                                  ('origin', 'Origin'), ('rel', 'Released'), ('patch', 'Patch')]))
    body += section('vaTableTitle', 'Every agent in one table',
                    'Real names, home towns, release days and patches, side by side. Click a column to sort it. Homework, but fast.',
                    f'  <div class="gs-table-wrap"><table class="gs-table va-table" id="vaTable"><caption class="gs-sr">All Valorant agents</caption>'
                    f'<thead><tr>{heads}</tr></thead><tbody>{rows}</tbody></table></div>')

    boxes = ''
    for r in ROLES:
        faces = ''.join(f'<a href="/valorant/agents/{a["slug"]}" title="{e(a["name"])}" style="--ac:{a["c1"]}">{icon_img(a, 44)}<span>{e(a["name"])}</span></a>'
                        for a in by_role[r])
        boxes += (f'<article class="va-rolebox"><header><span class="va-rolebox-ico">{role_img(r, 30)}</span>'
                  f'<h3>{r}s<small>{len(by_role[r])} agents</small></h3></header><p>{e(roles[r])}</p><div class="va-faces">{faces}</div></article>')
    body += section('vaRolesTitle', 'The four roles',
                    'Duelists take fights, Initiators open them, Controllers block sight lines and Sentinels hold the ground. Riot\'s own words below. Duelist is the fun one.',
                    f'  <div class="va-roles">{boxes}</div>')

    free = {a['name']: a for a in agents}
    starters = ''.join(f'<a href="/valorant/agents/{free[n]["slug"]}" style="--ac:{free[n]["c1"]}">{icon_img(free[n], 56)}<b>{e(n)}</b><small>{free[n]["role"]}</small></a>'
                       for n in data['starters'])
    inner = f'''  <div class="va-unlock">
    <div class="va-starters"><h3>Free from your first match</h3><div class="va-faces va-faces--big">{starters}</div></div>
    <ol class="ct-steps">
      <li>Every other agent costs 1,000 VP, 8,000 Kingdom Credits or 1 Free Agent Token in the Agent Store, and stays yours for good.</li>
      <li>The Basic Training event gives up to 2 Free Agent Tokens to new players.</li>
      <li>A new agent has a 28-day recruitment event from launch: earn 200,000 XP in that time and they unlock for free. Kingdom Credits and tokens can't buy them during it.</li>
      <li>Xbox Game Pass unlocks every agent while your subscription lasts.</li>
      <li>The Range and All Random One Site let you play any agent, locked or not.</li>
    </ol>
  </div>'''
    body += section('vaUnlockTitle', 'How to unlock agents',
                    'Five agents are free from day one, the rest cost VP, Kingdom Credits or a token. I\'m one of the free five. You\'re welcome.',
                    inner, last=True)
    return shell(f'Valorant Agents: All {len(agents)} Agents, Abilities and Release Dates | Parchrome',
                 f'Every Valorant agent from Brimstone to {newest["name"]}: abilities, role, real name, origin, release date and patch, '
                 'with a sortable table, the release timeline and how to unlock each one.', body, 'va-index')


def agent_page(a, agents, roles):
    n = len(agents)
    prev = agents[a['i'] - 2] if a['i'] > 1 else None
    nxt = agents[a['i']] if a['i'] < n else None
    facts = [('Role', a['role'], f"{len([x for x in agents if x['role'] == a['role']])} {a['role']}s"),
             ('Released', day(a['released']), patch_txt(a)),
             ('Agent', f"#{a['i']}", f'of {n} in release order')]
    bio = a['bio']
    body = banner('Valorant agents', a['name'], bio.split('. ')[0].rstrip('.') + '.', a, facts, f'/images/valorant/agents/{a["slug"]}-icon.webp')
    same = [x for x in agents if x['role'] == a['role']]
    tabs = [f'<a href="/valorant/agents/">{AGENT_ICON}All agents</a>'] + [
        f'<a href="/valorant/agents/{x["slug"]}"{" aria-current=" + chr(34) + "page" + chr(34) if x is a else ""}>{icon_img(x, 22, lazy=False)}{e(x["name"])}</a>'
        for x in same]
    body += f'<nav class="cb-tabs cb-tabs--many va-tray" aria-label="{a["role"]}s">{"".join(tabs)}</nav>\n'

    na = 'Not revealed'
    rows = [('Real name', a['real_name'] or na), ('Origin', a['origin'] or na), ('Role', a['role']),
            ('Released', day(a['released'], long=True)), ('Patch', a['patch'])] + (
            [('Act', a['act'])] if a['act'] != a['patch'] else []) + [
            ('Release order', f"#{a['i']} of {n}"), ('Protocol number', f"Agent {a['number']}" if a['number'] else na),
            ('Codename', a['codename']), ('Voice (English)', a['voice'] or na)]
    dl = ''.join(f'<div><dt>{e(k)}</dt><dd{" class=" + chr(34) + "va-na" + chr(34) if v == na else ""}>{e(v)}</dd></div>' for k, v in rows)
    me = a['name'] == 'Jett'
    inner = f'''  <div class="va-dossier" style="--ac:{a['c1']};--ac2:{a['c2']}">
    <figure class="va-stage">
      <img class="va-stage-bg" src="/images/valorant/agents/{a['slug']}-bg.webp" alt="" width="420" height="614" decoding="async">
      <img class="va-stage-por" src="/images/valorant/agents/{a['slug']}.webp" alt="{e(a['name'])}, full portrait" width="1000" height="{a['ph']}" decoding="async">
      <figcaption><span class="va-role">{role_img(a['role'], 22)}</span>{a['role']}</figcaption>
    </figure>
    <div class="va-file">
      <blockquote class="va-bio"><p>{e(bio)}</p><cite>Riot's agent bio</cite></blockquote>
      <div class="va-roleline">{role_img(a['role'], 26)}<p><b>{a['role']}</b>{e(roles[a['role']])}</p></div>
      <dl class="va-facts">{dl}</dl>
    </div>
  </div>'''
    jl = ('My file. Real name, home town and the day I showed up and made everyone else look slow.' if me else
          f"{a['name']}'s file: real name, home, the patch that brought {a['name']} in and the codename Riot used. Good intel, I'd still win the duel.")
    body += section('vaFileTitle', 'Agent file', e(jl), inner)

    abs_ = ''
    for ab in a['abilities']:
        k = ab['key'] or 'P'
        keycap = f'<kbd>{ab["key"]}</kbd>' if ab['key'] else '<kbd class="va-kbd-p">Passive</kbd>'
        abs_ += (f'<article class="va-ab va-ab--{ab["kind"].lower()}" id="ability-{slug_of(ab["name"])}">'
                 f'<div class="va-ab-top"><span class="va-ab-ico"><img src="/images/valorant/agents/{a["slug"]}-{k.lower()}.webp" alt="" width="64" height="64" loading="lazy" decoding="async"></span>'
                 f'<div><p class="va-ab-slot">{keycap}{ab["kind"]}{" ability" if ab["kind"] != "Passive" else ""}</p><h3>{e(ab["name"])}</h3></div></div>'
                 f'<div class="va-ab-desc">{ab["html"]}</div></article>')
    names = ', '.join(ab['name'] for ab in a['abilities'] if ab['key'])
    jl = ('My kit: Cloudburst, Updraft, Tailwind and Blade Storm. Red words hurt them, white words are the tools. Try to keep up!' if me else
          f"What every key does: {names}. Red words hurt the enemy, white words are the tool itself. Learn it before they do.")
    body += section('vaAbTitle', 'Abilities', e(jl), f'  <div class="va-abs-grid" style="--ac:{a["c1"]}">{abs_}</div>')

    rail = ''
    year = ''
    for x in agents:
        if x['released'][:4] != year:
            year = x['released'][:4]
            rail += f'<span class="va-rail-yr">{year}</span>'
        cur = ' aria-current="page"' if x is a else ''
        rail += f'<a href="/valorant/agents/{x["slug"]}" title="{e(x["name"])} · {day(x["released"])}"{cur} style="--ac:{x["c1"]}">{icon_img(x, 40)}<span>{e(x["name"])}</span></a>'
    nav = ''
    if prev:
        nav += f'<a class="va-step" href="/valorant/agents/{prev["slug"]}">{icon_img(prev, 36)}<span><small>Before {e(a["name"])}</small><b>{e(prev["name"])}</b><em>{day(prev["released"])}</em></span></a>'
    if nxt:
        nav += f'<a class="va-step va-step--next" href="/valorant/agents/{nxt["slug"]}"><span><small>After {e(a["name"])}</small><b>{e(nxt["name"])}</b><em>{day(nxt["released"])}</em></span>{icon_img(nxt, 36)}</a>'
    when = ('in the closed beta, one of the first ten' if a['patch'] == 'Closed beta' else f"on {day(a['released'], long=True)}, {patch_txt(a)}")
    body += section('vaRailTitle', 'Release order',
                    e(f"{a['name']} joined {when}. Here's where that sits in the whole roster. Scroll it, it's quick."),
                    f'  <div class="va-rail" id="vaRail">{rail}</div>\n  <div class="va-steps">{nav}</div>')

    others = [x for x in reversed(same) if x is not a]
    body += section('vaMoreTitle', f"More {a['role']}s",
                    e(f"The other {a['role']}s, newest first. Same job, different tricks. None of them are me, though."),
                    '  <div class="va-grid va-grid--more">\n' + '\n'.join(card(x) for x in others) + '\n  </div>', last=True)

    title = f"{a['name']} Valorant Guide: Abilities, Release Date and Lore | Parchrome"
    desc = (f"{a['name']} in Valorant: {a['role']}, released {day(a['released'], long=True)} ({patch_txt(a)}). "
            f"Every ability ({names}), real name, origin and release order. {bio}")
    return shell(title, desc[:300], body, 'va-agent')


def main():
    force = '--images' in sys.argv
    data = json.loads(DATA.read_text(encoding='utf-8'))
    api = json.loads(get('https://valorant-api.com/v1/agents?isPlayableCharacter=true'))['data']
    by_name = {x['displayName']: x for x in api}
    agents, roles = [], {}
    for i, row in enumerate(data['agents'], 1):
        x = by_name.pop(row['name'], None)
        if not x:
            print('!! not in valorant-api:', row['name'], '(skipped)')
            continue
        a = dict(row)
        a.update(i=len(agents) + 1, slug=slug_of(a['name']), api=x, role=x['role']['displayName'], bio=x['description'].strip(),
                 codename=x['developerName'], c1='#' + x['backgroundGradientColors'][0][:6], c2='#' + x['backgroundGradientColors'][2][:6])
        roles[a['role']] = x['role']['description']
        slots = {ab['slot']: ab for ab in x['abilities']}
        a['abilities'] = [dict(name=slots[s]['displayName'], key=k, kind=kind, html=ability_html(slots[s]['description']),
                               icon=slots[s].get('displayIcon'), slot=s) for s, k, kind in SLOTS if s in slots]
        agents.append(a)
    for name in by_name:
        print('!! new agent in valorant-api, not in valorant-agents.json:', name)
    assert set(roles) == set(ROLES), roles.keys()

    IMG.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for r in ROLES:
        x = next(a['api'] for a in agents if a['role'] == r)
        bake(x['role']['displayIcon'], IMG / f'role-{r.lower()}.webp', 64, force=force)
    for a in agents:
        x, s = a['api'], a['slug']
        bake(x['displayIcon'], IMG / f'{s}-icon.webp', 160, force=force)
        bake(x['fullPortrait'], IMG / f'{s}.webp', 1000, force=force)
        bake(x['background'], IMG / f'{s}-bg.webp', 420, force=force)
        card = IMG / f'{s}-card.webp'
        bake_card(x['fullPortrait'], card, a.get('card_x'), force=force or '--cards' in sys.argv)
        for ab in a['abilities']:
            out = IMG / f"{s}-{(ab['key'] or 'p').lower()}.webp"
            if ab['icon']:
                bake(ab['icon'], out, 96, force=force)
            elif not out.exists():  # no icon in the files: the role's mark stands in
                Image.open(IMG / f"role-{a['role'].lower()}.webp").save(out, 'WEBP')
        a['ph'] = Image.open(IMG / f'{s}.webp').height

    for a in agents:
        (OUT / f"{a['slug']}.html").write_text(agent_page(a, agents, roles), encoding='utf-8', newline='\n')
    (OUT / 'index.html').write_text(index_page(agents, roles, data), encoding='utf-8', newline='\n')
    # the player page (valorant-player.js) draws agents with these pages' art + colours: match ids -> slug
    roster = [dict(id=a['api']['uuid'], name=a['name'], slug=a['slug'], role=a['role'], ac=a['c1'], ac2=a['c2']) for a in agents]
    (ROOT / 'valorant-roster.json').write_text(json.dumps(roster, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
    print(f'wrote {len(agents)} agent pages + the index ({datetime.date.today()})')


if __name__ == '__main__':
    main()
