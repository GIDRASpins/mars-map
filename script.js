const MARS_RADIUS_KM = 3389.5;

// ============================================================================
// 1. КАТАЛОГ ЗОН МАРСА (З ПОВНИМ ПОКРИТТЯМ УРВИЩ ТА ПРІРВ)
// ============================================================================
const MARS_ZONES = [
    // === НЕБЕЗПЕЧНІ ЗОНИ (HAZARDS) ===
    {
        id: 'valles_marineris',
        name: 'Долина Марінера та північні каньйони (Valles Marineris Complex)',
        type: 'hazard',
        // Охоплює як головну вісь, так і північні провалля (Хебес, Офір, Ювента, Гангес)
        coords: [
            [-0.5, -78.0], [-1.8, -68.0], [-3.0, -59.0], [-5.5, -45.0],
            [-11.5, -34.0], [-14.5, -33.0], [-18.0, -42.0], [-17.0, -55.0],
            [-15.0, -68.0], [-13.5, -78.0], [-11.0, -88.0], [-8.0, -94.0],
            [-4.0, -92.0], [-1.5, -85.0]
        ]
    },
    {
        id: 'noctis_labyrinthus',
        name: 'Лабіринт Ночі (Noctis Labyrinthus)',
        type: 'hazard',
        coords: [
            [-4.5, -106.0], [-4.5, -95.0], [-8.5, -91.0], [-12.5, -92.5],
            [-14.0, -99.0], [-12.5, -107.0], [-8.0, -108.0]
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
        name: 'Вал басейну Еллада (Hellas Rim)',
        type: 'hazard',
        coords: [
            [-34.0, 60.0], [-31.0, 70.0], [-33.0, 80.0], [-38.0, 88.0],
            [-46.0, 89.0], [-52.0, 83.0], [-55.0, 72.0], [-53.0, 60.0],
            [-46.0, 53.0], [-39.0, 54.0], [-41.0, 60.0], [-46.0, 62.0],
            [-49.0, 69.0], [-47.0, 78.0], [-42.0, 81.0], [-37.0, 76.0], [-36.0, 66.0]
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
        id: 'aurorae_chaos',
        name: 'Хаос Аврора (Aurorae Chaos)',
        type: 'hazard',
        coords: [
            [-6.5, -42.0], [-7.0, -34.0], [-12.0, -32.0], [-14.5, -39.0], [-11.0, -44.0]
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
        id: 'gale_crater',
        name: 'Схили кратера Гейл (Gale Crater Rim)',
        type: 'hazard',
        coords: [
            [-4.0, 136.5], [-4.2, 138.8], [-5.8, 139.2], [-6.8, 138.0],
            [-6.5, 136.2], [-5.2, 135.5]
        ]
    },
    {
        id: 'jezero_rim',
        name: 'Стінки кратера Єзеро (Jezero Scarps)',
        type: 'hazard',
        coords: [
            [19.8, 76.5], [19.5, 78.5], [18.2, 78.8], [17.5, 77.5],
            [18.0, 76.0], [19.2, 75.8]
        ]
    },
    {
        id: 'planum_australe',
        name: 'Південна полярна шапка (Planum Australe)',
        type: 'hazard',
        coords: [
            [-75.0, -180.0], [-75.0, -90.0], [-75.0, 0.0], [-75.0, 90.0],
            [-75.0, 180.0], [-89.9, 180.0], [-89.9, 0.0], [-89.9, -180.0]
        ]
    },
    {
        id: 'planum_boreum',
        name: 'Північна полярна шапка (Planum Boreum)',
        type: 'hazard',
        coords: [
            [75.0, -180.0], [75.0, -90.0], [75.0, 0.0], [75.0, 90.0],
            [75.0, 180.0], [89.9, 180.0], [89.9, 0.0], [89.9, -180.0]
        ]
    },
    {
        id: 'dust_belt',
        name: 'Пиловий коридор (Dust Storm Corridor)',
        type: 'hazard',
        coords: [
            [-18.0, -40.0], [-19.0, -10.0], [-23.0, 20.0], [-30.0, 45.0],
            [-37.0, 40.0], [-32.0, 10.0], [-28.0, -20.0], [-24.0, -42.0]
        ]
    },

    // === БЕЗПЕЧНІ ЗОНИ (SAFE) ===
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
            [32.0, -168.0], [30.0, -148.0], [22.0, -145.0], [14.0, -150.0],
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
        name: 'Дно Еллади (Hellas Basin Floor)',
        type: 'safe',
        coords: [
            [-38.0, 66.0], [-37.5, 74.0], [-41.0, 77.0], [-45.0, 74.5],
            [-45.5, 67.0], [-42.0, 64.0]
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
        id: 'jezero_floor',
        name: 'Дно озера Єзеро (Jezero Lakebed)',
        type: 'safe',
        coords: [
            [18.8, 77.1], [18.7, 77.7], [18.2, 77.8], [18.1, 77.3], [18.4, 76.9]
        ]
    },
    {
        id: 'gale_floor',
        name: 'Дно кратера Гейл (Gale Floor)',
        type: 'safe',
        coords: [
            [-5.0, 137.0], [-4.9, 137.7], [-5.5, 137.8], [-5.6, 137.1]
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
    const lats = z.coords.map(p => p[0]);
    const lons = z.coords.map(p => p[1]);
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
// 3. ТОПОГРАФІЧНА МАТ-МОДЕЛЬ (РЕАЛЬНІ ПРІРВИ, КАНЬЙОНИ ТА УРВИЩА)
// ============================================================================
function getMolaElevation(lat, lon) {
    // 1. Глобальна марсіанська дихотомія (високий Південь vs низовинна Північ)
    let elev = -1500 + Math.sin((lat - 8) * Math.PI / 180) * -2700;
    elev += Math.sin(lat * 0.12 + 0.3) * Math.cos(lon * 0.12) * 600;
    elev += Math.sin(lat * 0.35) * Math.cos(lon * 0.35) * 250;

    // 2. Вулканічне нагір'я Тарсис (Tharsis Bulge: висота плато +4000...+7500 м)
    const dTharsis = Math.hypot((lat - 1) * 1.3, lon - (-95));
    if (dTharsis < 38) {
        elev += Math.cos((dTharsis / 38) * (Math.PI / 2)) * 6200;
    }

    // 3. Вулкан Олімп (+21.2 км та прямовисні 6-8 км базальні скелі)
    const dOly = Math.hypot(lat - 18.4, lon - (-133.8));
    if (dOly < 5.5) {
        if (dOly > 3.6) {
            elev += 4000 + (5.5 - dOly) * 3500; // Базальний уступ-урвище
        } else {
            elev += 11000 + (3.6 - dOly) * 2800; // Конус вулкана
        }
    }

    // 4. Вулкани провінції Тарсис (Аскрійська, Павоніс, Арсія)
    const dAsc = Math.hypot(lat - 11.8, lon - (-104.5));
    if (dAsc < 4.5) elev += (4.5 - dAsc) * 2600;

    const dPav = Math.hypot(lat - 0.8, lon - (-113.0));
    if (dPav < 4.0) elev += (4.0 - dPav) * 2200;

    const dArs = Math.hypot(lat - (-9.0), lon - (-121.0));
    if (dArs < 4.5) elev += (4.5 - dArs) * 2400;

    const dEly = Math.hypot(lat - 25.0, lon - 147.2);
    if (dEly < 5.0) elev += (5.0 - dEly) * 2200;

    // 5. ДОЛИНА МАРІНЕРА ТА СИСТЕМА ПІВНІЧНИХ БЕЗОДЕНЬ
    // Провалля сягають глибини -4500...-7800 м при висоті країв плато +4000 м (перепад 8-10 км!)
    if (lat >= -19.0 && lat <= 2.0 && lon >= -98.0 && lon <= -30.0) {
        // Вісь головного рифту каньйону
        const t = Math.max(0, Math.min(1, ((lon - (-92.0)) * 58.0 + (lat - (-5.0)) * (-9.0)) / (58*58 + 9*9)));
        const spineLat = -5.0 + t * (-9.0);
        const spineLon = -92.0 + t * 58.0;
        const distToSpine = Math.hypot((lat - spineLat) * 1.5, lon - spineLon);

        if (distToSpine < 4.8) {
            const abyssFactor = Math.cos((distToSpine / 4.8) * (Math.PI / 2));
            elev -= Math.pow(abyssFactor, 1.8) * 8200;
        }

        // Глибокі окремі ізольовані провалля північніше головного стовбура:
        // Хебес (глибина 8 км), Ювента (глибина 6 км), Гангес (глибина 5.5 км)
        const dHebes = Math.hypot((lat - (-1.0)) * 1.8, lon - (-76.0));
        if (dHebes < 2.5) elev -= Math.cos((dHebes / 2.5) * (Math.PI / 2)) * 7200;

        const dJuventae = Math.hypot((lat - (-4.5)) * 1.6, lon - (-62.5));
        if (dJuventae < 2.8) elev -= Math.cos((dJuventae / 2.8) * (Math.PI / 2)) * 6500;

        const dGanges = Math.hypot((lat - (-8.0)) * 1.6, lon - (-48.0));
        if (dGanges < 3.2) elev -= Math.cos((dGanges / 3.2) * (Math.PI / 2)) * 6000;
    }

    // 6. Лабіринт Ночі (Noctis Labyrinthus) - сітка прямовисних розколів
    const dNoctis = Math.hypot((lat - (-8.0)) * 1.4, lon - (-100.0));
    if (dNoctis < 6.8) {
        const canyonGrid = Math.sin(lat * 2.8) * Math.sin(lon * 2.8);
        elev -= (1 - dNoctis / 6.8) * 3400 + (canyonGrid > 0.1 ? canyonGrid * 2600 : 0);
    }

    // 7. Басейн Еллада (Hellas) - найглибша чаша Сонячної системи
    const dHel = Math.hypot((lat - (-42.0)) * 1.1, lon - 70.0);
    if (dHel < 18.0) {
        if (dHel > 12.0) {
            elev += Math.sin(((dHel - 12.0) / 6.0) * Math.PI) * 2400; // Гірський вал
        } else {
            elev -= Math.cos((dHel / 12.0) * (Math.PI / 2)) * 5600; // Дно до -7200м
        }
    }

    return Math.round(elev);
}

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
    const clampedLon = ((lon + 180) % 360 + 360) % 360 - 180;
    const alt = getMolaElevation(clampedLat, clampedLon);

    elLat.innerText = `${clampedLat.toFixed(4)}°`;
    elLon.innerText = `${clampedLon.toFixed(4)}°`;
    elAlt.innerText = `${alt > 0 ? '+' : ''}${alt} M`;
}

// ============================================================================
// 4. LEAFLET 2D
// ============================================================================
const map = L.map('map', {
    crs: L.CRS.EPSG4326,
    center: [0, 0],
    zoom: 1,
    minZoom: 0.5,
    maxZoom: 5,
    zoomSnap: 0.05,
    maxBounds: [[-90, -180], [90, 180]]
});

L.imageOverlay('https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg', [
    [-90, -180],
    [90, 180]
]).addTo(map);

const hazardLayerGroup = L.layerGroup().addTo(map);
const safeLayerGroup = L.layerGroup().addTo(map);

function renderZones2D() {
    hazardLayerGroup.clearLayers();
    safeLayerGroup.clearLayers();

    MARS_ZONES.forEach(z => {
        const isHaz = z.type === 'hazard';
        const poly = L.polygon(z.coords, {
            color: isHaz ? '#FF2E38' : '#00FFAA',
            fillColor: isHaz ? '#FF2E38' : '#00FFAA',
            fillOpacity: isHaz ? 0.22 : 0.16,
            weight: 2,
            dashArray: isHaz ? '4, 4' : '6, 6'
        });

        poly.on('click', (e) => {
            handleCoordinateSelect(e.latlng.lat, e.latlng.lng);
        });

        poly.on('mouseover', () => poly.setStyle({ fillOpacity: isHaz ? 0.45 : 0.35, weight: 3 }));
        poly.on('mouseout', () => poly.setStyle({ fillOpacity: isHaz ? 0.22 : 0.16, weight: 2 }));

        z.leafletLayer = poly;

        if (isHaz) {
            hazardLayerGroup.addLayer(poly);
        } else {
            safeLayerGroup.addLayer(poly);
        }
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

map.on('mousemove', (e) => {
    const lat = Math.max(-90, Math.min(90, e.latlng.lat));
    const lon = Math.max(-180, Math.min(180, e.latlng.lng));
    updateTelemetry(lat, lon);
});

function attachRouteHoverEvents(polyline, modeName, color) {
    polyline.bindTooltip('', { sticky: true, className: 'mars-tooltip' });
    polyline.on('mousemove', (e) => {
        const lat = Math.max(-90, Math.min(90, e.latlng.lat));
        const lon = ((e.latlng.lng + 180) % 360 + 360) % 360 - 180;
        updateTelemetry(lat, lon);
        const alt = getMolaElevation(lat, lon);
        const sign = alt > 0 ? '+' : '';
        polyline.setTooltipContent(`
            <div style="font-family:'Space Grotesk',sans-serif; font-size:11px; line-height:1.4;">
                <span style="color:${color}; font-weight:700;">● ${modeName}</span><br>
                <span style="font-family:'Space Mono',monospace; color:#FFF; font-weight:700; font-size:12px;">ВИСОТА: ${sign}${alt} м</span>
            </div>
        `);
    });
    polyline.on('click', (e) => {
        handleCoordinateSelect(e.latlng.lat, e.latlng.lng);
    });
}

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

function densifyPolygonRing(rawCoords, maxStepDeg = 1.6) {
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

function getPolarCapRing(latBase, isNorth, steps = 72) {
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
            const denseRing = densifyPolygonRing(z.coords);
            features.push({ type: 'Feature', properties: baseProps, geometry: { type: 'Polygon', coordinates: [denseRing] } });
        }
    });
    return features;
}

let myGlobe = null;
try {
    myGlobe = Globe()(document.getElementById('globe-container'))
        .globeImageUrl('https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg')
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
        .onPolygonClick(d => focusOnZone(d.properties.id))
        .onGlobeClick(({ lat, lng }) => handleCoordinateSelect(lat, lng));
} catch (err) {
    console.warn("3D Globe:", err);
}

window.addEventListener('mousemove', (e) => {
    if (!is3DMode || !myGlobe) return;
    if (e.target && e.target.closest && e.target.closest('.hud-sidebar, .hud-top, .sidebar-toggle, .warning-toast')) return;

    const container = document.getElementById('globe-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (typeof myGlobe.toGlobeCoords === 'function') {
        const coords = myGlobe.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top);
        if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
            updateTelemetry(coords.lat, coords.lng);
        } else {
            updateTelemetry(null, null);
        }
    }
});

window.addEventListener('resize', () => {
    if (myGlobe) myGlobe.width(window.innerWidth).height(window.innerHeight);
});

function update3DVisibility() {
    if (myGlobe) myGlobe.polygonsData(getActive3DFeatures());
}

// ============================================================================
// 6. TOGGLES ТА КЕРУВАННЯ
// ============================================================================
function setHazardVisibility(visible) {
    showHazardZones = visible;
    const btnTop = document.getElementById('btnVisHazards');
    btnTop.classList.toggle('active', showHazardZones);
    btnTop.classList.toggle('inactive', !showHazardZones);
    btnTop.innerHTML = `<span class="btn-dot ${showHazardZones ? 'dot-red' : 'dot-muted'}"></span>НЕБЕЗПЕКИ: ${showHazardZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`;

    document.getElementById('switchToggleHazards').classList.toggle('active', showHazardZones);
    update2DLayerVisibility();
    update3DVisibility();
}

function setSafeVisibility(visible) {
    showSafeZones = visible;
    const btnTop = document.getElementById('btnVisSafe');
    btnTop.classList.toggle('active', showSafeZones);
    btnTop.classList.toggle('inactive', !showSafeZones);
    btnTop.innerHTML = `<span class="btn-dot ${showSafeZones ? 'dot-green' : 'dot-muted'}"></span>БЕЗПЕЧНІ: ${showSafeZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`;

    document.getElementById('switchToggleSafe').classList.toggle('active', showSafeZones);
    update2DLayerVisibility();
    update3DVisibility();
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
    } else if (myGlobe) {
        myGlobe.width(window.innerWidth).height(window.innerHeight);
    }
};

document.getElementById('btnToggleSidebar').onclick = (e) => {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    e.target.classList.toggle('collapsed');
    e.target.innerText = sb.classList.contains('collapsed') ? '❯' : '❮';
};

function showWarning(msg) {
    const toast = document.getElementById('warningToast');
    document.getElementById('warningMsg').innerText = msg;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 6500);
}

// ============================================================================
// 7. СПИСОК ЗОН (КОМПАКТНИЙ)
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

document.getElementById('zoneFilterInput').addEventListener('input', (e) => {
    renderZonesList(e.target.value);
});

window.focusOnZone = function(zoneId) {
    const zone = MARS_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    if (is3DMode && myGlobe) {
        myGlobe.pointOfView({ lat: zone.centroid[0], lng: zone.centroid[1], altitude: 1.5 }, 1200);
    } else {
        if (zone.leafletLayer) {
            map.flyToBounds(zone.leafletLayer.getBounds(), { padding: [60, 60], maxZoom: 3.5, duration: 1.2 });
        } else {
            map.flyTo(zone.centroid, 3, { duration: 1.2 });
        }
    }
    showWarning(`ФОКУС: ${zone.name}`);
};

function executeGlobalSearch() {
    const input = document.getElementById('searchInput');
    const query = input.value.toLowerCase().trim();
    if (!query) return;

    const match = MARS_ZONES.find(z => z.name.toLowerCase().includes(query) || z.id.toLowerCase().includes(query));
    if (match) {
        focusOnZone(match.id);
        input.value = match.name;
    } else {
        showWarning(`Зону не знайдено: "${query}"`);
    }
}

document.getElementById('searchBtn').onclick = executeGlobalSearch;
document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeGlobalSearch();
});

// ============================================================================
// 8. КЕРУВАННЯ ТОЧКАМИ ТА ШЛЯХОМ
// ============================================================================
let markerA = null, markerB = null;
let ptA = null, ptB = null;
let fastPolyline = null, safePolyline = null;
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

function splitPathAtAntimeridian(path) {
    if (!path || path.length < 2) return path ? [path.map(p => [p.lat, ((p.lon + 180) % 360 + 360) % 360 - 180])] : [];

    const segments = [];
    let currentSegment = [];
    const norm = lon => ((lon + 180) % 360 + 360) % 360 - 180;

    for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        const currLon = norm(pt.lon);
        const currLat = pt.lat;

        if (i === 0) { currentSegment.push([currLat, currLon]); continue; }

        const prevLon = norm(path[i - 1].lon);
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

function handleCoordinateSelect(rawLat, rawLon) {
    const lat = Math.max(-90, Math.min(90, Number(rawLat).toFixed(4)));
    const lon = Math.max(-180, Math.min(180, Number(rawLon).toFixed(4)));

    if (!ptA) {
        ptA = { lat: Number(lat), lon: Number(lon) };
        if (markerA) map.removeLayer(markerA);
        markerA = L.marker([lat, lon], { icon: makeNothingPin('A', false), draggable: true }).addTo(map);
        markerA.on('dragend', (e) => {
            const p = e.target.getLatLng();
            ptA = { lat: p.lat, lon: p.lng };
            syncUI();
            if (fastRouteData) document.getElementById('btnBuildRoute').click();
        });
    } else if (!ptB) {
        ptB = { lat: Number(lat), lon: Number(lon) };
        if (markerB) map.removeLayer(markerB);
        markerB = L.marker([lat, lon], { icon: makeNothingPin('B', true), draggable: true }).addTo(map);
        markerB.on('dragend', (e) => {
            const p = e.target.getLatLng();
            ptB = { lat: p.lat, lon: p.lng };
            syncUI();
            if (fastRouteData) document.getElementById('btnBuildRoute').click();
        });
    }
    syncUI();
    update3DPinsAndPaths();
}

map.on('click', (e) => handleCoordinateSelect(e.latlng.lat, e.latlng.lng));

function syncUI() {
    document.getElementById('dispPointA').innerText = ptA ? `${ptA.lat.toFixed(2)}°, ${ptA.lon.toFixed(2)}°` : 'Клікніть на мапі...';
    document.getElementById('dispPointB').innerText = ptB ? `${ptB.lat.toFixed(2)}°, ${ptB.lon.toFixed(2)}°` : 'Клікніть на мапі...';
}

window.setPresetRoute = function(lat1, lon1, lat2, lon2) {
    if (markerA) map.removeLayer(markerA);
    if (markerB) map.removeLayer(markerB);
    ptA = null;
    ptB = null;
    handleCoordinateSelect(lat1, lon1);
    handleCoordinateSelect(lat2, lon2);
    document.getElementById('btnBuildRoute').click();

    const dLon = lon2 - lon1;
    const shortestDLon = ((dLon + 180) % 360 + 360) % 360 - 180;
    const midLon = ((lon1 + shortestDLon / 2 + 180) % 360 + 360) % 360 - 180;
    const midLat = (lat1 + lat2) / 2;

    if (is3DMode && myGlobe) {
        myGlobe.pointOfView({ lat: midLat, lng: midLon, altitude: 1.5 }, 1500);
    } else {
        if (Math.abs(dLon) > 180) {
            map.setView([midLat, 0], 1);
        } else {
            map.flyToBounds([[lat1, lon1], [lat2, lon2]], { padding: [50, 50] });
        }
    }
};

// ============================================================================
// 9. АЛГОРИТМ A* З ФІЗИЧНИМ АНАЛІЗОМ СХИЛІВ, КРУТИЗНИ ТА ПРІРВ
// ============================================================================
class FastMinHeap {
    constructor(capacity) {
        this.nodes = new Int32Array(capacity);
        this.costs = new Float32Array(capacity);
        this.size = 0;
    }
    push(node, cost) {
        let i = this.size++;
        this.nodes[i] = node;
        this.costs[i] = cost;
        while (i > 0) {
            let p = (i - 1) >> 1;
            if (this.costs[i] < this.costs[p]) {
                let tn = this.nodes[i]; this.nodes[i] = this.nodes[p]; this.nodes[p] = tn;
                let tc = this.costs[i]; this.costs[i] = this.costs[p]; this.costs[p] = tc;
                i = p;
            } else break;
        }
    }
    pop() {
        if (this.size === 0) return -1;
        let top = this.nodes[0], last = --this.size;
        this.nodes[0] = this.nodes[last];
        this.costs[0] = this.costs[last];
        let i = 0, half = this.size >> 1;
        while (i < half) {
            let l = (i << 1) + 1, r = l + 1, best = (r < this.size && this.costs[r] < this.costs[l]) ? r : l;
            if (this.costs[best] < this.costs[i]) {
                let tn = this.nodes[i]; this.nodes[i] = this.nodes[best]; this.nodes[best] = tn;
                let tc = this.costs[i]; this.costs[i] = this.costs[best]; this.costs[best] = tc;
                i = best;
            } else break;
        }
        return top;
    }
}

function runRealTerrainAStar(startPt, endPt, mode) {
    const totalDist = calculateMarsDistance(startPt.lat, startPt.lon, endPt.lat, endPt.lon);

    // Достатній запас для широкого обходу великих каньйонів
    const padLat = Math.max(20.0, Math.min(50.0, totalDist / 45.0 + 14.0));
    const padLon = Math.max(40.0, Math.min(85.0, totalDist / 30.0 + 30.0));

    const minLat = Math.max(-88, Math.min(startPt.lat, endPt.lat) - padLat);
    const maxLat = Math.min(88, Math.max(startPt.lat, endPt.lat) + padLat);

    const dLon = endPt.lon - startPt.lon;
    const shortestDLon = ((dLon + 180) % 360 + 360) % 360 - 180;
    const unwrappedEndLon = startPt.lon + shortestDLon;

    const minLon = Math.min(startPt.lon, unwrappedEndLon) - padLon;
    const maxLon = Math.max(startPt.lon, unwrappedEndLon) + padLon;

    const ROWS = 85, COLS = 85, TOTAL = ROWS * COLS;
    const latStep = (maxLat - minLat) / (ROWS - 1);
    const lonStep = (maxLon - minLon) / (COLS - 1);

    const latGrid = new Float32Array(ROWS), lonGrid = new Float32Array(COLS);
    const elevGrid = new Float32Array(TOTAL), hazardGrid = new Uint8Array(TOTAL), safeGrid = new Uint8Array(TOTAL);

    for (let r = 0; r < ROWS; r++) latGrid[r] = minLat + r * latStep;
    for (let c = 0; c < COLS; c++) lonGrid[c] = minLon + c * lonStep;

    const norm = lon => ((lon + 180) % 360 + 360) % 360 - 180;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const idx = r * COLS + c;
            const lat = latGrid[r];
            const normLon = norm(lonGrid[c]);
            elevGrid[idx] = getMolaElevation(lat, normLon);

            if (hazardsAvoidanceActive) {
                for (let z of HAZARD_ZONES) {
                    if (isPointInPolygon(lat, normLon, z.coords, z.bbox)) {
                        hazardGrid[idx] = 1;
                        break;
                    }
                }
            }

            for (let z of SAFE_ZONES) {
                if (isPointInPolygon(lat, normLon, z.coords, z.bbox)) {
                    safeGrid[idx] = 1;
                    break;
                }
            }
        }
    }

    const startR = Math.max(0, Math.min(ROWS - 1, Math.round((startPt.lat - minLat) / latStep)));
    const startC = Math.max(0, Math.min(COLS - 1, Math.round((startPt.lon - minLon) / lonStep)));
    const endR = Math.max(0, Math.min(ROWS - 1, Math.round((endPt.lat - minLat) / latStep)));
    const endC = Math.max(0, Math.min(COLS - 1, Math.round((unwrappedEndLon - minLon) / lonStep)));
    const startIdx = startR * COLS + startC, endIdx = endR * COLS + endC;

    const gScore = new Float32Array(TOTAL).fill(Infinity);
    const cameFrom = new Int32Array(TOTAL).fill(-1);
    const closed = new Uint8Array(TOTAL);
    const heap = new FastMinHeap(TOTAL * 3);

    gScore[startIdx] = 0;
    heap.push(startIdx, 0);

    const dr = [-1, -1, -1, 0, 0, 1, 1, 1];
    const dc = [-1, 0, 1, -1, 1, -1, 0, 1];
    let found = false;

    while (heap.size > 0) {
        const curIdx = heap.pop();
        if (curIdx === -1) break;
        if (closed[curIdx] === 1) continue;
        closed[curIdx] = 1;

        if (curIdx === endIdx) { found = true; break; }

        const curR = (curIdx / COLS) | 0, curC = curIdx % COLS;
        const curElev = elevGrid[curIdx];

        for (let i = 0; i < 8; i++) {
            const nr = curR + dr[i], nc = curC + dc[i];
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            const nIdx = nr * COLS + nc;
            if (closed[nIdx] === 1) continue;

            const stepDist = Math.hypot(
                (latGrid[nr] - latGrid[curR]) * 59.2,
                (lonGrid[nc] - lonGrid[curC]) * 59.2 * Math.cos(latGrid[curR] * Math.PI / 180)
            ) || 1;

            const elevDiff = Math.abs(elevGrid[nIdx] - curElev);
            
            // ФІЗИЧНИЙ НАХИЛ У ГРАДУСАХ ДЛЯ РОЗРАХУНКУ ПЕРЕШКОД
            const slopeDeg = Math.atan2(elevDiff, stepDist * 1000) * (180 / Math.PI);

            let cost = stepDist;

            if (mode === 'safe') {
                // МАТ-МОДЕЛЬ БЕЗПЕКИ: аналіз нахилу та виявлення урвищ
                if (slopeDeg < 3.5) {
                    cost *= 1.0; // Пологий ґрунт
                } else if (slopeDeg < 8.0) {
                    cost *= (1.0 + Math.pow(slopeDeg / 4.0, 1.8)); // Помірний ухил
                } else if (slopeDeg < 14.0) {
                    // Крутий схил: колеса буксують, небезпека заносу
                    cost *= (4.0 + Math.pow(slopeDeg / 3.5, 2.5));
                } else if (slopeDeg < 19.0) {
                    // Критично крутий схил (урвище)
                    cost += 9000 + stepDist * (40.0 + Math.pow(slopeDeg - 10, 2.8));
                } else {
                    // ПРІРВА / НЕПРОХІДНИЙ ОБРИВ (>= 19 градусів) - колосальний бар'єр
                    cost += 65000 + stepDist * 850.0;
                }

                // Штраф за падіння в безодню (раптовий вертикальний скид висоти > 1100 м)
                if (curElev - elevGrid[nIdx] > 1100) {
                    cost += 48000 + (curElev - elevGrid[nIdx]) * 35.0;
                }

                // Бонус за рух гладкими безпечними рівнинами
                if (safeGrid[nIdx] === 1) cost *= 0.45;

                // Штраф за полігональні зони небезпеки
                if (hazardGrid[nIdx] === 1) {
                    cost += 22000 + stepDist * 280.0;
                }
            } else {
                // ШВИДКИЙ РЕЖИМ: прямий шлях, але з урахуванням фізичних обривів
                cost = stepDist * (1.0 + Math.pow(slopeDeg / 6.0, 1.5));
                if (slopeDeg >= 22.0 || Math.abs(elevDiff) > 2200) {
                    cost += 15000 + stepDist * 90.0;
                }
                if (hazardGrid[nIdx] === 1) cost += stepDist * 1.5;
            }

            const tentG = gScore[curIdx] + cost;
            if (tentG < gScore[nIdx]) {
                gScore[nIdx] = tentG;
                cameFrom[nIdx] = curIdx;
                const h = Math.hypot(
                    (latGrid[endR] - latGrid[nr]) * 59.2,
                    (lonGrid[endC] - lonGrid[nc]) * 59.2 * Math.cos(latGrid[nr] * Math.PI / 180)
                );
                heap.push(nIdx, tentG + h);
            }
        }
    }

    let pIdx = found ? endIdx : -1;
    if (pIdx === -1) {
        let bestDist = Infinity;
        for (let i = 0; i < TOTAL; i++) {
            if (closed[i] === 1) {
                const r = (i / COLS) | 0, c = i % COLS;
                const d = Math.hypot(r - endR, c - endC);
                if (d < bestDist) { bestDist = d; pIdx = i; }
            }
        }
    }

    const path = [];
    let cur = pIdx;
    while (cur !== -1) {
        const r = (cur / COLS) | 0;
        const c = cur % COLS;
        path.push({
            lat: latGrid[r],
            lon: norm(lonGrid[c]),
            unwrappedLon: lonGrid[c],
            alt: elevGrid[cur]
        });
        if (cur === startIdx) break;
        cur = cameFrom[cur];
    }
    path.reverse();

    // Розрахунок метрик
    let totalDistKm = 0, peakSlope = 0, asc = 0, desc = 0;
    let hazardHitCount = 0;

    for (let i = 1; i < path.length; i++) {
        const d = calculateMarsDistance(path[i - 1].lat, path[i - 1].lon, path[i].lat, path[i].lon);
        totalDistKm += d;
        const diff = path[i].alt - path[i - 1].alt;
        if (diff > 0) asc += diff; else desc -= diff;
        const slope = Math.atan2(Math.abs(diff), Math.max(1, d * 1000)) * (180 / Math.PI);
        if (slope > peakSlope) peakSlope = slope;
    }

    for (let pt of path) {
        for (let z of HAZARD_ZONES) {
            if (isPointInPolygon(pt.lat, pt.lon, z.coords, z.bbox)) {
                hazardHitCount++;
                break;
            }
        }
    }

    let diagnosis = "ШЛЯХ ПОБУДОВАНО УСПІШНО.";
    let safetyScore = 95;

    if (mode === 'safe') {
        if (hazardHitCount === 0 && peakSlope < 12.0) {
            diagnosis = "БЕЗПЕЧНИЙ МАРШРУТ: Всі урвища та прірви успішно оминуто. Пологий рельєф.";
            safetyScore = 98;
        } else if (hazardHitCount === 0) {
            diagnosis = `БЕЗПЕЧНИЙ МАРШРУТ: Обійдено небезпечні зони. Макс. нахил ${peakSlope.toFixed(1)}°.`;
            safetyScore = 88;
        } else {
            diagnosis = `УВАГА: Повний обхід заблоковано рельєфом. Знайдено траверс із найменшим ризиком (${hazardHitCount} перетинів).`;
            safetyScore = Math.max(25, Math.round(85 - (hazardHitCount / path.length) * 110));
        }
    } else {
        diagnosis = `ШВИДКИЙ МАРШРУТ: Найкоротша дистанція напряму. Макс. нахил ${peakSlope.toFixed(1)}°.`;
        safetyScore = Math.max(15, Math.round(75 - (hazardHitCount / path.length) * 85 - (peakSlope > 14 ? 15 : 0)));
    }

    return {
        path,
        totalDist: totalDistKm,
        maxSlope: peakSlope,
        totalAsc: asc,
        totalDesc: desc,
        safety: safetyScore,
        scanDiagnosis: diagnosis
    };
}

// ============================================================================
// 10. ПЕРЕВІРКА БЕЗПЕКИ
// ============================================================================
function checkHazards(path) {
    let directHitZone = null;
    let closestZone = null;
    let minDistance = Infinity;

    for (let p of path) {
        for (let z of HAZARD_ZONES) {
            if (isPointInPolygon(p.lat, p.lon, z.coords, z.bbox)) {
                directHitZone = z;
                break;
            }
            const d = minDistanceToPolygonKm(p.lat, p.lon, z.coords, z.bbox);
            if (d < minDistance) {
                minDistance = d;
                closestZone = z;
            }
        }
        if (directHitZone) break;
    }

    if (directHitZone) {
        showWarning(`КРИТИЧНО! Маршрут проходить ПРЯМО ЧЕРЕЗ: ${directHitZone.name}`);
    } else if (closestZone && minDistance < 60) {
        showWarning(`УВАГА! Маршрут проходить за ${Math.round(minDistance)} км від: ${closestZone.name}`);
    }
}

function minDistanceToPolygonKm(lat, lon, poly, bbox) {
    if (isPointInPolygon(lat, lon, poly, bbox)) return 0;
    let minDist = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const d = distancePointToSegmentKm(lat, lon, poly[i][0], poly[i][1], poly[j][0], poly[j][1]);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

function distancePointToSegmentKm(pLat, pLon, aLat, aLon, bLat, bLon) {
    const midLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
    const cosLat = Math.cos(midLatRad);
    const ax = aLon * 59.16 * cosLat, ay = aLat * 59.16;
    const bx = bLon * 59.16 * cosLat, by = bLat * 59.16;
    const px = pLon * 59.16 * cosLat, py = pLat * 59.16;

    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return Math.hypot(px - ax, py - ay);

    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    const projX = ax + t * abx;
    const projY = ay + t * aby;
    return Math.hypot(px - projX, py - projY);
}

// ============================================================================
// 11. ПОБУДОВА ТА ВІДОБРАЖЕННЯ ШЛЯХУ
// ============================================================================
document.getElementById('btnBuildRoute').onclick = () => {
    if (!ptA || !ptB) return alert("Оберіть Точку А (старт) та Точку В (фініш) на мапі!");

    if (fastPolyline) map.removeLayer(fastPolyline);
    if (safePolyline) map.removeLayer(safePolyline);
    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);

    safeRouteData = runRealTerrainAStar(ptA, ptB, 'safe');
    fastRouteData = runRealTerrainAStar(ptA, ptB, 'fast');

    const fastSegments = splitPathAtAntimeridian(fastRouteData.path);
    const safeSegments = splitPathAtAntimeridian(safeRouteData.path);

    fastPolyline = L.polyline(fastSegments, { color: '#FF2E38', weight: 3.5, dashArray: '5, 6' }).addTo(map);
    safePolyline = L.polyline(safeSegments, { color: '#00FFAA', weight: 5.0 }).addTo(map);

    attachRouteHoverEvents(safePolyline, 'БЕЗПЕЧНИЙ МАРШРУТ', '#00FFAA');
    attachRouteHoverEvents(fastPolyline, 'ШВИДКИЙ МАРШРУТ', '#FF2E38');

    updateSeparateElevationCards();

    if (!is3DMode) {
        const dLon = ptB.lon - ptA.lon;
        if (Math.abs(dLon) > 180) {
            map.setView([(ptA.lat + ptB.lat) / 2, 0], 1);
        } else {
            map.fitBounds(safePolyline.getBounds(), { padding: [50, 50] });
        }
    }
    document.getElementById('routeReport').style.display = 'block';
    setActiveRoute('safe');
};

function updateSeparateElevationCards() {
    if (!safeRouteData || !fastRouteData) return;

    const sAlts = safeRouteData.path.map(p => p.alt);
    const sMin = Math.min(...sAlts);
    const sMax = Math.max(...sAlts);
    const sDiff = sMax - sMin;
    document.getElementById('elevSafeMin').innerText = `${sMin > 0 ? '+' : ''}${sMin} м`;
    document.getElementById('elevSafeMax').innerText = `${sMax > 0 ? '+' : ''}${sMax} м`;
    document.getElementById('elevSafeDiff').innerText = `Δ ${sDiff} м`;
    document.getElementById('elevSafeClimb').innerText = `+${Math.round(safeRouteData.totalAsc)} / -${Math.round(safeRouteData.totalDesc)} м`;

    const fAlts = fastRouteData.path.map(p => p.alt);
    const fMin = Math.min(...fAlts);
    const fMax = Math.max(...fAlts);
    const fDiff = fMax - fMin;
    document.getElementById('elevFastMin').innerText = `${fMin > 0 ? '+' : ''}${fMin} м`;
    document.getElementById('elevFastMax').innerText = `${fMax > 0 ? '+' : ''}${fMax} м`;
    document.getElementById('elevFastDiff').innerText = `Δ ${fDiff} м`;
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

    if (safePolyline) safePolyline.setStyle({ weight: mode === 'safe' ? 5 : 2.5, opacity: mode === 'safe' ? 1 : 0.35 });
    if (fastPolyline) fastPolyline.setStyle({ weight: mode === 'fast' ? 5 : 2.5, opacity: mode === 'fast' ? 1 : 0.35 });

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
    checkHazards(data.path);
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
    if (markerA) map.removeLayer(markerA);
    if (markerB) map.removeLayer(markerB);
    if (fastPolyline) map.removeLayer(fastPolyline);
    if (safePolyline) map.removeLayer(safePolyline);
    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);

    markerA = markerB = fastPolyline = safePolyline = ptA = ptB = fastRouteData = safeRouteData = safeHoverMarker = fastHoverMarker = null;
    syncUI();
    update3DPinsAndPaths();
    document.getElementById('routeReport').style.display = 'none';
};

// ============================================================================
// 12. СПІЛЬНИЙ ПОРІВНЯЛЬНИЙ ГРАФІК ВИСОТ
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

    const padLeft = 52;
    const padRight = 10;
    const padTop = 14;
    const padBottom = 16;
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

    if (minAlt <= 0 && maxAlt >= 0) {
        const y0 = padTop + h - ((0 - minAlt) / range) * h;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padLeft, y0);
        ctx.lineTo(padLeft + w, y0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText('0м', padLeft - 6, y0 + 3);
    }

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

    if (isFastActive) {
        const gradFast = ctx.createLinearGradient(0, padTop, 0, padTop + h);
        gradFast.addColorStop(0, 'rgba(255, 46, 56, 0.22)');
        gradFast.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
        ctx.lineTo(padLeft + w, padTop + h);
        ctx.lineTo(padLeft, padTop + h);
        ctx.closePath();
        ctx.fillStyle = gradFast;
        ctx.fill();
    }

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

    if (isSafeActive) {
        const gradSafe = ctx.createLinearGradient(0, padTop, 0, padTop + h);
        gradSafe.addColorStop(0, 'rgba(0, 255, 170, 0.24)');
        gradSafe.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
        ctx.lineTo(padLeft + w, padTop + h);
        ctx.lineTo(padLeft, padTop + h);
        ctx.closePath();
        ctx.fillStyle = gradSafe;
        ctx.fill();
    }

    if (activeHoverRatio >= 0 && activeHoverRatio <= 1) {
        const hx = padLeft + activeHoverRatio * w;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(hx, padTop);
        ctx.lineTo(hx, padTop + h);
        ctx.stroke();
        ctx.setLineDash([]);

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
    const safeIdx = Math.round(ratio * (safeP.length - 1));
    const fastIdx = Math.round(ratio * (fastP.length - 1));

    const sPt = safeP[safeIdx];
    const fPt = fastP[fastIdx];

    const sSign = sPt.alt > 0 ? '+' : '';
    const fSign = fPt.alt > 0 ? '+' : '';

    document.getElementById('chartHoverInfo').innerHTML = `
        <span style="color:#00FFAA; margin-right:12px;">🟢 БЕЗП: ${sSign}${sPt.alt}м (${Math.round(ratio * safeRouteData.totalDist)}км)</span>
        <span style="color:#FF2E38;">🔴 ШВИД: ${fSign}${fPt.alt}м (${Math.round(ratio * fastRouteData.totalDist)}км)</span>
    `;

    renderDualElevationChart(ratio);

    if (!safeHoverMarker) {
        safeHoverMarker = L.circleMarker([sPt.lat, sPt.lon], {
            radius: 6, color: '#FFFFFF', fillColor: '#00FFAA', fillOpacity: 1, weight: 2
        }).addTo(map);
    } else {
        safeHoverMarker.setLatLng([sPt.lat, sPt.lon]);
        if (!map.hasLayer(safeHoverMarker)) safeHoverMarker.addTo(map);
    }

    if (!fastHoverMarker) {
        fastHoverMarker = L.circleMarker([fPt.lat, fPt.lon], {
            radius: 6, color: '#FFFFFF', fillColor: '#FF2E38', fillOpacity: 1, weight: 2
        }).addTo(map);
    } else {
        fastHoverMarker.setLatLng([fPt.lat, fPt.lon]);
        if (!map.hasLayer(fastHoverMarker)) fastHoverMarker.addTo(map);
    }
});

cvs.addEventListener('mouseleave', () => {
    resetChartHoverReadout();
    renderDualElevationChart(-1);

    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);
});

// ============================================================================
// 13. СТАРТ
// ============================================================================
renderZones2D();
renderZonesList();
setHazardVisibility(true);
setSafeVisibility(true);