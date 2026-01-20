# Optimizador SVG (Python)

Este script es un optimizador básico de archivos SVG pensado como complemento para la herramienta web `optimizador.html`.

Características:

- Eliminación de comentarios y bloques `<metadata>`
- Eliminación de elementos con `display:none` o `visibility:hidden` (heurística sencilla)
- Eliminación de grupos `<g>` vacíos y `<defs>` vacíos
- Redondeo de números (atributos y coordenadas) con control de decimales
- Exportación de un JSON con coordenadas simples (paths, polygons, rects)

Requisitos

- Python 3.8+
- No hay dependencias externas (stdlib solamente)

Uso rápido:

```powershell
python optimizador.py input.svg -o output.svg --decimals 2 --extract-coords edificios.json
```

Opciones principales:

- `--inplace` : sobrescribe el archivo de entrada
- `--decimals N` : redondeo a N decimales (0..6)
- `--no-comments`, `--no-metadata`, `--no-hidden`, `--no-empty-groups`, `--no-defs` : desactivar pasos
- `--extract-coords archivo.json` : guarda coordenadas extraídas en JSON

Notas

- Esta herramienta realiza optimizaciones básicas mediante análisis de texto/regex. Para optimizaciones más profundas (simplificación de paths, consolidación de estilos, optimizaciones avanzadas) se recomienda integrar herramientas como `svgo` (Node.js) o librerías dedicadas.
