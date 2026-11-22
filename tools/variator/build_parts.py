"""STL 47개 → 청감타워용 와이어프레임 데이터(variator-parts.js)
사용: python3 build_parts.py <STL 폴더> <출력 variator-parts.js>
- 정점을 합치고, 떨어진 조각(필터 링 4개 등)은 따로 나눔
- 선: 두 면이 EDGE_DEG도 이상 꺾이는 모서리 + 열린 모서리. 크게 꺾이는 선(FEATURE_DEG 이상)을 앞에 둬서 작게 보일 때는 그것만 그림
- 바닥에 놓일 수 있는 안정 자세(볼록 껍질 면)를 미리 계산
"""
import sys, os, glob, json, base64, re, numpy as np
from scipy.spatial import ConvexHull
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stl_io import load, weld, components, edges_with_angles

EDGE_DEG, FEATURE_DEG, QUANT = 8.0, 25.0, 0.01   # QUANT: mm 단위 저장 간격

STAGES = {'01': '첫 시제품 (11-03)', '02': '시험 조각 1차', '03': '2차, 자리 안 맞아 버린 판 (11-04)', '04': '2차 판과 시험 부품 (11-04)',
          '05': '레진용 구멍 보정 전 (11-06)', '06': 'A1 프린터 시험 조각 (11-11)', '07': 'A1 최종 (11-19)'}

def centroid(v, f):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    vol = np.einsum('ij,ij->i', a, np.cross(b, c)) / 6
    if abs(vol.sum()) > 1e-6:
        return ((a + b + c) / 4 * vol[:, None]).sum(0) / vol.sum()
    ar = np.linalg.norm(np.cross(b - a, c - a), axis=1)
    return ((a + b + c) / 3 * ar[:, None]).sum(0) / ar.sum()

def rest_poses(v, com):
    try:
        h = ConvexHull(v)
    except Exception:
        return [[0, 0, -1, 1.0]]
    groups = []
    for simp, eq in zip(h.simplices, h.equations):
        n = eq[:3]
        for g in groups:
            if g['n'] @ n > 0.9995 and abs(g['d'] - eq[3]) < 0.05:
                g['tris'].append(simp); break
        else:
            groups.append({'n': n, 'd': eq[3], 'tris': [simp]})
    out = []
    for g in groups:
        n = g['n']; area = 0; inside = False
        p = com - (com @ n + g['d']) * n           # 무게중심을 그 면 평면에 내린 점
        for t in g['tris']:
            A, B, C = v[t]
            area += np.linalg.norm(np.cross(B - A, C - A)) / 2
            v0, v1, v2 = C - A, B - A, p - A
            d00, d01, d02, d11, d12 = v0 @ v0, v0 @ v1, v0 @ v2, v1 @ v1, v1 @ v2
            den = d00 * d11 - d01 * d01
            if den > 1e-12:
                u = (d11 * d02 - d01 * d12) / den; w = (d00 * d12 - d01 * d02) / den
                if u >= -1e-6 and w >= -1e-6 and u + w <= 1 + 1e-6: inside = True
        if inside and area > 0: out.append((area, n))
    if not out:
        out = [(1.0, h.equations[0][:3])]
    # 둥근 옆면은 좁은 면 여러 개로 쪼개져 있으므로, 방향이 비슷한(25° 안) 자세끼리 넓이를 합친다
    out.sort(key=lambda x: -x[0])
    clusters = []
    for area, n in out:
        for cl in clusters:
            if cl[1] @ n > np.cos(np.radians(25)):
                cl[0] += area; break
        else:
            clusters.append([area, n])
    out = sorted(clusters, key=lambda x: -x[0])[:6]
    tot = sum(a for a, _ in out)
    return [[round(float(n[0]), 4), round(float(n[1]), 4), round(float(n[2]), 4), round(a / tot, 3)] for a, n in out]

def b64(arr):
    return base64.b64encode(arr.tobytes()).decode('ascii')

def main(src, out):
    files = []
    stats = []
    for p in sorted(glob.glob(os.path.join(src, '*.stl'))):
        name = os.path.basename(p)[:-4]
        verts, faces = weld(load(p))
        comps = []
        for cv, cf in components(verts, faces):
            if len(cf) < 4: continue
            E, ang, _, _ = edges_with_angles(cv, cf)
            keep = ang >= EDGE_DEG
            E, ang = E[keep], ang[keep]
            order = np.argsort(~(ang >= FEATURE_DEG), kind='stable')
            E, ang = E[order], ang[order]
            nf = int((ang >= FEATURE_DEG).sum())
            used = np.unique(E); remap = -np.ones(len(cv), int); remap[used] = np.arange(len(used))
            vv = cv[used]; E = remap[E]
            lo, hi = cv.min(0), cv.max(0); c = (lo + hi) / 2
            com = centroid(cv, cf) - c
            q = np.round((vv - c) / QUANT).astype('<i2')
            comps.append({'v': b64(q), 'e': b64(E.astype('<u2')), 'nf': nf, 'size': [round(float(x), 2) for x in hi - lo],
                          'rest': rest_poses(cv - c, com)})
            stats.append((name, len(vv), len(E), nf))
        m = re.match(r'(\d\d)_', name)
        files.append({'name': name, 'stage': STAGES.get(m.group(1) if m else '', ''), 'comps': comps})
    data = {'version': 1, 'unit': 'mm', 'quant': QUANT, 'edgeDeg': EDGE_DEG, 'featureDeg': FEATURE_DEG, 'files': files}
    head = ('/* 아날로그 다변기 시행착오 3D 파일 47개 → 청감타워 바닥 이스터에그용 와이어프레임 데이터\n'
            ' * 원본: 아날로그다변기_시행착오_3D_1000 (STL, mm, 파일당 삼각형 최대 1000개)\n'
            ' * 만든 방법: tools/build_parts.py (정점 합침 → 떨어진 조각 분리 → %g° 이상 꺾이는 모서리만 → 안정 자세 계산)\n'
            ' * v: Int16 xyz (단위 quant mm, 조각 중심 기준) / e: Uint16 선 (정점 번호 쌍, 크게 꺾이는 선 nf개가 앞) / rest: 바닥에 닿는 면의 바깥 방향 + 확률\n'
            ' * 이 파일은 손으로 고치지 말고 다시 만들 것 */\n' % EDGE_DEG)
    with open(out, 'w', encoding='utf-8') as fo:
        fo.write(head + 'window.VARIATOR_PARTS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    nc = sum(len(f['comps']) for f in files)
    print(f'files {len(files)}  pieces {nc}  verts {sum(s[1] for s in stats)}  edges {sum(s[2] for s in stats)}  bytes {os.path.getsize(out)}')
    for s in stats:
        if s[2] > 1400 or s[2] < 30: print('  note', s)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
