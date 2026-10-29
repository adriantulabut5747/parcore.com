"""Bakes the /minecraft/ hero backdrop: a world photo, blurred (depth of field, so the 3D island floats in
front of it) and dimmed a little. Blur is baked, never CSS filter, for phone performance.
  python _tools/lobby-hero/bg.py [photo]   (default: Adrian's Hardcore Parcore sunset, hcpc5)
writes site/images/minecraft/lobby/hero-bg.webp"""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

SITE = Path(__file__).resolve().parents[2] / 'site'
src = Path(sys.argv[1]) if len(sys.argv) > 1 else SITE / 'minecrafticons/minecraft-hcpc/hcpc5-compresso.jpg'
im = Image.open(src).convert('RGB').resize((1600, 900), Image.LANCZOS)
im = im.filter(ImageFilter.GaussianBlur(4))
im = ImageEnhance.Brightness(im).enhance(0.9)
out = SITE / 'images/minecraft/lobby/hero-bg.webp'
im.save(out, 'WEBP', quality=80, method=6)
print(out, out.stat().st_size // 1024, 'KB')
