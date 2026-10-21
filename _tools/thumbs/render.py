"""Render a thumbnail template to a WebP.

    python _tools/thumbs/render.py music              -> site/icons/home/wr-music.webp
    python _tools/thumbs/render.py music out.webp     -> custom output path

Each template is _tools/thumbs/<name>.html, laid out at exactly 1280x720.
OUT maps a template to the image the site already uses, so no page code changes.
Needs Chrome (headless) and Pillow. The templates load Google Fonts, so stay online.
"""
import os, subprocess, sys, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, '..', '..', 'site'))
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
OUT = {
    'music': 'icons/home/wr-music.webp',
    'equipment-tier-list': 'clashofclans/articles/equipment-tier-list/thumb.webp',
    # A folder (trailing /) = article art: shot at 1.5x, saved as banner.webp (1920) + thumb.webp (800).
    'first-hardcore-world': 'minecrafticons/articles/first-hardcore-world/',
    '3x3-piston-door': 'minecrafticons/articles/3x3-piston-door/',
}

def render(name, out=None):
    src = os.path.join(HERE, name + '.html')
    out = out or os.path.join(SITE, OUT[name])
    scale = 1.5 if out.endswith('/') else 1
    png = os.path.join(tempfile.gettempdir(), 'thumb-' + name + '.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=%s' % scale,
                    '--window-size=1280,720', '--virtual-time-budget=4000', '--allow-file-access-from-files',
                    '--screenshot=' + png, 'file:///' + src.replace('\\', '/')], check=True, capture_output=True)
    im = Image.open(png).convert('RGB').crop((0, 0, int(1280 * scale), int(720 * scale)))
    if scale == 1:
        im.save(out, 'WEBP', quality=86, method=6)
        return print(name, '->', out, os.path.getsize(out) // 1024, 'KB')
    for f, w in (('banner.webp', 1920), ('thumb.webp', 800)):
        dst = os.path.join(out, f)
        im.resize((w, w * 9 // 16), Image.LANCZOS).save(dst, 'WEBP', quality=86, method=6)
        print(name, '->', dst, os.path.getsize(dst) // 1024, 'KB')

if __name__ == '__main__':
    render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
