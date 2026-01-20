#!/usr/bin/env python3
"""
Extrae nodos y aristas de un SVG y guarda un JSON con las coordenadas.

Uso:
    python mapa_nodes_extractor.py <input.svg> -o <out.json>

Salida JSON:
{
  "generatedAt": "iso...",
  "nodes": [ {"id":"n0","x":123.4,"y":456.7,"source":"polyline"}, ... ],
  "edges": [ {"from":"n0","to":"n1","weight":12.34}, ... ],
  "buildings": [ {"id":"cafeteria","nombreEdificio":"CAFETERIA","coordX":450,"coordY":520}, ... ]
}

Notas:
- Extrae puntos de <polyline>, <polygon>, <path> (heurístico), <circle>, <rect> (centro).
- Si un elemento SVG tiene atributo `id`, se intenta mantenerlo como id de nodo.
- Agrupa puntos cercanos (tolerancia configurable) para evitar duplicados.
"""
from __future__ import annotations
import argparse
import json
import math
import re
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

NUM_RE = re.compile(r"-?\d*\.?\d+(?:e[-+]?\d+)?", re.IGNORECASE)


def parse_points_list(points_str: str):
    pts = []
    for part in re.split(r"[\s]+", points_str.strip()):
        if not part: continue
        if ',' in part:
            a,b = part.split(',',1)
        else:
            # fallback: two consecutive numbers separated by space handled above
            continue
        try:
            x = float(a); y = float(b)
            pts.append((x,y))
        except Exception:
            continue
    return pts


def parse_path_to_points(d: str):
    # Heurístico: extrae todos los números y los agrupa en pares (x,y)
    nums = NUM_RE.findall(d)
    pts = []
    for i in range(0, len(nums)-1, 2):
        try:
            x = float(nums[i]); y = float(nums[i+1])
            pts.append((x,y))
        except Exception:
            continue
    return pts


def rect_center(x_str, y_str, w_str, h_str):
    try:
        x = float(x_str) if x_str is not None else 0.0
        y = float(y_str) if y_str is not None else 0.0
        w = float(w_str) if w_str is not None else 0.0
        h = float(h_str) if h_str is not None else 0.0
        return (x + w/2.0, y + h/2.0)
    except Exception:
        return None


def circle_center(cx_str, cy_str):
    try:
        return (float(cx_str), float(cy_str))
    except Exception:
        return None


def almost_equal(a, b, tol=1e-3):
    return abs(a-b) <= tol


class NodeIndex:
    def __init__(self, tol=1e-2):
        self.tol = tol
        self.nodes = []  # list of dicts {id,x,y,source}

    def find(self, x, y):
        for n in self.nodes:
            if math.hypot(n['x']-x, n['y']-y) <= self.tol:
                return n['id']
        return None

    def add(self, x, y, preferred_id=None, source='svg'):
        existing = self.find(x,y)
        if existing:
            return existing
        nid = preferred_id if preferred_id and not any(n['id']==preferred_id for n in self.nodes) else f'n{len(self.nodes)}'
        self.nodes.append({'id': nid, 'x': x, 'y': y, 'source': source})
        return nid


def extract(svg_path: Path, tolerance: float=1.0):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    # Handle namespace: get local-name by splitting '}'
    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0].strip('{')

    def local(tag):
        return f'{{{ns}}}{tag}' if ns else tag

    index = NodeIndex(tol=tolerance)
    edges = []
    buildings = []

    # Iterate elements
    for el in root.iter():
        tag = el.tag
        if isinstance(tag, str) and '}' in tag:
            tag_local = tag.split('}',1)[1]
        else:
            tag_local = tag
        tag_local = tag_local.lower()

        # polyline / polygon
        if tag_local in ('polyline','polygon'):
            pts_attr = el.get('points') or ''
            pts = parse_points_list(pts_attr)
            prev_id = None
            for (x,y) in pts:
                nid = index.add(x,y, source=tag_local)
                if prev_id and nid != prev_id:
                    dist = math.hypot(x - next(n for n in index.nodes if n['id']==prev_id)['x'], y - next(n for n in index.nodes if n['id']==prev_id)['y'])
                    edges.append({'from': prev_id, 'to': nid, 'weight': dist})
                prev_id = nid
        elif tag_local == 'path':
            d = el.get('d') or ''
            pts = parse_path_to_points(d)
            prev_id = None
            for (x,y) in pts:
                nid = index.add(x,y, source='path')
                if prev_id and nid != prev_id:
                    a = next(n for n in index.nodes if n['id']==prev_id)
                    b = next(n for n in index.nodes if n['id']==nid)
                    dist = math.hypot(b['x']-a['x'], b['y']-a['y'])
                    edges.append({'from': prev_id, 'to': nid, 'weight': dist})
                prev_id = nid
        elif tag_local == 'circle':
            cx = el.get('cx'); cy = el.get('cy')
            center = circle_center(cx, cy)
            if center:
                x,y = center
                nid = index.add(x,y, preferred_id=el.get('id'), source='circle')
                # If this circle is likely a building marker (has id or class), add to buildings
                if el.get('id') or (el.get('class') and 'node' in el.get('class')):
                    buildings.append({'id': el.get('id') or nid, 'nombreEdificio': el.get('id') or nid, 'coordX': x, 'coordY': y})
        elif tag_local == 'rect':
            xattr = el.get('x'); yattr = el.get('y'); wattr = el.get('width'); hattr = el.get('height')
            center = rect_center(xattr, yattr, wattr, hattr)
            if center:
                x,y = center
                nid = index.add(x,y, preferred_id=el.get('id'), source='rect')
                if el.get('id'):
                    buildings.append({'id': el.get('id'), 'nombreEdificio': el.get('id'), 'coordX': x, 'coordY': y})

    # dedupe edges (unordered)
    seen = set()
    unique_edges = []
    for e in edges:
        key = (e['from'], e['to'])
        if key in seen: continue
        seen.add(key)
        unique_edges.append(e)

    return {
        'generatedAt': datetime.utcnow().isoformat(),
        'nodes': index.nodes,
        'edges': unique_edges,
        'buildings': buildings
    }


def main():
    p = argparse.ArgumentParser(description='Extrae nodos/edges desde un SVG y guarda JSON')
    p.add_argument('svg', type=Path, help='SVG de entrada')
    p.add_argument('-o','--output', type=Path, default=Path('map_nodes.json'), help='JSON de salida')
    p.add_argument('--tolerance', type=float, default=1.0, help='Tolerancia para unir puntos cercanos (px)')
    p.add_argument('--also-generate-edificios-json', type=Path, help='Si se pasa, genera también un JSON tipo edificios (id,nombreEdificio,coordX,coordY)')
    args = p.parse_args()

    svg_path = args.svg
    if not svg_path.exists():
        print('Error: SVG no encontrado:', svg_path)
        return 2

    result = extract(svg_path, tolerance=args.tolerance)
    out_path = args.output
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    print('Guardado:', out_path)
    if args.also_generate_edificios_json:
        # use buildings if present, otherwise create edificios from nodes (first N)
        if result.get('buildings'):
            edificios = result['buildings']
        else:
            # pick nodes with source != 'path' as candidate buildings or take first few
            edificios = []
            for n in result['nodes'][:10]:
                edificios.append({'id': n['id'], 'nombreEdificio': n['id'], 'coordX': n['x'], 'coordY': n['y']})
        args.also_generate_edificios_json.write_text(json.dumps(edificios, indent=2, ensure_ascii=False), encoding='utf-8')
        print('Edificios guardados en:', args.also_generate_edificios_json)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
