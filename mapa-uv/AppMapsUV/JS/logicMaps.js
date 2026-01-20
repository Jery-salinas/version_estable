/**
 * ================================================
 * MAPA UV - Sistema de Rutas del Campus
 * ================================================
 * Archivo: logicMaps.js
 * Rutas:
 *   1. Entrada Principal → Edificio A
 *   2. Cafetería → Edificio P
 * ================================================
 */

// ============================================
// DATOS DEL MAPA
// ============================================
const EDIFICIOS = {
    entrada_principal: { nombre: "Entrada Principal", x: 355, y: 720 },
    edificio_a: { nombre: "Edificio A", x: 350, y: 85 },
    cafeteria: { nombre: "Cafetería", x: 310, y: 255 },
    edificio_p: { nombre: "Edificio P", x: 230, y: 680 }
};

// Agregados calibrados: Entrada Ruiz Cortinez y Edificio F
EDIFICIOS.entrada_ruiz_cortinez = { nombre: "Entrada Ruiz Cortinez", x: 491, y: 241 };
EDIFICIOS.edificio_f = { nombre: "Edificio F", x: 450, y: 422 };

const WAYPOINTS = {
    wp1: { x: 355, y: 680 },
    wp2: { x: 340, y: 620 },
    wp3: { x: 320, y: 550 },
    wp4: { x: 310, y: 480 },
    wp5: { x: 305, y: 400 },
    wp6: { x: 310, y: 320 },
    wp7: { x: 320, y: 250 },
    wp8: { x: 340, y: 180 },
    wp9: { x: 350, y: 120 },
    wp10: { x: 280, y: 550 },
    wp11: { x: 250, y: 600 },
    wp12: { x: 235, y: 650 }
};

// Waypoints específicos para la ruta Entrada Ruiz Cortinez ↔ Edificio F
WAYPOINTS.p1 = { x: 470, y: 276 };
WAYPOINTS.p2 = { x: 449, y: 307 };
WAYPOINTS.p3 = { x: 432, y: 337 };
WAYPOINTS.p4 = { x: 416, y: 368 };
WAYPOINTS.p5 = { x: 396, y: 399 };

const RUTAS = {
    "entrada_principal_to_edificio_a": {
        origen: "entrada_principal",
        destino: "edificio_a",
        puntos: ["entrada_principal", "wp1", "wp2", "wp3", "wp4", "wp5", "wp6", "wp7", "wp8", "wp9", "edificio_a"],
        distancia: "450m",
        tiempo: "5-6 min"
    },
    "cafeteria_to_edificio_p": {
        origen: "cafeteria",
        destino: "edificio_p",
        puntos: ["cafeteria", "wp6", "wp5", "wp4", "wp3", "wp10", "wp11", "wp12", "edificio_p"],
        distancia: "320m",
        tiempo: "4 min"
    }
};

// Ruta calibrada: Entrada Ruiz Cortinez → Punto 1..5 → Edificio F
RUTAS["entrada_ruiz_cortinez_to_edificio_f"] = {
    origen: "entrada_ruiz_cortinez",
    destino: "edificio_f",
    puntos: [
        "entrada_ruiz_cortinez",
        "p1",
        "p2",
        "p3",
        "p4",
        "p5",
        "edificio_f"
    ],
    distancia: "-",
    tiempo: "-"
};

// ============================================
// ESTADO GLOBAL
// ============================================
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;
let svgElement = null;
let routeGroup = null;
let markerLayer = null;
let realtimeMarker = null;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', init);

function init() {
    cargarSVG();
    llenarSelectores();
    configurarEventos();
}

function cargarSVG() {
    const svgContent = document.getElementById('svgContent');
    
    fetch('../assets/MapUVNew.svg')
        .then(response => {
            if (!response.ok) throw new Error('SVG no encontrado');
            return response.text();
        })
        .then(svgText => {
            svgContent.innerHTML = svgText;
            svgElement = svgContent.querySelector('svg');
            
            if (svgElement) {
                // Crear grupo para rutas
                routeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                routeGroup.id = 'route-layer';
                svgElement.appendChild(routeGroup);
                // Crear grupo para marcadores (separa marcadores en tiempo real)
                markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                markerLayer.id = 'marker-layer';
                svgElement.appendChild(markerLayer);
                
                // Ajustar vista inicial
                ajustarVistaInicial();

                // Añadir marcador en tiempo real estilo Google Maps en la coordenada dada
                agregarMarcadorTiempoReal(382, 409);
            }
            
            ocultarLoader();
        })
        .catch(error => {
            console.warn('Error cargando SVG:', error);
            mostrarPlaceholder();
            ocultarLoader();
        });
}

function mostrarPlaceholder() {
    const svgContent = document.getElementById('svgContent');
    svgContent.innerHTML = `
        <svg viewBox="0 0 1056 816" style="width:100%;height:100%;background:#f8faf9;">
            <rect width="1056" height="816" fill="#f0f0f0"/>
            <text x="528" y="400" text-anchor="middle" fill="#666" font-size="24" font-family="Poppins">
                Mapa del Campus
            </text>
            <text x="528" y="440" text-anchor="middle" fill="#999" font-size="14" font-family="Poppins">
                SVG no encontrado - Rutas disponibles
            </text>
        </svg>
    `;
    svgElement = svgContent.querySelector('svg');
    
    // Crear grupo para rutas en placeholder
    routeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    routeGroup.id = 'route-layer';
    svgElement.appendChild(routeGroup);
    // Crear grupo para marcadores en placeholder
    markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markerLayer.id = 'marker-layer';
    svgElement.appendChild(markerLayer);

    // Añadir marcador en tiempo real estilo Google Maps en la coordenada dada
    agregarMarcadorTiempoReal(382, 409);
}

function ajustarVistaInicial() {
    const container = document.getElementById('svgDisplay');
    const containerRect = container.getBoundingClientRect();
    
    // Calcular escala para ajustar el SVG al contenedor
    const svgWidth = 1056;
    const svgHeight = 816;
    
    const scaleX = containerRect.width / svgWidth;
    const scaleY = containerRect.height / svgHeight;
    
    scale = Math.min(scaleX, scaleY) * 0.9;
    translateX = (containerRect.width - svgWidth * scale) / 2;
    translateY = (containerRect.height - svgHeight * scale) / 2;
    
    aplicarTransformacion();
}

function ocultarLoader() {
    const loader = document.getElementById('map-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 300);
    }
}

// ============================================
// SELECTORES
// ============================================
function llenarSelectores() {
    const selectOrigen = document.getElementById('selectOrigen');
    const selectDestino = document.getElementById('selectDestino');
    
    Object.entries(EDIFICIOS).forEach(([id, data]) => {
        selectOrigen.add(new Option(data.nombre, id));
        selectDestino.add(new Option(data.nombre, id));
    });
}

// ============================================
// EVENTOS
// ============================================
function configurarEventos() {
    // Botones
    document.getElementById('btnCalcularRuta').addEventListener('click', calcularRuta);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarRuta);
    document.getElementById('zoomIn').addEventListener('click', () => zoom(1.3));
    document.getElementById('zoomOut').addEventListener('click', () => zoom(0.7));
    document.getElementById('zoomReset').addEventListener('click', resetView);
    
    // Pan & Zoom con mouse/touch
    const svgDisplay = document.getElementById('svgDisplay');
    
    // Mouse
    svgDisplay.addEventListener('mousedown', iniciarArrastre);
    svgDisplay.addEventListener('mousemove', arrastrar);
    svgDisplay.addEventListener('mouseup', terminarArrastre);
    svgDisplay.addEventListener('mouseleave', terminarArrastre);
    svgDisplay.addEventListener('wheel', manejarWheel, { passive: false });
    
    // Touch
    svgDisplay.addEventListener('touchstart', iniciarArrastreTactil, { passive: false });
    svgDisplay.addEventListener('touchmove', arrastrarTactil, { passive: false });
    svgDisplay.addEventListener('touchend', terminarArrastre);
}

// ============================================
// CÁLCULO DE RUTAS
// ============================================
function calcularRuta() {
    const origenId = document.getElementById('selectOrigen').value;
    const destinoId = document.getElementById('selectDestino').value;
    
    if (!origenId || !destinoId) {
        mostrarAlerta('Por favor selecciona origen y destino');
        return;
    }
    
    if (origenId === destinoId) {
        mostrarAlerta('El origen y destino deben ser diferentes');
        return;
    }
    
    // Buscar ruta
    const rutaKey = `${origenId}_to_${destinoId}`;
    const rutaKeyReverse = `${destinoId}_to_${origenId}`;
    let ruta = RUTAS[rutaKey] || RUTAS[rutaKeyReverse];
    
    if (!ruta) {
        mostrarAlerta('No hay ruta disponible.\n\nRutas disponibles:\n• Entrada Principal ↔ Edificio A\n• Cafetería ↔ Edificio P');
        return;
    }
    
    // Determinar si está invertida
    const reversed = ruta.origen !== origenId;
    
    dibujarRuta(ruta, reversed);
    mostrarDistancia(ruta);
}

function dibujarRuta(ruta, reversed = false) {
    if (!routeGroup) return;
    
    // Limpiar rutas anteriores
    routeGroup.innerHTML = '';
    
    // Obtener puntos
    let puntos = [...ruta.puntos];
    if (reversed) puntos = puntos.reverse();
    
    const coordenadas = puntos.map(id => getCoords(id)).filter(c => c !== null);
    
    if (coordenadas.length < 2) return;
    
    // Crear path
    const pathData = coordenadas.map((p, i) => 
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');
    
    // Sombra del path
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shadow.setAttribute('d', pathData);
    shadow.setAttribute('fill', 'none');
    shadow.setAttribute('stroke', 'rgba(0,0,0,0.2)');
    shadow.setAttribute('stroke-width', '10');
    shadow.setAttribute('stroke-linecap', 'round');
    shadow.setAttribute('stroke-linejoin', 'round');
    routeGroup.appendChild(shadow);
    
    // Path principal con animación
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('class', 'route-polyline');
    path.setAttribute('stroke-dasharray', '20 12');
    
    // Animación de la línea
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'stroke-dashoffset');
    animate.setAttribute('from', '0');
    animate.setAttribute('to', '-64');
    animate.setAttribute('dur', '1.5s');
    animate.setAttribute('repeatCount', 'indefinite');
    path.appendChild(animate);
    
    routeGroup.appendChild(path);
    
    // Marcadores de waypoints
    coordenadas.forEach((p, i) => {
        if (i > 0 && i < coordenadas.length - 1) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', '6');
            circle.setAttribute('class', 'route-marker');
            routeGroup.appendChild(circle);
        }
    });
    
    // Marcadores de origen y destino
    const origen = coordenadas[0];
    const destino = coordenadas[coordenadas.length - 1];
    
    // Marcador origen (verde)
    crearMarcadorSVG(origen.x, origen.y, '#4CAF50', 'O');
    
    // Marcador destino (rojo)
    crearMarcadorSVG(destino.x, destino.y, '#F44336', 'D');
}

function crearMarcadorSVG(x, y, color, letra) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x}, ${y})`);
    
    // Pin
    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pin.setAttribute('d', 'M0,-35 C-10,-35 -18,-27 -18,-17 C-18,-7 0,5 0,5 C0,5 18,-7 18,-17 C18,-27 10,-35 0,-35 Z');
    pin.setAttribute('fill', color);
    pin.setAttribute('stroke', '#fff');
    pin.setAttribute('stroke-width', '2');
    pin.setAttribute('filter', 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))');
    g.appendChild(pin);
    
    // Círculo interior
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '-17');
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', '#fff');
    g.appendChild(circle);
    
    // Letra
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '-13');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', color);
    text.setAttribute('font-size', '12');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'Poppins, sans-serif');
    text.textContent = letra;
    g.appendChild(text);
    
    routeGroup.appendChild(g);
}

// Añade un marcador en tiempo real estilo Google Maps en el layer de marcadores
function agregarMarcadorTiempoReal(x, y) {
    if (!markerLayer) return;
    if (realtimeMarker) {
        actualizarMarcadorTiempoReal(x, y);
        return;
    }

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = 'realtime-marker';
    g.setAttribute('transform', `translate(${x}, ${y})`);

    // Pulso (círculo animado)
    const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulse.setAttribute('cx', '0');
    pulse.setAttribute('cy', '-17');
    pulse.setAttribute('r', '8');
    pulse.setAttribute('fill', '#1976D2');
    pulse.setAttribute('opacity', '0.6');

    const animR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animR.setAttribute('attributeName', 'r');
    animR.setAttribute('from', '8');
    animR.setAttribute('to', '28');
    animR.setAttribute('dur', '1.6s');
    animR.setAttribute('repeatCount', 'indefinite');
    pulse.appendChild(animR);

    const animOp = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animOp.setAttribute('attributeName', 'opacity');
    animOp.setAttribute('from', '0.6');
    animOp.setAttribute('to', '0');
    animOp.setAttribute('dur', '1.6s');
    animOp.setAttribute('repeatCount', 'indefinite');
    pulse.appendChild(animOp);

    g.appendChild(pulse);

    // Pin estilo Google (simplificado)
    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pin.setAttribute('d', 'M0,-35 C-10,-35 -18,-27 -18,-17 C-18,-7 0,5 0,5 C0,5 18,-7 18,-17 C18,-27 10,-35 0,-35 Z');
    pin.setAttribute('fill', '#1976D2');
    pin.setAttribute('stroke', '#fff');
    pin.setAttribute('stroke-width', '1.5');
    pin.setAttribute('filter', 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))');
    g.appendChild(pin);

    // Círculo interior blanco
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    inner.setAttribute('cx', '0');
    inner.setAttribute('cy', '-17');
    inner.setAttribute('r', '6');
    inner.setAttribute('fill', '#fff');
    g.appendChild(inner);

    // Centro azul
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', '0');
    center.setAttribute('cy', '-17');
    center.setAttribute('r', '3');
    center.setAttribute('fill', '#1976D2');
    g.appendChild(center);

    markerLayer.appendChild(g);
    realtimeMarker = g;

    // Exponer función de actualización para uso externo
    window.updateRealtimeMarker = actualizarMarcadorTiempoReal;
}

function actualizarMarcadorTiempoReal(x, y) {
    if (!realtimeMarker) return;
    realtimeMarker.setAttribute('transform', `translate(${x}, ${y})`);
}

function getCoords(id) {
    if (EDIFICIOS[id]) return { x: EDIFICIOS[id].x, y: EDIFICIOS[id].y };
    if (WAYPOINTS[id]) return { x: WAYPOINTS[id].x, y: WAYPOINTS[id].y };
    return null;
}

function limpiarRuta() {
    if (routeGroup) routeGroup.innerHTML = '';
    
    document.getElementById('selectOrigen').value = '';
    document.getElementById('selectDestino').value = '';
    
    const infoBadge = document.getElementById('infoBadge');
    infoBadge.classList.remove('show');
}

function mostrarDistancia(ruta) {
    const infoBadge = document.getElementById('infoBadge');
    const distanceInfo = document.getElementById('distanceInfo');
    
    distanceInfo.textContent = `${ruta.distancia} (~${ruta.tiempo})`;
    infoBadge.classList.add('show');
}

// ============================================
// PAN & ZOOM
// ============================================
function zoom(factor) {
    const oldScale = scale;
    scale = Math.min(Math.max(0.3, scale * factor), 4);
    
    // Ajustar translate para zoom centrado
    const container = document.getElementById('svgDisplay');
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    translateX = centerX - (centerX - translateX) * (scale / oldScale);
    translateY = centerY - (centerY - translateY) * (scale / oldScale);
    
    aplicarTransformacion();
}

function resetView() {
    ajustarVistaInicial();
    limpiarRuta();
}

function aplicarTransformacion() {
    const svgContent = document.getElementById('svgContent');
    svgContent.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

// Mouse drag
function iniciarArrastre(e) {
    if (e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    document.getElementById('svgContent').style.cursor = 'grabbing';
}

function arrastrar(e) {
    if (!isDragging) return;
    e.preventDefault();
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    aplicarTransformacion();
}

function terminarArrastre() {
    isDragging = false;
    document.getElementById('svgContent').style.cursor = 'grab';
}

// Touch
function iniciarArrastreTactil(e) {
    if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
    }
}

function arrastrarTactil(e) {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    translateX = e.touches[0].clientX - startX;
    translateY = e.touches[0].clientY - startY;
    aplicarTransformacion();
}

// Wheel zoom
function manejarWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom(factor);
}

// ============================================
// UTILIDADES
// ============================================
function mostrarAlerta(mensaje) {
    alert(mensaje);
}