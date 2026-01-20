import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # mapa-uv/
DATA = ROOT / 'AppMapsUV' / 'DATA'

walk_path = DATA / 'walk_graph_extracted.json'
edificios_path = DATA / 'edificios_from_map.json'
output_path = DATA / 'walk_graph_with_buildings.json'


def dist(a, b):
    return math.hypot(a[0]-b[0], a[1]-b[1])


def main():
    if not walk_path.exists():
        print('ERROR: no se encontró', walk_path)
        return
    if not edificios_path.exists():
        print('ERROR: no se encontró', edificios_path)
        return

    with open(walk_path, 'r', encoding='utf-8') as f:
        walk = json.load(f)

    with open(edificios_path, 'r', encoding='utf-8') as f:
        edificios_src = json.load(f)
        edificios = edificios_src.get('edificios') or edificios_src

    nodes = walk.get('nodes', [])[:]  # copy
    edges = walk.get('edges', [])[:]  # copy

    # build node lookup for distance
    # Build lookup of ORIGINAL walk nodes only (so buildings attach to real walk nodes,
    # not to other buildings added during the loop)
    node_lookup_walk = {n['id']:(float(n.get('x',0)), float(n.get('y',0))) for n in nodes}

    attached = []

    for b in edificios:
        bid = b.get('id')
        bx = float(b.get('x'))
        by = float(b.get('y'))
        # find nearest walk node (only among original walk nodes)
        nearest_id = None
        nearest_d = float('inf')
        for nid, (nx, ny) in node_lookup_walk.items():
            d = dist((bx,by),(nx,ny))
            if d < nearest_d:
                nearest_d = d
                nearest_id = nid

        # create building node (kept separate)
        bnode = {
            'id': bid,
            'x': bx,
            'y': by,
            'source': 'building',
            'nombre': b.get('nombre'),
            'categoria': b.get('categoria')
        }
        nodes.append(bnode)

        # connect both ways (building <-> nearest walk node)
        edge1 = {'from': bid, 'to': nearest_id, 'weight': nearest_d}
        edge2 = {'from': nearest_id, 'to': bid, 'weight': nearest_d}
        edges.append(edge1)
        edges.append(edge2)

        attached.append({'buildingId': bid, 'attachedTo': nearest_id, 'distance': nearest_d})

    out = {
        'generatedAt': walk.get('generatedAt'),
        'nodes': nodes,
        'edges': edges,
        'buildingsAttached': attached
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print('Generado:', output_path)


if __name__ == '__main__':
    main()
