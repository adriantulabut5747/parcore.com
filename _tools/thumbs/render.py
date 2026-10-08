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
}

def render(name, out=None):
    src = os.path.join(HERE, name + '.html')
    out = out or os.path.join(SITE, OUT[name])
    png = os.path.join(tempfile.gettempdir(), 'thumb-' + name + '.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                    '--window-size=1280,720', '--virtual-time-budget=4000', '--allow-file-access-from-files',
                    '--screenshot=' + png, 'file:///' + src.replace('\\', '/')], check=True, capture_output=True)
    im = Image.open(png).convert('RGB').crop((0, 0, 1280, 720))
    im.save(out, 'WEBP', quality=86, method=6)
    print(name, '->', out, os.path.getsize(out) // 1024, 'KB')

if __name__ == '__main__':
    render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
