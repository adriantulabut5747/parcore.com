# The Traveler's card for /genshin-impact/characters (not published).
# Every other character's card is its wish-result art (scripts/genshin-feed.py `strip()`), but
# the Traveler is never pulled, so the game has none. This draws one in the same 320x512 frame:
# Aether (behind, dimmed) and Lumine from their transparent wish art, on a dark ground with a
# soft gold glow. Run once; the feed script never overwrites it.
#   python _tools/genshin/traveler-strip.py
import io
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(__file__).resolve().parents[2] / 'site' / 'images' / 'genshin' / 'strip' / 'Traveler.webp'
W, H = 640, 1024  # drawn at 2x, saved at 320x512


def art(key):
    url = 'https://enka.network/ui/UI_Gacha_AvatarImg_%s.png' % key
    req = urllib.request.Request(url, headers={'User-Agent': 'ParchromeBot/1.0 (https://parchrome.netlify.app)'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert('RGBA')


card = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(card)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(34 - 20 * t), int(36 - 22 * t), int(52 - 30 * t), 255))
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([40, 60, 620, 560], fill=(214, 170, 90, 110))
card.alpha_composite(glow.filter(ImageFilter.GaussianBlur(110)))


def place(im, scale, x, y, dim=1.0):
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    if dim < 1:
        im = Image.merge('RGBA', (*ImageEnhance.Brightness(im.convert('RGB')).enhance(dim).split(), im.split()[3]))
    im = im.crop((max(-x, 0), max(-y, 0), im.width, im.height))  # alpha_composite takes no negative offsets
    card.alpha_composite(im, (max(x, 0), max(y, 0)))


place(art('PlayerBoy'), 1.2, -230, -30, 0.8)
place(art('PlayerGirl'), 1.3, -380, 60)
OUT.parent.mkdir(parents=True, exist_ok=True)
card.convert('RGB').resize((W // 2, H // 2), Image.LANCZOS).save(OUT, 'WEBP', quality=80, method=6)
print('Wrote', OUT)
