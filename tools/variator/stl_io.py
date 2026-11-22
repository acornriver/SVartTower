import struct, numpy as np
def load(p):
    b = open(p, 'rb').read()
    if b[:5].lower() == b'solid' and b'facet' in b[:300]:
        vs = [[float(x) for x in l.split()[1:4]] for l in b.decode('latin1').splitlines() if l.split()[:1] == ['vertex']]
        return np.array(vs, np.float64).reshape(-1, 3, 3)
    n = struct.unpack('<I', b[80:84])[0]
    a = np.frombuffer(b[84:84 + n * 50], dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]))
    return a['v'].astype(np.float64)

def weld(tris, tol=1e-3):
    v = tris.reshape(-1, 3)
    key = np.round(v / tol).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    verts = np.zeros((len(uniq), 3)); cnt = np.zeros(len(uniq))
    np.add.at(verts, inv, v); np.add.at(cnt, inv, 1); verts /= cnt[:, None]
    faces = inv.reshape(-1, 3)
    faces = faces[(faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])]
    return verts, faces

def components(verts, faces):
    par = list(range(len(verts)))
    def f(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for a, b, c in faces:
        ra, rb, rc = f(a), f(b), f(c); par[rb] = ra; par[f(rc)] = ra
    roots = np.array([f(i) for i in range(len(verts))])
    out = []
    for r in np.unique(roots[faces[:, 0]]):
        fm = roots[faces[:, 0]] == r
        fs = faces[fm]; used = np.unique(fs); remap = -np.ones(len(verts), int); remap[used] = np.arange(len(used))
        out.append((verts[used], remap[fs]))
    return out

def edges_with_angles(verts, faces):
    n = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    area = np.linalg.norm(n, axis=1) / 2
    n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    em = {}
    for fi, (a, b, c) in enumerate(faces):
        for e in ((a, b), (b, c), (c, a)):
            k = (min(e), max(e)); em.setdefault(k, []).append(fi)
    E, ang = [], []
    for k, fl in em.items():
        if len(fl) != 2: E.append(k); ang.append(180.0); continue
        d = float(np.clip(n[fl[0]] @ n[fl[1]], -1, 1)); E.append(k); ang.append(np.degrees(np.arccos(d)))
    return np.array(E), np.array(ang), n, area
