"""Minimal reader for Minecraft's gzipped NBT (structure block .nbt files). Stdlib only."""
import gzip, struct

def load(path):
    with gzip.open(path, 'rb') as f:
        data = f.read()
    pos = 0

    def take(n):
        nonlocal pos
        b = data[pos:pos + n]; pos += n
        return b

    def string():
        (n,) = struct.unpack('>H', take(2))
        return take(n).decode('utf-8')

    def payload(t):
        if t == 1: return struct.unpack('>b', take(1))[0]
        if t == 2: return struct.unpack('>h', take(2))[0]
        if t == 3: return struct.unpack('>i', take(4))[0]
        if t == 4: return struct.unpack('>q', take(8))[0]
        if t == 5: return struct.unpack('>f', take(4))[0]
        if t == 6: return struct.unpack('>d', take(8))[0]
        if t == 7: (n,) = struct.unpack('>i', take(4)); return list(take(n))
        if t == 8: return string()
        if t == 9:
            et = take(1)[0]; (n,) = struct.unpack('>i', take(4))
            return [payload(et) for _ in range(n)]
        if t == 10:
            out = {}
            while True:
                tt = take(1)[0]
                if tt == 0: return out
                k = string(); out[k] = payload(tt)
        if t == 11: (n,) = struct.unpack('>i', take(4)); return list(struct.unpack('>%di' % n, take(4 * n)))
        if t == 12: (n,) = struct.unpack('>i', take(4)); return list(struct.unpack('>%dq' % n, take(8 * n)))
        raise ValueError('bad tag %d' % t)

    t = take(1)[0]; string()
    return payload(t)
