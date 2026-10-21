"""Mob skins for the mob summoner's 3D preview: every look the page's options can pick (Oct 19 2026).

Copies textures into site/minecrafticons/mobs3d/<folder>/ :
  villager/, zombie_villager/   body, type/<biome>, baby/<biome>, profession/<job>, profession_level/<badge>
  cat/ wolf/ pig/ chicken/ frog/ axolotl/ parrot/ rabbit/ horse/ llama/ panda/ shulker/
                                the Java 26.3 variant textures, same names as in the jar (cat_calico.png ...)
  equipment/<layer>/            Java's gear layers: saddles, horse_body, llama_body, wolf_body, happy_ghast_body,
                                humanoid_baby (baby armor); equipment/nautilus/ from Bedrock
  bee/ copper_golem/ zombie_nautilus/coral.png   Bedrock's angry / nectar bee, rusted golem, coral nautilus
  cow/ fox/                     from Bedrock's sample pack instead: Java's fox sheet has another layout, and the
                                warm / cold cow and the brown mooshroom are drawn on Bedrock-only models
  sheep/skin.png, wool.png      Java's sheep + wool sheets laid out the Bedrock way (wool 32 px down),
                                so the wool can be tinted to its dye colour on its own
  sheep/skin_baby.png, wool_baby.png   Java's baby sheep (Bedrock's has no face), cropped to the baby model
  ../armor/leather_overlay.png, leather_legs_overlay.png   leather armor's untinted buckles
  ../particles/effect_0-7.png   the mob effect swirl (tinted per effect by mc-mob3d.js)
  equipment/wings/elytra.png    the elytra's wings
Java's textures fit the Bedrock models (build.py) pixel for pixel for these mobs: the UVs are the same.
mc-mob.js mobSkin() picks the layers for the options set; mc-mob3d.js stacks them (collars tinted).
The villager hat rules are in mc-mob.js VHAT, read from the .png.mcmeta files next to its textures.

Also writes site/mc-mob-lists.json (loot tables, enderman blocks) for the page's suggestions.

Run (needs Pillow; build.py first):   python _tools/mobs3d/skins.py [path/to/client.jar]
"""
import io, json, os, sys, zipfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, '..', '..', 'site'))
OUT = os.path.join(SITE, 'minecrafticons', 'mobs3d')
RP = os.path.normpath(os.path.join(HERE, '..', '..', '..', '_cache', 'bedrock-samples', 'resource_pack', 'textures', 'entity'))
JAR = sys.argv[1] if len(sys.argv) > 1 else os.path.expandvars(r'%APPDATA%\.minecraft\versions\26.3\26.3.jar')

# Java entity folders to copy, and the files in them to leave out (other mobs, effects, armor)
JAVA = {
    'villager': '', 'zombie_villager': '', 'cat': 'ocelot', 'wolf': 'armor', 'pig': '', 'chicken': '',
    'frog': '', 'axolotl': '', 'parrot': '', 'rabbit': '', 'horse': 'donkey|mule|skeleton|zombie',
    'llama': 'spit', 'panda': '', 'shulker': 'spark',
    # gear drawn over a mob (saddles, horse / wolf armor, llama carpets, harnesses, baby armor): the
    # mob's own model again, a little bigger, with this picture (mc-mob3d.js gearParts)
    'equipment': 'humanoid/|humanoid_leggings|wings|nautilus_',  # nautilus gear: Bedrock's (below)
}
# Bedrock file -> site file
BEDROCK = {
    'cow/cow_warm': 'cow/cow_warm', 'cow/cow_cold': 'cow/cow_cold', 'cow/cow_temperate_baby': 'cow/cow_temperate_baby',
    'cow/cow_warm_baby': 'cow/cow_warm_baby', 'cow/cow_cold_baby': 'cow/cow_cold_baby',
    'cow/brown_mooshroom_v2': 'cow/mooshroom_brown', 'cow/mooshroom_brown_baby': 'cow/mooshroom_brown_baby',
    'fox/arctic_fox': 'fox/fox_snow', 'fox/fox_snow_baby': 'fox/fox_snow_baby',
    # these pair with Bedrock-only models (nautilus saddle / armor, coral zombie nautilus) or Bedrock layers
    'nautilus/nautilus_saddle': 'equipment/nautilus/saddle', 'nautilus/zombie_nautilus_coral': 'zombie_nautilus/coral',
    'nautilus/zombie_nautilus': 'zombie_nautilus/plain',
    'copper_golem/copper_golem_eyes': 'copper_golem/eyes',
}
for m in ('copper', 'iron', 'gold', 'diamond', 'netherite'):
    BEDROCK['nautilus/armor/nautilus_armor_' + m] = 'equipment/nautilus/' + m
for w in ('exposed', 'weathered', 'oxidized'):
    BEDROCK['copper_golem/copper_golem_' + w] = 'copper_golem/' + w
    BEDROCK['copper_golem/copper_golem_eyes_' + w] = 'copper_golem/eyes_' + w
for b in ('bee', 'bee_angry', 'bee_nectar', 'bee_angry_nectar'):
    BEDROCK['bee/' + b] = 'bee/' + b
    BEDROCK['bee/' + b + '_baby'] = 'bee/' + b + '_baby'


def save(data_or_path, dst):
    dst = os.path.join(OUT, dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if isinstance(data_or_path, bytes):
        open(dst, 'wb').write(data_or_path)
    else:
        open(dst, 'wb').write(open(data_or_path, 'rb').read())


n = 0
z = zipfile.ZipFile(JAR)
for name in z.namelist():
    for mob, skip in JAVA.items():
        pre = 'assets/minecraft/textures/entity/%s/' % mob
        if name.startswith(pre) and name.endswith('.png') and not (skip and any(s in name[len(pre):] for s in skip.split('|'))):
            save(z.read(name), mob + '/' + name[len(pre):])
            n += 1
for src, dst in BEDROCK.items():
    save(os.path.join(RP, src.replace('/', os.sep) + '.png'), dst + '.png')
    n += 1

# Sheep: the Bedrock model has the body boxes on the sheet's top half and the wool boxes 32 px lower,
# the same UVs as Java's two 64x32 sheets (sheep.png, sheep_wool.png). Bedrock's own sheet has no bare skin.
os.makedirs(os.path.join(OUT, 'sheep'), exist_ok=True)
for src, dst, y in (('sheep', 'skin', 0), ('sheep_wool', 'wool', 32)):
    im = Image.open(io.BytesIO(z.read('assets/minecraft/textures/entity/sheep/%s.png' % src))).convert('RGBA')
    sheet = Image.new('RGBA', (64, 64))
    sheet.paste(im, (0, y))
    sheet.save(os.path.join(OUT, 'sheep', dst + '.png'), optimize=True)
print('copied %d textures + the sheep' % n)

# --- extras (Oct 19) ---
# Baby sheep: Bedrock's sheep_baby.png is all wool (no face, no hooves; Bedrock draws those another way).
# Java's two baby sheets use the same UVs on the left 32 x 32 of a 64 x 32 sheet, which is the baby model's
# whole texture, so they're cropped to it. The wool is its own layer, tinted to the dye like the adult's.
for src, dst in (('sheep_baby', 'skin_baby'), ('sheep_wool_baby', 'wool_baby')):
    im = Image.open(io.BytesIO(z.read('assets/minecraft/textures/entity/sheep/%s.png' % src))).convert('RGBA')
    im.crop((0, 0, 32, 32)).save(os.path.join(OUT, 'sheep', dst + '.png'), optimize=True)
# Leather armor's untinted layer (the buckles and trim), drawn over the dyed one.
ARMOR = os.path.join(SITE, 'minecrafticons', 'armor')
for src, dst in (('humanoid', 'leather_overlay'), ('humanoid_leggings', 'leather_legs_overlay')):
    save(z.read('assets/minecraft/textures/entity/equipment/%s/leather_overlay.png' % src), os.path.join('..', 'armor', dst + '.png'))
# The swirl every mob effect gives off (entity_effect), 8 frames, white: tinted to the effect's colour.
for i in range(8):
    save(z.read('assets/minecraft/textures/particle/effect_%d.png' % i), os.path.join('..', 'particles', 'effect_%d.png' % i))
# Elytra wings (WingsLayer draws ElytraModel with it on humanoid mobs and armor stands), 64 x 32.
save(z.read('assets/minecraft/textures/entity/equipment/wings/elytra.png'), 'equipment/wings/elytra.png')
print('copied the baby sheep, leather overlays, effect particles, elytra')

# Lists the page offers as suggestions: every loot table (Drops when killed) and the blocks an enderman
# can pick up (tags/block/enderman_holdable, its #tags opened up).
def tag(name):
    out = []
    for v in json.loads(z.read('data/minecraft/tags/block/%s.json' % name))['values']:
        out += tag(v[11:]) if v.startswith('#minecraft:') else [v.split(':')[-1]]
    return out
loot = sorted(x[len('data/minecraft/loot_table/'):-5] for x in z.namelist()
              if x.startswith('data/minecraft/loot_table/') and x.endswith('.json') and '/blocks/' not in x)
with open(os.path.join(SITE, 'mc-mob-lists.json'), 'w', encoding='utf-8', newline=chr(10)) as f:
    json.dump({'loot': loot, 'holdable': sorted(set(tag('enderman_holdable')))}, f, separators=(',', ':'))
print('wrote mc-mob-lists.json:', len(loot), 'loot tables')
