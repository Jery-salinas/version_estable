# UVMaps — Mapa interno del Campus (demo)

Proyecto demo que muestra un mapa por capas: capa de nodos (SVG), capa detallada (SVG convertido desde DWG) y UI para interactuar (pan/zoom, toggle de capas y trazar rutas simples).

Estructura:

- `index.html` — entrada principal.
- `css/styles.css` — estilos responsivos (mobile-first).
- `js/map.js` — lógica del mapa: carga de capas SVG, pan/zoom, dibujo de rutas.
- `js/ui.js` — funciones de UI y enlace con los botones.
- `assets/capa1_nodes.svg` — capa 1: nodos (ejemplo).
- `assets/capa2_dwg_converted.svg` — capa 2: SVG de ejemplo (simulate DWG convertido).

Cómo usar:

1. Abre `index.html` en el navegador (es una app estática). En móviles, puedes abrir el archivo con un servidor simple (recomendado) como `npx serve` o usando Live Server de VSCode.
2. Reemplaza `assets/capa2_dwg_converted.svg` por el SVG que obtengas al convertir tu DWG (herramientas: Autodesk TrueView + conversor, o servicios/convertidores offline). El SVG resultante debe tener dimensiones compatibles (viewBox) para encajar.
3. Ajusta `assets/capa1_nodes.svg` para colocar nodos con atributos `data-node-id` y `data-node-name`. Los nodos deben ser elementos con `cx/cy` (circles) o cualquier elemento con un `getBBox()` válido.

Notas técnicas y recomendaciones:

- DWG no es nativamente reproducible en navegadores. La estrategia aquí es convertir DWG a SVG y usarlo como capa vectorial (mejor para zoom y estilo). Alternativas: rasterizar a PNG/TIFF y usar como imagen, o integrar un visualizador como Autodesk Forge (requiere API/clave).
- El esquema de interacción implementado usa transformaciones SVG simples (translate/scale). Para map tiles más complejos o georreferenciados considera librerías especializadas (OpenLayers, Leaflet) y un pipeline para convertir coordenadas.
- Para producción: agrega carga diferida de la capa DWG, indicadores de progreso y manejo de errores más robusto.

Próximos pasos sugeridos:

- Añadir interactividad en los nodos (mostrar popup con información del edificio).
- Soporte para múltiples rutas y cálculo de caminos (graph search) en base a una red de aristas.
- Optimizar el SVG convertido para reducir tamaño (limpiar entidades innecesarias).

Si quieres, puedo:

- Añadir conversor/loader automático que convierta un .dwg local (si puedes proveer el archivo) usando herramientas externas.
- Implementar cálculo de rutas A\* sobre una red de caminos definida en un JSON.
