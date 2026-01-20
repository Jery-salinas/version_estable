#!/usr/bin/env python3
"""
Optimizador básico de SVG (CLI)

Características:
- Eliminar comentarios
- Eliminar <metadata>
- Eliminar elementos con display:none o visibility:hidden
- Eliminar grupos vacíos (<g>) y <defs> vacíos
- Redondear números en atributos y en path 'd' según precisión
- Extraer coordenadas sencillas (paths, polygon/polyline, rect)

Uso:
    python optimizador.py input.svg -o output.svg --decimals 2 --extract-coords edificios.json

No usa dependencias externas (solo la stdlib).
"""

from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Tuple


FLOAT_RE = re.compile(r"-?\d*\.\d+|-?\d+")
COMMENT_RE = re.compile(r"<!--([\s\S]*?)-->")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def remove_comments(svg: str) -> str:
    return COMMENT_RE.sub("", svg)


def round_number_str(match: re.Match, decimals: int) -> str:
    s = match.group(0)
    try:
        n = float(s)
    except Exception:
        return s
    fmt = f"{0:.{decimals}f}"  # placeholder
    return format(n, f".{decimals}f").rstrip('0').rstrip('.') if '.' in format(n, f".{decimals}f") else format(n, f".{decimals}f")


def round_numbers_in_text(s: str, decimals: int) -> str:
    # Round all floats/ints found in the string to the specified decimals
    def repl(m: re.Match) -> str:
        t = m.group(0)
        # keep integers as-is if decimals == 0
        try:
            v = float(t)
        except Exception:
            return t
        if decimals == 0:
            return str(int(round(v)))
        return format(v, f".{decimals}f").rstrip('0').rstrip('.')
    return FLOAT_RE.sub(repl, s)


def remove_metadata(svg: str) -> str:
    # Remove <metadata>...</metadata> blocks (case-insensitive)
    return re.sub(r"<metadata[\s\S]*?<\/metadata>", "", svg, flags=re.IGNORECASE)


def remove_defs_empty(svg: str) -> str:
    return re.sub(r"<defs>\s*<\/defs>", "", svg, flags=re.IGNORECASE)


def remove_empty_groups(svg: str) -> str:
    # remove simple empty <g></g>
    prev = None
    out = svg
    # iterate until no change to remove nested empty groups
    while prev != out:
        prev = out
        out = re.sub(r"<g[^>]*>\s*<\/g>", "", out, flags=re.IGNORECASE)
    return out


def remove_hidden_elements(svg: str) -> str:
    # Remove tags that have style="...display:none..." or display="none" or visibility="hidden"
    # Simple heuristic; won't cover all CSS cases
    out = re.sub(r'<[^>]+style\s*=\s*"[^"]*(display\s*:\s*none|visibility\s*:\s*hidden)[^\"]*"[^>]*>\s*<\/[^>]+>', '', svg, flags=re.IGNORECASE)
    out = re.sub(r'<[^>]+(?:display\s*=\s*"none"|visibility\s*=\s*"hidden")[^>]*>\s*<\/[^>]+>', '', out, flags=re.IGNORECASE)
    return out


def round_attributes(svg: str, decimals: int) -> str:
    # Round numbers in common attributes: x,y,width,height,points,transform,d attributes etc.
    # For simplicity, we will replace numbers globally, but be careful to not mangle IDs.
    # Strategy: round numbers inside attribute values only, using a regex that finds attribute="..."

    def attr_repl(m: re.Match) -> str:
        attr = m.group(1)
        val = m.group(2)
        # Special handling for points attribute (pairs separated by spaces)
        if attr.lower() == 'points':
            parts = re.split(r"\s+", val.strip())
            new_parts = []
            for p in parts:
                coords = p.split(',')
                new_coords = []
                for c in coords:
                    try:
                        v = float(c)
                        if decimals == 0:
                            new_coords.append(str(int(round(v))))
                        else:
                            new_coords.append(format(v, f".{decimals}f").rstrip('0').rstrip('.'))
                    except Exception:
                        new_coords.append(c)
                new_parts.append(','.join(new_coords))
            return f'{attr}="{' '.join(new_parts)}'
        # For d attribute or transform or any other attribute, round numbers
        new_val = FLOAT_RE.sub(lambda mm: format(float(mm.group(0)), f".{decimals}f").rstrip('0').rstrip('.'), val) if decimals >= 0 else val
        return f'{attr}="{new_val}"'

    # apply to attributes
    out = re.sub(r'([a-zA-Z:\-]+)\s*=\s*"([^"]*)"', attr_repl, svg)
    return out


def extract_coordinates(svg: str) -> dict:
    # Simple extraction using regex to find path d, polygon/polyline points, rects
    paths = re.findall(r'<path[^>]*d\s*=\s*"([^"]+)"[^>]*>', svg, flags=re.IGNORECASE)
    polys = re.findall(r'<(polygon|polyline)[^>]*points\s*=\s*"([^"]+)"[^>]*>', svg, flags=re.IGNORECASE)
    rects = re.findall(r'<rect[^>]*>', svg, flags=re.IGNORECASE)

    items = []
    for i, d in enumerate(paths, 1):
        items.append({'type': 'path', 'id': f'path_{i}', 'd': d})
    for i, (tag, pts) in enumerate(polys, 1):
        items.append({'type': tag.lower(), 'id': f'{tag.lower()}_{i}', 'points': pts})
    for i, r in enumerate(rects, 1):
        # extract attributes x,y,width,height if present
        x = re.search(r'x\s*=\s*"([^"]+)"', r, flags=re.IGNORECASE)
        y = re.search(r'y\s*=\s*"([^"]+)"', r, flags=re.IGNORECASE)
        w = re.search(r'width\s*=\s*"([^"]+)"', r, flags=re.IGNORECASE)
        h = re.search(r'height\s*=\s*"([^"]+)"', r, flags=re.IGNORECASE)
        items.append({'type': 'rect', 'id': f'rect_{i}', 'x': x.group(1) if x else None, 'y': y.group(1) if y else None, 'width': w.group(1) if w else None, 'height': h.group(1) if h else None})
    return {'generatedAt': None, 'items': items}


def optimize_svg_text(svg_text: str, *, remove_comments_flag=True, remove_metadata_flag=True, remove_hidden_flag=True, remove_empty_groups_flag=True, remove_defs_flag=True, decimals: int = 1) -> Tuple[str, dict]:
    orig = svg_text
    s = svg_text
    if remove_comments_flag:
        s = remove_comments(s)
    if remove_metadata_flag:
        s = remove_metadata(s)
    if remove_hidden_flag:
        s = remove_hidden_elements(s)
    if remove_empty_groups_flag:
        s = remove_empty_groups(s)
    if remove_defs_flag:
        s = remove_defs_empty(s)
    # Round numbers in attributes and data
    if decimals is not None and decimals >= 0:
        s = round_numbers_in_text(s, decimals)
    # cleanup excessive whitespace
    s = re.sub(r'\s{2,}', ' ', s)
    stats = {
        'original_bytes': len(orig.encode('utf-8')),
        'optimized_bytes': len(s.encode('utf-8'))
    }
    return s, stats


def main(argv=None):
    parser = argparse.ArgumentParser(description='Optimizador básico de SVG')
    parser.add_argument('input', type=Path, help='Archivo SVG de entrada')
    parser.add_argument('-o', '--output', type=Path, help='Archivo SVG de salida (si no se especifica, añade .opt.svg)')
    parser.add_argument('--inplace', action='store_true', help='Sobrescribir el archivo de entrada')
    parser.add_argument('--decimals', type=int, default=1, help='Cantidad de decimales para redondeo (0..6)')
    parser.add_argument('--no-comments', dest='comments', action='store_false', help='No eliminar comentarios')
    parser.add_argument('--no-metadata', dest='metadata', action='store_false', help='No eliminar metadata')
    parser.add_argument('--no-hidden', dest='hidden', action='store_false', help='No eliminar elementos ocultos')
    parser.add_argument('--no-empty-groups', dest='emptygroups', action='store_false', help='No eliminar grupos vacíos')
    parser.add_argument('--no-defs', dest='defs', action='store_false', help='No eliminar defs vacíos')
    parser.add_argument('--extract-coords', type=Path, help='Generar JSON con coordenadas extraídas')
    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f'Error: {args.input} no existe', file=sys.stderr)
        return 2

    text = read_text(args.input)
    optimized_text, stats = optimize_svg_text(
        text,
        remove_comments_flag=args.comments,
        remove_metadata_flag=args.metadata,
        remove_hidden_flag=args.hidden,
        remove_empty_groups_flag=args.emptygroups,
        remove_defs_flag=args.defs,
        decimals=max(0, min(6, args.decimals if args.decimals is not None else 1))
    )

    out_path = args.output
    if args.inplace:
        out_path = args.input
    if out_path is None:
        out_path = args.input.with_name(args.input.stem + '.opt.svg')

    write_text(out_path, optimized_text)

    orig_b = stats['original_bytes']
    opt_b = stats['optimized_bytes']
    red = (1 - (opt_b / orig_b)) * 100 if orig_b > 0 else 0
    print(f'Original: {orig_b} bytes')
    print(f'Optimizado: {opt_b} bytes')
    print(f'Reducción: {red:.1f}%')
    print(f'Archivo de salida: {out_path}')

    if args.extract_coords:
        coords = extract_coordinates(optimized_text)
        coords['generatedAt'] = __import__('datetime').datetime.utcnow().isoformat()
        write_text(args.extract_coords, json.dumps(coords, indent=2, ensure_ascii=False))
        print(f'Coordenadas extraídas: {args.extract_coords}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
