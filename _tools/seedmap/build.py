"""Compile cubiomes + seedmap.c to site/mc-seedmap.wasm (the Seed Map's generator).

    pip install ziglang        # once: the C compiler (targets WebAssembly)
    python _tools/seedmap/build.py

cubiomes is pinned to COMMIT and cloned next to this file (git-ignored). Bump COMMIT
when cubiomes adds a Minecraft version, rebuild, then re-check seeds in-game.
"""
import pathlib, subprocess, sys

COMMIT = 'e61f90580cbdd883214a8054670dacae655e59c0'  # 2024-11-10, newest = 1.21 Winter Drop
HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / 'cubiomes'
OUT = HERE.parents[1] / 'site' / 'mc-seedmap.wasm'

if not SRC.exists():
    subprocess.run(['git', 'clone', 'https://github.com/Cubitect/cubiomes.git', str(SRC)], check=True)
subprocess.run(['git', '-C', str(SRC), 'checkout', '-q', COMMIT], check=True)

files = [HERE / 'seedmap.c'] + [SRC / f for f in
         ('biomenoise.c', 'biomes.c', 'finders.c', 'generator.c', 'layers.c', 'noise.c', 'util.c')]
subprocess.run([sys.executable, '-m', 'ziglang', 'cc', '--target=wasm32-wasi', '-O3', '-flto',
                '-mexec-model=reactor', '-s', '-fno-sanitize=undefined', '-Wno-everything',
                '-o', str(OUT)] + [str(f) for f in files], check=True)
print(OUT, OUT.stat().st_size // 1024, 'KB')
