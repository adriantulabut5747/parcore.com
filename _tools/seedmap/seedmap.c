// Thin WebAssembly face for cubiomes, used by site/mc-seedmap-worker.js.
// Build: python _tools/seedmap/build.py  ->  site/mc-seedmap.wasm
//
// One generator per worker. sm_init() sets version + dimension + seed; every
// other call reads that state and writes into one shared output buffer whose
// address is returned (the JS side copies it out before the next call).

#include "cubiomes/generator.h"
#include "cubiomes/finders.h"
#include "cubiomes/util.h"
#include <stdlib.h>

#define EXPORT(name) __attribute__((export_name(#name)))

static Generator g;
static SurfaceNoise sn;   // End city terrain check
static uint64_t seed;
static int dim;
static void *buf;
static size_t bufSize;

static void *need(size_t n)
{
    if (n > bufSize) { free(buf); buf = malloc(n); bufSize = n; }
    return buf;
}

EXPORT(sm_init) void sm_init(int mc, int d, int64_t s)
{
    seed = (uint64_t)s;
    dim = d;
    setupGenerator(&g, mc, 0);
    applySeed(&g, d, seed);
    if (d == DIM_END) initSurfaceNoise(&sn, DIM_END, seed);
}

// Biome ids for a w*h grid at 1:scale, top-left (x,z) in scale units.
// Sampled high above the terrain so 1.18+ cave biomes never show (the map is
// the surface, like Chunkbase's default).
EXPORT(sm_biomes) int *sm_biomes(int scale, int x, int z, int w, int h)
{
    int y = dim == DIM_NETHER ? 64 : 256;   // blocks; the Nether is only 128 tall
    Range r = { scale, x, z, w, h, scale == 1 ? y : y / 4, 1 };   // y is 1:4 unless scale 1
    int *out = need(getMinCacheSize(&g, scale, w, 1, h) * sizeof(int));
    genBiomes(&g, out, r);
    return out;
}

// Positions of one structure type inside the block box [x0,x1) x [z0,z1).
// Writes x,z pairs; returns the count.
EXPORT(sm_structs) int *sm_structs(int type, int x0, int z0, int x1, int z1)
{
    StructureConfig sc;
    int *out = need(4096 * 2 * sizeof(int) + sizeof(int));
    int n = 0;
    if (getStructureConfig(type, g.mc, &sc))
    {
        int span = sc.regionSize * 16;
        int rx0 = floordiv(x0, span), rx1 = floordiv(x1 - 1, span);
        int rz0 = floordiv(z0, span), rz1 = floordiv(z1 - 1, span);
        for (int rz = rz0; rz <= rz1; rz++)
        for (int rx = rx0; rx <= rx1 && n < 4096; rx++)
        {
            Pos p;
            if (!getStructurePos(type, g.mc, seed, rx, rz, &p)) continue;
            if (p.x < x0 || p.x >= x1 || p.z < z0 || p.z >= z1) continue;
            if (!isViableStructurePos(type, &g, p.x, p.z, 0)) continue;
            if (dim == DIM_OVERWORLD && !isViableStructureTerrain(type, &g, p.x, p.z)) continue;
            if (type == End_City && !isViableEndCityTerrain(&g, &sn, p.x, p.z)) continue;
            out[1 + 2*n] = p.x; out[2 + 2*n] = p.z; n++;
        }
    }
    out[0] = n;
    return out;
}

// World spawn (x,z). Overworld only; slow-ish (a biome search), so call once.
EXPORT(sm_spawn) int *sm_spawn(void)
{
    int *out = need(2 * sizeof(int));
    Pos p = getSpawn(&g);
    out[0] = p.x; out[1] = p.z;
    return out;
}

// The first n strongholds (x,z pairs). The game has 128.
EXPORT(sm_strongholds) int *sm_strongholds(int n)
{
    int *out = need(2 * n * sizeof(int));
    StrongholdIter sh;
    initFirstStronghold(&sh, g.mc, seed);
    for (int i = 0; i < n; i++)
    {
        nextStronghold(&sh, &g);
        out[2*i] = sh.pos.x; out[2*i + 1] = sh.pos.z;
    }
    return out;
}

// 1 byte per chunk in a w*h chunk grid from chunk (cx,cz): 1 = slime chunk.
EXPORT(sm_slime) unsigned char *sm_slime(int cx, int cz, int w, int h)
{
    unsigned char *out = need((size_t)w * h);
    for (int j = 0; j < h; j++)
        for (int i = 0; i < w; i++)
            out[j*w + i] = isSlimeChunk(seed, cx + i, cz + j);
    return out;
}

// 256 RGB triplets (cubiomes' Amidst-style palette) and biome names.
EXPORT(sm_colors) unsigned char *sm_colors(void)
{
    unsigned char (*c)[3] = need(256 * 3);
    initBiomeColors(c);
    return (unsigned char *)c;
}

EXPORT(sm_biome_name) const char *sm_biome_name(int mc, int id) { return biome2str(mc, id); }
