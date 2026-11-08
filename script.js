const MARS_RADIUS_KM = 3389.5;
// Обидві карти (основна 0 та сусідня 1 на стику) + ліва копія -1 для повного кругового огляду
const WORLD_OFFSETS = [0, 1, -1];

const MARS_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg';

// Миттєвий прелоадинг текстури в кеш браузера для швидкого відображення карт
const marsPreloadImg = new Image();
marsPreloadImg.src = MARS_TEXTURE_URL;

// ============================================================================
// ОПТИМІЗОВАНИЙ АЛГОРИТМ ЗГЛАДЖУВАННЯ (ЛЕГКИЙ ДЛЯ GPU CANVAS)
// ============================================================================
function smoothClosedPolygon(rawCoords, iterations = 2, maxStepDeg = 2.0) {
    if (!rawCoords || rawCoords.length < 3) return rawCoords;

    let pts = [];
    const n0 = rawCoords.length;
    for (let i = 0; i < n0; i++) {
        const p1 = rawCoords[i];
        const p2 = rawCoords[(i + 1) % n0];
        pts.push([p1[0], p1[1]]);
        const dLat = p2[0] - p1[0];
        const dLon = p2[1] - p1[1];
        const dist = Math.hypot(dLat, dLon);
        if (dist > maxStepDeg) {
            const steps = Math.ceil(dist / maxStepDeg);
            for (let s = 1; s < steps; s++) {
                const t = s / steps;
                pts.push([p1[0] + dLat * t, p1[1] + dLon * t]);
            }
        }
    }

    for (let it = 0; it < iterations; it++) {
        const next = [];
        const len = pts.length;
        for (let i = 0; i < len; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % len];
            next.push([
                0.75 * p1[0] + 0.25 * p2[0],
                0.75 * p1[1] + 0.25 * p2[1]
            ]);
            next.push([
                0.25 * p1[0] + 0.75 * p2[0],
                0.25 * p1[1] + 0.75 * p2[1]
            ]);
        }
        pts = next;
    }
    return pts;
}

function createPolarCapCoords(latBase, isNorth) {
    const coords = [];
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
        coords.push([latBase, -180 + (i / steps) * 360]);
    }
    coords.push([isNorth ? 89.99 : -89.99, 180]);
    coords.push([isNorth ? 89.99 : -89.99, -180]);
    return coords;
}

// ============================================================================
// 1. КАТАЛОГ ЗОН МАРСА
// ============================================================================
const MARS_ZONES = [
    // === НЕБЕЗПЕЧНІ ЗОНИ ===
    {
        id: 'valles_marineris',
        name: 'Долина Марінера та хаос Аврора (Valles Marineris & Aurorae Chaos)',
        type: 'hazard',
        coords: [
            [-0.5, -78.0], [-1.8, -68.0], [-3.0, -59.0], [-5.5, -45.0],
            [-6.5, -40.0], [-7.0, -32.0], [-12.0, -30.0], [-15.0, -34.0],
            [-16.0, -42.0], [-18.0, -55.0], [-15.0, -68.0], [-13.5, -78.0],
            [-11.0, -88.0], [-8.0, -94.0], [-4.0, -92.0], [-1.5, -85.0]
        ]
    },
    {
        id: 'noctis_labyrinthus',
        name: 'Лабіринт Ночі (Noctis Labyrinthus)',
        type: 'hazard',
        coords: [
            [-4.5, -106.0], [-4.5, -96.5], [-8.5, -96.0], [-12.5, -97.0],
            [-14.0, -101.0], [-12.5, -107.0], [-8.0, -108.0]
        ]
    },
    {
        id: 'olympus_mons',
        name: 'Олімп (Olympus Mons)',
        type: 'hazard',
        coords: [
            [23.5, -134.0], [22.8, -130.0], [20.5, -127.0], [17.0, -126.5],
            [14.0, -128.5], [13.0, -133.0], [14.2, -138.0], [16.5, -141.0],
            [20.0, -141.5], [22.5, -138.5]
        ]
    },
    {
        id: 'ascraeus_mons',
        name: 'Гора Аскрійська (Ascraeus Mons)',
        type: 'hazard',
        coords: [
            [13.8, -105.5], [13.2, -102.5], [11.5, -101.5], [9.8, -103.0],
            [9.5, -106.0], [11.0, -107.5], [12.8, -107.0]
        ]
    },
    {
        id: 'pavonis_mons',
        name: 'Гора Павоніс (Pavonis Mons)',
        type: 'hazard',
        coords: [
            [2.5, -114.2], [2.0, -111.5], [0.5, -110.5], [-1.0, -111.8],
            [-1.2, -114.5], [0.2, -116.0], [1.8, -115.8]
        ]
    },
    {
        id: 'arsia_mons',
        name: 'Гора Арсія (Arsia Mons)',
        type: 'hazard',
        coords: [
            [-7.2, -122.0], [-7.8, -119.0], [-9.5, -118.0], [-11.2, -119.5],
            [-11.5, -122.5], [-10.2, -124.5], [-8.5, -124.0]
        ]
    },
    {
        id: 'elysium_mons',
        name: 'Гора Елізій (Elysium Mons)',
        type: 'hazard',
        coords: [
            [27.5, 145.5], [27.0, 149.0], [25.0, 151.0], [23.0, 149.5],
            [22.5, 146.0], [24.0, 143.5], [26.2, 143.8]
        ]
    },
    {
        id: 'hellas_rim',
        name: 'Вал басейну Еллада - Хребет Геллеспонт (Hellas Western Rim)',
        type: 'hazard',
        coords: [
            [-32.0, 48.0], [-35.0, 56.0], [-45.0, 57.0], [-55.0, 52.0],
            [-58.0, 44.0], [-48.0, 40.0], [-38.0, 42.0]
        ]
    },
    {
        id: 'argyre_rim',
        name: 'Вал басейну Аргір (Argyre Rim)',
        type: 'hazard',
        coords: [
            [-45.0, -46.0], [-44.0, -40.0], [-47.0, -35.0], [-52.0, -36.0],
            [-55.0, -42.0], [-54.0, -49.0], [-49.0, -51.0], [-46.0, -49.0]
        ]
    },
    {
        id: 'aram_chaos',
        name: 'Хаос Арам (Aram Chaos)',
        type: 'hazard',
        coords: [
            [4.5, -23.0], [4.0, -18.5], [1.5, -18.0], [0.5, -22.0], [2.0, -24.5]
        ]
    },
    {
        id: 'medusae_fossae',
        name: 'Борозни Медузи (Medusae Fossae)',
        type: 'hazard',
        coords: [
            [2.0, -172.0], [3.5, -160.0], [1.0, -148.0], [-1.5, -145.0],
            [-4.5, -155.0], [-3.0, -168.0], [-1.0, -175.0]
        ]
    },
    {
        id: 'syrtis_calderas',
        name: 'Кальдери Сиртіс Майор (Syrtis Calderas)',
        type: 'hazard',
        coords: [
            [12.0, 66.0], [11.5, 71.5], [8.0, 72.5], [5.0, 69.0], [6.0, 65.0], [9.5, 64.0]
        ]
    },
    {
        id: 'schiaparelli',
        name: 'Кратер Скіапареллі (Schiaparelli Crater)',
        type: 'hazard',
        coords: [
            [0.5, 15.0], [0.0, 18.5], [-2.0, 20.0], [-4.5, 19.5],
            [-5.8, 16.5], [-4.5, 13.5], [-2.0, 13.0], [-0.5, 14.0]
        ]
    },
    {
        id: 'planum_australe',
        name: 'Південна полярна шапка (Planum Australe)',
        type: 'hazard',
        isPolar: true,
        coords: createPolarCapCoords(-75.0, false)
    },
    {
        id: 'planum_boreum',
        name: 'Північна полярна шапка (Planum Boreum)',
        type: 'hazard',
        isPolar: true,
        coords: createPolarCapCoords(75.0, true)
    },
    {
        id: 'dust_belt',
        name: 'Пиловий коридор Дайдалії (Daedalia Dust Storm Track)',
        type: 'hazard',
        coords: [
            [-22.0, -135.0], [-25.0, -115.0], [-30.0, -98.0], [-36.0, -100.0],
            [-34.0, -118.0], [-28.0, -138.0]
        ]
    },

    // === БЕЗПЕЧНІ ЗОНИ ===
    {
        id: 'elysium_planitia',
        name: 'Рівнина Елізій (Elysium Planitia)',
        type: 'safe',
        coords: [
            [13.0, 145.0], [14.5, 155.0], [12.0, 168.0], [6.0, 172.0],
            [1.5, 165.0], [0.0, 153.0], [3.5, 144.0], [8.0, 142.0]
        ]
    },
    {
        id: 'acidalia_planitia',
        name: 'Ацидалійська рівнина (Acidalia Planitia)',
        type: 'safe',
        coords: [
            [54.0, -35.0], [53.0, -15.0], [46.0, -10.0], [38.0, -18.0],
            [36.0, -32.0], [42.0, -42.0], [50.0, -40.0]
        ]
    },
    {
        id: 'utopia_planitia',
        name: 'Рівнина Утопія (Utopia Planitia)',
        type: 'safe',
        coords: [
            [56.0, 95.0], [54.0, 120.0], [48.0, 135.0], [38.0, 132.0],
            [33.0, 115.0], [34.0, 95.0], [43.0, 85.0], [51.0, 88.0]
        ]
    },
    {
        id: 'amazonis_planitia',
        name: 'Рівнина Амазонія (Amazonis Planitia)',
        type: 'safe',
        coords: [
            [32.0, -168.0], [30.0, -149.0], [22.0, -146.0], [14.0, -150.0],
            [12.0, -165.0], [19.0, -174.0], [27.0, -175.0]
        ]
    },
    {
        id: 'isidis_planitia',
        name: 'Рівнина Ісіди (Isidis Planitia)',
        type: 'safe',
        coords: [
            [19.0, 84.0], [18.5, 92.0], [14.0, 96.0], [9.5, 93.0],
            [8.0, 86.0], [11.5, 80.5], [16.0, 80.0]
        ]
    },
    {
        id: 'chryse_planitia',
        name: 'Рівнина Хриса (Chryse Planitia)',
        type: 'safe',
        coords: [
            [32.0, -48.0], [30.0, -36.0], [24.0, -34.0], [18.0, -42.0],
            [19.0, -52.0], [26.0, -55.0]
        ]
    },
    {
        id: 'meridiani_planum',
        name: 'Плато Меридіана (Meridiani Planum)',
        type: 'safe',
        coords: [
            [3.5, -7.0], [3.0, 4.0], [0.0, 6.5], [-4.0, 3.5],
            [-4.5, -5.0], [-1.0, -8.5]
        ]
    },
    {
        id: 'arcadia_planitia',
        name: 'Рівнина Аркадія (Arcadia Planitia)',
        type: 'safe',
        coords: [
            [52.0, -175.0], [51.0, -152.0], [42.0, -150.0], [36.0, -158.0],
            [38.0, -174.0], [46.0, -177.0]
        ]
    },
    {
        id: 'hellas_floor',
        name: 'Дно басейну Еллада (Hellas Basin Floor)',
        type: 'safe',
        coords: [
            [-38.0, 65.0], [-37.0, 75.0], [-42.0, 79.0], [-47.0, 75.0],
            [-47.0, 65.0], [-42.0, 62.0]
        ]
    },
    {
        id: 'hesperia_planum',
        name: 'Плато Гесперія (Hesperia Planum)',
        type: 'safe',
        coords: [
            [-16.0, 106.0], [-15.5, 118.0], [-22.0, 122.0], [-28.0, 116.0],
            [-27.0, 107.0], [-20.0, 103.0]
        ]
    },
    {
        id: 'vastitas_borealis',
        name: 'Низовина Вастітас (Vastitas Borealis)',
        type: 'safe',
        coords: [
            [68.0, -20.0], [67.0, 20.0], [62.0, 35.0], [58.0, 10.0],
            [59.0, -25.0], [64.0, -35.0]
        ]
    },
    {
        id: 'jezero_crater',
        name: 'Кратер та дельта Єзеро (Jezero Crater & Delta)',
        type: 'safe',
        coords: [
            [18.9, 76.5], [19.2, 77.4], [18.8, 78.4], [18.1, 78.3], [17.8, 77.3], [18.1, 76.3]
        ]
    },
    {
        id: 'gale_crater',
        name: 'Кратер Гейл та гора Шарп (Gale Crater Floor)',
        type: 'safe',
        coords: [
            [-4.5, 136.3], [-4.3, 138.1], [-5.6, 138.8], [-6.4, 137.9], [-6.1, 136.2], [-5.2, 135.7]
        ]
    },
    {
        id: 'casius_plain',
        name: 'Коридор Касій (Casius Corridor)',
        type: 'safe',
        coords: [
            [36.0, 65.0], [38.0, 78.0], [32.0, 80.0], [28.0, 68.0]
        ]
    }
];

MARS_ZONES.forEach(z => {
    if (z.id !== 'planum_boreum' && z.id !== 'planum_australe') {
        z.smoothCoords = smoothClosedPolygon(z.coords, 2, 2.0);
    } else {
        z.smoothCoords = z.coords;
    }
    const lats = z.smoothCoords.map(p => p[0]);
    const lons = z.smoothCoords.map(p => p[1]);
    z.bbox = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
    z.centroid = [
        lats.reduce((a, b) => a + b, 0) / lats.length,
        lons.reduce((a, b) => a + b, 0) / lons.length
    ];
});

const HAZARD_ZONES = MARS_ZONES.filter(z => z.type === 'hazard');
const SAFE_ZONES = MARS_ZONES.filter(z => z.type === 'safe');

let showHazardZones = true;
let showSafeZones = true;
let hazardsAvoidanceActive = true;
let is3DMode = false;
let toastTimeout = null;
let activeZoneFilter = 'all';

let safeHoverMarker = null;
let fastHoverMarker = null;

// ============================================================================
// 2. ГЕОМЕТРИЧНІ ФУНКЦІЇ
// ============================================================================
function normalizeLon(lon) {
    return ((lon + 180) % 360 + 360) % 360 - 180;
}

function isPointInPolygon(lat, lon, poly, bbox) {
    if (lat < bbox[0] || lat > bbox[1] || lon < bbox[2] || lon > bbox[3]) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function calculateMarsDistance(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * toRad / 2) ** 2 +
              Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
              Math.sin((lon2 - lon1) * toRad / 2) ** 2;
    return 2 * MARS_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================================
// 3. ТОПОГРАФІЧНА МАТ-МОДЕЛЬ MOLA
// ============================================================================
function getMolaElevation(lat, lon) {
    let elev = -1500 + Math.sin((lat - 8) * Math.PI / 180) * -2700;
    elev += Math.sin(lat * 0.12 + 0.3) * Math.cos(lon * 0.12) * 600;
    elev += Math.sin(lat * 0.35) * Math.cos(lon * 0.35) * 250;

    const dTharsis = Math.hypot((lat - 1) * 1.3, lon - (-95));
    if (dTharsis < 38) {
        elev += Math.cos((dTharsis / 38) * (Math.PI / 2)) * 6200;
    }

    const dOly = Math.hypot(lat - 18.4, lon - (-133.8));
    if (dOly < 5.5) {
        if (dOly > 3.6) {
            elev += 4000 + (5.5 - dOly) * 3500;
        } else {
            elev += 11000 + (3.6 - dOly) * 2800;
        }
    }

    const dAsc = Math.hypot(lat - 11.8, lon - (-104.5));
    if (dAsc < 4.5) elev += (4.5 - dAsc) * 2600;

    const dPav = Math.hypot(lat - 0.8, lon - (-113.0));
    if (dPav < 4.0) elev += (4.0 - dPav) * 2200;

    const dArs = Math.hypot(lat - (-9.0), lon - (-121.0));
    if (dArs < 4.5) elev += (4.5 - dArs) * 2400;

    const dEly = Math.hypot(lat - 25.0, lon - 147.2);
    if (dEly < 5.0) elev += (5.0 - dEly) * 2200;

    if (lat >= -19.0 && lat <= 2.0 && lon >= -98.0 && lon <= -30.0) {
        const t = Math.max(0, Math.min(1, ((lon - (-92.0)) * 58.0 + (lat - (-5.0)) * (-9.0)) / (58*58 + 9*9)));
        const spineLat = -5.0 + t * (-9.0);
        const spineLon = -92.0 + t * 58.0;
        const distToSpine = Math.hypot((lat - spineLat) * 1.5, lon - spineLon);

        if (distToSpine < 4.8) {
            const abyssFactor = Math.cos((distToSpine / 4.8) * (Math.PI / 2));
            elev -= Math.pow(abyssFactor, 1.8) * 8200;
        }
    }

    const dNoctis = Math.hypot((lat - (-8.0)) * 1.4, lon - (-100.0));
    if (dNoctis < 6.8) {
        const canyonGrid = Math.sin(lat * 2.8) * Math.sin(lon * 2.8);
        elev -= (1 - dNoctis / 6.8) * 3400 + (canyonGrid > 0.1 ? canyonGrid * 2600 : 0);
    }

    const dHel = Math.hypot((lat - (-42.0)) * 1.1, lon - 70.0);
    if (dHel < 18.0) {
        if (dHel > 12.0) {
            elev += Math.sin(((dHel - 12.0) / 6.0) * Math.PI) * 2400;
        } else {
            elev -= Math.cos((dHel / 12.0) * (Math.PI / 2)) * 5600;
        }
    }

    return Math.round(elev);
}

let lastTeleTime = 0;
function updateTelemetry(lat, lon) {
    const elLat = document.getElementById('teleLat');
    const elLon = document.getElementById('teleLon');
    const elAlt = document.getElementById('teleAlt');
    if (!elLat || !elLon || !elAlt) return;

    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
        elLat.innerText = '---';
        elLon.innerText = '---';
        elAlt.innerText = '---';
        return;
    }

    const clampedLat = Math.max(-90, Math.min(90, lat));
    const clampedLon = normalizeLon(lon);
    const alt = getMolaElevation(clampedLat, clampedLon);

    elLat.innerText = `${clampedLat.toFixed(4)}°`;
    elLon.innerText = `${clampedLon.toFixed(4)}°`;
    elAlt.innerText = `${alt > 0 ? '+' : ''}${alt} M`;
}

// ============================================================================
// 4. LEAFLET 2D (АПАРАТНИЙ GPU CANVAS + КАРТИ ПРОГРУЖАЮТЬСЯ ОДРАЗУ)
// ============================================================================
const map = L.map('map', {
    crs: L.CRS.EPSG4326,
    center: [0, 0],
    zoom: 2,
    zoomSnap: 0.05,
    preferCanvas: true,
    worldCopyJump: false,
    maxBounds: [[-90, -100000], [90, 100000]],
    maxBoundsViscosity: 1.0
});

WORLD_OFFSETS.forEach(offset => {
    L.imageOverlay(MARS_TEXTURE_URL, [
        [-90, -180 + offset * 360],
        [90, 180 + offset * 360]
    ], { 
        interactive: false
    }).addTo(map);
});

function updatePoleToPoleZoom() {
    const h = map.getSize().y;
    if (!h) return;
    const fitZoom = Math.log2(h / 256);
    const safeMinZoom = Math.max(0.5, fitZoom);

    map.setMinZoom(safeMinZoom);
    if (map.getZoom() < safeMinZoom) {
        map.setZoom(safeMinZoom);
    }
}

updatePoleToPoleZoom();
window.addEventListener('resize', updatePoleToPoleZoom);

map.on('moveend', () => {
    const center = map.getCenter();
    if (center.lng > 180 || center.lng < -180) {
        map.setView([center.lat, normalizeLon(center.lng)], map.getZoom(), { animate: false });
    }
});

let isMapDragging = false;
map.on('dragstart', () => { isMapDragging = true; });
map.on('dragend', () => {
    setTimeout(() => { isMapDragging = false; }, 100);
});

const hazardLayerGroup = L.layerGroup().addTo(map);
const safeLayerGroup = L.layerGroup().addTo(map);
const selectedZoneGroup = L.layerGroup().addTo(map);

const markerAGroup = L.layerGroup().addTo(map);
const markerBGroup = L.layerGroup().addTo(map);
const safePolylineGroup = L.layerGroup().addTo(map);
const fastPolylineGroup = L.layerGroup().addTo(map);

function renderZones2D() {
    hazardLayerGroup.clearLayers();
    safeLayerGroup.clearLayers();

    MARS_ZONES.forEach(z => {
        const isHaz = z.type === 'hazard';

        WORLD_OFFSETS.forEach(offset => {
            const shiftedCoords = z.smoothCoords.map(pt => [pt[0], pt[1] + offset * 360]);

            const poly = L.polygon(shiftedCoords, {
                color: isHaz ? '#FF2E38' : '#00FFAA',
                fillColor: isHaz ? '#FF2E38' : '#00FFAA',
                fillOpacity: isHaz ? 0.22 : 0.16,
                weight: z.isPolar ? 0 : 2,
                stroke: !z.isPolar,
                dashArray: isHaz ? '4, 4' : '6, 6'
            });

            // Клік по зоні не відкриває панель: він «проходить» до мапи і ставить точку маршруту.
            // Панель із інформацією відкривається лише через пошук / список / вибір зони.

            if (isHaz) {
                hazardLayerGroup.addLayer(poly);
            } else {
                safeLayerGroup.addLayer(poly);
            }
        });
    });

    update2DLayerVisibility();
}

function update2DLayerVisibility() {
    if (showHazardZones) {
        if (!map.hasLayer(hazardLayerGroup)) map.addLayer(hazardLayerGroup);
    } else {
        if (map.hasLayer(hazardLayerGroup)) map.removeLayer(hazardLayerGroup);
    }

    if (showSafeZones) {
        if (!map.hasLayer(safeLayerGroup)) map.addLayer(safeLayerGroup);
    } else {
        if (map.hasLayer(safeLayerGroup)) map.removeLayer(safeLayerGroup);
    }
}

function highlightSelectedZone(zoneId) {
    selectedZoneGroup.clearLayers();
    if (!zoneId) return;

    const zone = MARS_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    const isHaz = zone.type === 'hazard';
    WORLD_OFFSETS.forEach(offset => {
        const shiftedCoords = zone.smoothCoords.map(pt => [pt[0], pt[1] + offset * 360]);
        const hl = L.polygon(shiftedCoords, {
            color: isHaz ? '#FF5722' : '#00FFAA',
            fillColor: isHaz ? '#FF5722' : '#00FFAA',
            fillOpacity: 0.36,
            weight: 4,
            dashArray: '8, 6',
            className: 'zone-selected-glow'
        });
        selectedZoneGroup.addLayer(hl);
    });
}

map.on('mousemove', (e) => {
    const now = performance.now();
    if (now - lastTeleTime < 40) return;
    lastTeleTime = now;
    updateTelemetry(e.latlng.lat, e.latlng.lng);
});

// ============================================================================
// 5. 3D GLOBE
// ============================================================================
function getSphericalSignedArea(ring) {
    const pts = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
        ? ring.slice(0, -1)
        : ring;
    const n = pts.length;
    if (n < 3) return 0;
    const toRad = Math.PI / 180;
    let total = 0;
    for (let i = 0; i < n; i++) {
        const [lon1, lat1] = pts[i];
        const [lon2, lat2] = pts[(i + 1) % n];
        const rLat1 = lat1 * toRad, rLat2 = lat2 * toRad;
        let dLon = (lon2 - lon1) * toRad;
        while (dLon > Math.PI) dLon -= 2 * Math.PI;
        while (dLon < -Math.PI) dLon += 2 * Math.PI;
        total += dLon * (Math.sin(rLat1) + Math.sin(rLat2)) / 2;
    }
    return total;
}

function densifyPolygonRing(rawCoords, maxStepDeg = 1.5) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    const densePts = [];
    const n = rawCoords.length;

    for (let i = 0; i < n; i++) {
        const [lat1, lon1] = rawCoords[i];
        const [lat2, lon2] = rawCoords[(i + 1) % n];

        const phi1 = lat1 * toRad, th1 = lon1 * toRad;
        const x1 = Math.cos(phi1) * Math.cos(th1);
        const y1 = Math.cos(phi1) * Math.sin(th1);
        const z1 = Math.sin(phi1);

        const phi2 = lat2 * toRad, th2 = lon2 * toRad;
        const x2 = Math.cos(phi2) * Math.cos(th2);
        const y2 = Math.cos(phi2) * Math.sin(th2);
        const z2 = Math.sin(phi2);

        const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
        const angDeg = Math.acos(dot) * toDeg;
        const steps = Math.max(1, Math.ceil(angDeg / maxStepDeg));

        for (let s = 0; s < steps; s++) {
            const t = s / steps;
            let xi = (dot > 0.9999) ? x1 + t * (x2 - x1) : (Math.sin((1 - t) * Math.acos(dot)) * x1 + Math.sin(t * Math.acos(dot)) * x2) / Math.sin(Math.acos(dot));
            let yi = (dot > 0.9999) ? y1 + t * (y2 - y1) : (Math.sin((1 - t) * Math.acos(dot)) * y1 + Math.sin(t * Math.acos(dot)) * y2) / Math.sin(Math.acos(dot));
            let zi = (dot > 0.9999) ? z1 + t * (z2 - z1) : (Math.sin((1 - t) * Math.acos(dot)) * z1 + Math.sin(t * Math.acos(dot)) * z2) / Math.sin(Math.acos(dot));
            const r = Math.hypot(xi, yi, zi);
            densePts.push([Math.atan2(yi, xi) * toDeg, Math.asin(zi / r) * toDeg]);
        }
    }

    if (getSphericalSignedArea(densePts) < 0) densePts.reverse();
    if (densePts.length > 0) densePts.push([densePts[0][0], densePts[0][1]]);
    return densePts;
}

function getPolarCapRing(latBase, isNorth, steps = 36) {
    const ring = [];
    const poleLat = isNorth ? 89.99 : -89.99;
    for (let s = 0; s <= steps; s++) ring.push([-180 + (s / steps) * 360, latBase]);
    for (let s = steps; s >= 0; s--) ring.push([-180 + (s / steps) * 360, poleLat]);
    if (getSphericalSignedArea(ring) < 0) ring.reverse();
    ring.push([ring[0][0], ring[0][1]]);
    return ring;
}

let hovered3DZone = null;

function getActive3DFeatures() {
    const features = [];
    MARS_ZONES.forEach(z => {
        const isHaz = z.type === 'hazard';
        if (isHaz ? !showHazardZones : !showSafeZones) return;

        const baseProps = {
            id: z.id,
            name: z.name,
            type: z.type,
            centroid: z.centroid,
            fillColor: isHaz ? 'rgba(255, 46, 56, 0.38)' : 'rgba(0, 255, 170, 0.30)',
            hoverCapColor: isHaz ? 'rgba(255, 46, 56, 0.68)' : 'rgba(0, 255, 170, 0.62)',
            sideColor: isHaz ? 'rgba(255, 46, 56, 0.12)' : 'rgba(0, 255, 170, 0.10)',
            strokeColor: isHaz ? '#FF2E38' : '#00FFAA',
            altitude: isHaz ? 0.0055 : 0.0040
        };

        if (z.id === 'planum_boreum' || z.id === 'planum_australe') {
            const isBoreum = (z.id === 'planum_boreum');
            const capRing = getPolarCapRing(isBoreum ? 75.0 : -75.0, isBoreum);
            features.push({ type: 'Feature', properties: baseProps, geometry: { type: 'Polygon', coordinates: [capRing] } });
        } else {
            const denseRing = densifyPolygonRing(z.smoothCoords);
            features.push({ type: 'Feature', properties: baseProps, geometry: { type: 'Polygon', coordinates: [denseRing] } });
        }
    });
    return features;
}

let myGlobe = null;
try {
    myGlobe = Globe()(document.getElementById('globe-container'))
        .globeImageUrl(MARS_TEXTURE_URL)
        .backgroundColor('#050608')
        .showAtmosphere(true)
        .atmosphereColor('#ff5533')
        .atmosphereAltitude(0.12)
        .polygonsData(getActive3DFeatures())
        .polygonGeoJsonGeometry(d => d.geometry)
        .polygonCapColor(d => d === hovered3DZone ? d.properties.hoverCapColor : d.properties.fillColor)
        .polygonSideColor(d => d.properties.sideColor)
        .polygonStrokeColor(d => d.properties.strokeColor)
        .polygonAltitude(d => d === hovered3DZone ? 0.010 : d.properties.altitude)
        .polygonCapCurvatureResolution(1.2)
        .onPolygonHover(d => {
            if (d !== hovered3DZone) {
                hovered3DZone = d;
                myGlobe.polygonAltitude(myGlobe.polygonAltitude())
                       .polygonCapColor(myGlobe.polygonCapColor());
            }
        })
        .onPolygonClick((d, ev, coords) => {
            if (coords) handleCoordinateSelect(coords.lat, coords.lng);
        })
        .onGlobeClick(({ lat, lng }) => handleCoordinateSelect(lat, lng));
} catch (err) {
    console.warn("3D Globe:", err);
}

// ============================================================================
// 6. ПАНЕЛЬ ТА КЕРУВАННЯ
// ============================================================================
function setHazardVisibility(visible) {
    showHazardZones = visible;
    const btnTop = document.getElementById('btnVisHazards');
    btnTop.classList.toggle('active', showHazardZones);
    btnTop.classList.toggle('inactive', !showHazardZones);
    btnTop.innerHTML = `<span class="btn-dot ${showHazardZones ? 'dot-red' : 'dot-muted'}"></span>НЕБЕЗПЕКИ: ${showHazardZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`;

    document.getElementById('switchToggleHazards').classList.toggle('active', showHazardZones);
    update2DLayerVisibility();
    if (myGlobe) myGlobe.polygonsData(getActive3DFeatures());
}

function setSafeVisibility(visible) {
    showSafeZones = visible;
    const btnTop = document.getElementById('btnVisSafe');
    btnTop.classList.toggle('active', showSafeZones);
    btnTop.classList.toggle('inactive', !showSafeZones);
    btnTop.innerHTML = `<span class="btn-dot ${showSafeZones ? 'dot-green' : 'dot-muted'}"></span>БЕЗПЕЧНІ: ${showSafeZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`;

    document.getElementById('switchToggleSafe').classList.toggle('active', showSafeZones);
    update2DLayerVisibility();
    if (myGlobe) myGlobe.polygonsData(getActive3DFeatures());
}

document.getElementById('btnVisHazards').onclick = () => setHazardVisibility(!showHazardZones);
document.getElementById('btnVisSafe').onclick = () => setSafeVisibility(!showSafeZones);
document.getElementById('switchToggleHazards').onclick = () => setHazardVisibility(!showHazardZones);
document.getElementById('switchToggleSafe').onclick = () => setSafeVisibility(!showSafeZones);

document.getElementById('btnToggleHazards').onclick = (e) => {
    hazardsAvoidanceActive = !hazardsAvoidanceActive;
    e.target.classList.toggle('active', hazardsAvoidanceActive);
    e.target.innerText = hazardsAvoidanceActive ? "A* ОБМЕЖЕННЯ: УВІМК" : "A* ОБМЕЖЕННЯ: ВИМК";
    if (ptA && ptB) document.getElementById('btnBuildRoute').click();
};

document.getElementById('btnToggleView').onclick = (e) => {
    is3DMode = !is3DMode;
    e.target.classList.toggle('active', is3DMode);
    e.target.innerText = is3DMode ? "2D РЕЖИМ" : "3D РЕЖИМ";
    document.getElementById('map').style.display = is3DMode ? 'none' : 'block';
    document.getElementById('globe-container').style.display = is3DMode ? 'block' : 'none';
    if (!is3DMode) {
        map.invalidateSize();
        updatePoleToPoleZoom();
    } else if (myGlobe) {
        myGlobe.width(window.innerWidth).height(window.innerHeight);
    }
};

document.getElementById('btnToggleSidebar').onclick = () => {
    const sb = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('btnToggleSidebar');
    sb.classList.toggle('collapsed');
    toggleBtn.classList.toggle('collapsed');
    toggleBtn.innerText = sb.classList.contains('collapsed') ? '❯' : '❮';
};

const btnCloseSidebarMobile = document.getElementById('btnCloseSidebarMobile');
if (btnCloseSidebarMobile) {
    btnCloseSidebarMobile.onclick = () => {
        const sb = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('btnToggleSidebar');
        sb.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        toggleBtn.innerText = '❯';
    };
}

if (window.innerWidth <= 768) {
    const sb = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('btnToggleSidebar');
    if (sb && toggleBtn) {
        sb.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        toggleBtn.innerText = '❯';
    }
}

function showWarning(msg) {
    const toast = document.getElementById('warningToast');
    document.getElementById('warningMsg').innerText = msg;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 6500);
}

// ============================================================================
// 7. СПИСОК ЗОН ТА ФОКУСУВАННЯ
// ============================================================================
function renderZonesList(searchQuery = '') {
    const container = document.getElementById('zonesListContainer');
    const query = searchQuery.toLowerCase().trim();

    const filtered = MARS_ZONES.filter(z => {
        if (activeZoneFilter !== 'all' && z.type !== activeZoneFilter) return false;
        if (!query) return true;
        return z.name.toLowerCase().includes(query) || z.id.includes(query);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="font-size:0.72rem; color:#64748B; padding:10px; text-align:center;">Зон не знайдено</div>`;
        return;
    }

    container.innerHTML = filtered.map(z => {
        const isHaz = z.type === 'hazard';
        return `
            <div class="zone-item ${isHaz ? 'hazard-item' : 'safe-item'}" onclick="focusOnZone('${z.id}')">
                <div class="zone-item-head">
                    <span class="zone-item-title">
                        <span class="btn-dot ${isHaz ? 'dot-red' : 'dot-green'}"></span>
                        ${z.name}
                    </span>
                    <button class="zone-item-btn" onclick="event.stopPropagation(); focusOnZone('${z.id}')">⌖</button>
                </div>
            </div>
        `;
    }).join('');
}

document.querySelectorAll('.z-tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.z-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeZoneFilter = tab.getAttribute('data-filter');
        renderZonesList(document.getElementById('zoneFilterInput').value);
    };
});

document.getElementById('zoneFilterInput')?.addEventListener('input', (e) => {
    renderZonesList(e.target.value);
});

window.focusOnZone = function(zoneId) {
    const zone = MARS_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    highlightSelectedZone(zoneId);

    if (is3DMode && myGlobe) {
        myGlobe.pointOfView({ lat: zone.centroid[0], lng: zone.centroid[1], altitude: 1.5 }, 1200);
    } else {
        const curLon = map.getCenter().lng;
        const closestOffset = WORLD_OFFSETS.reduce((prev, curr) => {
            return Math.abs(curr * 360 + zone.centroid[1] - curLon) < Math.abs(prev * 360 + zone.centroid[1] - curLon) ? curr : prev;
        }, 0);
        map.flyTo([zone.centroid[0], zone.centroid[1] + closestOffset * 360], Math.max(map.getZoom(), 2.8), { duration: 1.2 });
    }
    showWarning(`ФОКУС: ${zone.name}`);
    displayZoneDetails(zoneId);

    const sel = document.getElementById('zoneSelect');
    if (sel && sel.value !== zoneId) sel.value = zoneId;
};

function populateZoneSelect() {
    const select = document.getElementById('zoneSelect');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Оберіть зону Марса...</option>';
    MARS_ZONES.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone.id;
        option.textContent = zone.name;
        select.appendChild(option);
    });
}

function displayZoneDetails(zoneId) {
    const zone = MARS_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    const card = document.getElementById('zoneInfoCard');
    const nameEl = document.getElementById('cardZoneName');
    const terrainEl = document.getElementById('cardTerrainType');

    if (nameEl) nameEl.innerText = zone.name;
    if (terrainEl) {
        terrainEl.innerText = zone.type === 'hazard' 
            ? "Кам'янистий / Скелястий каньйон" 
            : "Піщаний / Базальтова рівнина";
    }

    document.getElementById('cardIcePresence').innerText = zone.type === 'hazard' ? "Ні" : "Присутній (глибина ~1.2м)";
    document.getElementById('cardWeather').innerText = "Ясно, легкий пиловий серпанок";
    document.getElementById('cardTime').innerText = "14:32 MTC";
    document.getElementById('cardTemp').innerText = zone.type === 'hazard' ? "-78 °C" : "-55 °C";

    if (card) card.style.display = 'block';
}

document.getElementById('zoneSelect')?.addEventListener('change', (e) => {
    const selectedZoneId = e.target.value;
    if (selectedZoneId) focusOnZone(selectedZoneId);
});

document.getElementById('btnCloseZoneCard')?.addEventListener('click', () => {
    const card = document.getElementById('zoneInfoCard');
    if (card) card.style.display = 'none';
    selectedZoneGroup.clearLayers();
    const select = document.getElementById('zoneSelect');
    if (select) select.value = "";
});

populateZoneSelect();

// ============================================================================
// 8. СИНХРОНІЗОВАНІ МАРКЕРИ НА ОБИДВОХ КАРТАХ ТА СТИКАХ
// ============================================================================
let ptA = null, ptB = null;
let fastRouteData = null, safeRouteData = null;
let activeRouteMode = 'safe';

function makeNothingPin(letter, isRed) {
    const bg = isRed ? '#FF2E38' : '#00F0FF';
    const textCol = isRed ? '#FFFFFF' : '#000000';
    return L.divIcon({
        className: 'custom-pin',
        html: `<div style="background:${bg}; color:${textCol}; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk'; font-weight:800; font-size:11px; border:2px solid #000; box-shadow:0 0 12px ${bg};">${letter}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });
}

function renderSyncedMarker(group, pt, letter, isRed, onPointChange) {
    group.clearLayers();
    if (!pt) return;

    WORLD_OFFSETS.forEach(offset => {
        const marker = L.marker([pt.lat, pt.lon + offset * 360], {
            icon: makeNothingPin(letter, isRed),
            draggable: true
        });

        marker.on('drag', (e) => {
            const raw = e.target.getLatLng();
            const normL = normalizeLon(raw.lng);
            group.eachLayer(m => {
                if (m !== marker) {
                    const mOffset = Math.round((m.getLatLng().lng - normL) / 360);
                    m.setLatLng([raw.lat, normL + mOffset * 360]);
                }
            });
        });

        marker.on('dragend', (e) => {
            const raw = e.target.getLatLng();
            const newPt = {
                lat: Math.max(-90, Math.min(90, Number(raw.lat.toFixed(4)))),
                lon: Number(normalizeLon(raw.lng).toFixed(4))
            };
            onPointChange(newPt);
        });

        group.addLayer(marker);
    });
}

function updateMarkerLayers() {
    renderSyncedMarker(markerAGroup, ptA, 'A', false, (newPt) => {
        ptA = newPt;
        updateMarkerLayers();
        syncUI();
        if (fastRouteData) document.getElementById('btnBuildRoute').click();
        debouncedSaveCloudRoute();
    });

    renderSyncedMarker(markerBGroup, ptB, 'B', true, (newPt) => {
        ptB = newPt;
        updateMarkerLayers();
        syncUI();
        if (fastRouteData) document.getElementById('btnBuildRoute').click();
        debouncedSaveCloudRoute();
    });
}

function splitPathAtAntimeridian(path) {
    if (!path || path.length < 2) return path ? [path.map(p => [p.lat, normalizeLon(p.lon)])] : [];

    const segments = [];
    let currentSegment = [];

    for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        const currLon = normalizeLon(pt.lon);
        const currLat = pt.lat;

        if (i === 0) { currentSegment.push([currLat, currLon]); continue; }

        const prevLon = normalizeLon(path[i - 1].lon);
        const prevLat = path[i - 1].lat;
        const dLon = currLon - prevLon;

        if (Math.abs(dLon) > 180) {
            if (prevLon > 0) {
                const frac = (180 - prevLon) / Math.max(0.0001, (180 - prevLon) + (currLon + 180));
                const crossLat = prevLat + frac * (currLat - prevLat);
                currentSegment.push([crossLat, 180]);
                segments.push(currentSegment);
                currentSegment = [[crossLat, -180], [currLat, currLon]];
            } else {
                const frac = (prevLon + 180) / Math.max(0.0001, (prevLon + 180) + (180 - currLon));
                const crossLat = prevLat + frac * (currLat - prevLat);
                currentSegment.push([crossLat, -180]);
                segments.push(currentSegment);
                currentSegment = [[crossLat, 180], [currLat, currLon]];
            }
        } else {
            currentSegment.push([currLat, currLon]);
        }
    }
    if (currentSegment.length > 0) segments.push(currentSegment);
    return segments;
}

function update3DPinsAndPaths() {
    if (!myGlobe) return;

    const labels = [];
    if (ptA) labels.push({ lat: ptA.lat, lng: ptA.lon, text: 'A', color: '#00F0FF' });
    if (ptB) labels.push({ lat: ptB.lat, lng: ptB.lon, text: 'B', color: '#FF2E38' });

    myGlobe.labelsData(labels)
        .labelLat('lat').labelLng('lng').labelText('text')
        .labelSize(2.5).labelDotRadius(0.8).labelColor('color')
        .labelResolution(3).labelAltitude(0.020);

    const paths = [];
    if (safeRouteData && fastRouteData) {
        const safeSegs = splitPathAtAntimeridian(safeRouteData.path);
        const fastSegs = splitPathAtAntimeridian(fastRouteData.path);

        if (activeRouteMode === 'safe') {
            fastSegs.forEach(seg => paths.push({ coords: seg, color: 'rgba(255,46,56,0.3)' }));
            safeSegs.forEach(seg => paths.push({ coords: seg, color: '#00FFAA' }));
        } else {
            safeSegs.forEach(seg => paths.push({ coords: seg, color: 'rgba(0,255,170,0.3)' }));
            fastSegs.forEach(seg => paths.push({ coords: seg, color: '#FF2E38' }));
        }
    }
    myGlobe.pathsData(paths)
        .pathPoints('coords').pathPointLat(p => p[0]).pathPointLng(p => p[1])
        .pathColor('color').pathDashLength(0.01).pathDashGap(0.005).pathStroke(2.5)
        .pathAltitude(0.009);
}

function applyCloudRoutePoints(pointA, pointB, autoBuild = true) {
    ptA = (pointA && typeof pointA.lat === 'number') 
        ? { lat: Number(pointA.lat), lon: Number(normalizeLon(pointA.lon)) } 
        : null;
    ptB = (pointB && typeof pointB.lat === 'number') 
        ? { lat: Number(pointB.lat), lon: Number(normalizeLon(pointB.lon)) } 
        : null;

    updateMarkerLayers();
    syncUI();
    update3DPinsAndPaths();

    if (autoBuild && ptA && ptB) {
        document.getElementById('btnBuildRoute').click();
    }
}

function handleCoordinateSelect(rawLat, rawLon) {
    const lat = Math.max(-90, Math.min(90, Number(rawLat).toFixed(4)));
    const lon = Number(normalizeLon(rawLon).toFixed(4));

    if (!ptA) {
        ptA = { lat, lon };
    } else if (!ptB) {
        ptB = { lat, lon };
    } else {
        ptA = { lat, lon };
        ptB = null;
        fastPolylineGroup.clearLayers();
        safePolylineGroup.clearLayers();
        fastRouteData = safeRouteData = null;
        document.getElementById('routeReport').style.display = 'none';
    }

    updateMarkerLayers();
    syncUI();
    update3DPinsAndPaths();
    debouncedSaveCloudRoute();
}

map.on('click', (e) => {
    if (isMapDragging) return;
    handleCoordinateSelect(e.latlng.lat, e.latlng.lng);
});

function syncUI() {
    document.getElementById('dispPointA').innerText = ptA ? `${ptA.lat.toFixed(2)}°, ${ptA.lon.toFixed(2)}°` : 'Клікніть на мапі...';
    document.getElementById('dispPointB').innerText = ptB ? `${ptB.lat.toFixed(2)}°, ${ptB.lon.toFixed(2)}°` : 'Клікніть на мапі...';
}

window.setPresetRoute = function(lat1, lon1, lat2, lon2) {
    ptA = null;
    ptB = null;
    handleCoordinateSelect(lat1, lon1);
    handleCoordinateSelect(lat2, lon2);
    document.getElementById('btnBuildRoute').click();
    debouncedSaveCloudRoute();

    if (is3DMode && myGlobe) {
        myGlobe.pointOfView({ lat: (lat1 + lat2) / 2, lng: normalizeLon((lon1 + lon2) / 2), altitude: 1.5 }, 1500);
    } else {
        map.flyToBounds([[lat1, lon1], [lat2, lon2]], { padding: [50, 50] });
    }
};

// ============================================================================
// 9. НАВІГАЦІЙНА МОДЕЛЬ: A* НА СФЕРІ + ANY-ANGLE ЗГЛАДЖУВАННЯ
// ============================================================================
// Модель:
//  1) Поверхня — сферичний ґрід (широта/довгота) з висотами MOLA, локальним градієнтом
//     (базис ~7 км), маскою небезпечних зон із буфером безпеки та маскою безпечних зон.
//  2) Вартість кроку = ортодромічна відстань × (фактор нахилу + штраф зони) × бонус безпечної зони.
//     Нахил кроку = max(середній нахил між вузлами, локальний градієнт) — тому бокові схили теж штрафуються.
//  3) Пошук: A* із 16 напрямками (без «перекосу» по 45°) і допустимою евристикою
//     h = мін.фактор × ортодромія до цілі.
//  4) Any-angle згладжування: відрізки ґрідової ламаної заміняються ортодромією, якщо вона не дорожча.
//     Маршрут починається точно в A і закінчується точно в B.
//  5) Профіль висот і статистика рахуються по рівномірній вибірці вздовж маршруту
//     за точною функцією getMolaElevation.
const NAV_DEG = Math.PI / 180;
const NAV_KM_PER_DEG = MARS_RADIUS_KM * NAV_DEG;
const NAV_GRAD_BASE_DEG = 0.12;          // базис градієнта ≈ 7 км
const NAV_BUFFER_KM = 15;                // буфер безпеки навколо небезпечних зон
const NAV_SAFE_LIMIT_DEG = 15;           // «м'яка» межа нахилу, безпечний режим
const NAV_FAST_LIMIT_DEG = 25;           // «м'яка» межа нахилу, швидкий режим
const NAV_DIRS = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
    [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]
];

class FastMinHeap {
    constructor(capacity = 1024) {
        this.nodes = new Int32Array(capacity);
        this.costs = new Float64Array(capacity);
        this.size = 0;
    }
    grow() {
        const cap = this.nodes.length * 2;
        const n = new Int32Array(cap); n.set(this.nodes);
        const c = new Float64Array(cap); c.set(this.costs);
        this.nodes = n; this.costs = c;
    }
    push(node, cost) {
        if (this.size === this.nodes.length) this.grow();
        let i = this.size++;
        this.nodes[i] = node;
        this.costs[i] = cost;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.costs[i] < this.costs[p]) {
                const tn = this.nodes[i]; this.nodes[i] = this.nodes[p]; this.nodes[p] = tn;
                const tc = this.costs[i]; this.costs[i] = this.costs[p]; this.costs[p] = tc;
                i = p;
            } else break;
        }
    }
    pop() {
        if (this.size === 0) return -1;
        const top = this.nodes[0];
        const last = --this.size;
        this.nodes[0] = this.nodes[last];
        this.costs[0] = this.costs[last];
        let i = 0;
        const half = this.size >> 1;
        while (i < half) {
            const l = (i << 1) + 1, r = l + 1;
            const best = (r < this.size && this.costs[r] < this.costs[l]) ? r : l;
            if (this.costs[best] < this.costs[i]) {
                const tn = this.nodes[i]; this.nodes[i] = this.nodes[best]; this.nodes[best] = tn;
                const tc = this.costs[i]; this.costs[i] = this.costs[best]; this.costs[best] = tc;
                i = best;
            } else break;
        }
        return top;
    }
}

// ---------- Геометрія на сфері ----------
function navToVec(lat, lon) {
    const la = lat * NAV_DEG, lo = lon * NAV_DEG;
    const c = Math.cos(la);
    return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)];
}

// Ортодромія між двома точками; lon2 береться в «розгорнутій» системі відносно lon1
function makeGreatCircle(lat1, lon1, lat2, lon2) {
    const p1 = navToVec(lat1, lon1), p2 = navToVec(lat2, lon2);
    let dot = p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2];
    dot = Math.max(-1, Math.min(1, dot));
    const omega = Math.acos(dot);
    const sinO = Math.sin(omega);
    return {
        distKm: omega * MARS_RADIUS_KM,
        at(t) {
            if (omega < 1e-9 || sinO < 1e-9) {
                return { lat: lat1 + (lat2 - lat1) * t, lon: lon1 + (lon2 - lon1) * t };
            }
            const a = Math.sin((1 - t) * omega) / sinO;
            const b = Math.sin(t * omega) / sinO;
            const x = a * p1[0] + b * p2[0];
            const y = a * p1[1] + b * p2[1];
            const z = a * p1[2] + b * p2[2];
            const lat = Math.asin(Math.max(-1, Math.min(1, z))) / NAV_DEG;
            const lonN = Math.atan2(y, x) / NAV_DEG;
            // розгортаємо довготу поруч із lon1, щоб не було стрибків через ±180°
            return { lat, lon: lonN + 360 * Math.round((lon1 - lonN) / 360) };
        }
    };
}

// ---------- Підготовка ґріду місцевості (спільна для обох режимів) ----------
let navGridCache = {};

function buildTerrainGrid(startPt, endPt, padScale = 1) {
    const shortestDLon = ((endPt.lon - startPt.lon + 180) % 360 + 360) % 360 - 180;
    const endLonU = startPt.lon + shortestDLon;

    const latLo = Math.min(startPt.lat, endPt.lat), latHi = Math.max(startPt.lat, endPt.lat);
    const spanDeg = Math.max(latHi - latLo, Math.abs(shortestDLon), 1);
    const padLat = Math.max(6, Math.min(70, (0.35 * spanDeg + 5) * padScale));
    const midCos = Math.max(0.3, Math.cos(((latLo + latHi) / 2) * NAV_DEG));
    const padLon = Math.min(120, padLat / midCos);

    const minLat = Math.max(-89.5, Math.min(latLo - padLat, latLo));
    const maxLat = Math.min(89.5, Math.max(latHi + padLat, latHi));
    let minLon = Math.min(startPt.lon, endLonU) - padLon;
    let maxLon = Math.max(startPt.lon, endLonU) + padLon;
    if (maxLon - minLon > 350) {
        const extra = (maxLon - minLon - 350) / 2;
        minLon += extra; maxLon -= extra;
    }

    const latRange = maxLat - minLat, lonRange = maxLon - minLon;
    const step = Math.max(0.12, Math.max(latRange, lonRange) / 240);
    const rows = Math.ceil(latRange / step) + 1;
    const cols = Math.ceil(lonRange / step) + 1;
    const latStep = latRange / (rows - 1), lonStep = lonRange / (cols - 1);
    const total = rows * cols;
    const cellKm = Math.max(latStep, lonStep) * NAV_KM_PER_DEG;

    const latGrid = new Float64Array(rows), lonGrid = new Float64Array(cols);
    for (let r = 0; r < rows; r++) latGrid[r] = minLat + r * latStep;
    for (let c = 0; c < cols; c++) lonGrid[c] = minLon + c * lonStep;

    const elev = new Float32Array(total);
    const grad = new Float32Array(total);          // локальний нахил, м/м
    const zoneH = new Uint8Array(total);           // 0 — вільно, 1 — буфер, 2 — усередині небезпечної зони
    const zoneS = new Uint8Array(total);           // 1 — безпечна зона
    const insideH = new Uint8Array(total);

    const d = NAV_GRAD_BASE_DEG / 2;
    for (let r = 0; r < rows; r++) {
        const lat = latGrid[r];
        const cosLat = Math.max(0.05, Math.cos(lat * NAV_DEG));
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const lonN = normalizeLon(lonGrid[c]);
            elev[idx] = getMolaElevation(lat, lonN);

            const gLat = (getMolaElevation(Math.min(90, lat + d), lonN) - getMolaElevation(Math.max(-90, lat - d), lonN))
                / (NAV_GRAD_BASE_DEG * NAV_KM_PER_DEG * 1000);
            const gLon = (getMolaElevation(lat, normalizeLon(lonGrid[c] + d)) - getMolaElevation(lat, normalizeLon(lonGrid[c] - d)))
                / (NAV_GRAD_BASE_DEG * NAV_KM_PER_DEG * cosLat * 1000);
            grad[idx] = Math.hypot(gLat, gLon);

            if (hazardsAvoidanceActive) {
                for (const z of HAZARD_ZONES) {
                    if (isPointInPolygon(lat, lonN, z.smoothCoords, z.bbox)) { insideH[idx] = 1; break; }
                }
            }
            for (const z of SAFE_ZONES) {
                if (isPointInPolygon(lat, lonN, z.smoothCoords, z.bbox)) { zoneS[idx] = 1; break; }
            }
        }
    }

    // Буфер безпеки навколо небезпечних зон: квадратне розширення маски на m клітинок
    const m = Math.max(1, Math.min(3, Math.ceil(NAV_BUFFER_KM / cellKm)));
    const tmp = new Uint8Array(total), near = new Uint8Array(total);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let v = 0;
            for (let k = Math.max(0, c - m); k <= Math.min(cols - 1, c + m) && !v; k++) v = insideH[r * cols + k];
            tmp[r * cols + c] = v;
        }
    }
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let v = 0;
            for (let k = Math.max(0, r - m); k <= Math.min(rows - 1, r + m) && !v; k++) v = tmp[k * cols + c];
            near[r * cols + c] = v;
        }
    }
    for (let i = 0; i < total; i++) zoneH[i] = insideH[i] ? 2 : (near[i] ? 1 : 0);

    // Таблиця відстаней між сусідніми вузлами (залежить лише від рядка й напрямку)
    const distTbl = new Float64Array(rows * NAV_DIRS.length).fill(Infinity);
    for (let r = 0; r < rows; r++) {
        for (let k = 0; k < NAV_DIRS.length; k++) {
            const nr = r + NAV_DIRS[k][0];
            if (nr < 0 || nr >= rows) continue;
            distTbl[r * NAV_DIRS.length + k] = calculateMarsDistance(
                latGrid[r], 0, latGrid[nr], NAV_DIRS[k][1] * lonStep
            );
        }
    }

    return { rows, cols, total, minLat, minLon, latStep, lonStep, cellKm,
             latGrid, lonGrid, elev, grad, zoneH, zoneS, distTbl, endLonU };
}

// ---------- Модель вартості ----------
function navSlopeFactor(thetaDeg, mode) {
    if (mode === 'safe') {
        let f = 1 + (thetaDeg / 7) ** 2;
        if (thetaDeg > NAV_SAFE_LIMIT_DEG) f += 40 + 25 * (thetaDeg - NAV_SAFE_LIMIT_DEG);
        return f;
    }
    let f = 1 + (thetaDeg / 14) ** 2;
    if (thetaDeg > NAV_FAST_LIMIT_DEG) f += 40 + 25 * (thetaDeg - NAV_FAST_LIMIT_DEG);
    return f;
}

// Штраф і бонус зони для режиму: [додаток до фактора, множник]
function navZoneTerms(zh, zs, mode) {
    if (mode === 'safe') {
        const add = zh === 2 ? 50 : (zh === 1 ? 1.5 : 0);
        return [add, zs ? 0.8 : 1.0];
    }
    return [zh === 2 ? 0.15 : 0, 1.0];
}

function navEdgeCost(distKm, h1, h2, g1, g2, add, mul, mode) {
    const slope = Math.max(Math.abs(h2 - h1) / (distKm * 1000), 0.5 * (g1 + g2));
    const theta = Math.atan(slope) / NAV_DEG;
    return distKm * (navSlopeFactor(theta, mode) + add) * mul;
}

// ---------- A* по ґріду ----------
function planGridPath(grid, startPt, endPt, mode) {
    const { rows, cols, total, latGrid, lonGrid, elev, grad, zoneH, zoneS, distTbl, minLat, minLon, latStep, lonStep } = grid;
    const NDIR = NAV_DIRS.length;

    const nearestCell = (lat, lonU) => {
        const r = Math.max(0, Math.min(rows - 1, Math.round((lat - minLat) / latStep)));
        const c = Math.max(0, Math.min(cols - 1, Math.round((lonU - minLon) / lonStep)));
        return [r, c];
    };
    const [startR, startC] = nearestCell(startPt.lat, startPt.lon);
    const [endR, endC] = nearestCell(endPt.lat, grid.endLonU);
    const startIdx = startR * cols + startC, endIdx = endR * cols + endC;
    if (startIdx === endIdx) return [];

    // Попередньо розраховані штрафи/бонуси зон для режиму
    const zAdd = new Float32Array(total), zMul = new Float32Array(total);
    for (let i = 0; i < total; i++) {
        const t = navZoneTerms(zoneH[i], zoneS[i], mode);
        zAdd[i] = t[0]; zMul[i] = t[1];
    }
    const minF = mode === 'safe' ? 0.8 : 1.0;

    // Евристика: мін.фактор × ортодромія до цілі (допустима й узгоджена)
    const hArr = new Float32Array(total);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            hArr[r * cols + c] = minF * calculateMarsDistance(latGrid[r], lonGrid[c], latGrid[endR], lonGrid[endC]);
        }
    }

    const gScore = new Float64Array(total).fill(Infinity);
    const cameFrom = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const heap = new FastMinHeap(8192);
    gScore[startIdx] = 0;
    heap.push(startIdx, hArr[startIdx]);

    let found = false;
    while (heap.size > 0) {
        const cur = heap.pop();
        if (cur === -1) break;
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === endIdx) { found = true; break; }

        const cr = (cur / cols) | 0, cc = cur - cr * cols;
        for (let k = 0; k < NDIR; k++) {
            const nr = cr + NAV_DIRS[k][0], nc = cc + NAV_DIRS[k][1];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const nIdx = nr * cols + nc;
            if (closed[nIdx]) continue;

            const distKm = distTbl[cr * NDIR + k];
            let add, mul;
            if (k < 8) {
                add = 0.5 * (zAdd[cur] + zAdd[nIdx]);
                mul = 0.5 * (zMul[cur] + zMul[nIdx]);
            } else {
                // «ходи конем» проходять між двома проміжними клітинками — враховуємо їх
                const dr = NAV_DIRS[k][0], dc = NAV_DIRS[k][1];
                let m1, m2;
                if (Math.abs(dr) === 2) {
                    m1 = (cr + dr / 2) * cols + cc;
                    m2 = (cr + dr / 2) * cols + (cc + dc);
                } else {
                    m1 = cr * cols + (cc + dc / 2);
                    m2 = (cr + dr) * cols + (cc + dc / 2);
                }
                add = 0.25 * (zAdd[cur] + zAdd[m1] + zAdd[m2] + zAdd[nIdx]);
                mul = 0.25 * (zMul[cur] + zMul[m1] + zMul[m2] + zMul[nIdx]);
            }

            const cost = navEdgeCost(distKm, elev[cur], elev[nIdx], grad[cur], grad[nIdx], add, mul, mode);
            const tentG = gScore[cur] + cost;
            if (tentG < gScore[nIdx]) {
                gScore[nIdx] = tentG;
                cameFrom[nIdx] = cur;
                heap.push(nIdx, tentG + hArr[nIdx]);
            }
        }
    }

    // Якщо ціль недосяжна (практично не трапляється) — найближча досягнута клітинка
    let pIdx = found ? endIdx : -1;
    if (pIdx === -1) {
        let best = Infinity;
        for (let i = 0; i < total; i++) {
            if (closed[i]) {
                const r = (i / cols) | 0, c = i - r * cols;
                const dd = Math.hypot(r - endR, c - endC);
                if (dd < best) { best = dd; pIdx = i; }
            }
        }
    }

    const nodes = [];
    for (let cur = pIdx; cur !== -1; cur = cameFrom[cur]) {
        const r = (cur / cols) | 0, c = cur - r * cols;
        nodes.push({ lat: latGrid[r], lon: lonGrid[c] });
        if (cur === startIdx) break;
    }
    nodes.reverse();
    return nodes;
}

// ---------- Вибірка місцевості в довільній точці ----------
function navSampleTerrain(grid, lat, lonU, mode, out) {
    const { rows, cols, minLat, minLon, latStep, lonStep, elev, grad, zoneH, zoneS } = grid;
    const fr = (lat - minLat) / latStep, fc = (lonU - minLon) / lonStep;
    const r0 = Math.max(0, Math.min(rows - 2, Math.floor(fr)));
    const c0 = Math.max(0, Math.min(cols - 2, Math.floor(fc)));
    const tr = Math.max(0, Math.min(1, fr - r0)), tc = Math.max(0, Math.min(1, fc - c0));
    const i00 = r0 * cols + c0, i01 = i00 + 1, i10 = i00 + cols, i11 = i10 + 1;
    const w00 = (1 - tr) * (1 - tc), w01 = (1 - tr) * tc, w10 = tr * (1 - tc), w11 = tr * tc;
    out.h = elev[i00] * w00 + elev[i01] * w01 + elev[i10] * w10 + elev[i11] * w11;
    out.g = grad[i00] * w00 + grad[i01] * w01 + grad[i10] * w10 + grad[i11] * w11;
    const near = tr < 0.5 ? (tc < 0.5 ? i00 : i01) : (tc < 0.5 ? i10 : i11);
    const t = navZoneTerms(zoneH[near], zoneS[near], mode);
    out.add = t[0]; out.mul = t[1];
    return out;
}

// Вартість руху по ортодромії між двома точками (вибірка кожні ~півклітинки)
function navSegmentCost(grid, a, b, mode) {
    const gc = makeGreatCircle(a.lat, a.lon, b.lat, b.lon);
    if (gc.distKm < 1e-6) return 0;
    const n = Math.max(1, Math.ceil(gc.distKm / Math.max(1.5, grid.cellKm * 0.5)));
    const stepKm = gc.distKm / n;
    let prev = navSampleTerrain(grid, a.lat, a.lon, mode, {});
    let total = 0;
    for (let k = 1; k <= n; k++) {
        const p = gc.at(k / n);
        const cur = navSampleTerrain(grid, p.lat, p.lon, mode, {});
        total += navEdgeCost(stepKm, prev.h, cur.h, prev.g, cur.g,
            0.5 * (prev.add + cur.add), 0.5 * (prev.mul + cur.mul), mode);
        prev = cur;
    }
    return total;
}

// ---------- Any-angle згладжування ----------
function smoothNavPath(grid, nodes, mode) {
    if (nodes.length <= 2) return nodes;
    const prefix = [0];
    for (let i = 1; i < nodes.length; i++) {
        prefix.push(prefix[i - 1] + navSegmentCost(grid, nodes[i - 1], nodes[i], mode));
    }
    const out = [nodes[0]];
    let i = 0;
    const MAX_LOOKAHEAD = 40;
    while (i < nodes.length - 1) {
        let best = i + 1;
        for (let j = i + 2; j < nodes.length && j <= i + MAX_LOOKAHEAD; j++) {
            const direct = navSegmentCost(grid, nodes[i], nodes[j], mode);
            if (direct <= (prefix[j] - prefix[i]) * 1.002) best = j;
            else if (j - best >= 6) break;
        }
        out.push(nodes[best]);
        i = best;
    }
    return out;
}

// ---------- Рівномірна вибірка вздовж маршруту ----------
function resampleNavPath(nodes) {
    const segs = [];
    let L = 0;
    for (let i = 1; i < nodes.length; i++) {
        const gc = makeGreatCircle(nodes[i - 1].lat, nodes[i - 1].lon, nodes[i].lat, nodes[i].lon);
        segs.push({ gc, start: L });
        L += gc.distKm;
    }
    const n = Math.max(60, Math.min(600, Math.ceil(L / 3))) + 1;
    const pts = [];
    let si = 0;
    for (let i = 0; i < n; i++) {
        const s = L * i / (n - 1);
        while (si < segs.length - 1 && s > segs[si].start + segs[si].gc.distKm) si++;
        const seg = segs[si];
        const t = seg.gc.distKm > 1e-9 ? Math.max(0, Math.min(1, (s - seg.start) / seg.gc.distKm)) : 0;
        const p = seg.gc.at(t);
        pts.push({ lat: p.lat, lonU: p.lon });
    }
    // кінці — точно в A і B
    pts[0] = { lat: nodes[0].lat, lonU: nodes[0].lon };
    pts[n - 1] = { lat: nodes[nodes.length - 1].lat, lonU: nodes[nodes.length - 1].lon };
    return { pts, L };
}

function getNavGrid(startPt, endPt, padScale) {
    const key = `${startPt.lat},${startPt.lon}|${endPt.lat},${endPt.lon}|${hazardsAvoidanceActive}`;
    if (navGridCache.key !== key) navGridCache = { key, grids: {} };
    if (!navGridCache.grids[padScale]) navGridCache.grids[padScale] = buildTerrainGrid(startPt, endPt, padScale);
    return navGridCache.grids[padScale];
}

// Якщо безпечний маршрут усе ще перетинає небезпечні зони, розширюємо область пошуку
// (можливо, обхід лежить за межами початкового вікна) і беремо кращий варіант.
function runRealTerrainAStar(startPt, endPt, mode) {
    let best = computeNavRoute(startPt, endPt, mode, 1);
    if (mode === 'safe' && hazardsAvoidanceActive && best.hazardHits > 0) {
        for (const scale of [2.2, 4]) {
            const alt = computeNavRoute(startPt, endPt, mode, scale);
            if (alt.hazardHits < best.hazardHits ||
                (alt.hazardHits === best.hazardHits && alt.totalDist < best.totalDist - 1)) {
                best = alt;
            }
            if (best.hazardHits === 0) break;
        }
    }
    return best;
}

function computeNavRoute(startPt, endPt, mode, padScale) {
    const grid = getNavGrid(startPt, endPt, padScale);

    const A = { lat: startPt.lat, lon: startPt.lon };
    const B = { lat: endPt.lat, lon: grid.endLonU };
    const directKm = calculateMarsDistance(A.lat, A.lon, B.lat, B.lon);

    let nodes = [A, B];
    if (directKm > 0.5) {
        const gridNodes = planGridPath(grid, A, B, mode);
        nodes = [A, ...gridNodes, B];
        nodes = smoothNavPath(grid, nodes, mode);
    }

    const { pts, L } = resampleNavPath(nodes);
    const spacing = L / Math.max(1, pts.length - 1);

    const path = pts.map(p => {
        const lon = normalizeLon(p.lonU);
        return { lat: p.lat, lon, unwrappedLon: p.lonU, alt: getMolaElevation(p.lat, lon) };
    });

    // --- Статистика по точному профілю ---
    let asc = 0, desc = 0;
    for (let i = 1; i < path.length; i++) {
        const diff = path[i].alt - path[i - 1].alt;
        if (diff > 0) asc += diff; else desc -= diff;
    }
    const k = Math.max(1, Math.ceil(8 / Math.max(spacing, 1e-6)));  // базис нахилу ≈ 8 км
    let peakSlope = 0, steepCount = 0, windows = 0;
    for (let i = 0; i + k < path.length; i++) {
        const slope = Math.atan(Math.abs(path[i + k].alt - path[i].alt) / (k * spacing * 1000)) / NAV_DEG;
        if (slope > peakSlope) peakSlope = slope;
        if (slope > 10) steepCount++;
        windows++;
    }
    const steepFrac = windows ? steepCount / windows : 0;

    let hazardHits = 0;
    for (const pt of path) {
        for (const z of HAZARD_ZONES) {
            if (isPointInPolygon(pt.lat, pt.lon, z.smoothCoords, z.bbox)) { hazardHits++; break; }
        }
    }
    const hazardKm = hazardHits * spacing;
    const hazardFrac = hazardHits / path.length;
    const detourPct = directKm > 0.5 ? Math.max(0, (L / directKm - 1) * 100) : 0;

    const safetyScore = Math.max(5, Math.min(99, Math.round(
        100 - 120 * hazardFrac - 60 * steepFrac - 1.5 * Math.max(0, peakSlope - 12) - (hazardHits > 0 ? 8 : 0)
    )));

    let diagnosis;
    if (mode === 'safe') {
        if (!hazardsAvoidanceActive) {
            diagnosis = `ОБХІД ЗОН ВИМКНЕНО: маршрут оптимізовано лише за рельєфом. Макс. нахил ${peakSlope.toFixed(1)}°.`;
        } else if (hazardHits === 0) {
            diagnosis = `БЕЗПЕЧНИЙ МАРШРУТ: небезпечні зони оминуто з запасом. Макс. нахил ${peakSlope.toFixed(1)}°, подовження до ортодромії +${detourPct.toFixed(0)}%.`;
        } else {
            diagnosis = `УВАГА: повний обхід неможливий — траверс небезпечних зон ≈ ${Math.round(hazardKm)} км. Обрано шлях з найменшим ризиком.`;
        }
    } else {
        diagnosis = `ШВИДКИЙ МАРШРУТ: мінімальні витрати без обходу зон. Макс. нахил ${peakSlope.toFixed(1)}°, у небезпечних зонах ≈ ${Math.round(hazardKm)} км.`;
    }

    return {
        path,
        totalDist: L,
        maxSlope: peakSlope,
        totalAsc: asc,
        totalDesc: desc,
        safety: safetyScore,
        scanDiagnosis: diagnosis,
        hazardHits
    };
}

// ============================================================================
// 10. ВІДОБРАЖЕННЯ МАРШРУТУ НА ОБИДВОХ КАРТАХ
// ============================================================================
function attachRouteTooltip(polyline, modeName, color) {
    polyline.bindTooltip('', { sticky: true, className: 'mars-tooltip' });
    polyline.on('mousemove', (e) => {
        const lat = Math.max(-90, Math.min(90, e.latlng.lat));
        const lon = normalizeLon(e.latlng.lng);
        updateTelemetry(lat, lon);
        const alt = getMolaElevation(lat, lon);
        polyline.setTooltipContent(`
            <div style="font-family:'Space Grotesk',sans-serif; font-size:11px; line-height:1.4;">
                <span style="color:${color}; font-weight:700;">● ${modeName}</span><br>
                <span style="font-family:'Space Mono',monospace; color:#FFF; font-weight:700; font-size:12px;">ВИСОТА: ${alt > 0 ? '+' : ''}${alt} м</span>
            </div>
        `);
    });
}

function renderMultiWorldPolyline(group, segments, styleOptions, tooltipModeName, color) {
    group.clearLayers();
    WORLD_OFFSETS.forEach(offset => {
        const shiftedSegments = segments.map(seg => seg.map(pt => [pt[0], pt[1] + offset * 360]));
        const line = L.polyline(shiftedSegments, styleOptions);
        attachRouteTooltip(line, tooltipModeName, color);
        group.addLayer(line);
    });
}

document.getElementById('btnBuildRoute').onclick = () => {
    if (!ptA || !ptB) return alert("Оберіть Точку А (старт) та Точку В (фініш) на мапі!");

    safePolylineGroup.clearLayers();
    fastPolylineGroup.clearLayers();

    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);

    safeRouteData = runRealTerrainAStar(ptA, ptB, 'safe');
    fastRouteData = runRealTerrainAStar(ptA, ptB, 'fast');

    const fastSegments = splitPathAtAntimeridian(fastRouteData.path);
    const safeSegments = splitPathAtAntimeridian(safeRouteData.path);

    renderMultiWorldPolyline(fastPolylineGroup, fastSegments, { color: '#FF2E38', weight: 3.5, dashArray: '5, 6' }, 'ШВИДКИЙ МАРШРУТ', '#FF2E38');
    renderMultiWorldPolyline(safePolylineGroup, safeSegments, { color: '#00FFAA', weight: 5.0 }, 'БЕЗПЕЧНИЙ МАРШРУТ', '#00FFAA');

    updateSeparateElevationCards();

    if (!is3DMode) {
        map.fitBounds([[ptA.lat, ptA.lon], [ptB.lat, ptB.lon]], { padding: [50, 50] });
    }

    document.getElementById('routeReport').style.display = 'block';
    setActiveRoute('safe');
};

function updateSeparateElevationCards() {
    if (!safeRouteData || !fastRouteData) return;

    const sAlts = safeRouteData.path.map(p => p.alt);
    const sMin = Math.min(...sAlts), sMax = Math.max(...sAlts);
    document.getElementById('elevSafeMin').innerText = `${sMin > 0 ? '+' : ''}${sMin} м`;
    document.getElementById('elevSafeMax').innerText = `${sMax > 0 ? '+' : ''}${sMax} м`;
    document.getElementById('elevSafeDiff').innerText = `Δ ${sMax - sMin} м`;
    document.getElementById('elevSafeClimb').innerText = `+${Math.round(safeRouteData.totalAsc)} / -${Math.round(safeRouteData.totalDesc)} м`;

    const fAlts = fastRouteData.path.map(p => p.alt);
    const fMin = Math.min(...fAlts), fMax = Math.max(...fAlts);
    document.getElementById('elevFastMin').innerText = `${fMin > 0 ? '+' : ''}${fMin} м`;
    document.getElementById('elevFastMax').innerText = `${fMax > 0 ? '+' : ''}${fMax} м`;
    document.getElementById('elevFastDiff').innerText = `Δ ${fMax - fMin} м`;
    document.getElementById('elevFastClimb').innerText = `+${Math.round(fastRouteData.totalAsc)} / -${Math.round(fastRouteData.totalDesc)} м`;
}

window.setActiveRoute = function(mode) {
    activeRouteMode = mode;
    document.getElementById('tabSafe').classList.toggle('active', mode === 'safe');
    document.getElementById('tabFast').classList.toggle('active', mode === 'fast');

    document.querySelector('.elev-safe-card')?.classList.toggle('active', mode === 'safe');
    document.querySelector('.elev-fast-card')?.classList.toggle('active', mode === 'fast');

    const data = mode === 'safe' ? safeRouteData : fastRouteData;
    if (!data) return;

    safePolylineGroup.eachLayer(l => l.setStyle({ weight: mode === 'safe' ? 5 : 2.5, opacity: mode === 'safe' ? 1 : 0.35 }));
    fastPolylineGroup.eachLayer(l => l.setStyle({ weight: mode === 'fast' ? 5 : 2.5, opacity: mode === 'fast' ? 1 : 0.35 }));

    document.getElementById('metricDist').innerText = `${Math.round(data.totalDist)} км`;
    document.getElementById('metricSlope').innerText = `${data.maxSlope.toFixed(1)}°`;
    document.getElementById('metricClimb').innerText = `+${Math.round(data.totalAsc)} / -${Math.round(data.totalDesc)} м`;

    const sEl = document.getElementById('metricSafety');
    sEl.innerText = `${data.safety}%`;
    sEl.style.color = data.safety >= 75 ? '#00FFAA' : (data.safety > 40 ? '#FFD700' : '#FF2E38');

    document.getElementById('scannerDiagnosis').innerText = data.scanDiagnosis;
    document.getElementById('scannerDiagnosis').style.borderColor = data.safety < 50 ? '#FF2E38' : 'rgba(0, 255, 170, 0.3)';

    resetChartHoverReadout();
    update3DPinsAndPaths();
    renderDualElevationChart(-1);
};

function resetChartHoverReadout() {
    if (!safeRouteData || !fastRouteData) return;
    const sAlts = safeRouteData.path.map(p => p.alt);
    const fAlts = fastRouteData.path.map(p => p.alt);
    const sMin = Math.min(...sAlts), sMax = Math.max(...sAlts);
    const fMin = Math.min(...fAlts), fMax = Math.max(...fAlts);

    document.getElementById('chartHoverInfo').innerHTML = `
        <span style="color:#00FFAA; margin-right:12px;">🟢 БЕЗП: ${sMin > 0 ? '+' : ''}${sMin}…${sMax > 0 ? '+' : ''}${sMax}м</span>
        <span style="color:#FF2E38;">🔴 ШВИД: ${fMin > 0 ? '+' : ''}${fMin}…${fMax > 0 ? '+' : ''}${fMax}м</span>
    `;
}

document.getElementById('btnClearRoute').onclick = () => {
    markerAGroup.clearLayers();
    markerBGroup.clearLayers();
    fastPolylineGroup.clearLayers();
    safePolylineGroup.clearLayers();
    selectedZoneGroup.clearLayers();

    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);

    ptA = ptB = fastRouteData = safeRouteData = safeHoverMarker = fastHoverMarker = null;
    syncUI();
    update3DPinsAndPaths();
    document.getElementById('routeReport').style.display = 'none';
    debouncedSaveCloudRoute();
};

// ============================================================================
// 11. ГРАФІК ПРОФІЛЮ ВИСОТ
// ============================================================================
function renderDualElevationChart(activeHoverRatio = -1) {
    if (!safeRouteData || !fastRouteData) return;
    const cvs = document.getElementById('elevationCanvas'), ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const safeP = safeRouteData.path;
    const fastP = fastRouteData.path;
    if (!safeP.length || !fastP.length) return;

    const allAlts = [...safeP.map(p => p.alt), ...fastP.map(p => p.alt)];
    const minAlt = Math.min(...allAlts);
    const maxAlt = Math.max(...allAlts);
    const range = Math.max(1, maxAlt - minAlt);

    const padLeft = 52, padRight = 10, padTop = 14, padBottom = 16;
    const w = cvs.width - padLeft - padRight;
    const h = cvs.height - padTop - padBottom;

    ctx.font = "9px 'Space Mono', monospace";
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft + w, padTop);
    ctx.stroke();
    ctx.fillText(`${maxAlt > 0 ? '+' : ''}${maxAlt}м`, padLeft - 6, padTop + 3);

    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + h);
    ctx.lineTo(padLeft + w, padTop + h);
    ctx.stroke();
    ctx.fillText(`${minAlt > 0 ? '+' : ''}${minAlt}м`, padLeft - 6, padTop + h + 3);

    const isFastActive = (activeRouteMode === 'fast');
    ctx.beginPath();
    fastP.forEach((pt, i) => {
        const x = padLeft + (i / (fastP.length - 1)) * w;
        const y = padTop + h - ((pt.alt - minAlt) / range) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isFastActive ? '#FF2E38' : 'rgba(255, 46, 56, 0.55)';
    ctx.lineWidth = isFastActive ? 2.6 : 1.6;
    if (!isFastActive) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    const isSafeActive = (activeRouteMode === 'safe');
    ctx.beginPath();
    safeP.forEach((pt, i) => {
        const x = padLeft + (i / (safeP.length - 1)) * w;
        const y = padTop + h - ((pt.alt - minAlt) / range) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isSafeActive ? '#00FFAA' : 'rgba(0, 255, 170, 0.55)';
    ctx.lineWidth = isSafeActive ? 2.6 : 1.6;
    if (!isSafeActive) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (activeHoverRatio >= 0 && activeHoverRatio <= 1) {
        const hx = padLeft + activeHoverRatio * w;
        const safeIdx = Math.round(activeHoverRatio * (safeP.length - 1));
        const fastIdx = Math.round(activeHoverRatio * (fastP.length - 1));
        const sPt = safeP[safeIdx];
        const fPt = fastP[fastIdx];

        const ySafe = padTop + h - ((sPt.alt - minAlt) / range) * h;
        const yFast = padTop + h - ((fPt.alt - minAlt) / range) * h;

        ctx.beginPath();
        ctx.arc(hx, yFast, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FF2E38';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hx, ySafe, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00FFAA';
        ctx.stroke();
    }
}

const cvs = document.getElementById('elevationCanvas');
cvs.addEventListener('mousemove', (e) => {
    if (!safeRouteData || !fastRouteData) return;

    const rect = cvs.getBoundingClientRect();
    const padLeft = 52;
    const w = cvs.width - padLeft - 10;
    const mouseX = (e.clientX - rect.left) * (cvs.width / rect.width);
    const relX = Math.max(0, Math.min(w, mouseX - padLeft));
    const ratio = relX / w;

    const safeP = safeRouteData.path;
    const fastP = fastRouteData.path;
    const sPt = safeP[Math.round(ratio * (safeP.length - 1))];
    const fPt = fastP[Math.round(ratio * (fastP.length - 1))];

    document.getElementById('chartHoverInfo').innerHTML = `
        <span style="color:#00FFAA; margin-right:12px;">🟢 БЕЗП: ${sPt.alt > 0 ? '+' : ''}${sPt.alt}м (${Math.round(ratio * safeRouteData.totalDist)}км)</span>
        <span style="color:#FF2E38;">🔴 ШВИД: ${fPt.alt > 0 ? '+' : ''}${fPt.alt}м (${Math.round(ratio * fastRouteData.totalDist)}км)</span>
    `;

    renderDualElevationChart(ratio);
});

cvs.addEventListener('mouseleave', () => {
    resetChartHoverReadout();
    renderDualElevationChart(-1);
});

// ============================================================================
// 12. СТАРТ ТА СИСТЕМА АКАУНТІВ (POSTGRESQL API)
// ============================================================================
renderZones2D();
renderZonesList();
setHazardVisibility(true);
setSafeVisibility(true);

let currentUser = null;
let authTabMode = 'login';
let autoSaveTimer = null;
let syncToastTimer = null;

// Токен сесії живе лише в пам'яті сторінки: у браузері (localStorage/cookies) нічого не зберігається.
// Усі дані акаунтів і маршрутів — тільки в PostgreSQL.
let sessionToken = null;

function authHeaders(extra = {}) {
    return sessionToken ? { ...extra, Authorization: `Bearer ${sessionToken}` } : extra;
}

function clearLocalSession() {
    currentUser = null;
    sessionToken = null;
    renderAuthUI(false);
}

function showSyncToast(message) {
    const toast = document.getElementById('syncToast');
    const msgEl = document.getElementById('syncToastMsg');
    if (!toast || !msgEl) return;
    msgEl.innerText = message;
    toast.classList.add('show');
    if (syncToastTimer) clearTimeout(syncToastTimer);
    syncToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function debouncedSaveCloudRoute(delay = 500) {
    if (!currentUser) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveRouteToAccount(false), delay);
}

// Збереження точок у базу PostgreSQL через бекенд Railway
async function saveRouteToAccount(showToast = true) {
    if (!currentUser) return;

    try {
        const payload = {
            username: currentUser,
            pointA: ptA ? { lat: ptA.lat, lon: ptA.lon } : null,
            pointB: ptB ? { lat: ptB.lat, lon: ptB.lon } : null
        };

        const res = await fetch('/api/save-route', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });

        if (res.status === 401) {
            clearLocalSession();
            showSyncToast('Сесія завершилась, увійдіть знову');
            return;
        }

        if (res.ok) {
            updateModalSyncView(ptA, ptB);
            if (showToast) showSyncToast('Маршрут збережено в PostgreSQL 💾');
        } else {
            const data = await res.json();
            console.warn('Сервер повернув помилку збереження:', data.error);
        }
    } catch (e) {
        console.error('Помилка звернення до сервера БД:', e);
    }
}

// Завантаження збережених точок ровера з PostgreSQL
async function loadRouteFromAccount(autoBuild = true) {
    if (!currentUser) return;

    try {
        const res = await fetch(`/api/load-route/${encodeURIComponent(currentUser)}`, {
            headers: authHeaders()
        });
        if (res.status === 401) {
            clearLocalSession();
            showSyncToast('Сесія завершилась, увійдіть знову');
            return;
        }
        const data = await res.json();

        if (res.ok && data.success) {
            if (data.pointA || data.pointB) {
                applyCloudRoutePoints(data.pointA, data.pointB, autoBuild);
                showSyncToast(`Маршрут завантажено з PostgreSQL (${currentUser})`);
            } else {
                showSyncToast('В акаунті ще немає збережених точок');
            }
            updateModalSyncView(data.pointA, data.pointB);
        } else {
            showSyncToast(data.error || 'Помилка завантаження даних');
        }
    } catch (e) {
        console.error('Помилка завантаження з PostgreSQL:', e);
        showSyncToast('Помилка зв’язку з базою даних');
    }
}

function updateModalSyncView(a, b) {
    const elA = document.getElementById('syncDispPointA');
    const elB = document.getElementById('syncDispPointB');
    if (elA) elA.innerText = a ? `${Number(a.lat).toFixed(2)}°, ${Number(a.lon).toFixed(2)}°` : 'Не встановлено';
    if (elB) elB.innerText = b ? `${Number(b.lat).toFixed(2)}°, ${Number(b.lon).toFixed(2)}°` : 'Не встановлено';
}

async function checkAuthSession() {
    // Нічого не відновлюємо з браузера: після перезавантаження потрібно увійти знову
    renderAuthUI(false);
}

function renderAuthUI(isLoggedIn, username = '') {
    const btnText = document.getElementById('accountBtnText');
    const btnAccount = document.getElementById('btnAccount');
    const dotAccount = document.getElementById('accountDot');
    const loggedOutView = document.getElementById('authLoggedOutView');
    const loggedInView = document.getElementById('authLoggedInView');
    const loggedInTitle = document.getElementById('loggedInUsernameTitle');

    if (isLoggedIn) {
        if (btnText) btnText.innerText = username;
        if (btnAccount) btnAccount.classList.add('logged-in');
        if (dotAccount) dotAccount.classList.add('online');
        if (loggedOutView) loggedOutView.style.display = 'none';
        if (loggedInView) loggedInView.style.display = 'block';
        if (loggedInTitle) loggedInTitle.innerText = `РОСТЕР // ${username.toUpperCase()}`;
    } else {
        if (btnText) btnText.innerText = 'ВХІД / АКАУНТ';
        if (btnAccount) btnAccount.classList.remove('logged-in');
        if (dotAccount) dotAccount.classList.remove('online');
        if (loggedOutView) loggedOutView.style.display = 'block';
        if (loggedInView) loggedInView.style.display = 'none';
    }
}

function initAccountModal() {
    const modal = document.getElementById('accountModal');
    const btnAccount = document.getElementById('btnAccount');
    const btnCloseModal = document.getElementById('btnCloseAccountModal');
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabRegister = document.getElementById('tabAuthRegister');
    const authForm = document.getElementById('authForm');
    const btnSubmit = document.getElementById('btnSubmitAuth');
    const btnLogout = document.getElementById('btnLogout');
    const btnSaveCurrent = document.getElementById('btnSaveCurrentRoute');
    const btnLoadSaved = document.getElementById('btnLoadSavedRoute');
    const errBox = document.getElementById('authErrorMsg');
    const succBox = document.getElementById('authSuccessMsg');

    function showErr(msg) {
        if (!errBox) return;
        errBox.innerText = msg;
        errBox.style.display = 'block';
        if (succBox) succBox.style.display = 'none';
    }
    function showSucc(msg) {
        if (!succBox) return;
        succBox.innerText = msg;
        succBox.style.display = 'block';
        if (errBox) errBox.style.display = 'none';
    }
    function clearMsgs() {
        if (errBox) errBox.style.display = 'none';
        if (succBox) succBox.style.display = 'none';
    }

    if (btnAccount && modal) btnAccount.onclick = () => { clearMsgs(); modal.style.display = 'flex'; };
    if (btnCloseModal && modal) btnCloseModal.onclick = () => { modal.style.display = 'none'; };
    if (modal) modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    if (tabLogin && tabRegister) {
        tabLogin.onclick = () => {
            authTabMode = 'login';
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            btnSubmit.innerText = 'УВІЙТИ В АКАУНТ';
            clearMsgs();
        };
        tabRegister.onclick = () => {
            authTabMode = 'register';
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            btnSubmit.innerText = 'СТВОРИТИ АКАУНТ';
            clearMsgs();
        };
    }

    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            clearMsgs();

            const usernameInput = document.getElementById('authUsername');
            const passwordInput = document.getElementById('authPassword');
            const u = usernameInput ? usernameInput.value.trim() : '';
            const p = passwordInput ? passwordInput.value.trim() : '';

            if (u.length < 3) return showErr('Логін має містити щонайменше 3 символи');
            if (p.length < 3) return showErr('Пароль має містити щонайменше 3 символи');

            btnSubmit.disabled = true;
            btnSubmit.innerText = 'ОБРОБКА...';

            try {
                const res = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: u,
                        password: p,
                        mode: authTabMode,
                        pointA: ptA,
                        pointB: ptB
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    showErr(data.error || 'Помилка авторизації');
                    return;
                }

                currentUser = data.user.username;
                sessionToken = data.token;
                renderAuthUI(true, currentUser);
                updateModalSyncView(data.user.point_a, data.user.point_b);

                if (authTabMode === 'register') {
                    showSucc('Акаунт успішно створено в PostgreSQL!');
                } else {
                    if (data.user.point_a || data.user.point_b) {
                        applyCloudRoutePoints(data.user.point_a, data.user.point_b, true);
                        showSucc('Вхід успішний! Завантажено збережений маршрут.');
                    } else if (ptA || ptB) {
                        saveRouteToAccount(false);
                        showSucc('Вхід успішний! Поточні точки збережено.');
                    } else {
                        showSucc('Вхід успішний!');
                    }
                }

                setTimeout(() => { modal.style.display = 'none'; }, 1000);
            } catch (err) {
                console.error('Помилка мережі /api/auth:', err);
                showErr('Помилка підключення до сервера БД');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerText = (authTabMode === 'register') ? 'СТВОРИТИ АКАУНТ' : 'УВІЙТИ В АКАУНТ';
            }
        };
    }

    if (btnLogout) {
        btnLogout.onclick = () => {
            fetch('/api/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
            clearLocalSession();
            modal.style.display = 'none';
            showSyncToast('Ви вийшли з акаунту');
        };
    }

    if (btnSaveCurrent) {
        btnSaveCurrent.onclick = () => {
            if (!ptA && !ptB) return alert('Спочатку оберіть хоча б одну точку на мапі!');
            saveRouteToAccount(true);
        };
    }

    if (btnLoadSaved) {
        btnLoadSaved.onclick = () => {
            loadRouteFromAccount(true);
            modal.style.display = 'none';
        };
    }
}

initAccountModal();
checkAuthSession();