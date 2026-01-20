import json
import heapq
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'AppMapsUV' / 'DATA'
GFILE = DATA / 'walk_graph_with_buildings.json'

def load_graph(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    nodes = {n['id']: n for n in data.get('nodes', [])}
    adj = {}
    for n in nodes:
        adj[n] = []
    for e in data.get('edges', []):
        adj.setdefault(e['from'], []).append((e['to'], float(e['weight'])))
    buildings = []
    # collect buildings: nodes with source=='building' or present in buildingsAttached
    for n in nodes.values():
        if n.get('source') == 'building' or n.get('nombre') or n.get('nombreEdificio'):
            buildings.append(n['id'])
    # fallback: use buildingsAttached list if present
    if not buildings and data.get('buildingsAttached'):
        buildings = [b['buildingId'] for b in data['buildingsAttached']]

    return nodes, adj, buildings


def dijkstra(adj, start, goal):
    # returns (distance, path list) or (None, None) if no path
    dist = {start: 0.0}
    prev = {}
    pq = [(0.0, start)]
    visited = set()
    while pq:
        d, u = heapq.heappop(pq)
        if u in visited: continue
        visited.add(u)
        if u == goal:
            break
        for v, w in adj.get(u, []):
            nd = d + w
            if v not in dist or nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    if goal not in dist:
        return None, None
    # reconstruct
    path = []
    cur = goal
    while True:
        path.append(cur)
        if cur == start:
            break
        cur = prev.get(cur)
        if cur is None:
            break
    path.reverse()
    return dist[goal], path


def human_name(node, nodes):
    n = nodes.get(node, {})
    return n.get('nombre') or n.get('nombreEdificio') or node


def find_routes(nodes, adj, buildings, count=3):
    examples = []
    # try pairs choosing diverse origins
    total = len(buildings)
    # heuristic: pick some spread-out indices
    indices = [0, total//3, (2*total)//3]
    tried = set()
    for i in indices:
        for j in range(total-1, -1, -1):
            if i==j: continue
            a = buildings[i]
            b = buildings[j]
            if (a,b) in tried: continue
            tried.add((a,b))
            dist, path = dijkstra(adj, a, b)
            if path and len(path) > 1:
                examples.append((a,b,dist,path))
                if len(examples) >= count:
                    return examples
    # fallback: brute-force until we have count
    for i in range(total):
        for j in range(i+1, total):
            a = buildings[i]
            b = buildings[j]
            if (a,b) in tried: continue
            tried.add((a,b))
            dist, path = dijkstra(adj, a, b)
            if path and len(path) > 1:
                examples.append((a,b,dist,path))
                if len(examples) >= count:
                    return examples
    return examples


def main():
    if not GFILE.exists():
        print('ERROR: No se encuentra', GFILE)
        return
    nodes, adj, buildings = load_graph(GFILE)
    print(f'Nodos totales: {len(nodes)}, edificios detectados: {len(buildings)}')
    examples = find_routes(nodes, adj, buildings, count=3)
    if not examples:
        print('No se encontraron rutas entre edificios.')
        return
    out = []
    for a,b,dist,path in examples:
        route = {
            'origen_id': a,
            'origen_nombre': human_name(a,nodes),
            'destino_id': b,
            'destino_nombre': human_name(b,nodes),
            'distance_units': dist,
            'approx_meters': round(dist * 0.5, 1),
            'path': [ {'id': pid, 'name': human_name(pid,nodes), 'x': nodes[pid].get('x'), 'y': nodes[pid].get('y')} for pid in path ]
        }
        out.append(route)
    # print nicely
    for i, r in enumerate(out, start=1):
        print(f"\nRuta #{i}: {r['origen_nombre']} ({r['origen_id']}) → {r['destino_nombre']} ({r['destino_id']})")
        print(f"  Distancia (unidades SVG): {r['distance_units']:.2f} — aprox. {r['approx_meters']} m")
        print('  Camino:')
        for step in r['path']:
            print(f"    - {step['name']} ({step['id']}) @ ({step['x']}, {step['y']})")

if __name__ == '__main__':
    main()
