// ============================================
// VARIABLES GLOBALES
// ============================================

let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;
let currentTheme = 'light';

// Referencias DOM
const svgDisplay = document.getElementById('svgDisplay');
const svgContent = document.getElementById('svgContent');
const mapLoader = document.getElementById('map-loader');
const infoBadge = document.getElementById('infoBadge');
const distanceInfo = document.getElementById('distanceInfo');
const selectOrigen = document.getElementById('selectOrigen');
const selectDestino = document.getElementById('selectDestino');
const btnCalcularRuta = document.getElementById('btnCalcularRuta');
const btnLimpiar = document.getElementById('btnLimpiar');
const toggleThemeBtn = document.getElementById('toggleTheme');

// Datos de edificios (puedes cargar esto desde JSON)
const edificios = [
    { id: 'biblioteca', nombre: 'Biblioteca', coordX: 100, coordY: 100 },
    { id: 'edificioA', nombre: 'Edificio A', coordX: 200, coordY: 150 },
    { id: 'edificioB', nombre: 'Edificio B', coordX: 300, coordY: 200 },
    { id: 'edificioC', nombre: 'Edificio C', coordX: 400, coordY: 250 },
    { id: 'cafeteria', nombre: 'Cafetería', coordX: 250, coordY: 100 },
];

// ============================================
// INICIALIZACIÓN
// ============================================

function init() {
    // Cargar tema guardado
    loadTheme();
    
    // Cargar SVG del mapa
    loadSVGMap();
    
    // Poblar selectores
    populateSelectors();
    
    // Setup event listeners
    setupEventListeners();
}

// ============================================
// CARGA DEL MAPA SVG
// ============================================

async function loadSVGMap() {
    try {
        showLoader(true);
        
        // Ruta al archivo SVG
        const svgPath = '../assets/PLANO_OPTIMIZADO.SVG';
        
        // Fetch del archivo
        const response = await fetch(svgPath);
        if (!response.ok) {
            throw new Error('No se pudo cargar el mapa');
        }
        
        const svgText = await response.text();
        
        // Insertar SVG en el contenedor
        svgContent.innerHTML = svgText;
        
        // Configurar el SVG
        const svgElement = svgContent.querySelector('svg');
        if (svgElement) {
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';
            svgElement.style.display = 'block';
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }
        
        // Aplicar zoom y pan
        resetTransform();
        
        console.log('✅ Mapa cargado correctamente');
        
    } catch (error) {
        console.error('❌ Error al cargar el mapa:', error);
        svgContent.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; flex-direction: column; gap: 10px;">
                <p style="font-size: 18px;">⚠️ Error al cargar el mapa</p>
                <p style="font-size: 14px;">${error.message}</p>
            </div>
        `;
    } finally {
        showLoader(false);
    }
}

// ============================================
// PAN & ZOOM
// ============================================

function setupEventListeners() {
    // Pan & Zoom con mouse
    svgDisplay.addEventListener('mousedown', startDrag);
    svgDisplay.addEventListener('mousemove', drag);
    svgDisplay.addEventListener('mouseup', endDrag);
    svgDisplay.addEventListener('mouseleave', endDrag);
    svgDisplay.addEventListener('wheel', zoom, { passive: false });
    
    // Touch events para móviles
    svgDisplay.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgDisplay.addEventListener('touchmove', handleTouchMove, { passive: false });
    svgDisplay.addEventListener('touchend', handleTouchEnd);
    
    // Controles de zoom
    document.getElementById('zoomIn').addEventListener('click', () => {
        scale = Math.min(scale * 1.3, 10);
        updateTransform();
    });
    
    document.getElementById('zoomOut').addEventListener('click', () => {
        scale = Math.max(scale / 1.3, 0.1);
        updateTransform();
    });
    
    document.getElementById('zoomReset').addEventListener('click', resetTransform);
    
    // Botones de acción
    btnCalcularRuta.addEventListener('click', calcularRuta);
    btnLimpiar.addEventListener('click', limpiarSeleccion);
    
    // Theme toggle
    toggleThemeBtn.addEventListener('click', toggleTheme);
}

function startDrag(e) {
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    svgContent.style.cursor = 'grabbing';
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
}

function endDrag() {
    isDragging = false;
    svgContent.style.cursor = 'grab';
}

function zoom(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = scale * delta;
    
    // Limitar el zoom
    if (newScale >= 0.1 && newScale <= 10) {
        scale = newScale;
        updateTransform();
    }
}

// Touch events para móviles
let touchStartDist = 0;
let touchStartScale = 1;
let lastTouchX = 0;
let lastTouchY = 0;

function handleTouchStart(e) {
    if (e.touches.length === 1) {
        // Pan con un dedo
        isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        // Zoom con dos dedos
        e.preventDefault();
        isDragging = false;
        touchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
        touchStartScale = scale;
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 1 && isDragging) {
        // Pan
        e.preventDefault();
        const deltaX = e.touches[0].clientX - lastTouchX;
        const deltaY = e.touches[0].clientY - lastTouchY;
        translateX += deltaX;
        translateY += deltaY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        updateTransform();
    } else if (e.touches.length === 2) {
        // Zoom
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
        const newScale = touchStartScale * (currentDist / touchStartDist);
        
        if (newScale >= 0.1 && newScale <= 10) {
            scale = newScale;
            updateTransform();
        }
    }
}

function handleTouchEnd(e) {
    if (e.touches.length === 0) {
        isDragging = false;
    }
}

function getTouchDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateTransform() {
    if (svgContent) {
        svgContent.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
}

function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
}

// ============================================
// SELECTORES Y RUTAS
// ============================================

function populateSelectors() {
    // Limpiar opciones existentes
    selectOrigen.innerHTML = '<option value="">Seleccionar origen...</option>';
    selectDestino.innerHTML = '<option value="">Seleccionar destino...</option>';
    
    // Agregar edificios
    edificios.forEach(edificio => {
        const optionOrigen = document.createElement('option');
        optionOrigen.value = edificio.id;
        optionOrigen.textContent = edificio.nombre;
        selectOrigen.appendChild(optionOrigen);
        
        const optionDestino = document.createElement('option');
        optionDestino.value = edificio.id;
        optionDestino.textContent = edificio.nombre;
        selectDestino.appendChild(optionDestino);
    });
}

function calcularRuta() {
    const origenId = selectOrigen.value;
    const destinoId = selectDestino.value;
    
    if (!origenId || !destinoId) {
        alert('Por favor selecciona origen y destino');
        return;
    }
    
    if (origenId === destinoId) {
        alert('El origen y destino deben ser diferentes');
        return;
    }
    
    const origen = edificios.find(e => e.id === origenId);
    const destino = edificios.find(e => e.id === destinoId);
    
    if (!origen || !destino) {
        alert('Error al encontrar los edificios');
        return;
    }
    
    // Calcular distancia (ejemplo simple - Euclidiana)
    const distancia = Math.sqrt(
        Math.pow(destino.coordX - origen.coordX, 2) + 
        Math.pow(destino.coordY - origen.coordY, 2)
    );
    
    // Mostrar información
    distanceInfo.textContent = `${distancia.toFixed(0)} metros aprox.`;
    infoBadge.classList.add('show');
    
    console.log(`📍 Ruta: ${origen.nombre} → ${destino.nombre}`);
    console.log(`📏 Distancia: ${distancia.toFixed(2)} unidades`);
    
    // Aquí puedes implementar tu algoritmo de rutas (Dijkstra, A*, etc.)
    // y dibujar la ruta en el SVG
}

function limpiarSeleccion() {
    selectOrigen.value = '';
    selectDestino.value = '';
    infoBadge.classList.remove('show');
    console.log('🔄 Selección limpiada');
}

// ============================================
// TEMA CLARO/OSCURO
// ============================================

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveTheme();
}

function applyTheme() {
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggleThemeBtn.textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        toggleThemeBtn.textContent = '🌙';
    }
}

function saveTheme() {
    localStorage.setItem('theme', currentTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        currentTheme = savedTheme;
        applyTheme();
    }
}

// ============================================
// UTILIDADES
// ============================================

function showLoader(show) {
    if (show) {
        mapLoader.style.display = 'flex';
    } else {
        mapLoader.style.display = 'none';
    }
}

// ============================================
// CARGAR EDIFICIOS DESDE JSON (OPCIONAL)
// ============================================

async function loadEdificiosFromJSON() {
    try {
        const response = await fetch('data/edificios.json');
        if (!response.ok) {
            throw new Error('No se pudo cargar edificios.json');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al cargar edificios:', error);
        return null;
    }
}

// ============================================
// INICIAR APLICACIÓN
// ============================================

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}