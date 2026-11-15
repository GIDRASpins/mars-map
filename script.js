const MARS_RADIUS_KM = 3389.5;
let activeWorldOffsets = [-1, 0, 1];
const MARS_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/70/Solarsystemscope_texture_8k_mars.jpg';
const MARS_TEXTURE_FALLBACK_URL = 'https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg';
let activeMarsTextureUrl = MARS_TEXTURE_URL;

function getSafe3DTextureUrl() {
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (gl && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 8192) return MARS_TEXTURE_URL;
    } catch (e) {}
    return MARS_TEXTURE_FALLBACK_URL;
}

const MARS_STORM_PRESETS = {
    hellas: { name: '[СЦЕНАРІЙ] Циклон «Діабло» (Hellas Cyclone DS-01)', regionName: 'Hellas Planitia (Рівнина Еллада)', lat: -28.0, lon: 70.0, headingDeg: 62, speedKmH: 48, radiusKm: 520, outerRadiusKm: 860, windSpeedMs: 34.5, tau: 2.85 },
    chryse: { name: '[СЦЕНАРІЙ] Пиловий шквал «Хриса» (Chryse Storm DS-02)', regionName: 'Chryse Planitia (Рівнина Хриса)', lat: 24.5, lon: -42.0, headingDeg: 115, speedKmH: 44, radiusKm: 480, outerRadiusKm: 800, windSpeedMs: 31.8, tau: 2.65 },
    valles: { name: '[СЦЕНАРІЙ] Каньйонний тайфун «Марінер» (Valles Front DS-03)', regionName: 'Valles Marineris (Долина Марінера)', lat: -13.5, lon: -65.0, headingDeg: 84, speedKmH: 54, radiusKm: 450, outerRadiusKm: 760, windSpeedMs: 38.2, tau: 3.10 },
    elysium: { name: '[СЦЕНАРІЙ] Вулканічний вихор «Елізій» (Elysium Vortex DS-04)', regionName: 'Elysium Planitia (Рівнина Елізій)', lat: 12.0, lon: 148.0, headingDeg: 135, speedKmH: 38, radiusKm: 470, outerRadiusKm: 790, windSpeedMs: 29.5, tau: 2.40 },
    utopia: { name: '[СЦЕНАРІЙ] Полярний пиловий фронт «Утопія» (Utopia Front DS-05)', regionName: 'Utopia Planitia (Рівнина Утопія)', lat: 44.0, lon: 115.0, headingDeg: 95, speedKmH: 46, radiusKm: 530, outerRadiusKm: 880, windSpeedMs: 33.0, tau: 2.75 }
};

const trL = (s) => (window.I18N ? I18N.tr(s) : s);
if (window.I18N) {
    I18N.addPairs(Object.values(MARS_STORM_PRESETS).flatMap(p => [
        [p.name, '[SCENARIO] ' + ((p.name.match(/\(([^)]+)\)\s*$/) || [])[1] || p.name)],
        [p.regionName, p.regionName.replace(/\s*\(.*\)\s*$/, '')]
    ]));
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const MARS_STORM_STATE = {
    active: true, speedMultiplier: 150, autoAvoidRoute: true,
    lastTick: performance.now(), intervalId: null, lastAutoRerouteTime: 0,
    lastAutoRerouteKey: '', bannerDismissed: false, storms: [],
    scenario: false, source: '', serverKey: ''
};

let currentMarsWeather = {
    sol: 0, ls: 0, season: 'Осінь / Сезон глобальних бур',
    min_temp: -81, max_temp: -18, pressure: 738, tau: 2.85,
    wind_speed: 34.5, wind_direction: 'ENE (062°)',
    atmo_opacity: 'Критична пилова буря', solar_efficiency: 34
};

const marsPreloadImg = new Image();
const pendingMarsTileDraws = [];
marsPreloadImg.onload = () => { while (pendingMarsTileDraws.length > 0) pendingMarsTileDraws.shift()(); };
marsPreloadImg.onerror = () => {
    if (activeMarsTextureUrl !== MARS_TEXTURE_FALLBACK_URL) {
        activeMarsTextureUrl = MARS_TEXTURE_FALLBACK_URL;
        marsPreloadImg.src = MARS_TEXTURE_FALLBACK_URL;
        if (typeof myGlobe !== 'undefined' && myGlobe) myGlobe.globeImageUrl(MARS_TEXTURE_FALLBACK_URL);
    }
};
marsPreloadImg.src = MARS_TEXTURE_URL;

function smoothClosedPolygon(rawCoords, iterations = 4, maxStepDeg = 0.8) {
    if (!rawCoords || rawCoords.length < 3) return rawCoords;
    let pts = [];
    const n0 = rawCoords.length;
    for (let i = 0; i < n0; i++) {
        const p1 = rawCoords[i], p2 = rawCoords[(i + 1) % n0];
        pts.push([p1[0], p1[1]]);
        const dLat = p2[0] - p1[0], dLon = p2[1] - p1[1], dist = Math.hypot(dLat, dLon);
        if (dist > maxStepDeg) {
            const steps = Math.ceil(dist / maxStepDeg);
            for (let s = 1; s < steps; s++) {
                const t = s / steps;
                pts.push([p1[0] + dLat * t, p1[1] + dLon * t]);
            }
        }
    }
    for (let it = 0; it < iterations; it++) {
        const next = [], len = pts.length;
        for (let i = 0; i < len; i++) {
            const p1 = pts[i], p2 = pts[(i + 1) % len];
            next.push([0.75 * p1[0] + 0.25 * p2[0], 0.75 * p1[1] + 0.25 * p2[1]]);
            next.push([0.25 * p1[0] + 0.75 * p2[0], 0.25 * p1[1] + 0.75 * p2[1]]);
        }
        pts = next;
    }
    return pts;
}

const MARS_ZONES = [
    { id: 'planum_boreum', name: 'Північна полярна шапка (Planum Boreum)', type: 'hazard', isPolar: true, coords: [[74.34,-180],[74.0,-175],[73.75,-170],[73.6,-165],[73.55,-160],[73.57,-155],[73.64,-150],[73.72,-145],[73.78,-140],[73.83,-135],[73.84,-130],[73.83,-125],[73.82,-120],[73.82,-115],[73.86,-110],[73.95,-105],[74.08,-100],[74.23,-95],[74.39,-90],[74.51,-85],[74.56,-80],[74.51,-75],[74.34,-70],[74.06,-65],[73.69,-60],[73.27,-55],[72.85,-50],[72.49,-45],[72.24,-40],[72.15,-35],[72.24,-30],[72.51,-25],[72.95,-20],[73.5,-15],[74.11,-10],[74.72,-5],[75.27,0],[75.71,5],[76.0,10],[76.14,15],[76.12,20],[75.99,25],[75.76,30],[75.48,35],[75.17,40],[74.86,45],[74.55,50],[74.26,55],[73.97,60],[73.66,65],[73.34,70],[73.0,75],[72.64,80],[72.3,85],[72.0,90],[71.79,95],[71.69,100],[71.76,105],[71.99,110],[72.38,115],[72.91,120],[73.54,125],[74.2,130],[74.83,135],[75.37,140],[75.76,145],[75.98,150],[76.0,155],[75.85,160],[75.55,165],[75.17,170],[74.74,175],[74.34,180],[89.99,180],[89.99,-180]] },
    { id: 'planum_australe', name: 'Південна полярна шапка (Planum Australe)', type: 'hazard', isPolar: true, coords: [[-74.34,-180],[-74.0,-175],[-73.75,-170],[-73.6,-165],[-73.55,-160],[-73.57,-155],[-73.64,-150],[-73.72,-145],[-73.78,-140],[-73.83,-135],[-73.84,-130],[-73.83,-125],[-73.82,-120],[-73.82,-115],[-73.86,-110],[-73.95,-105],[-74.08,-100],[-74.23,-95],[-74.39,-90],[-74.51,-85],[-74.56,-80],[-74.51,-75],[-74.34,-70],[-74.06,-65],[-73.69,-60],[-73.27,-55],[-72.85,-50],[-72.49,-45],[-72.24,-40],[-72.15,-35],[-72.24,-30],[-72.51,-25],[-72.95,-20],[-73.5,-15],[-74.11,-10],[-74.72,-5],[-75.27,0],[-75.71,5],[-76.0,10],[-76.14,15],[-76.12,20],[-75.99,25],[-75.76,30],[-75.48,35],[-75.17,40],[-74.86,45],[-74.55,50],[-74.26,55],[-73.97,60],[-73.66,65],[-73.34,70],[-73.0,75],[-72.64,80],[-72.3,85],[-72.0,90],[-71.79,95],[-71.69,100],[-71.76,105],[-71.99,110],[-72.38,115],[-72.91,120],[-73.54,125],[-74.2,130],[-74.83,135],[-75.37,140],[-75.76,145],[-75.98,150],[-76.0,155],[-75.85,160],[-75.55,165],[-75.17,170],[-74.74,175],[-74.34,180],[-89.99,180],[-89.99,-180]] },
    { id: 'valles_marineris', name: 'Долина Марінера та хаос Аврора (Valles Marineris & Aurorae Chaos)', type: 'hazard', coords: [[-9.68,-90.4],[-11.26,-82.52],[-13.14,-72.68],[-15.34,-62.73],[-16.67,-52.49],[-17.0,-42.0],[-15.65,-34.38],[-13.22,-27.34],[-7.78,-28.66],[-8.75,-35.62],[-9.0,-42.0],[-7.73,-51.51],[-6.26,-61.27],[-4.86,-71.32],[-3.74,-81.48],[-3.32,-89.6]] },
    { id: 'noctis_labyrinthus', name: 'Лабіринт Ночі (Noctis Labyrinthus)', type: 'hazard', coords: [[-7.4,-95.24],[-6.21,-96.43],[-5.66,-97.96],[-5.38,-99.2],[-4.89,-100.1],[-4.19,-101.07],[-3.79,-102.33],[-4.06,-103.64],[-4.87,-104.68],[-5.86,-105.47],[-6.88,-106.24],[-8.09,-106.97],[-9.52,-107.26],[-10.9,-106.81],[-11.88,-105.71],[-12.39,-104.37],[-12.57,-103.08],[-12.56,-101.91],[-12.39,-100.81],[-12.1,-99.76],[-11.76,-98.64],[-11.28,-97.32],[-10.39,-95.94],[-8.99,-95.07]] },
    { id: 'olympus_mons', name: 'Олімп (Olympus Mons)', type: 'hazard', coords: [[16.35,-126.17],[18.37,-127.02],[19.91,-127.98],[21.38,-128.52],[22.92,-129.2],[24.05,-130.5],[24.58,-132.14],[24.89,-133.83],[25.07,-135.65],[24.63,-137.48],[23.42,-138.9],[21.9,-139.94],[20.32,-140.96],[18.44,-141.71],[16.45,-141.34],[15.04,-139.76],[14.34,-137.93],[13.71,-136.54],[12.81,-135.3],[12.09,-133.77],[11.9,-132.0],[12.09,-130.07],[12.73,-128.04],[14.21,-126.46]] },
    { id: 'ascraeus_mons', name: 'Гора Аскрійська (Ascraeus Mons)', type: 'hazard', coords: [[9.15,-100.72],[10.69,-100.44],[12.04,-100.91],[12.97,-101.56],[13.8,-102.0],[14.85,-102.37],[15.92,-103.11],[16.48,-104.36],[16.18,-105.78],[15.22,-106.92],[14.01,-107.66],[12.79,-108.12],[11.55,-108.33],[10.35,-108.16],[9.38,-107.53],[8.75,-106.63],[8.32,-105.67],[7.89,-104.61],[7.65,-103.29],[8.01,-101.82]] },
    { id: 'pavonis_mons', name: 'Гора Павоніс (Pavonis Mons)', type: 'hazard', coords: [[0.07,-108.89],[1.33,-109.23],[2.31,-109.9],[3.14,-110.58],[3.81,-111.4],[4.08,-112.42],[3.97,-113.45],[3.79,-114.46],[3.51,-115.62],[2.76,-116.69],[1.53,-117.11],[0.27,-116.77],[-0.71,-116.1],[-1.54,-115.42],[-2.21,-114.6],[-2.48,-113.58],[-2.37,-112.55],[-2.19,-111.54],[-1.91,-110.38],[-1.16,-109.31]] },
    { id: 'arsia_mons', name: 'Гора Арсія (Arsia Mons)', type: 'hazard', coords: [[-10.52,-116.81],[-9.02,-117.03],[-7.86,-117.64],[-6.96,-118.26],[-6.1,-118.86],[-5.33,-119.66],[-4.89,-120.74],[-4.95,-121.96],[-5.47,-123.14],[-6.35,-124.19],[-7.55,-124.99],[-8.98,-125.31],[-10.35,-124.96],[-11.28,-124.07],[-11.75,-123.03],[-12.08,-122.12],[-12.56,-121.22],[-13.02,-120.05],[-12.95,-118.6],[-12.03,-117.36]] },
    { id: 'elysium_mons', name: 'Гора Елізій (Elysium Mons)', type: 'hazard', coords: [[25.0,152.06],[26.32,151.28],[27.3,150.36],[28.15,149.49],[28.81,148.44],[29.02,147.2],[28.8,145.97],[28.32,144.79],[27.53,143.72],[26.36,143.01],[25.0,142.82],[23.64,143.02],[22.35,143.55],[21.37,144.56],[21.09,145.93],[21.46,147.2],[21.83,148.23],[21.93,149.43],[22.29,150.93],[23.43,152.02]] },
    { id: 'hellas_rim', name: 'Вал басейну Еллада - Хребет Геллеспонт (Hellas Western Rim)', type: 'hazard', coords: [[-31.22,42.17],[-37.01,45.39],[-42.79,46.01],[-48.75,44.72],[-52.59,41.59],[-55.41,44.41],[-51.25,49.28],[-43.21,51.99],[-34.99,50.61],[-28.78,45.83]] },
    { id: 'argyre_rim', name: 'Вал басейну Аргір (Argyre Rim)', type: 'hazard', coords: [[-47.34,-36.81],[-45.87,-37.87],[-45.03,-39.46],[-44.64,-41.08],[-44.46,-42.62],[-44.52,-44.2],[-45.04,-45.74],[-46.07,-47.0],[-47.4,-47.85],[-48.87,-48.35],[-50.49,-48.55],[-52.16,-48.18],[-53.51,-47.01],[-54.06,-45.23],[-53.74,-43.39],[-52.99,-41.93],[-52.3,-40.71],[-51.68,-39.35],[-50.7,-37.85],[-49.15,-36.81]] },
    { id: 'aram_chaos', name: 'Хаос Арам (Aram Chaos)', type: 'hazard', coords: [[2.12,-16.6],[3.15,-17.26],[3.81,-18.27],[4.24,-19.16],[4.69,-19.9],[5.12,-20.77],[5.3,-21.84],[5.05,-22.9],[4.48,-23.75],[3.73,-24.39],[2.84,-24.86],[1.81,-24.94],[0.87,-24.39],[0.32,-23.3],[0.27,-22.12],[0.4,-21.18],[0.36,-20.36],[0.17,-19.27],[0.28,-17.91],[0.99,-16.83]] },
    { id: 'medusae_fossae', name: 'Борозни Медузи (Medusae Fossae)', type: 'hazard', coords: [[-3.18,-171.73],[-2.6,-164.0],[-3.39,-155.21],[-3.5,-147.12],[0.5,-146.88],[1.39,-154.79],[2.6,-164.0],[1.18,-172.27]] },
    { id: 'syrtis_calderas', name: 'Кальдери Сиртіс Майор (Syrtis Calderas)', type: 'hazard', coords: [[6.62,72.02],[8.13,72.07],[9.34,71.41],[10.11,70.61],[10.78,70.01],[11.65,69.47],[12.49,68.6],[12.81,67.37],[12.34,66.11],[11.3,65.18],[10.07,64.63],[8.83,64.36],[7.61,64.36],[6.5,64.77],[5.73,65.56],[5.35,66.53],[5.14,67.49],[4.92,68.52],[4.87,69.79],[5.4,71.13]] },
    { id: 'schiaparelli', name: 'Кратер Скіапареллі (Schiaparelli Crater)', type: 'hazard', coords: [[-2.5,20.63],[-1.25,20.11],[-0.33,19.22],[0.41,18.26],[0.86,17.12],[0.75,15.9],[0.28,14.82],[-0.29,13.74],[-1.19,12.72],[-2.5,12.37],[-3.75,12.89],[-4.67,13.78],[-5.41,14.74],[-5.86,15.88],[-5.75,17.1],[-5.28,18.18],[-4.71,19.26],[-3.81,20.28]] },
    { id: 'dust_belt', name: 'Пиловий коридор Дайдалії (Daedalia Dust Storm Track)', type: 'hazard', coords: [[-24.83,-135.98],[-29.88,-123.25],[-33.67,-113.23],[-37.62,-100.98],[-32.38,-99.02],[-27.33,-110.77],[-23.12,-120.75],[-19.17,-134.02]] },
    { id: 'vastitas_borealis', name: 'Низовина Вастітас (Vastitas Borealis)', type: 'safe', coords: [[59.95,38.42],[62.83,36.95],[65.08,32.23],[66.35,26.87],[67.17,22.64],[68.17,19.28],[69.34,15.64],[70.21,11.21],[70.41,6.31],[69.87,1.44],[68.53,-2.81],[66.41,-5.47],[63.8,-5.61],[61.31,-3.38],[59.29,-0.14],[57.57,2.89],[55.81,5.85],[54.26,9.63],[53.55,14.26],[53.94,18.72],[54.85,22.38],[55.57,26.08],[56.2,30.82],[57.52,35.78]] },
    { id: 'utopia_planitia', name: 'Рівнина Утопія (Utopia Planitia)', type: 'safe', coords: [[46.08,138.16],[48.71,134.72],[49.87,129.52],[50.34,124.94],[51.07,121.34],[51.91,117.63],[51.99,113.24],[50.83,108.85],[48.86,105.2],[46.71,102.07],[44.4,98.87],[41.6,95.96],[38.4,94.59],[35.39,95.57],[33.11,98.6],[31.75,102.79],[31.32,107.52],[31.9,112.32],[33.35,116.53],[35.01,119.88],[36.27,123.18],[37.38,127.69],[39.29,133.24],[42.47,137.59]] },
    { id: 'acidalia_planitia', name: 'Ацидалійська рівнина (Acidalia Planitia)', type: 'safe', coords: [[40.88,-16.61],[44.49,-17.09],[47.5,-19.69],[49.6,-22.49],[51.3,-24.81],[52.7,-27.15],[53.69,-29.67],[54.77,-32.38],[56.08,-35.77],[56.44,-39.77],[54.7,-42.96],[51.49,-44.2],[48.29,-44.26],[45.43,-44.41],[42.5,-44.27],[39.8,-42.75],[37.91,-40.09],[36.58,-37.31],[35.36,-34.58],[34.68,-31.6],[35.06,-28.62],[35.95,-25.85],[36.73,-22.66],[38.08,-19.0]] },
    { id: 'arcadia_planitia', name: 'Рівнина Аркадія (Arcadia Planitia)', type: 'safe', coords: [[46.53,-149.66],[48.98,-151.52],[50.61,-154.38],[51.62,-157.44],[52.27,-160.52],[52.51,-163.78],[52.05,-167.17],[50.79,-170.29],[48.94,-172.82],[46.79,-174.79],[44.38,-176.37],[41.65,-177.35],[38.78,-177.08],[36.41,-175.05],[35.24,-171.55],[35.39,-167.62],[36.33,-164.2],[37.29,-161.36],[38.03,-158.47],[39.02,-155.11],[40.85,-151.79],[43.56,-149.69]] },
    { id: 'amazonis_planitia', name: 'Рівнина Амазонія (Amazonis Planitia)', type: 'safe', coords: [[20.76,-145.84],[23.74,-146.93],[26.09,-149.18],[27.74,-151.74],[29.01,-154.18],[30.14,-156.58],[31.04,-159.21],[31.39,-162.14],[30.94,-165.1],[29.71,-167.76],[27.91,-169.95],[25.7,-171.67],[23.12,-172.82],[20.26,-173.07],[17.45,-172.03],[15.26,-169.7],[14.08,-166.58],[13.86,-163.42],[14.08,-160.69],[14.18,-158.22],[14.09,-155.48],[14.29,-152.24],[15.43,-148.94],[17.73,-146.54]] },
    { id: 'elysium_planitia', name: 'Рівнина Елізій (Elysium Planitia)', type: 'safe', coords: [[7.67,177.08],[10.47,174.72],[11.96,170.36],[12.51,166.26],[13.13,163.24],[14.12,160.52],[14.81,157.23],[14.46,153.65],[13.13,150.53],[11.4,147.97],[9.53,145.49],[7.3,143.09],[4.57,141.65],[1.74,142.06],[-0.6,144.32],[-2.11,147.72],[-2.79,151.53],[-2.65,155.32],[-1.78,158.68],[-0.6,161.4],[0.3,163.98],[0.93,167.43],[2.08,171.92],[4.44,175.9]] },
    { id: 'isidis_planitia', name: 'Рівнина Ісіди (Isidis Planitia)', type: 'safe', coords: [[14.0,96.01],[16.32,95.14],[18.06,93.59],[19.31,91.86],[20.28,90.04],[20.9,88.0],[20.84,85.78],[19.93,83.69],[18.32,82.05],[16.28,80.98],[14.0,80.5],[11.65,80.75],[9.56,81.89],[8.17,83.76],[7.61,85.92],[7.61,88.0],[7.84,90.0],[8.33,92.12],[9.49,94.21],[11.5,95.7]] },
    { id: 'chryse_planitia', name: 'Рівнина Хриса (Chryse Planitia)', type: 'safe', coords: [[24.33,-30.52],[26.52,-30.73],[28.42,-32.2],[29.67,-34.29],[30.42,-36.33],[31.09,-38.13],[31.87,-40.02],[32.48,-42.32],[32.4,-44.87],[31.36,-47.06],[29.58,-48.34],[27.52,-48.61],[25.54,-48.15],[23.75,-47.25],[22.17,-45.96],[20.9,-44.24],[20.12,-42.16],[19.88,-39.98],[20.02,-37.86],[20.41,-35.75],[21.13,-33.59],[22.42,-31.64]] },
    { id: 'casius_plain', name: 'Коридор Касій (Casius Corridor)', type: 'safe', coords: [[30.52,77.56],[32.98,77.0],[35.02,75.07],[36.38,72.99],[37.53,71.38],[38.95,69.8],[40.39,67.58],[41.07,64.78],[40.5,62.19],[38.95,60.53],[36.97,59.84],[34.93,59.86],[32.92,60.52],[31.11,61.94],[29.8,63.98],[29.05,66.2],[28.53,68.36],[28.01,70.73],[27.81,73.53],[28.58,76.18]] },
    { id: 'meridiani_planum', name: 'Плато Меридіана (Meridiani Planum)', type: 'safe', coords: [[-0.5,6.41],[1.32,5.33],[2.59,3.57],[3.46,1.76],[4.14,-0.03],[4.57,-2.0],[4.48,-4.11],[3.8,-6.08],[2.67,-7.71],[1.24,-9.01],[-0.5,-9.84],[-2.43,-9.77],[-4.1,-8.47],[-4.99,-6.26],[-5.06,-3.94],[-4.81,-2.0],[-4.72,-0.21],[-4.65,1.94],[-4.02,4.33],[-2.51,6.09]] },
    { id: 'hesperia_planum', name: 'Плато Гесперія (Hesperia Planum)', type: 'safe', coords: [[-18.28,125.88],[-15.98,123.84],[-14.78,120.66],[-14.36,117.4],[-14.21,114.44],[-14.24,111.5],[-14.76,108.43],[-16.04,105.53],[-17.97,103.25],[-20.21,101.66],[-22.61,100.54],[-25.25,99.87],[-28.0,100.19],[-30.27,102.09],[-31.27,105.44],[-30.75,109.26],[-29.3,112.47],[-27.85,114.89],[-26.82,117.24],[-25.78,120.21],[-23.99,123.47],[-21.27,125.75]] },
    { id: 'hellas_floor', name: 'Дно басейну Еллада (Hellas Basin Floor)', type: 'safe', coords: [[-42.0,80.54],[-39.56,79.48],[-37.72,77.6],[-36.43,75.51],[-35.42,73.43],[-34.61,71.21],[-34.25,68.73],[-34.63,66.16],[-35.78,63.85],[-37.53,62.07],[-39.65,60.85],[-42.0,60.24],[-44.46,60.45],[-46.7,61.66],[-48.29,63.78],[-49.0,66.35],[-49.05,68.84],[-48.85,71.12],[-48.6,73.44],[-48.06,75.99],[-46.78,78.49],[-44.63,80.21]] },
    { id: 'jezero_crater', name: 'Кратер та дельта Єзеро (Jezero Crater & Delta)', type: 'safe', coords: [[18.5,79.49],[19.38,79.13],[19.97,78.47],[20.34,77.76],[20.59,77.0],[20.54,76.16],[20.08,75.42],[19.35,74.95],[18.5,74.74],[17.6,74.84],[16.85,75.35],[16.51,76.17],[16.54,77.0],[16.7,77.74],[16.97,78.53],[17.57,79.24]] },
    { id: 'gale_crater', name: 'Кратер Гейл та гора Шарп (Gale Crater Floor)', type: 'safe', coords: [[-5.4,140.25],[-4.43,139.85],[-3.82,139.08],[-3.49,138.29],[-3.23,137.5],[-3.17,136.58],[-3.58,135.68],[-4.42,135.12],[-5.4,134.99],[-6.34,135.23],[-7.1,135.8],[-7.52,136.62],[-7.57,137.5],[-7.42,138.34],[-7.1,139.2],[-6.42,139.96]] }
];

MARS_ZONES.forEach(z => {
    z.smoothCoords = (z.id !== 'planum_boreum' && z.id !== 'planum_australe') ? smoothClosedPolygon(z.coords, 4, 0.8) : z.coords;
    const lats = z.smoothCoords.map(p => p[0]), lons = z.smoothCoords.map(p => p[1]);
    z.bbox = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
    z.centroid = [lats.reduce((a, b) => a + b, 0) / lats.length, lons.reduce((a, b) => a + b, 0) / lons.length];
});

if (window.I18N) I18N.addPairs(MARS_ZONES.map(z => [z.name, z.name.replace(/^.*\(([^()]*)\)\s*$/, '$1')]));

const HAZARD_ZONES = MARS_ZONES.filter(z => z.type === 'hazard');
const SAFE_ZONES = MARS_ZONES.filter(z => z.type === 'safe');

const MARS_BASES = [
    { id: 'base_jezero', name: 'База «Єзеро-Персеверанс»', shortName: 'ЄЗЕРО', zoneId: 'jezero_crater', lat: 18.5, lon: 77.1, type: 'Дослідницький хаб' },
    { id: 'base_gale', name: 'Станція «Гейл-К’юріосіті»', shortName: 'ГЕЙЛ', zoneId: 'gale_crater', lat: -5.4, lon: 137.6, type: 'Гірничо-наукова база' },
    { id: 'base_chryse', name: 'Колонія «Хриса-Вікінг»', shortName: 'ХРИСА', zoneId: 'chryse_planitia', lat: 26.0, lon: -39.5, type: 'Головний космопорт' },
    { id: 'base_acidalia', name: 'Аванпост «Арес-Ацидалія»', shortName: 'АЦИДАЛІЯ', zoneId: 'acidalia_planitia', lat: 45.4, lon: -31.8, type: 'Енерговузол' },
    { id: 'base_arcadia', name: 'Льодова база «Аркадія»', shortName: 'АРКАДІЯ', zoneId: 'arcadia_planitia', lat: 43.3, lon: -163.5, type: 'Водовидобувний комплекс' },
    { id: 'base_utopia', name: 'Станція «Утопія-Чжужун»', shortName: 'УТОПІЯ', zoneId: 'utopia_planitia', lat: 41.5, lon: 114.7, type: 'Підповерхневий бункер' },
    { id: 'base_amazonis', name: 'База «Амазонія-Вест»', shortName: 'АМАЗОНІЯ', zoneId: 'amazonis_planitia', lat: 22.3, lon: -159.4, type: 'Логістичний центр' },
    { id: 'base_elysium', name: 'Станція «Елізій-ІнСайт»', shortName: 'ЕЛІЗІЙ', zoneId: 'elysium_planitia', lat: 6.4, lon: 158.0, type: 'Геотермальна база' },
    { id: 'base_isidis', name: 'Аванпост «Ісіда-Горизонт»', shortName: 'ІСІДА', zoneId: 'isidis_planitia', lat: 14.3, lon: 88.2, type: 'Транзитний притулок' },
    { id: 'base_meridiani', name: 'Станція «Меридіан-Оппортьюніті»', shortName: 'МЕРИДІАН', zoneId: 'meridiani_planum', lat: -0.3, lon: -1.7, type: 'Екваторіальний маяк' },
    { id: 'base_hesperia', name: 'Аванпост «Гесперія»', shortName: 'ГЕСПЕРІЯ', zoneId: 'hesperia_planum', lat: -22.5, lon: 112.8, type: 'Південний форпост' },
    { id: 'base_hellas', name: 'Глибока база «Еллада»', shortName: 'ЕЛЛАДА', zoneId: 'hellas_floor', lat: -41.7, lon: 70.3, type: 'Атмосферне укриття' },
    { id: 'base_vastitas', name: 'Станція «Вастітас-Північ»', shortName: 'ВАСТІТАС', zoneId: 'vastitas_borealis', lat: 62.6, lon: 17.5, type: 'Кріогенна станція' },
    { id: 'base_casius', name: 'Релей-база «Касій»', shortName: 'КАСІЙ', zoneId: 'casius_plain', lat: 34.4, lon: 68.1, type: 'Станція зв’язку' }
];

MARS_BASES.forEach(b => {
    const z = SAFE_ZONES.find(sz => sz.id === b.zoneId);
    if (z && !isPointInPolygon(b.lat, b.lon, z.smoothCoords, z.bbox)) {
        b.lat = Number(z.centroid[0].toFixed(2));
        b.lon = Number(z.centroid[1].toFixed(2));
    }
});

let showHazardZones = true, showSafeZones = true, showBases = true, showWazeReports = true;
let hazardsAvoidanceActive = true, is3DMode = false, toastTimeout = null;
let activeZoneFilter = 'all', currentSelectedZoneId = null;
let safeHoverMarker = null, fastHoverMarker = null, isSosRouteActive = false;

function normalizeLon(lon) { return ((lon + 180) % 360 + 360) % 360 - 180; }

function isPointInPolygon(lat, lon, poly, bbox) {
    if (lat < bbox[0] || lat > bbox[1] || lon < bbox[2] || lon > bbox[3]) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if (((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

function calculateMarsDistance(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * toRad / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin((lon2 - lon1) * toRad / 2) ** 2;
    return 2 * MARS_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateShortestMarsDistance(lat1, lon1, lat2, lon2) {
    const dLon = ((lon2 - lon1 + 180) % 360 + 360) % 360 - 180, toRad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * toRad / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon * toRad / 2) ** 2;
    return 2 * MARS_RADIUS_KM * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
}

function getMarsBearingRad(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180, p1 = lat1 * toRad, p2 = lat2 * toRad;
    const dLon = (((lon2 - lon1 + 180) % 360 + 360) % 360 - 180) * toRad;
    return Math.atan2(Math.sin(dLon) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon));
}

function getStormContourWobble(brng, seed) {
    return seed ? (1 + 0.14 * Math.sin(brng * 3 + seed) + 0.08 * Math.cos(brng * 5 - seed * 1.3)) : 1;
}

function makeMarsCircleCoords(lat, lon, radiusKm, steps = 40, seed = 0) {
    const rad = Math.PI / 180, p1 = lat * rad, l1 = lon * rad, pts = [];
    let prevLon = lon;
    for (let i = 0; i <= steps; i++) {
        const brng = (i / steps) * Math.PI * 2, dR = (radiusKm * getStormContourWobble(brng, seed)) / MARS_RADIUS_KM;
        const p2 = Math.asin(Math.sin(p1) * Math.cos(dR) + Math.cos(p1) * Math.sin(dR) * Math.cos(brng));
        const l2 = l1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(p1), Math.cos(dR) - Math.sin(p1) * Math.sin(p2));
        prevLon += ((l2 / rad - prevLon + 180) % 360 + 360) % 360 - 180;
        pts.push([p2 / rad, prevLon]);
    }
    return pts;
}

const MARS_CRATERS = [
    { name: 'Huygens', lat: -13.96, lon: 55.58, rKm: 234, depthM: 2800, rimM: 900 },
    { name: 'Greeley', lat: -36.79, lon: 3.92, rKm: 229, depthM: 2400, rimM: 750 },
    { name: 'Cassini', lat: 23.35, lon: 32.11, rKm: 204, depthM: 2500, rimM: 800 },
    { name: 'Antoniadi', lat: 21.38, lon: 60.83, rKm: 200, depthM: 2400, rimM: 780 },
    { name: 'Dollfus', lat: -21.59, lon: -4.26, rKm: 182, depthM: 2100, rimM: 680 },
    { name: 'Tikhonravov', lat: 13.28, lon: 35.93, rKm: 172, depthM: 2200, rimM: 700 },
    { name: 'de Vaucouleurs', lat: -13.47, lon: 171.0, rKm: 151, depthM: 2000, rimM: 650 },
    { name: 'Copernicus', lat: -49.18, lon: -168.83, rKm: 151, depthM: 2200, rimM: 700 },
    { name: 'Newton', lat: -40.84, lon: -158.03, rKm: 150, depthM: 2300, rimM: 720 },
    { name: 'Herschel', lat: -14.64, lon: 129.89, rKm: 149, depthM: 2200, rimM: 700 },
    { name: 'Schroeter', lat: -1.89, lon: 55.99, rKm: 146, depthM: 2000, rimM: 650 },
    { name: 'Flaugergues', lat: -16.99, lon: 19.22, rKm: 118, depthM: 1850, rimM: 600 },
    { name: 'Kepler', lat: -47.03, lon: 140.98, rKm: 114, depthM: 1800, rimM: 580 },
    { name: 'Proctor', lat: -47.97, lon: 29.72, rKm: 86, depthM: 1650, rimM: 520 },
    { name: 'Terby', lat: -28.24, lon: 74.14, rKm: 86, depthM: 1700, rimM: 540 },
    { name: 'Henry', lat: 10.91, lon: 23.45, rKm: 84, depthM: 1550, rimM: 500 },
    { name: 'Becquerel', lat: 22.13, lon: -7.94, rKm: 83, depthM: 1650, rimM: 520 },
    { name: 'Ptolemaeus', lat: -46.21, lon: -157.6, rKm: 83, depthM: 1600, rimM: 500 },
    { name: 'Crommelin', lat: 5.08, lon: -10.14, rKm: 55, depthM: 1350, rimM: 440 },
    { name: 'Beer', lat: -14.47, lon: -8.17, rKm: 43, depthM: 1150, rimM: 380 },
    { name: 'Miyamoto', lat: -2.88, lon: -7.0, rKm: 75, depthM: 1300, rimM: 420 },
    { name: 'Danielson', lat: 7.93, lon: -7.1, rKm: 33, depthM: 1100, rimM: 360 },
    { name: 'Firsoff', lat: 2.66, lon: -9.42, rKm: 45, depthM: 1200, rimM: 400 },
    { name: 'Holden', lat: -26.04, lon: -34.02, rKm: 77, depthM: 1550, rimM: 480 },
    { name: 'Bakhuysen', lat: -23.0, lon: 15.6, rKm: 76, depthM: 1500, rimM: 470 },
    { name: 'Kaiser', lat: -46.2, lon: 19.1, rKm: 100, depthM: 1750, rimM: 540 },
    { name: 'Russell', lat: -54.8, lon: 12.4, rKm: 70, depthM: 1450, rimM: 460 },
    { name: 'Lyot', lat: 50.5, lon: 29.3, rKm: 118, depthM: 1900, rimM: 580 },
    { name: 'Korolev', lat: 72.8, lon: -164.5, rKm: 41, depthM: 1500, rimM: 480 },
    { name: 'Galle', lat: -50.8, lon: -30.9, rKm: 115, depthM: 1800, rimM: 560 },
    { name: 'Moreux', lat: 41.8, lon: 44.5, rKm: 67, depthM: 1400, rimM: 450 },
    { name: 'Bamberg', lat: 39.7, lon: -3.2, rKm: 28, depthM: 1050, rimM: 340 },
    { name: 'Cerulli', lat: 32.3, lon: 22.1, rKm: 65, depthM: 1400, rimM: 440 },
    { name: 'Pasteur', lat: 19.3, lon: 24.5, rKm: 56, depthM: 1300, rimM: 420 },
    { name: 'Schiaparelli_W', lat: -3.2, lon: 14.5, rKm: 42, depthM: 1150, rimM: 370 },
    { name: 'Pollack', lat: -7.9, lon: 25.2, rKm: 48, depthM: 1200, rimM: 390 }
].map(c => {
    const kmPerDeg = (Math.PI / 180) * MARS_RADIUS_KM;
    const cosLat = Math.max(0.25, Math.cos(c.lat * Math.PI / 180));
    const padKm = c.rKm * 1.48;
    return { ...c, maxDegLat: padKm / kmPerDeg, maxDegLon: padKm / (kmPerDeg * cosLat), cosLat };
});

function getCraterParamsAt(lat, lon) {
    let elevDelta = 0, hazard = 0;
    const kmPerDeg = (Math.PI / 180) * MARS_RADIUS_KM;
    for (let i = 0; i < MARS_CRATERS.length; i++) {
        const c = MARS_CRATERS[i];
        const dLat = lat - c.lat;
        if (dLat > c.maxDegLat || dLat < -c.maxDegLat) continue;
        const dLon = ((lon - c.lon + 180) % 360 + 360) % 360 - 180;
        if (dLon > c.maxDegLon || dLon < -c.maxDegLon) continue;
        const distKm = Math.hypot(dLat * kmPerDeg, dLon * c.cosLat * kmPerDeg);
        const u = distKm / c.rKm;
        if (u >= 1.45) continue;
        const rim = c.rimM * Math.exp(-Math.pow((u - 1.0) / 0.16, 2));
        const bowl = u < 1.0 ? -c.depthM * Math.pow(1 - u * u, 1.4) : 0;
        elevDelta += rim + bowl;
        if (u < 1.28) {
            const rimWeight = Math.exp(-Math.pow((u - 1.0) / 0.22, 2));
            const innerWeight = u < 0.95 ? (1.0 - 0.15 * u) : 0;
            hazard = Math.max(hazard, Math.max(rimWeight, innerWeight));
        }
    }
    return { elevDelta, hazard };
}

function getCraterHazardAt(lat, lon) {
    return getCraterParamsAt(lat, lon).hazard;
}

const MarsTileTerrainScanner = (() => {
    const SIZE = 256;
    const vikingCache = new Map();
    const molaCache = new Map();
    const inflight = new Set();
    const failed = new Set();
    let version = 0;
    let refineTimer = null;

    function scheduleRefine() {
        if (refineTimer) clearTimeout(refineTimer);
        refineTimer = setTimeout(() => {
            refineTimer = null;
            if (typeof routeConfirmed !== 'undefined' && routeConfirmed && ptA && ptB && !isMarkerDragging) {
                navGridCache = {};
                buildRoute(false);
            }
        }, 90);
    }

    function pickZoom(latSpan, lonSpan) {
        for (let z = 7; z >= 2; z--) {
            const deg = 180 / Math.pow(2, z);
            const tilesX = Math.ceil(lonSpan / deg) + 1;
            const tilesY = Math.ceil(latSpan / deg) + 1;
            if (tilesX * tilesY <= 12) return z;
        }
        return 2;
    }

    function analyzeVikingTile(img) {
        const cvs = document.createElement('canvas');
        cvs.width = SIZE; cvs.height = SIZE;
        const ctx = cvs.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const N = SIZE * SIZE;
        const lum = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
        }
        const W1 = SIZE + 1;
        const sat = new Float64Array(W1 * W1);
        for (let y = 0; y < SIZE; y++) {
            let rowSum = 0;
            for (let x = 0; x < SIZE; x++) {
                rowSum += lum[y * SIZE + x];
                sat[(y + 1) * W1 + (x + 1)] = sat[y * W1 + (x + 1)] + rowSum;
            }
        }
        const boxMean = (x, y, r) => {
            const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r);
            const x1 = Math.min(SIZE - 1, x + r) + 1, y1 = Math.min(SIZE - 1, y + r) + 1;
            const sum = sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0];
            return sum / ((x1 - x0) * (y1 - y0));
        };
        const raw = new Float32Array(N);
        for (let y = 1; y < SIZE - 1; y++) {
            for (let x = 1; x < SIZE - 1; x++) {
                const idx = y * SIZE + x;
                const hpSmall = Math.abs(lum[idx] - boxMean(x, y, 4));
                const hpMed = Math.abs(lum[idx] - boxMean(x, y, 11));
                const gx = (lum[idx + 1] - lum[idx - 1]) * 0.5;
                const gy = (lum[idx + SIZE] - lum[idx - SIZE]) * 0.5;
                const grad = Math.hypot(gx, gy);
                raw[idx] = Math.min(1.0, Math.max(0, hpSmall * 5.2 + hpMed * 4.0 + grad * 3.6 - 0.045));
            }
        }
        const dilated = new Float32Array(N);
        for (let y = 2; y < SIZE - 2; y++) {
            for (let x = 2; x < SIZE - 2; x++) {
                const idx = y * SIZE + x;
                let mx = 0, sum = 0;
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const v = raw[(y + dy) * SIZE + (x + dx)];
                        if (v > mx) mx = v;
                        sum += v;
                    }
                }
                dilated[idx] = 0.65 * mx + 0.35 * (sum / 25);
            }
        }
        return dilated;
    }

    function analyzeMolaTile(img) {
        const cvs = document.createElement('canvas');
        cvs.width = SIZE; cvs.height = SIZE;
        const ctx = cvs.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const md = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const N = SIZE * SIZE;
        const raw = new Float32Array(N);
        for (let y = 1; y < SIZE - 1; y++) {
            for (let x = 1; x < SIZE - 1; x++) {
                const idx = y * SIZE + x;
                const pR = (idx + 1) * 4, pL = (idx - 1) * 4, pD = (idx + SIZE) * 4, pU = (idx - SIZE) * 4;
                const dX = Math.hypot(md[pR] - md[pL], md[pR + 1] - md[pL + 1], md[pR + 2] - md[pL + 2]) / (255 * 1.73);
                const dY = Math.hypot(md[pD] - md[pU], md[pD + 1] - md[pU + 1], md[pD + 2] - md[pU + 2]) / (255 * 1.73);
                raw[idx] = Math.min(1.0, Math.max(0, Math.hypot(dX, dY) * 3.2 - 0.04));
            }
        }
        return raw;
    }

    function loadTileImg(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img.naturalWidth > 8 ? img : null);
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }

    async function fetchLayerTile(kind, z, ty, tx) {
        const key = `${kind}/${z}/${ty}/${tx}`;
        const targetCache = kind === 'viking' ? vikingCache : molaCache;
        if (targetCache.has(key) || inflight.has(key) || failed.has(key)) return;
        inflight.add(key);
        const layer = kind === 'viking' ? 'Mars_Viking_MDIM21_ClrMosaic_global_232m' : 'Mars_MGS_MOLA_ClrShade_merge_global_463m';
        let img = await loadTileImg(`/api/mars-tile/${layer}/${z}/${ty}/${tx}.jpg`);
        if (!img) img = await loadTileImg(`https://trek.nasa.gov/tiles/Mars/EQ/${layer}/1.0.0/default/default028mm/${z}/${ty}/${tx}.jpg`);
        inflight.delete(key);
        if (!img) { failed.add(key); return; }
        if (targetCache.size >= 120) targetCache.delete(targetCache.keys().next().value);
        targetCache.set(key, kind === 'viking' ? analyzeVikingTile(img) : analyzeMolaTile(img));
        version++;
        scheduleRefine();
    }

    function ensureBounds(minLat, maxLat, minLon, maxLon) {
        const zV = pickZoom(maxLat - minLat, maxLon - minLon);
        const zM = Math.min(6, zV);
        const queueZoom = (kind, z) => {
            const deg = 180 / Math.pow(2, z);
            const numRows = Math.pow(2, z), numCols = 2 * numRows;
            const ty0 = Math.max(0, Math.min(numRows - 1, Math.floor((90 - maxLat) / deg)));
            const ty1 = Math.max(0, Math.min(numRows - 1, Math.floor((90 - minLat) / deg)));
            const fx0 = Math.floor((minLon + 180) / deg), fx1 = Math.floor((maxLon + 180) / deg);
            for (let ty = ty0; ty <= ty1; ty++) {
                for (let fx = fx0; fx <= fx1; fx++) {
                    fetchLayerTile(kind, z, ty, ((fx % numCols) + numCols) % numCols);
                }
            }
        };
        queueZoom('viking', zV);
        queueZoom('mola', zM);
        return zV;
    }

    function sampleGrid(cacheMap, kind, lat, lon, maxZ) {
        for (let z = maxZ; z >= 2; z--) {
            const deg = 180 / Math.pow(2, z);
            const numRows = Math.pow(2, z), numCols = 2 * numRows;
            const fy = (90 - Math.max(-89.9, Math.min(89.9, lat))) / deg;
            const fx = (normalizeLon(lon) + 180) / deg;
            const ty = Math.max(0, Math.min(numRows - 1, Math.floor(fy)));
            const tx = ((Math.floor(fx) % numCols) + numCols) % numCols;
            const grid = cacheMap.get(`${kind}/${z}/${ty}/${tx}`);
            if (!grid) continue;
            const u = (fx - Math.floor(fx)) * (SIZE - 1), v = (fy - Math.floor(fy)) * (SIZE - 1);
            const x0 = Math.floor(u), y0 = Math.floor(v), x1 = Math.min(SIZE - 1, x0 + 1), y1 = Math.min(SIZE - 1, y0 + 1);
            const txF = u - x0, tyF = v - y0;
            return (grid[y0 * SIZE + x0] * (1 - txF) + grid[y0 * SIZE + x1] * txF) * (1 - tyF) + (grid[y1 * SIZE + x0] * (1 - txF) + grid[y1 * SIZE + x1] * txF) * tyF;
        }
        return 0;
    }

    function sampleAt(lat, lon, prefZ = 6) {
        return Math.max(sampleGrid(vikingCache, 'viking', lat, lon, prefZ), sampleGrid(molaCache, 'mola', lat, lon, Math.min(6, prefZ)));
    }

    return { ensureBounds, sampleAt, getVersion: () => version };
})();

function getMolaElevationRaw(lat, lon) {
    let elev = -1500 + Math.sin((lat - 8) * Math.PI / 180) * -2700;
    elev += Math.sin(lat * 0.12 + 0.3) * Math.cos(lon * 0.12) * 560 + Math.sin(lat * 0.35) * Math.cos(lon * 0.35) * 210;
    const dTharsis = Math.hypot((lat - 1) * 1.3, lon + 95);
    if (dTharsis < 38) elev += Math.cos((dTharsis / 38) * (Math.PI / 2)) * 6200;
    const dOly = Math.hypot(lat - 18.4, lon + 133.8);
    if (dOly < 5.5) elev += dOly > 3.6 ? (4000 + (5.5 - dOly) * 3500) : (11000 + (3.6 - dOly) * 2800);
    const dAsc = Math.hypot(lat - 11.8, lon + 104.5); if (dAsc < 4.5) elev += (4.5 - dAsc) * 2600;
    const dPav = Math.hypot(lat - 0.8, lon + 113.0); if (dPav < 4.0) elev += (4.0 - dPav) * 2200;
    const dArs = Math.hypot(lat + 9.0, lon + 121.0); if (dArs < 4.5) elev += (4.5 - dArs) * 2400;
    const dEly = Math.hypot(lat - 25.0, lon - 147.2); if (dEly < 5.0) elev += (5.0 - dEly) * 2200;
    if (lat >= -19.0 && lat <= 2.0 && lon >= -98.0 && lon <= -30.0) {
        const t = Math.max(0, Math.min(1, ((lon + 92.0) * 58.0 + (lat + 5.0) * -9.0) / (58 * 58 + 81)));
        const distToSpine = Math.hypot((lat - (-5.0 + t * -9.0)) * 1.5, lon - (-92.0 + t * 58.0));
        if (distToSpine < 4.8) elev -= Math.pow(Math.cos((distToSpine / 4.8) * (Math.PI / 2)), 1.8) * 8200;
    }
    const dNoctis = Math.hypot((lat + 8.0) * 1.4, lon + 100.0);
    if (dNoctis < 6.8) {
        const canyonGrid = Math.sin(lat * 2.8) * Math.sin(lon * 2.8);
        elev -= (1 - dNoctis / 6.8) * 3400 + (canyonGrid > 0.1 ? canyonGrid * 2600 : 0);
    }
    const dHel = Math.hypot((lat + 42.0) * 1.1, lon - 70.0);
    if (dHel < 18.0) elev += dHel > 12.0 ? Math.sin(((dHel - 12.0) / 6.0) * Math.PI) * 2400 : -Math.cos((dHel / 12.0) * (Math.PI / 2)) * 5600;
    elev += getCraterParamsAt(lat, lon).elevDelta;
    elev += Math.sin(lat * 1.4 + 0.7) * Math.cos(lon * 1.4 - 0.4) * 90;
    elev += Math.sin(lat * 5.2 - 1.1) * Math.cos(lon * 5.2 + 0.8) * 22;
    elev += Math.sin(lat * 16.0 + lon * 11.0) * Math.cos(lon * 14.0 - lat * 9.0) * 7;
    return elev;
}

function getMolaElevation(lat, lon) { return Math.round(getMolaElevationRaw(lat, lon)); }

let lastTeleTime = 0;
function updateTelemetry(lat, lon) {
    const elLat = document.getElementById('teleLat'), elLon = document.getElementById('teleLon'), elAlt = document.getElementById('teleAlt');
    if (!elLat || !elLon || !elAlt) return;
    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) { elLat.innerText = elLon.innerText = elAlt.innerText = '---'; return; }
    const cLat = Math.max(-90, Math.min(90, lat)), cLon = normalizeLon(lon), alt = getMolaElevation(cLat, cLon);
    elLat.innerText = `${cLat.toFixed(4)}°`; elLon.innerText = `${cLon.toFixed(4)}°`; elAlt.innerText = `${alt > 0 ? '+' : ''}${alt} M`;
}

// 4. LEAFLET 2D (8K ПІДКЛАДКА + NASA MARS TREK ТАЙЛИ)
const map = L.map('map', {
    crs: L.CRS.EPSG4326, center: [0, 0], zoom: 2, maxZoom: 13, zoomSnap: 0.05, zoomDelta: 0.5,
    preferCanvas: true, worldCopyJump: false, maxBounds: [[-90, -1e9], [90, 1e9]], maxBoundsViscosity: 1.0
});

const TRANSPARENT_TILE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const MarsCylindricalLayer = L.GridLayer.extend({
    createTile: function (coords) {
        const size = this.getTileSize(), canvas = document.createElement('canvas');
        canvas.width = size.x; canvas.height = size.y;
        const z = coords.z, numRows = Math.pow(2, z), numCols = 2 * numRows;
        if (coords.y < 0 || coords.y >= numRows) return canvas;
        const col = ((coords.x % numCols) + numCols) % numCols, row = coords.y;
        const drawSlice = () => {
            const ctx = canvas.getContext('2d');
            if (!ctx || !marsPreloadImg.naturalWidth) return;
            const sw = marsPreloadImg.naturalWidth / numCols, sh = marsPreloadImg.naturalHeight / numRows;
            ctx.drawImage(marsPreloadImg, col * sw, row * sh, sw, sh, 0, 0, size.x, size.y);
        };
        if (marsPreloadImg.complete && marsPreloadImg.naturalWidth > 0) drawSlice();
        else pendingMarsTileDraws.push(drawSlice);
        return canvas;
    }
});
new MarsCylindricalLayer({ tileSize: 256, updateWhenIdle: false, keepBuffer: 2, zIndex: 1 }).addTo(map);

const MarsTrekEqLayer = L.TileLayer.extend({
    getTileUrl: function (coords) {
        const z = coords.z, numRows = Math.pow(2, z), numCols = 2 * numRows;
        if (coords.y < 0 || coords.y >= numRows) return TRANSPARENT_TILE;
        const col = ((coords.x % numCols) + numCols) % numCols;
        return L.Util.template(this._url, { z, x: col, y: coords.y });
    }
});

const vikingTrekLayer = new MarsTrekEqLayer(
    'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    { tileSize: 256, minZoom: 0, maxNativeZoom: 7, maxZoom: 13, zIndex: 2, keepBuffer: 4, updateWhenIdle: false, errorTileUrl: TRANSPARENT_TILE, className: 'mars-hq-tiles' }
).addTo(map);

(function initUltraHighResMarsOverlays() {
    const st = document.createElement('style');
    st.textContent = `
        .mars-hq-tiles img { image-rendering: auto; }
        .mars-ctx-detail-tiles { mix-blend-mode: overlay; filter: contrast(1.12); pointer-events: none; }
        .leaflet-overlay-pane path.mars-route-line { stroke-linecap: round !important; stroke-linejoin: round !important; }
        .leaflet-tooltip.mars-tooltip { background: rgba(15, 23, 42, 0.92) !important; color: #F8FAFC !important; border: 1px solid rgba(255, 255, 255, 0.2) !important; border-radius: 10px !important; padding: 6px 10px !important; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important; backdrop-filter: blur(12px); }
        .leaflet-tooltip.mars-tooltip::before { display: none !important; }
    `;
    document.head.appendChild(st);
    const probeImg = (url) => new Promise(res => {
        const img = new Image();
        img.onload = () => res(img.naturalWidth > 16);
        img.onerror = () => res(false);
        img.src = url;
    });
    probeImg('https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/8/128/256.jpg')
        .then(ok => { if (ok) { vikingTrekLayer.options.maxNativeZoom = 8; vikingTrekLayer.redraw(); } });
    const addDetail = (id, ext, minZ, maxNatZ, opacity) => new MarsTrekEqLayer(
        `https://trek.nasa.gov/tiles/Mars/EQ/${id}/1.0.0/default/default028mm/{z}/{y}/{x}.${ext}`,
        { tileSize: 256, minZoom: minZ, maxNativeZoom: maxNatZ, maxZoom: 13, opacity, zIndex: 3, keepBuffer: 3, updateWhenIdle: false, errorTileUrl: TRANSPARENT_TILE, className: 'mars-ctx-detail-tiles' }
    ).addTo(map);
    Promise.all([
        probeImg('https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/default/default028mm/0/0/0.png'),
        probeImg('https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/default/default028mm/0/0/0.jpg')
    ]).then(([pngOk, jpgOk]) => {
        if (pngOk || jpgOk) return addDetail('CTX_beta01_uncontrolled_5m_Caltech', pngOk ? 'png' : 'jpg', 8, 12, 0.55);
        return Promise.all([
            probeImg('https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/0/0/0.png'),
            probeImg('https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/0/0/0.jpg')
        ]).then(([tPng, tJpg]) => {
            if (tPng || tJpg) addDetail('THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', tPng ? 'png' : 'jpg', 7, 9, 0.50);
        });
    });
})();

function computeVisibleWorldOffsets() {
    const b = map.getBounds(), minO = Math.floor((b.getWest() + 180) / 360) - 1, maxO = Math.ceil((b.getEast() - 180) / 360) + 1, offsets = [];
    for (let o = minO; o <= maxO; o++) offsets.push(o);
    return offsets;
}

function updatePoleToPoleZoom() {
    const h = map.getSize().y; if (!h) return;
    const safeMinZoom = Math.max(0.5, Math.log2(h / 256));
    map.setMinZoom(safeMinZoom);
    if (map.getZoom() < safeMinZoom) map.setZoom(safeMinZoom);
}
updatePoleToPoleZoom();

window.addEventListener('resize', () => {
    updatePoleToPoleZoom(); syncWorldLayers();
    if (is3DMode && myGlobe) myGlobe.width(window.innerWidth).height(window.innerHeight);
});

let isMapDragging = false, isMarkerDragging = false;
map.on('dragstart', () => { isMapDragging = true; });
map.on('dragend', () => { setTimeout(() => { isMapDragging = false; }, 100); });

const hazardLayerGroup = L.layerGroup().addTo(map);
const safeLayerGroup = L.layerGroup().addTo(map);
const selectedZoneGroup = L.layerGroup().addTo(map);
const baseLayerGroup = L.layerGroup().addTo(map);
const markerAGroup = L.layerGroup().addTo(map);
const markerBGroup = L.layerGroup().addTo(map);
const safePolylineGroup = L.layerGroup().addTo(map);
const fastPolylineGroup = L.layerGroup().addTo(map);
const stormLayerGroup = L.layerGroup().addTo(map);
const waypointsLayerGroup = L.layerGroup().addTo(map);
const wazeReportsGroup = L.layerGroup().addTo(map);
const wazeRoverMarkerGroup = L.layerGroup().addTo(map);

const stormPane = map.createPane('stormPane');
stormPane.style.zIndex = 460;
const stormVectorRenderer = L.svg({ pane: 'stormPane' });

const StormImageOverlay = L.ImageOverlay.extend({
    _initImage: function () {
        const wrap = this._image = L.DomUtil.create('div', 'leaflet-image-layer' + (this._zoomAnimated ? ' leaflet-zoom-animated' : ''));
        wrap.style.pointerEvents = 'none';
        const img = this._innerImg = document.createElement('img');
        img.src = this._url; img.alt = this.options.alt || ''; img.className = 'storm-tornado-img';
        img.style.pointerEvents = 'none'; img.onselectstart = L.Util.falseFn; img.onmousemove = L.Util.falseFn;
        img.onload = L.Util.bind(this.fire, this, 'load'); img.onerror = L.Util.bind(this.fire, this, 'error');
        wrap.appendChild(img);
    },
    setUrl: function (url) { this._url = url; if (this._innerImg) this._innerImg.src = url; return this; },
    _updateOpacity: function () { L.DomUtil.setOpacity(this._image, this.options.opacity); }
});

function renderZones2D() {
    hazardLayerGroup.clearLayers(); safeLayerGroup.clearLayers();
    MARS_ZONES.forEach(z => {
        const isHaz = z.type === 'hazard';
        activeWorldOffsets.forEach(offset => {
            const poly = L.polygon(z.smoothCoords.map(pt => [pt[0], pt[1] + offset * 360]), {
                color: isHaz ? '#FF2E38' : '#00FFAA', fillColor: isHaz ? '#FF2E38' : '#00FFAA',
                fillOpacity: isHaz ? 0.24 : 0.18, weight: z.isPolar ? 0 : 2.2, stroke: !z.isPolar,
                lineCap: 'round', lineJoin: 'round', smoothFactor: 0.5, dashArray: isHaz ? '6, 6' : '8, 8',
                className: isHaz ? 'zone-hazard-poly' : 'zone-safe-poly'
            });
            (isHaz ? hazardLayerGroup : safeLayerGroup).addLayer(poly);
        });
    });
    update2DLayerVisibility();
}

function update2DLayerVisibility() {
    if (showHazardZones) { if (!map.hasLayer(hazardLayerGroup)) map.addLayer(hazardLayerGroup); }
    else if (map.hasLayer(hazardLayerGroup)) map.removeLayer(hazardLayerGroup);
    if (showSafeZones) { if (!map.hasLayer(safeLayerGroup)) map.addLayer(safeLayerGroup); }
    else if (map.hasLayer(safeLayerGroup)) map.removeLayer(safeLayerGroup);
}

function renderBases2D() {
    baseLayerGroup.clearLayers();
    if (!showBases) return;
    MARS_BASES.forEach(b => {
        activeWorldOffsets.forEach(offset => {
            const icon = L.divIcon({
                className: 'custom-pin',
                html: `<div class="mars-base-pin" title="${escHtml(b.name)}"><div class="mars-base-badge">⌂</div><div class="mars-base-label">${escHtml(b.shortName)}</div></div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            });
            const marker = L.marker([b.lat, b.lon + offset * 360], { icon, zIndexOffset: 380 });
            marker.on('click', (e) => { L.DomEvent.stopPropagation(e); handleCoordinateSelect(b.lat, b.lon); });
            baseLayerGroup.addLayer(marker);
        });
    });
}

window.focusOnBase = function(baseId) {
    const b = MARS_BASES.find(x => x.id === baseId); if (!b) return;
    if (b.zoneId) highlightSelectedZone(b.zoneId);
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: b.lat, lng: normalizeLon(b.lon), altitude: 1.35 }, 1200);
    else map.flyTo([b.lat, b.lon + Math.round((map.getCenter().lng - b.lon) / 360) * 360], Math.max(map.getZoom(), 3.2), { duration: 1.2 });
    showWarning(`🏠 БАЗА: ${b.name} (${b.type})`);
};

function highlightSelectedZone(zoneId) {
    currentSelectedZoneId = zoneId || null; selectedZoneGroup.clearLayers();
    if (!zoneId) return;
    const zone = MARS_ZONES.find(z => z.id === zoneId); if (!zone) return;
    const isHaz = zone.type === 'hazard';
    activeWorldOffsets.forEach(offset => {
        selectedZoneGroup.addLayer(L.polygon(zone.smoothCoords.map(pt => [pt[0], pt[1] + offset * 360]), {
            color: isHaz ? '#FF5722' : '#00FFAA', fillColor: isHaz ? '#FF5722' : '#00FFAA',
            fillOpacity: 0.38, weight: 4.5, lineCap: 'round', lineJoin: 'round', dashArray: '8, 6', className: 'zone-selected-glow'
        }));
    });
}

function rerenderRoutes2D() {
    if (!safeRouteData || !fastRouteData) return;
    drawAllRoutes2D(false);
}

function syncWorldLayers(force = false) {
    if (isMarkerDragging) return;
    const nextOffsets = computeVisibleWorldOffsets();
    const changed = force || nextOffsets.length !== activeWorldOffsets.length || nextOffsets[0] !== activeWorldOffsets[0] || nextOffsets[nextOffsets.length - 1] !== activeWorldOffsets[nextOffsets.length - 1];
    if (!changed) return;
    activeWorldOffsets = nextOffsets;
    renderZones2D(); renderBases2D();
    if (currentSelectedZoneId) highlightSelectedZone(currentSelectedZoneId);
    updateMarkerLayers(); rerenderRoutes2D();
    if (typeof renderStorms2D === 'function') renderStorms2D();
    if (typeof renderWazeReports2D === 'function') renderWazeReports2D();
    if (typeof updateWazeRover2D === 'function') updateWazeRover2D();
}

map.on('move', () => syncWorldLayers(false));
map.on('zoomend', () => syncWorldLayers(false));
map.on('moveend', () => {
    if (isMarkerDragging) return;
    const center = map.getCenter();
    if (center.lng > 180 || center.lng < -180) map.setView([center.lat, normalizeLon(center.lng)], map.getZoom(), { animate: false });
    syncWorldLayers(false);
});
map.on('mousemove', (e) => {
    const now = performance.now(); if (now - lastTeleTime < 40) return;
    lastTeleTime = now; updateTelemetry(e.latlng.lat, e.latlng.lng);
});

// 5. 3D GLOBE
function getSphericalSignedArea(ring) {
    const pts = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ? ring.slice(0, -1) : ring;
    if (pts.length < 3) return 0;
    const toRad = Math.PI / 180; let total = 0;
    for (let i = 0; i < pts.length; i++) {
        const [lon1, lat1] = pts[i], [lon2, lat2] = pts[(i + 1) % pts.length];
        let dLon = (lon2 - lon1) * toRad;
        while (dLon > Math.PI) dLon -= 2 * Math.PI;
        while (dLon < -Math.PI) dLon += 2 * Math.PI;
        total += dLon * (Math.sin(lat1 * toRad) + Math.sin(lat2 * toRad)) / 2;
    }
    return total;
}

function densifyPolygonRing(rawCoords, maxStepDeg = 1.5) {
    const toRad = Math.PI / 180, toDeg = 180 / Math.PI, densePts = [], n = rawCoords.length;
    for (let i = 0; i < n; i++) {
        const [lat1, lon1] = rawCoords[i], [lat2, lon2] = rawCoords[(i + 1) % n];
        const phi1 = lat1 * toRad, th1 = lon1 * toRad, phi2 = lat2 * toRad, th2 = lon2 * toRad;
        const x1 = Math.cos(phi1) * Math.cos(th1), y1 = Math.cos(phi1) * Math.sin(th1), z1 = Math.sin(phi1);
        const x2 = Math.cos(phi2) * Math.cos(th2), y2 = Math.cos(phi2) * Math.sin(th2), z2 = Math.sin(phi2);
        const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2)), omega = Math.acos(dot);
        const steps = Math.max(1, Math.ceil((omega * toDeg) / maxStepDeg));
        for (let s = 0; s < steps; s++) {
            const t = s / steps;
            let xi, yi, zi;
            if (dot > 0.9999) { xi = x1 + t * (x2 - x1); yi = y1 + t * (y2 - y1); zi = z1 + t * (z2 - z1); }
            else { const sinO = Math.sin(omega), a = Math.sin((1 - t) * omega) / sinO, b = Math.sin(t * omega) / sinO; xi = a * x1 + b * x2; yi = a * y1 + b * y2; zi = a * z1 + b * z2; }
            const r = Math.hypot(xi, yi, zi);
            densePts.push([Math.atan2(yi, xi) * toDeg, Math.asin(zi / r) * toDeg]);
        }
    }
    if (getSphericalSignedArea(densePts) < 0) densePts.reverse();
    if (densePts.length > 0) densePts.push([densePts[0][0], densePts[0][1]]);
    return densePts;
}

function getPolarCapMultiCoords(coords, isNorth) {
    if (!coords || coords.length < 4) return [];
    const edge = coords.slice(0, -2), poleLat = isNorth ? 89.9 : -89.9;
    const west = edge.filter(p => p[1] <= 0).map(p => [p[1], p[0]]), east = edge.filter(p => p[1] >= 0).map(p => [p[1], p[0]]);
    return isNorth
        ? [[ [[-180, poleLat], [0, poleLat], ...west.slice().reverse(), [-180, poleLat]] ], [ [[0, poleLat], [180, poleLat], ...east.slice().reverse(), [0, poleLat]] ]]
        : [[ [...west, [0, poleLat], [-180, poleLat], west[0]] ], [ [...east, [180, poleLat], [0, poleLat], east[0]] ]];
}

let hovered3DZone = null;
function getActive3DFeatures() {
    const features = [];
    MARS_ZONES.forEach(z => {
        const isHaz = z.type === 'hazard';
        if (isHaz ? !showHazardZones : !showSafeZones) return;
        const baseProps = {
            id: z.id, name: z.name, type: z.type, centroid: z.centroid,
            fillColor: isHaz ? 'rgba(255, 46, 56, 0.34)' : 'rgba(0, 255, 170, 0.28)',
            hoverCapColor: isHaz ? 'rgba(255, 46, 56, 0.62)' : 'rgba(0, 255, 170, 0.56)',
            sideColor: isHaz ? 'rgba(255, 46, 56, 0.10)' : 'rgba(0, 255, 170, 0.08)',
            strokeColor: z.isPolar ? 'rgba(255, 46, 56, 0.15)' : (isHaz ? '#FF2E38' : '#00FFAA'),
            altitude: isHaz ? 0.0045 : 0.0035
        };
        if (z.id === 'planum_boreum' || z.id === 'planum_australe') {
            features.push({ type: 'Feature', properties: baseProps, geometry: { type: 'MultiPolygon', coordinates: getPolarCapMultiCoords(z.coords, z.id === 'planum_boreum') } });
        } else {
            features.push({ type: 'Feature', properties: baseProps, geometry: { type: 'Polygon', coordinates: [densifyPolygonRing(z.smoothCoords)] } });
        }
    });
    return features;
}

let myGlobe = null, globeInitializedView = false;
function update3DBases() {
    if (!myGlobe) return;
    const pts = showBases ? MARS_BASES.map(b => ({ id: b.id, lat: b.lat, lng: normalizeLon(b.lon), name: b.name, type: b.type, color: '#38BDF8', radius: 0.42, altitude: 0.025 })) : [];
    myGlobe.pointsData(pts).pointLat('lat').pointLng('lng').pointColor('color').pointRadius('radius').pointAltitude('altitude')
        .pointLabel(d => `<div style="background:rgba(15,23,42,0.92);color:#fff;padding:6px 10px;border-radius:8px;border:1px solid #38BDF8;font-family:'Space Grotesk',sans-serif;font-size:12px;"><b>🏠 ${escHtml(d.name)}</b><br><span style="color:#94A3B8;font-size:11px;">${escHtml(d.type)}</span></div>`)
        .onPointClick(d => { if (d) handleCoordinateSelect(d.lat, d.lng); });
}

try {
    myGlobe = Globe()(document.getElementById('globe-container'))
        .globeImageUrl(getSafe3DTextureUrl()).backgroundColor('#050608').showAtmosphere(true).atmosphereColor('#ff5533').atmosphereAltitude(0.12)
        .polygonsData(getActive3DFeatures()).polygonGeoJsonGeometry(d => d.geometry)
        .polygonCapColor(d => d === hovered3DZone ? d.properties.hoverCapColor : d.properties.fillColor)
        .polygonSideColor(d => d.properties.sideColor).polygonStrokeColor(d => d.properties.strokeColor)
        .polygonAltitude(d => d === hovered3DZone ? Math.max(0.008, d.properties.altitude + 0.003) : d.properties.altitude)
        .polygonCapCurvatureResolution(2.0)
        .onPolygonHover(d => { if (d !== hovered3DZone) { hovered3DZone = d; myGlobe.polygonAltitude(myGlobe.polygonAltitude()).polygonCapColor(myGlobe.polygonCapColor()); } })
        .onPolygonClick((d, ev, coords) => { if (coords) handleCoordinateSelect(coords.lat, coords.lng); })
        .onGlobeClick(({ lat, lng }) => handleCoordinateSelect(lat, lng));
    update3DBases();
} catch (err) { console.warn("3D Globe:", err); }

// 6. ПАНЕЛЬ ТА КЕРУВАННЯ
function setHazardVisibility(visible) {
    showHazardZones = visible;
    const btnTop = document.getElementById('btnVisHazards');
    if (btnTop) { btnTop.classList.toggle('active', showHazardZones); btnTop.classList.toggle('inactive', !showHazardZones); btnTop.innerHTML = `<span class="btn-dot ${showHazardZones ? 'dot-red' : 'dot-muted'}"></span>НЕБЕЗПЕКИ: ${showHazardZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`; }
    document.getElementById('switchToggleHazards')?.classList.toggle('active', showHazardZones);
    update2DLayerVisibility(); if (myGlobe) myGlobe.polygonsData(getActive3DFeatures());
}

function setSafeVisibility(visible) {
    showSafeZones = visible;
    const btnTop = document.getElementById('btnVisSafe');
    if (btnTop) { btnTop.classList.toggle('active', showSafeZones); btnTop.classList.toggle('inactive', !showSafeZones); btnTop.innerHTML = `<span class="btn-dot ${showSafeZones ? 'dot-green' : 'dot-muted'}"></span>БЕЗПЕЧНІ: ${showSafeZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`; }
    document.getElementById('switchToggleSafe')?.classList.toggle('active', showSafeZones);
    update2DLayerVisibility(); if (myGlobe) myGlobe.polygonsData(getActive3DFeatures());
}

function setBasesVisibility(visible) {
    showBases = visible;
    const btnTop = document.getElementById('btnVisBases');
    if (btnTop) { btnTop.classList.toggle('active', showBases); btnTop.classList.toggle('inactive', !showBases); btnTop.innerHTML = `<span class="btn-dot ${showBases ? 'dot-base' : 'dot-muted'}"></span>БАЗИ: ${showBases ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`; }
    document.getElementById('switchToggleBases')?.classList.toggle('active', showBases);
    renderBases2D(); update3DBases();
}

function setReportsVisibility(visible) {
    showWazeReports = visible;
    const btnTop = document.getElementById('btnToggleReports');
    if (btnTop) { btnTop.classList.toggle('active', showWazeReports); btnTop.classList.toggle('inactive', !showWazeReports); btnTop.innerHTML = `<span class="btn-dot ${showWazeReports ? 'dot-cyan' : 'dot-muted'}"></span>ПОЗНАЧКИ: ${showWazeReports ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`; }
    if (typeof renderWazeReports2D === 'function') renderWazeReports2D();
}

document.getElementById('btnVisHazards')?.addEventListener('click', () => setHazardVisibility(!showHazardZones));
document.getElementById('btnVisSafe')?.addEventListener('click', () => setSafeVisibility(!showSafeZones));
document.getElementById('btnVisBases')?.addEventListener('click', () => setBasesVisibility(!showBases));
document.getElementById('btnToggleReports')?.addEventListener('click', () => setReportsVisibility(!showWazeReports));
document.getElementById('switchToggleHazards')?.addEventListener('click', () => setHazardVisibility(!showHazardZones));
document.getElementById('switchToggleSafe')?.addEventListener('click', () => setSafeVisibility(!showSafeZones));
document.getElementById('switchToggleBases')?.addEventListener('click', () => setBasesVisibility(!showBases));

const btnToggleHazardsEl = document.getElementById('btnToggleHazards');
if (btnToggleHazardsEl) {
    btnToggleHazardsEl.onclick = (e) => {
        hazardsAvoidanceActive = !hazardsAvoidanceActive;
        e.currentTarget.classList.toggle('active', hazardsAvoidanceActive);
        e.currentTarget.innerText = hazardsAvoidanceActive ? "A* ОБМЕЖЕННЯ: УВІМК" : "A* ОБМЕЖЕННЯ: ВИМК";
        if (routeConfirmed && ptA && ptB) buildRoute(false);
    };
}

const btnToggleViewEl = document.getElementById('btnToggleView');
if (btnToggleViewEl) {
    btnToggleViewEl.onclick = () => {
        is3DMode = !is3DMode;
        btnToggleViewEl.classList.toggle('is-3d', is3DMode);
        const label = is3DMode ? 'Перемкнути на 2D карту' : 'Перемкнути на 3D карту';
        btnToggleViewEl.title = label; btnToggleViewEl.setAttribute('aria-label', label);
        document.getElementById('map').style.display = is3DMode ? 'none' : 'block';
        document.getElementById('globe-container').style.display = is3DMode ? 'block' : 'none';
        if (!is3DMode) { map.invalidateSize(); updatePoleToPoleZoom(); syncWorldLayers(true); }
        else if (myGlobe) {
            myGlobe.width(window.innerWidth).height(window.innerHeight);
            if (!globeInitializedView) {
                globeInitializedView = true; const c = map.getCenter();
                myGlobe.pointOfView({ lat: c.lat, lng: normalizeLon(c.lng), altitude: 2.1 }, 0);
            }
            myGlobe.polygonsData(getActive3DFeatures()); update3DBases();
            if (typeof update3DStormRings === 'function') update3DStormRings();
            update3DPinsAndPaths();
        }
    };
}

function syncSidebarLayoutClasses() {
    const sb = document.getElementById('sidebar');
    if (sb) document.body.classList.toggle('sidebar-collapsed', sb.classList.contains('collapsed'));
}

const btnToggleSidebarEl = document.getElementById('btnToggleSidebar');
if (btnToggleSidebarEl) {
    btnToggleSidebarEl.onclick = () => {
        const sb = document.getElementById('sidebar'); if (!sb) return;
        sb.classList.toggle('collapsed'); btnToggleSidebarEl.classList.toggle('collapsed');
        btnToggleSidebarEl.innerText = sb.classList.contains('collapsed') ? '❯' : '❮';
        syncSidebarLayoutClasses();
    };
}

const btnCloseSidebarMobile = document.getElementById('btnCloseSidebarMobile');
if (btnCloseSidebarMobile) {
    btnCloseSidebarMobile.onclick = () => {
        const sb = document.getElementById('sidebar'), toggleBtn = document.getElementById('btnToggleSidebar');
        if (sb) sb.classList.add('collapsed');
        if (toggleBtn) { toggleBtn.classList.add('collapsed'); toggleBtn.innerText = '❯'; }
        syncSidebarLayoutClasses();
    };
}
if (window.innerWidth <= 768) {
    const sb = document.getElementById('sidebar'), toggleBtn = document.getElementById('btnToggleSidebar');
    if (sb && toggleBtn) { sb.classList.add('collapsed'); toggleBtn.classList.add('collapsed'); toggleBtn.innerText = '❯'; syncSidebarLayoutClasses(); }
}

const hudTopEl = document.querySelector('.hud-top');
if (hudTopEl && typeof ResizeObserver !== 'undefined') {
    const updateHudOffset = () => document.documentElement.style.setProperty('--hud-top-bottom', `${Math.ceil(hudTopEl.getBoundingClientRect().bottom + 10)}px`);
    new ResizeObserver(updateHudOffset).observe(hudTopEl);
    updateHudOffset();
}

function showWarning(msg) {
    const toast = document.getElementById('warningToast'); if (!toast) return;
    document.getElementById('warningMsg').innerText = msg; toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 6500);
}

// 7. СПИСОК ЗОН ТА БАЗ
function renderZonesList(searchQuery = '') {
    const container = document.getElementById('zonesListContainer'), query = searchQuery.toLowerCase().trim();
    if (!container) return;
    if (activeZoneFilter === 'base') {
        const filteredBases = MARS_BASES.filter(b => !query || b.name.toLowerCase().includes(query) || b.type.toLowerCase().includes(query) || b.id.includes(query));
        container.innerHTML = filteredBases.length ? filteredBases.map(b => `<div class="zone-item base-item" onclick="focusOnBase('${b.id}')"><div class="zone-item-head"><span class="zone-item-title"><span class="btn-dot dot-base"></span>${b.name}</span><button class="zone-item-btn" onclick="event.stopPropagation(); focusOnBase('${b.id}')">⌖</button></div></div>`).join('') : `<div style="font-size:0.72rem; color:#64748B; padding:10px; text-align:center;">Баз не знайдено</div>`;
        return;
    }
    const filtered = MARS_ZONES.filter(z => (activeZoneFilter === 'all' || z.type === activeZoneFilter) && (!query || z.name.toLowerCase().includes(query) || z.id.includes(query)));
    container.innerHTML = filtered.length ? filtered.map(z => {
        const isHaz = z.type === 'hazard';
        return `<div class="zone-item ${isHaz ? 'hazard-item' : 'safe-item'}" onclick="focusOnZone('${z.id}')"><div class="zone-item-head"><span class="zone-item-title"><span class="btn-dot ${isHaz ? 'dot-red' : 'dot-green'}"></span>${z.name}</span><button class="zone-item-btn" onclick="event.stopPropagation(); focusOnZone('${z.id}')">⌖</button></div></div>`;
    }).join('') : `<div style="font-size:0.72rem; color:#64748B; padding:10px; text-align:center;">Зон не знайдено</div>`;
}

document.querySelectorAll('.z-tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.z-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active'); activeZoneFilter = tab.getAttribute('data-filter');
        renderZonesList(document.getElementById('zoneFilterInput')?.value || '');
    };
});
document.getElementById('zoneFilterInput')?.addEventListener('input', (e) => renderZonesList(e.target.value));

window.focusOnZone = function(zoneId) {
    const zone = MARS_ZONES.find(z => z.id === zoneId); if (!zone) return;
    highlightSelectedZone(zoneId);
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: zone.centroid[0], lng: zone.centroid[1], altitude: 1.5 }, 1200);
    else map.flyTo([zone.centroid[0], zone.centroid[1] + Math.round((map.getCenter().lng - zone.centroid[1]) / 360) * 360], Math.max(map.getZoom(), 2.8), { duration: 1.2 });
    showWarning(`ФОКУС: ${zone.name}`); displayZoneDetails(zoneId);
    const sel = document.getElementById('zoneSelect'); if (sel && sel.value !== zoneId) sel.value = zoneId;
};

function populateZoneSelect() {
    const select = document.getElementById('zoneSelect'); if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Оберіть зону Марса...</option>';
    MARS_ZONES.forEach(zone => { const opt = document.createElement('option'); opt.value = zone.id; opt.textContent = zone.name; select.appendChild(opt); });
}

function displayZoneDetails(zoneId) {
    const zone = MARS_ZONES.find(z => z.id === zoneId); if (!zone) return;
    const card = document.getElementById('zoneInfoCard'), nameEl = document.getElementById('cardZoneName'), terrainEl = document.getElementById('cardTerrainType');
    if (nameEl) nameEl.innerText = zone.name;
    if (terrainEl) terrainEl.innerText = zone.type === 'hazard' ? "Кам'янистий / Скелястий каньйон" : "Піщаний / Базальтова рівнина";
    let weatherStatus = "Ясно, легкий пиловий серпанок", zoneTemp = zone.type === 'hazard' ? "-78 °C" : "-55 °C";
    if (typeof getStormImpactAtPoint === 'function') {
        const stormInfo = getStormImpactAtPoint(zone.centroid ? zone.centroid[0] : zone.coords[0][0], zone.centroid ? zone.centroid[1] : zone.coords[0][1]);
        if (stormInfo && stormInfo.inStorm) { weatherStatus = `⚠️ ШТОРМ: ${stormInfo.stormName} (${stormInfo.windSpeed} м/с, τ=${stormInfo.tau})`; zoneTemp = "-84 °C (сильне затемнення)"; }
    }
    document.getElementById('cardIcePresence').innerText = zone.type === 'hazard' ? "Ні" : "Присутній (глибина ~1.2м)";
    document.getElementById('cardWeather').innerText = weatherStatus;
    document.getElementById('cardTime').innerText = "14:32 MTC";
    document.getElementById('cardTemp').innerText = zoneTemp;
    if (card) card.style.display = 'block';
}

document.getElementById('zoneSelect')?.addEventListener('change', (e) => { if (e.target.value) focusOnZone(e.target.value); });
document.getElementById('btnCloseZoneCard')?.addEventListener('click', () => {
    const card = document.getElementById('zoneInfoCard'); if (card) card.style.display = 'none';
    currentSelectedZoneId = null; selectedZoneGroup.clearLayers();
    const select = document.getElementById('zoneSelect'); if (select) select.value = "";
});
populateZoneSelect();

// 8. МАРКЕРИ ТА МАРШРУТИ
let ptA = null, ptB = null, fastRouteData = null, safeRouteData = null, activeRouteMode = 'safe';
let waypoints = [], isPickingWaypoint = false, isPickingReportLoc = false, pendingReportCoords = { lat: 0, lon: 0 };
let routeConfirmed = false, liveDragRouteTimer = null, lastLiveRouteTime = 0;

function scheduleLiveRouteRebuild() {
    if (!routeConfirmed || !ptA || !ptB) return;
    const now = performance.now(), elapsed = now - lastLiveRouteTime;
    if (elapsed >= 55) {
        lastLiveRouteTime = now;
        buildRoute(false);
    } else if (!liveDragRouteTimer) {
        liveDragRouteTimer = setTimeout(() => {
            liveDragRouteTimer = null;
            lastLiveRouteTime = performance.now();
            if (routeConfirmed && ptA && ptB) buildRoute(false);
        }, 55 - elapsed);
    }
}

function makeNothingPin(letter, isRed) {
    const bg = isRed ? '#FF2E38' : '#00F0FF', textCol = isRed ? '#FFFFFF' : '#000000';
    return L.divIcon({ className: 'custom-pin', html: `<div style="background:${bg}; color:${textCol}; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk'; font-weight:800; font-size:11px; border:2px solid #000; box-shadow:0 0 12px ${bg};">${letter}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
}

function makeWaypointPin(num) {
    return L.divIcon({ className: 'custom-pin', html: `<div style="background:#0EA5E9; color:#FFFFFF; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk'; font-weight:800; font-size:11px; border:2px solid #000; box-shadow:0 0 12px #0EA5E9;">${num}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
}

function renderSyncedMarker(group, pt, letter, isRed, onPointDrag, onPointChange) {
    group.clearLayers(); if (!pt) return;
    activeWorldOffsets.forEach(offset => {
        const marker = L.marker([pt.lat, pt.lon + offset * 360], { icon: makeNothingPin(letter, isRed), draggable: true });
        marker._worldOffset = offset;
        marker.on('dragstart', () => { isMarkerDragging = true; });
        marker.on('drag', (e) => {
            const raw = e.target.getLatLng(), normL = normalizeLon(raw.lng);
            group.eachLayer(m => { if (m !== marker) m.setLatLng([raw.lat, normL + m._worldOffset * 360]); });
            onPointDrag({ lat: Math.max(-90, Math.min(90, Number(Number(raw.lat).toFixed(4)))), lon: Number(normL.toFixed(4)) });
        });
        marker.on('dragend', (e) => { isMarkerDragging = false; const raw = e.target.getLatLng(); onPointChange({ lat: Math.max(-90, Math.min(90, Number(Number(raw.lat).toFixed(4)))), lon: Number(normalizeLon(raw.lng).toFixed(4)) }); });
        group.addLayer(marker);
    });
}

function renderSyncedWaypoints2D() {
    waypointsLayerGroup.clearLayers(); if (!waypoints.length) return;
    waypoints.forEach((wp, idx) => {
        activeWorldOffsets.forEach(offset => {
            const marker = L.marker([wp.lat, wp.lon + offset * 360], { icon: makeWaypointPin(idx + 1), draggable: true });
            marker._worldOffset = offset;
            marker.on('dragstart', () => { isMarkerDragging = true; });
            marker.on('drag', (e) => {
                const raw = e.target.getLatLng();
                wp.lat = Math.max(-90, Math.min(90, Number(Number(raw.lat).toFixed(4)))); wp.lon = Number(normalizeLon(raw.lng).toFixed(4));
                renderWaypointsUI(); if (routeConfirmed) scheduleLiveRouteRebuild();
            });
            marker.on('dragend', () => { isMarkerDragging = false; updateMarkerLayers(); renderWaypointsUI(); if (routeConfirmed && ptA && ptB) { navGridCache = {}; buildRoute(false); } debouncedSaveCloudRoute(); });
            waypointsLayerGroup.addLayer(marker);
        });
    });
}

function renderWaypointsUI() {
    const list = document.getElementById('waypointsList'); if (!list) return;
    list.innerHTML = waypoints.length ? waypoints.map((wp, idx) => `
        <div class="card-waypoint" data-id="${escHtml(wp.id)}">
            <div class="p-label">
                <span class="pin-wp">${idx + 1}</span>
                <span class="wp-title">${escHtml(wp.name || ('ВЕЙПОІНТ ' + (idx + 1)))}</span>
                <div class="wp-actions">
                    <button class="btn-wp-move" onclick="moveWaypoint(${idx}, -1)" title="Вгору" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button class="btn-wp-move" onclick="moveWaypoint(${idx}, 1)" title="Вниз" ${idx === waypoints.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="btn-wp-del" onclick="removeWaypoint('${escHtml(wp.id)}')" title="Видалити точку">×</button>
                </div>
            </div>
            <div class="p-value">${wp.lat.toFixed(3)}°, ${wp.lon.toFixed(3)}°</div>
        </div>
    `).join('') : '';
}

window.addWaypoint = function(lat, lon, name = null) {
    const clampedLat = Math.max(-90, Math.min(90, Number(Number(lat).toFixed(4)))), clampedLon = Number(normalizeLon(lon).toFixed(4));
    const wp = { id: 'wp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), lat: clampedLat, lon: clampedLon, name: name || `ВЕЙПОІНТ ${waypoints.length + 1}` };
    waypoints.push(wp); isPickingWaypoint = false;
    updateMarkerLayers(); renderWaypointsUI();
    showWarning(`📍 Додано: ${wp.name} (${clampedLat}°, ${clampedLon}°)`);
    if (routeConfirmed && ptA && ptB) { navGridCache = {}; buildRoute(false); }
    debouncedSaveCloudRoute();
};

window.removeWaypoint = function(id) {
    waypoints = waypoints.filter(w => w.id !== id); updateMarkerLayers(); renderWaypointsUI();
    if (routeConfirmed && ptA && ptB) { navGridCache = {}; buildRoute(false); } debouncedSaveCloudRoute();
};

window.moveWaypoint = function(index, dir) {
    const targetIdx = index + dir; if (targetIdx < 0 || targetIdx >= waypoints.length) return;
    [waypoints[index], waypoints[targetIdx]] = [waypoints[targetIdx], waypoints[index]];
    updateMarkerLayers(); renderWaypointsUI();
    if (routeConfirmed && ptA && ptB) { navGridCache = {}; buildRoute(false); } debouncedSaveCloudRoute();
};

window.reverseRoute = function() {
    if (!ptA || !ptB) return showWarning('Для реверсу потрібні Старт (A) та Фініш (B)');
    [ptA, ptB] = [ptB, ptA]; waypoints.reverse(); updateMarkerLayers(); syncUI(); renderWaypointsUI();
    showWarning('⇄ Маршрут розвернуто (Реверс)!');
    if (routeConfirmed) { navGridCache = {}; buildRoute(false); } debouncedSaveCloudRoute();
};

function updateMarkerLayers() {
    renderSyncedMarker(markerAGroup, ptA, 'A', false,
        (dragPt) => { ptA = dragPt; syncUI(); if (routeConfirmed) scheduleLiveRouteRebuild(); },
        (newPt) => { ptA = newPt; updateMarkerLayers(); syncUI(); if (routeConfirmed && ptB) buildRoute(false); debouncedSaveCloudRoute(); }
    );
    renderSyncedMarker(markerBGroup, ptB, 'B', true,
        (dragPt) => { ptB = dragPt; syncUI(); if (routeConfirmed) scheduleLiveRouteRebuild(); },
        (newPt) => { ptB = newPt; updateMarkerLayers(); syncUI(); if (routeConfirmed && ptA) buildRoute(false); debouncedSaveCloudRoute(); }
    );
    renderSyncedWaypoints2D();
}

function splitPathAtAntimeridian(path) {
    if (!path || path.length < 2) return path ? [path.map(p => [p.lat, normalizeLon(p.lon)])] : [];
    const segments = []; let currentSegment = [];
    for (let i = 0; i < path.length; i++) {
        const pt = path[i], currLon = normalizeLon(pt.lon), currLat = pt.lat;
        if (i === 0) { currentSegment.push([currLat, currLon]); continue; }
        const prevLon = normalizeLon(path[i - 1].lon), prevLat = path[i - 1].lat;
        if (Math.abs(currLon - prevLon) > 180) {
            const crossLat = prevLat + ((prevLon > 0 ? (180 - prevLon) : (prevLon + 180)) / Math.max(0.0001, (prevLon > 0 ? (180 - prevLon) + (currLon + 180) : (prevLon + 180) + (180 - currLon)))) * (currLat - prevLat);
            currentSegment.push([crossLat, prevLon > 0 ? 180 : -180]); segments.push(currentSegment);
            currentSegment = [[crossLat, prevLon > 0 ? -180 : 180], [currLat, currLon]];
        } else currentSegment.push([currLat, currLon]);
    }
    if (currentSegment.length > 0) segments.push(currentSegment);
    return segments;
}

function update3DPinsAndPaths() {
    if (!myGlobe) return;
    const labels = [];
    if (ptA) labels.push({ lat: ptA.lat, lng: ptA.lon, text: 'A', color: '#00F0FF' });
    waypoints.forEach((wp, i) => labels.push({ lat: wp.lat, lng: wp.lon, text: `W${i + 1}`, color: '#0EA5E9' }));
    if (ptB) labels.push({ lat: ptB.lat, lng: ptB.lon, text: 'B', color: '#FF2E38' });
    myGlobe.labelsData(labels).labelLat('lat').labelLng('lng').labelText('text').labelSize(1.8).labelDotRadius(0.6).labelColor('color').labelResolution(3).labelAltitude(0.018);
    if (typeof update3DStormRings === 'function') update3DStormRings();
    if (typeof update3DStormHtmlElements === 'function') update3DStormHtmlElements();
    const paths = [];
    if (safeRouteData && fastRouteData) {
        const safeSegs = splitPathAtAntimeridian(safeRouteData.path), fastSegs = splitPathAtAntimeridian(fastRouteData.path);
        if (activeRouteMode === 'safe') {
            fastSegs.forEach(seg => paths.push({ coords: seg, color: 'rgba(255,46,56,0.38)', stroke: 1.8, alt: 0.008 }));
            safeSegs.forEach(seg => paths.push({ coords: seg, color: '#00FFAA', stroke: 3.2, alt: 0.011 }));
        } else {
            safeSegs.forEach(seg => paths.push({ coords: seg, color: 'rgba(0,255,170,0.38)', stroke: 1.8, alt: 0.008 }));
            fastSegs.forEach(seg => paths.push({ coords: seg, color: '#FF2E38', stroke: 3.2, alt: 0.011 }));
        }
    }
    myGlobe.pathsData(paths)
        .pathPoints('coords')
        .pathPointLat(p => p[0])
        .pathPointLng(p => p[1])
        .pathColor('color')
        .pathDashLength(1)
        .pathDashGap(0)
        .pathDashAnimateTime(0)
        .pathStroke(d => d.stroke || 2.8)
        .pathPointAlt(d => d.alt || 0.010);
}

function applyCloudRoutePoints(pointA, pointB, autoBuild = true, cloudWaypoints = null) {
    isSosRouteActive = false;
    ptA = (pointA && typeof pointA.lat === 'number') ? { lat: Number(pointA.lat), lon: Number(normalizeLon(pointA.lon)) } : null;
    ptB = (pointB && typeof pointB.lat === 'number') ? { lat: Number(pointB.lat), lon: Number(normalizeLon(pointB.lon)) } : null;
    if (Array.isArray(cloudWaypoints)) waypoints = cloudWaypoints.map(w => ({ id: w.id || ('wp_' + Math.random().toString(36).substr(2, 6)), lat: Number(w.lat), lon: Number(normalizeLon(w.lon)), name: w.name || 'Вейпоінт' }));
    updateMarkerLayers(); syncUI(); renderWaypointsUI();
    if (autoBuild && ptA && ptB) { routeConfirmed = true; buildRoute(true); }
    else { routeConfirmed = false; stopAndClearRouteTimer(); update3DPinsAndPaths(); }
}

function handleCoordinateSelect(rawLat, rawLon) {
    isSosRouteActive = false;
    const lat = Math.max(-90, Math.min(90, Number(Number(rawLat).toFixed(4)))), lon = Number(normalizeLon(rawLon).toFixed(4));
    if (isPickingReportLoc) {
        isPickingReportLoc = false; pendingReportCoords = { lat, lon };
        const disp = document.getElementById('reportCoordsDisp'); if (disp) disp.innerText = `Координати: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
        const modal = document.getElementById('reportModal'); if (modal) modal.style.display = 'flex';
        showWarning(`📍 Локацію позначки обрано: ${lat}°, ${lon}°`);
        return;
    }
    if (isPickingWaypoint) { addWaypoint(lat, lon); return; }
    if (!ptA) { ptA = { lat, lon }; routeConfirmed = false; }
    else if (!ptB) { ptB = { lat, lon }; routeConfirmed = false; }
    else {
        ptA = { lat, lon }; ptB = null; routeConfirmed = false; stopAndClearRouteTimer();
        fastPolylineGroup.clearLayers(); safePolylineGroup.clearLayers(); fastRouteData = safeRouteData = null;
        const rr = document.getElementById('routeReport'); if (rr) rr.style.display = 'none';
        if (typeof stopWazeNavigation === 'function') stopWazeNavigation();
    }
    updateMarkerLayers(); syncUI(); update3DPinsAndPaths(); debouncedSaveCloudRoute();
}

map.on('click', (e) => { if (!isMapDragging) handleCoordinateSelect(e.latlng.lat, e.latlng.lng); });

function syncUI() {
    const elA = document.getElementById('dispPointA'), elB = document.getElementById('dispPointB');
    if (elA) elA.innerText = ptA ? `${ptA.lat.toFixed(3)}°, ${ptA.lon.toFixed(3)}°` : 'Клікніть на мапі...';
    if (elB) elB.innerText = ptB ? `${ptB.lat.toFixed(3)}°, ${ptB.lon.toFixed(3)}°` : 'Клікніть на мапі...';
}

function getCylindricalRouteBounds() {
    if (safeRouteData && safeRouteData.path && safeRouteData.path.length > 0) {
        const lats = safeRouteData.path.map(p => p.lat), uLons = safeRouteData.path.map(p => p.unwrappedLon);
        const minU = Math.min(...uLons), maxU = Math.max(...uLons), shift = 360 * Math.round((map.getCenter().lng - (minU + maxU) / 2) / 360);
        return [[Math.min(...lats), minU + shift], [Math.max(...lats), maxU + shift]];
    }
    const dLon = ((ptB.lon - ptA.lon + 180) % 360 + 360) % 360 - 180, endLonU = ptA.lon + dLon, shift = 360 * Math.round((map.getCenter().lng - (ptA.lon + endLonU) / 2) / 360);
    return [[Math.min(ptA.lat, ptB.lat), Math.min(ptA.lon, endLonU) + shift], [Math.max(ptA.lat, ptB.lat), Math.max(ptA.lon, endLonU) + shift]];
}

window.setPresetRoute = function(lat1, lon1, lat2, lon2) {
    isSosRouteActive = false; ptA = null; ptB = null;
    handleCoordinateSelect(lat1, lon1); handleCoordinateSelect(lat2, lon2);
    routeConfirmed = true; buildRoute(false); debouncedSaveCloudRoute();
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: (lat1 + lat2) / 2, lng: normalizeLon(lon1 + (((lon2 - lon1 + 180) % 360 + 360) % 360 - 180) / 2), altitude: 1.5 }, 1500);
    else map.flyToBounds(getCylindricalRouteBounds(), { padding: [50, 50] });
};

function isPointInAnyHazardZone(lat, lon) {
    for (const z of HAZARD_ZONES) if (isPointInPolygon(lat, lon, z.smoothCoords, z.bbox)) return true;
    return false;
}

function findNearestSafeZoneTarget(fromPt) {
    const ptInStorm = (typeof isPointInAnyActiveStorm === 'function') && isPointInAnyActiveStorm(fromPt.lat, fromPt.lon, 15);
    let currentSafeZone = null;
    for (const z of SAFE_ZONES) if (isPointInPolygon(fromPt.lat, fromPt.lon, z.smoothCoords, z.bbox)) { currentSafeZone = z; break; }
    if (currentSafeZone && !ptInStorm) {
        const localBase = MARS_BASES.find(b => b.zoneId === currentSafeZone.id);
        const tLat = localBase ? localBase.lat : currentSafeZone.centroid[0], tLon = localBase ? localBase.lon : currentSafeZone.centroid[1];
        if (!((typeof isPointInAnyActiveStorm === 'function') && isPointInAnyActiveStorm(tLat, tLon, 20))) {
            return { zone: currentSafeZone, base: localBase || null, lat: tLat, lon: tLon, distKm: calculateShortestMarsDistance(fromPt.lat, fromPt.lon, tLat, tLon), alreadyInsideSafe: true };
        }
    }
    let bestClear = null, bestAny = null;
    SAFE_ZONES.forEach(z => {
        const candidates = [], baseInZone = MARS_BASES.find(b => b.zoneId === z.id);
        if (baseInZone) candidates.push({ lat: baseInZone.lat, lon: baseInZone.lon, base: baseInZone });
        candidates.push({ lat: z.centroid[0], lon: z.centroid[1], base: baseInZone || null });
        const [cLat, cLon] = z.centroid;
        for (const v of z.smoothCoords) for (const t of [0.08, 0.18]) candidates.push({ lat: v[0] + (cLat - v[0]) * t, lon: v[1] + (cLon - v[1]) * t, base: baseInZone || null });
        for (const cand of candidates) {
            if (!isPointInPolygon(cand.lat, cand.lon, z.smoothCoords, z.bbox) || isPointInAnyHazardZone(cand.lat, cand.lon)) continue;
            const distKm = calculateShortestMarsDistance(fromPt.lat, fromPt.lon, cand.lat, cand.lon);
            const item = { zone: z, base: cand.base, lat: cand.lat, lon: cand.lon, distKm, alreadyInsideSafe: false };
            if (!bestAny || distKm < bestAny.distKm) bestAny = item;
            if (!((typeof isPointInAnyActiveStorm === 'function') && isPointInAnyActiveStorm(cand.lat, cand.lon, 25)) && (!bestClear || distKm < bestClear.distKm)) bestClear = item;
        }
    });
    return bestClear || bestAny;
}

window.triggerSOS = function() {
    if (!ptA) return showWarning('🆘 SOS: Спочатку встановіть Точку A (ровер) на мапі або оберіть базу!');
    const target = findNearestSafeZoneTarget(ptA);
    if (!target) return showWarning('🆘 SOS: Не вдалося знайти безпечну зону!');
    if (!hazardsAvoidanceActive) { hazardsAvoidanceActive = true; const btnH = document.getElementById('btnToggleHazards'); if (btnH) { btnH.classList.add('active'); btnH.innerText = 'A* ОБМЕЖЕННЯ: УВІМК'; } }
    ptB = { lat: Number(target.lat.toFixed(4)), lon: Number(normalizeLon(target.lon).toFixed(4)) };
    isSosRouteActive = true; activeRouteMode = 'safe'; routeConfirmed = true;
    updateMarkerLayers(); syncUI(); highlightSelectedZone(target.zone.id);
    navGridCache = {}; buildRoute(true); debouncedSaveCloudRoute();
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: (ptA.lat + ptB.lat) / 2, lng: normalizeLon(ptA.lon + (((ptB.lon - ptA.lon + 180) % 360 + 360) % 360 - 180) / 2), altitude: 1.5 }, 1300);
    const distKm = safeRouteData ? Math.round(safeRouteData.totalDist) : Math.round(target.distKm);
    showWarning(target.alreadyInsideSafe ? `🆘 SOS: Ровер у зоні "${target.zone.name}". Курс до притулку (~${distKm} км).` : `🆘 SOS ЕВАКУАЦІЯ: Перенаправлено до ${target.zone.name} (~${distKm} км).`);
};

document.getElementById('btnSosTop')?.addEventListener('click', window.triggerSOS);
document.getElementById('btnSosSidebar')?.addEventListener('click', window.triggerSOS);

// ============================================================================
// 9. ПЛАВНИЙ АЛГОРИТМ МАРШРУТИЗАЦІЇ (ANY-ANGLE A* + ELASTIC BAND + CATMULL-ROM)
// ============================================================================
const NAV_DEG = Math.PI / 180, NAV_KM_PER_DEG = MARS_RADIUS_KM * NAV_DEG;
const NAV_GRAD_BASE_DEG = 0.08, NAV_SAFE_LIMIT_DEG = 5.5, NAV_FAST_LIMIT_DEG = 25.0;

// 32 напрямки руху (крок кута ~11° замість 26.5°/45°) для відсутності ступінчастості
const NAV_DIRS = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
    [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
    [-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1],
    [-3, -2], [-3, 2], [-2, -3], [-2, 3], [2, -3], [2, 3], [3, -2], [3, 2]
];

class FastMinHeap {
    constructor(capacity = 1024) { this.nodes = new Int32Array(capacity); this.costs = new Float64Array(capacity); this.size = 0; }
    grow() { const cap = this.nodes.length * 2, n = new Int32Array(cap), c = new Float64Array(cap); n.set(this.nodes); c.set(this.costs); this.nodes = n; this.costs = c; }
    push(node, cost) {
        if (this.size === this.nodes.length) this.grow();
        let i = this.size++; this.nodes[i] = node; this.costs[i] = cost;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.costs[i] < this.costs[p]) {
                [this.nodes[i], this.nodes[p]] = [this.nodes[p], this.nodes[i]];
                [this.costs[i], this.costs[p]] = [this.costs[p], this.costs[i]];
                i = p;
            } else break;
        }
    }
    pop() {
        if (this.size === 0) return -1;
        const top = this.nodes[0], last = --this.size;
        this.nodes[0] = this.nodes[last]; this.costs[0] = this.costs[last];
        let i = 0; const half = this.size >> 1;
        while (i < half) {
            const l = (i << 1) + 1, r = l + 1;
            const best = (r < this.size && this.costs[r] < this.costs[l]) ? r : l;
            if (this.costs[best] < this.costs[i]) {
                [this.nodes[i], this.nodes[best]] = [this.nodes[best], this.nodes[i]];
                [this.costs[i], this.costs[best]] = [this.costs[best], this.costs[i]];
                i = best;
            } else break;
        }
        return top;
    }
}

// Двопрохідне перетворення відстаней (Chamfer Distance Transform) у кілометрах
function computeHazardDistanceFieldKm(insideH, rows, cols, dLatKm, dLonKm) {
    const total = rows * cols, INF = 1e6;
    const dist = new Float32Array(total);
    let anyHazard = false;
    for (let i = 0; i < total; i++) {
        if (insideH[i]) { dist[i] = 0; anyHazard = true; }
        else dist[i] = INF;
    }
    if (!anyHazard) return dist;

    const dDiag = Math.hypot(dLatKm, dLonKm);
    for (let r = 0; r < rows; r++) {
        const rowOff = r * cols;
        for (let c = 0; c < cols; c++) {
            const idx = rowOff + c;
            let best = dist[idx];
            if (best === 0) continue;
            if (r > 0) {
                const up = dist[idx - cols] + dLatKm;
                if (up < best) best = up;
                if (c > 0) { const ul = dist[idx - cols - 1] + dDiag; if (ul < best) best = ul; }
                if (c + 1 < cols) { const ur = dist[idx - cols + 1] + dDiag; if (ur < best) best = ur; }
            }
            if (c > 0) { const lf = dist[idx - 1] + dLonKm; if (lf < best) best = lf; }
            dist[idx] = best;
        }
    }
    for (let r = rows - 1; r >= 0; r--) {
        const rowOff = r * cols;
        for (let c = cols - 1; c >= 0; c--) {
            const idx = rowOff + c;
            let best = dist[idx];
            if (best === 0) continue;
            if (r + 1 < rows) {
                const dn = dist[idx + cols] + dLatKm;
                if (dn < best) best = dn;
                if (c + 1 < cols) { const dr = dist[idx + cols + 1] + dDiag; if (dr < best) best = dr; }
                if (c > 0) { const dl = dist[idx + cols - 1] + dDiag; if (dl < best) best = dl; }
            }
            if (c + 1 < cols) { const rt = dist[idx + 1] + dLonKm; if (rt < best) best = rt; }
            dist[idx] = best;
        }
    }
    return dist;
}

let navGridCache = {};
function buildTerrainGrid(startPt, endPt, padScale = 1) {
    const shortestDLon = ((endPt.lon - startPt.lon + 180) % 360 + 360) % 360 - 180;
    const endLonU = startPt.lon + shortestDLon;
    const latLo = Math.min(startPt.lat, endPt.lat), latHi = Math.max(startPt.lat, endPt.lat);
    const midLat = (latLo + latHi) * 0.5;
    const avgCos = Math.max(0.22, Math.cos(midLat * NAV_DEG));
    const spanDeg = Math.max(latHi - latLo, Math.abs(shortestDLon) * avgCos, 0.02);

    const basePad = spanDeg > 3 ? Math.max(6.0, 0.8 * spanDeg) : Math.max(0.05, 0.85 * spanDeg);
    const padLat = Math.min(72, basePad * padScale);
    const padLon = Math.min(135, padLat / avgCos);

    const minLat = Math.max(-88.5, latLo - padLat);
    const maxLat = Math.min(88.5, latHi + padLat);
    let minLon = Math.min(startPt.lon, endLonU) - padLon;
    let maxLon = Math.max(startPt.lon, endLonU) + padLon;
    if (maxLon - minLon > 352) {
        const extra = (maxLon - minLon - 352) / 2;
        minLon += extra; maxLon -= extra;
    }

    const tileZoom = MarsTileTerrainScanner.ensureBounds(minLat, maxLat, minLon, maxLon);
    const latRange = Math.max(1e-4, maxLat - minLat), lonRange = Math.max(1e-4, maxLon - minLon);
    const step = Math.max(0.0003, Math.max(latRange, lonRange) / 215);
    const rows = Math.max(16, Math.ceil(latRange / step) + 1);
    const cols = Math.max(16, Math.ceil(lonRange / step) + 1);
    const latStep = latRange / (rows - 1), lonStep = lonRange / (cols - 1), total = rows * cols;
    const dLatKm = latStep * NAV_KM_PER_DEG, dLonKm = lonStep * avgCos * NAV_KM_PER_DEG;
    const cellKm = Math.max(dLatKm, dLonKm);
    const stormSafetyMarginKm = Math.max(28, cellKm * 2.0);

    const latGrid = new Float64Array(rows), lonGrid = new Float64Array(cols);
    for (let r = 0; r < rows; r++) latGrid[r] = minLat + r * latStep;
    for (let c = 0; c < cols; c++) lonGrid[c] = minLon + c * lonStep;

    const elev = new Float32Array(total), grad = new Float32Array(total), rough = new Float32Array(total);
    const craterHaz = new Float32Array(total), zoneS = new Uint8Array(total), insideH = new Uint8Array(total);
    const gradStepDeg = Math.min(NAV_GRAD_BASE_DEG, Math.max(0.0004, Math.min(latStep, lonStep) * 0.5)), d = gradStepDeg / 2;

    for (let r = 0; r < rows; r++) {
        const lat = latGrid[r], cosLat = Math.max(0.06, Math.cos(lat * NAV_DEG));
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c, lonN = normalizeLon(lonGrid[c]);
            const e0 = getMolaElevationRaw(lat, lonN);
            elev[idx] = e0;
            const eN = getMolaElevationRaw(Math.min(90, lat + d), lonN), eS = getMolaElevationRaw(Math.max(-90, lat - d), lonN);
            const eE = getMolaElevationRaw(lat, normalizeLon(lonGrid[c] + d)), eW = getMolaElevationRaw(lat, normalizeLon(lonGrid[c] - d));
            const gLat = (eN - eS) / (gradStepDeg * NAV_KM_PER_DEG * 1000);
            const gLon = (eE - eW) / (gradStepDeg * NAV_KM_PER_DEG * cosLat * 1000);
            grad[idx] = Math.hypot(gLat, gLon);
            rough[idx] = Math.max(Math.abs(eN - e0), Math.abs(eS - e0), Math.abs(eE - e0), Math.abs(eW - e0));

            const cHaz = getCraterHazardAt(lat, lonN);
            const tHaz = MarsTileTerrainScanner.sampleAt(lat, lonN, tileZoom);
            craterHaz[idx] = Math.min(1.5, Math.max(cHaz, tHaz * 1.15));

            if (hazardsAvoidanceActive) {
                for (const z of HAZARD_ZONES) if (isPointInPolygon(lat, lonN, z.smoothCoords, z.bbox)) { insideH[idx] = 1; break; }
                if (!insideH[idx] && typeof isPointInAnyActiveStorm === 'function' && isPointInAnyActiveStorm(lat, lonN, stormSafetyMarginKm)) insideH[idx] = 1;
            }
            for (const z of SAFE_ZONES) if (isPointInPolygon(lat, lonN, z.smoothCoords, z.bbox)) { zoneS[idx] = 1; break; }
        }
    }

    const hazDistKm = computeHazardDistanceFieldKm(insideH, rows, cols, dLatKm, dLonKm);
    const hazBufferKm = Math.min(85, Math.max(3.5, cellKm * 7.5));
    const rawPot = new Float32Array(total);
    for (let i = 0; i < total; i++) {
        let p = 0;
        if (insideH[i]) p += 75;
        else if (hazDistKm[i] < hazBufferKm) {
            const u = 1 - hazDistKm[i] / hazBufferKm;
            p += 14.0 * u * u * (3 - 2 * u);
        }
        const ch = craterHaz[i];
        if (ch > 0.05) p += ch * ch * 36 + ch * 14;
        if (rough[i] > 35) p += Math.min(18, Math.pow((rough[i] - 35) / 85, 2) * 5.5);
        const slopeDeg = Math.atan(grad[i]) / NAV_DEG;
        if (slopeDeg > 2.0) p += Math.min(45, Math.pow((slopeDeg - 2.0) / 3.0, 2) * 4.5);
        if (zoneS[i] && !insideH[i]) p *= 0.82;
        rawPot[i] = p;
    }

    const softPotential = new Float32Array(total);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let sum = 0, wsum = 0;
            for (let dr = -1; dr <= 1; dr++) {
                const nr = r + dr; if (nr < 0 || nr >= rows) continue;
                for (let dc = -1; dc <= 1; dc++) {
                    const nc = c + dc; if (nc < 0 || nc >= cols) continue;
                    const w = (dr === 0 && dc === 0) ? 4 : (dr === 0 || dc === 0 ? 2 : 1);
                    sum += rawPot[nr * cols + nc] * w; wsum += w;
                }
            }
            softPotential[r * cols + c] = sum / wsum;
        }
    }

    const distTbl = new Float64Array(rows * NAV_DIRS.length).fill(Infinity);
    for (let r = 0; r < rows; r++) {
        for (let k = 0; k < NAV_DIRS.length; k++) {
            const nr = r + NAV_DIRS[k][0];
            if (nr >= 0 && nr < rows) distTbl[r * NAV_DIRS.length + k] = calculateMarsDistance(latGrid[r], 0, latGrid[nr], NAV_DIRS[k][1] * lonStep);
        }
    }
    return {
        rows, cols, total, minLat, maxLat, minLon, maxLon, latStep, lonStep,
        cellKm, dLatKm, dLonKm, avgCos, tileZoom, hazBufferKm,
        latGrid, lonGrid, elev, grad, rough, craterHaz, insideH, hazDistKm, zoneS, softPotential, distTbl, endLonU
    };
}

function sampleGridScalar(grid, arr, lat, lonU) {
    const fr = Math.max(0, Math.min(grid.rows - 1.0001, (lat - grid.minLat) / grid.latStep));
    const fc = Math.max(0, Math.min(grid.cols - 1.0001, (lonU - grid.minLon) / grid.lonStep));
    const r0 = Math.floor(fr), c0 = Math.floor(fc), r1 = Math.min(grid.rows - 1, r0 + 1), c1 = Math.min(grid.cols - 1, c0 + 1);
    const tr = fr - r0, tc = fc - c0;
    const v00 = arr[r0 * grid.cols + c0], v01 = arr[r0 * grid.cols + c1];
    const v10 = arr[r1 * grid.cols + c0], v11 = arr[r1 * grid.cols + c1];
    return (v00 * (1 - tc) + v01 * tc) * (1 - tr) + (v10 * (1 - tc) + v11 * tc) * tr;
}

function navSlopeFactor(thetaDeg, mode) {
    if (mode === 'safe') {
        let f = 1 + Math.pow(thetaDeg / 2.5, 2.0);
        if (thetaDeg > NAV_SAFE_LIMIT_DEG) f += 32 + 16 * Math.pow(thetaDeg - NAV_SAFE_LIMIT_DEG, 1.45);
        return f;
    }
    let f = 1 + (thetaDeg / 14) ** 2;
    if (thetaDeg > NAV_FAST_LIMIT_DEG) f += 38 + 22 * (thetaDeg - NAV_FAST_LIMIT_DEG);
    return f;
}

function navPointPenalty(grid, idx, mode) {
    if (mode === 'safe') {
        return [grid.softPotential[idx], grid.zoneS[idx] && !grid.insideH[idx] ? 0.88 : 1.0];
    }
    return [grid.insideH[idx] ? 0.15 : 0, 1.0];
}

function navEdgeCost(distKm, h1, h2, g1, g2, add, mul, mode) {
    const absDh = Math.abs(h2 - h1);
    const thetaDeg = Math.atan(Math.max(absDh / Math.max(1, distKm * 1000), 0.5 * (g1 + g2))) / NAV_DEG;
    const climbCost = mode === 'safe' ? absDh * 0.015 : absDh * 0.002;
    return distKm * (navSlopeFactor(thetaDeg, mode) + add) * mul + climbCost;
}

function getNavGrid(startPt, endPt, padScale = 1) {
    const tVer = MarsTileTerrainScanner.getVersion();
    const sKey = (typeof hasActiveStorms === 'function' && hasActiveStorms()) ? getActiveStormCacheKey() : 'ns';
    const key = `${startPt.lat.toFixed(4)},${startPt.lon.toFixed(4)}_${endPt.lat.toFixed(4)},${endPt.lon.toFixed(4)}_${padScale}_${hazardsAvoidanceActive ? 1 : 0}_${tVer}_${sKey}`;
    if (navGridCache[key]) return navGridCache[key];
    const keys = Object.keys(navGridCache);
    if (keys.length >= 10) delete navGridCache[keys[0]];
    const grid = buildTerrainGrid(startPt, endPt, padScale);
    navGridCache[key] = grid;
    return grid;
}

function planGridPath(grid, A, B, mode) {
    const rA = Math.max(0, Math.min(grid.rows - 1, Math.round((A.lat - grid.minLat) / grid.latStep)));
    const cA = Math.max(0, Math.min(grid.cols - 1, Math.round((A.lon - grid.minLon) / grid.lonStep)));
    const rB = Math.max(0, Math.min(grid.rows - 1, Math.round((B.lat - grid.minLat) / grid.latStep)));
    const cB = Math.max(0, Math.min(grid.cols - 1, Math.round((B.lon - grid.minLon) / grid.lonStep)));
    const startIdx = rA * grid.cols + cA, targetIdx = rB * grid.cols + cB;
    if (startIdx === targetIdx) return [];

    const isSafe = mode === 'safe', hScale = isSafe ? 0.86 : 0.99;
    const total = grid.total, gCost = new Float64Array(total).fill(Infinity), parent = new Int32Array(total).fill(-1), closed = new Uint8Array(total);
    const heap = new FastMinHeap(Math.min(total, 4096));
    const h = (r, c) => hScale * Math.hypot((grid.latGrid[r] - grid.latGrid[rB]) * NAV_KM_PER_DEG, (grid.lonGrid[c] - grid.lonGrid[cB]) * grid.avgCos * NAV_KM_PER_DEG);

    gCost[startIdx] = 0; heap.push(startIdx, h(rA, cA));
    let visited = 0, bestIdx = startIdx, bestDist = Infinity;

    while (heap.size > 0 && visited < total) {
        const u = heap.pop(); if (u < 0) break; if (closed[u]) continue;
        closed[u] = 1; visited++;
        const ur = Math.floor(u / grid.cols), uc = u % grid.cols, distToTgt = h(ur, uc);
        if (distToTgt < bestDist) { bestDist = distToTgt; bestIdx = u; }
        if (u === targetIdx) { bestIdx = u; break; }

        let hasPrev = false, dr1 = 0, dc1 = 0, len1 = 1;
        if (parent[u] >= 0) {
            const p = parent[u], pr = Math.floor(p / grid.cols), pc = p % grid.cols;
            dr1 = ur - pr; dc1 = uc - pc; len1 = Math.hypot(dr1, dc1) || 1;
            hasPrev = true;
        }

        for (let k = 0; k < NAV_DIRS.length; k++) {
            const dr2 = NAV_DIRS[k][0], dc2 = NAV_DIRS[k][1];
            const nr = ur + dr2, nc = uc + dc2;
            if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols) continue;
            const v = nr * grid.cols + nc; if (closed[v]) continue;

            const maxStep = Math.max(Math.abs(dr2), Math.abs(dc2));
            let midAdd = 0, blockedJump = false;
            if (maxStep > 1) {
                for (let s = 1; s < maxStep; s++) {
                    const mr = ur + Math.round((dr2 * s) / maxStep), mc = uc + Math.round((dc2 * s) / maxStep);
                    const midIdx = mr * grid.cols + mc;
                    if (isSafe && grid.insideH[midIdx] && !grid.insideH[u] && !grid.insideH[v]) { blockedJump = true; break; }
                    midAdd = Math.max(midAdd, navPointPenalty(grid, midIdx, mode)[0]);
                }
                if (blockedJump) continue;
            }

            let distKm = grid.distTbl[ur * NAV_DIRS.length + k];
            if (!isFinite(distKm) || distKm <= 0) distKm = grid.cellKm * Math.hypot(dr2, dc2);

            const [vAdd, mul] = navPointPenalty(grid, v, mode);
            const [uAdd] = navPointPenalty(grid, u, mode);
            const add = Math.max(vAdd, midAdd, 0.5 * (uAdd + vAdd));
            let stepCost = navEdgeCost(distKm, grid.elev[u], grid.elev[v], grid.grad[u], grid.grad[v], add, mul, mode);

            if (hasPrev) {
                const cosTurn = (dr1 * dr2 + dc1 * dc2) / (len1 * Math.hypot(dr2, dc2));
                stepCost += (1 - cosTurn) * (isSafe ? 0.22 : 0.08) * distKm;
            }

            const tentative = gCost[u] + stepCost;
            if (tentative < gCost[v]) { gCost[v] = tentative; parent[v] = u; heap.push(v, tentative + h(nr, nc)); }
        }
    }

    const pathNodes = []; let curr = bestIdx;
    while (curr >= 0 && curr !== startIdx) {
        pathNodes.push({ lat: grid.latGrid[Math.floor(curr / grid.cols)], lon: grid.lonGrid[curr % grid.cols] });
        curr = parent[curr];
    }
    pathNodes.reverse();
    return pathNodes;
}

function isPointBlockedForSafe(lat, lonU, grid) {
    const lon = normalizeLon(lonU);
    if (hazardsAvoidanceActive) {
        for (const z of HAZARD_ZONES) if (isPointInPolygon(lat, lon, z.smoothCoords, z.bbox)) return true;
        if (typeof isPointInAnyActiveStorm === 'function' && isPointInAnyActiveStorm(lat, lon, 22)) return true;
    }
    if (getCraterHazardAt(lat, lon) > 0.22) return true;
    if (grid && MarsTileTerrainScanner.sampleAt(lat, lon, grid.tileZoom) > 0.32) return true;
    return false;
}

function evaluateContinuousSegmentCost(pA, pB, grid, mode, checkSafety = true) {
    const totalKm = calculateMarsDistance(pA.lat, pA.lon, pB.lat, pB.lon);
    if (totalKm < 1e-5) return 0;
    const sampleStepKm = Math.max(0.15, grid.cellKm * 0.75);
    const steps = Math.max(2, Math.min(80, Math.ceil(totalKm / sampleStepKm)));
    const segKm = totalKm / steps;
    const startBlocked = checkSafety ? isPointBlockedForSafe(pA.lat, pA.lon, grid) : false;
    const endBlocked = checkSafety ? isPointBlockedForSafe(pB.lat, pB.lon, grid) : false;

    let cost = 0;
    let prevLat = pA.lat, prevLon = pA.lon;
    let prevH = sampleGridScalar(grid, grid.elev, prevLat, prevLon);
    let prevG = sampleGridScalar(grid, grid.grad, prevLat, prevLon);

    for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const lat = pA.lat + (pB.lat - pA.lat) * t;
        const lon = pA.lon + (pB.lon - pA.lon) * t;
        if (checkSafety && !startBlocked && !endBlocked && s < steps && isPointBlockedForSafe(lat, lon, grid)) {
            return Infinity;
        }
        const h = sampleGridScalar(grid, grid.elev, lat, lon);
        const g = sampleGridScalar(grid, grid.grad, lat, lon);
        if (checkSafety) {
            const slopeDeg = Math.atan(Math.abs(h - prevH) / Math.max(1, segKm * 1000)) / NAV_DEG;
            if (slopeDeg > NAV_SAFE_LIMIT_DEG + 1.5) return Infinity;
        }
        const add = mode === 'safe'
            ? sampleGridScalar(grid, grid.softPotential, lat, lon)
            : (sampleGridScalar(grid, grid.insideH, lat, lon) > 0.5 ? 0.15 : 0);
        const zs = mode === 'safe' ? sampleGridScalar(grid, grid.zoneS, lat, lon) : 0;
        const mul = (mode === 'safe' && zs > 0.5) ? 0.88 : 1.0;
        cost += navEdgeCost(segKm, prevH, h, prevG, g, add, mul, mode);
        prevLat = lat; prevLon = lon; prevH = h; prevG = g;
    }
    return cost;
}

function stringPullNavPath(grid, nodes, mode) {
    if (!nodes || nodes.length <= 2) return nodes || [];
    const n = nodes.length;
    const cumCost = new Float64Array(n);
    for (let i = 1; i < n; i++) {
        const c = evaluateContinuousSegmentCost(nodes[i - 1], nodes[i], grid, mode, false);
        cumCost[i] = cumCost[i - 1] + (isFinite(c) ? c : calculateMarsDistance(nodes[i - 1].lat, nodes[i - 1].lon, nodes[i].lat, nodes[i].lon));
    }

    const isSafe = mode === 'safe';
    const tol = isSafe ? 1.045 : 1.035;
    const maxLookahead = isSafe ? 48 : 85;
    const out = [nodes[0]];
    let i = 0;

    while (i < n - 1) {
        let bestJ = i + 1;
        const limit = Math.min(n - 1, i + maxLookahead);
        for (let j = limit; j > i + 1; j--) {
            const refCost = cumCost[j] - cumCost[i];
            const directCost = evaluateContinuousSegmentCost(nodes[i], nodes[j], grid, mode, isSafe);
            if (directCost <= refCost * tol) {
                bestJ = j;
                break;
            }
        }
        out.push(nodes[bestJ]);
        i = bestJ;
    }
    return out;
}

const NAV_MAX_STEP_KM = 14, NAV_MAX_POINTS = 1000;
function navPolylineLength(nodes) {
    let L = 0;
    for (let i = 1; i < nodes.length; i++) L += calculateMarsDistance(nodes[i - 1].lat, nodes[i - 1].lon, nodes[i].lat, nodes[i].lon);
    return L;
}

function resampleNavPath(nodes, desiredStepKm = 6, maxSteps = NAV_MAX_POINTS) {
    if (!nodes || nodes.length === 0) return { pts: [], L: 0 };
    if (nodes.length === 1) return { pts: [{ lat: nodes[0].lat, lonU: nodes[0].lon }], L: 0 };
    const cum = [0]; let totalL = 0;
    for (let i = 1; i < nodes.length; i++) {
        totalL += calculateMarsDistance(nodes[i - 1].lat, nodes[i - 1].lon, nodes[i].lat, nodes[i].lon);
        cum.push(totalL);
    }
    if (totalL < 1e-4) return { pts: [{ lat: nodes[0].lat, lonU: nodes[0].lon }, { lat: nodes[nodes.length - 1].lat, lonU: nodes[nodes.length - 1].lon }], L: totalL };
    const steps = Math.max(16, Math.min(maxSteps, Math.round(totalL / Math.max(0.02, desiredStepKm)))), pts = [];
    let segIdx = 0;
    for (let s = 0; s <= steps; s++) {
        const targetDist = (s / steps) * totalL;
        while (segIdx < cum.length - 2 && cum[segIdx + 1] < targetDist) segIdx++;
        const p1 = nodes[segIdx], p2 = nodes[segIdx + 1];
        const t = Math.max(0, Math.min(1, (targetDist - cum[segIdx]) / Math.max(1e-6, cum[segIdx + 1] - cum[segIdx])));
        pts.push({ lat: p1.lat + (p2.lat - p1.lat) * t, lonU: p1.lon + (p2.lon - p1.lon) * t });
    }
    return { pts, L: totalL };
}

function elasticSmoothNavPath(pts, mode, grid, iterations = 65) {
    const n = pts.length;
    if (n < 4) return pts;
    const isSafe = mode === 'safe';
    const P = pts.map(p => ({ lat: p.lat, lonU: p.lonU }));
    const origBlocked = isSafe ? P.map(p => isPointBlockedForSafe(p.lat, p.lonU, grid)) : null;

    const epsLat = grid.latStep * 0.85;
    const epsLon = grid.lonStep * 0.85;
    const repelScaleLat = isSafe ? grid.latStep * 0.055 : 0;
    const repelScaleLon = isSafe ? grid.lonStep * 0.055 : 0;

    for (let it = 0; it < iterations; it++) {
        const alpha = isSafe ? 0.36 : 0.42;
        const beta = 0.08;
        for (let i = 1; i < n - 1; i++) {
            const cur = P[i];
            const lapLat = 0.5 * (P[i - 1].lat + P[i + 1].lat) - cur.lat;
            const lapLon = 0.5 * (P[i - 1].lonU + P[i + 1].lonU) - cur.lonU;

            let bihLat = 0, bihLon = 0;
            if (i >= 2 && i <= n - 3) {
                bihLat = (-P[i - 2].lat + 4 * P[i - 1].lat - 6 * cur.lat + 4 * P[i + 1].lat - P[i + 2].lat) / 16;
                bihLon = (-P[i - 2].lonU + 4 * P[i - 1].lonU - 6 * cur.lonU + 4 * P[i + 1].lonU - P[i + 2].lonU) / 16;
            }

            let repLat = 0, repLon = 0;
            if (isSafe) {
                const pN = sampleGridScalar(grid, grid.softPotential, cur.lat + epsLat, cur.lonU);
                const pS = sampleGridScalar(grid, grid.softPotential, cur.lat - epsLat, cur.lonU);
                const pE = sampleGridScalar(grid, grid.softPotential, cur.lat, cur.lonU + epsLon);
                const pW = sampleGridScalar(grid, grid.softPotential, cur.lat, cur.lonU - epsLon);
                const gLat = (pN - pS) / (2 * epsLat), gLon = (pE - pW) / (2 * epsLon);
                const gMag = Math.hypot(gLat, gLon);
                if (gMag > 1e-4) {
                    const clampMag = Math.min(1.8, gMag * 0.08);
                    repLat = -(gLat / gMag) * clampMag * repelScaleLat;
                    repLon = -(gLon / gMag) * clampMag * repelScaleLon;
                }
            }

            const nLat = Math.max(grid.minLat + 0.001, Math.min(grid.maxLat - 0.001, cur.lat + alpha * lapLat + beta * bihLat + repLat));
            const nLon = Math.max(grid.minLon + 0.001, Math.min(grid.maxLon - 0.001, cur.lonU + alpha * lapLon + beta * bihLon + repLon));

            if (isSafe && !origBlocked[i] && isPointBlockedForSafe(nLat, nLon, grid)) {
                const halfLat = 0.5 * (cur.lat + nLat), halfLon = 0.5 * (cur.lonU + nLon);
                if (!isPointBlockedForSafe(halfLat, halfLon, grid)) {
                    cur.lat = halfLat; cur.lonU = halfLon;
                }
                continue;
            }
            cur.lat = nLat;
            cur.lonU = nLon;
        }
    }
    return P;
}

function catmullRomSubdivide(pts, mode, grid, subdivisions = 3) {
    if (!pts || pts.length < 3) return pts || [];
    const isSafe = mode === 'safe';
    const out = [];
    const n = pts.length;

    const getPt = (idx) => {
        if (idx < 0) return { lat: 2 * pts[0].lat - pts[1].lat, lonU: 2 * pts[0].lonU - pts[1].lonU };
        if (idx >= n) return { lat: 2 * pts[n - 1].lat - pts[n - 2].lat, lonU: 2 * pts[n - 1].lonU - pts[n - 2].lonU };
        return pts[idx];
    };

    const knotDist = (a, b) => Math.pow(Math.max(1e-5, Math.hypot(b.lat - a.lat, (b.lonU - a.lonU) * (grid ? grid.avgCos : 1))), 0.5);

    for (let i = 0; i < n - 1; i++) {
        const p0 = getPt(i - 1), p1 = getPt(i), p2 = getPt(i + 1), p3 = getPt(i + 2);
        const t0 = 0, t1 = t0 + knotDist(p0, p1), t2 = t1 + knotDist(p1, p2), t3 = t2 + knotDist(p2, p3);
        const segSafe = isSafe && !isPointBlockedForSafe(p1.lat, p1.lonU, grid) && !isPointBlockedForSafe(p2.lat, p2.lonU, grid);

        for (let s = 0; s < subdivisions; s++) {
            if (s === 0) { out.push({ lat: p1.lat, lonU: p1.lonU }); continue; }
            const u = s / subdivisions;
            const t = t1 + u * (t2 - t1);

            const interp = (a, b, ta, tb) => {
                const denom = Math.max(1e-6, tb - ta), w1 = (tb - t) / denom, w2 = (t - ta) / denom;
                return { lat: a.lat * w1 + b.lat * w2, lonU: a.lonU * w1 + b.lonU * w2 };
            };
            const A1 = interp(p0, p1, t0, t1), A2 = interp(p1, p2, t1, t2), A3 = interp(p2, p3, t2, t3);
            const B1 = interp(A1, A2, t0, t2), B2 = interp(A2, A3, t1, t3);
            let C = interp(B1, B2, t1, t2);
            C.lat = Math.max(-89.5, Math.min(89.5, C.lat));

            if (segSafe && isPointBlockedForSafe(C.lat, C.lonU, grid)) {
                C = { lat: p1.lat + (p2.lat - p1.lat) * u, lonU: p1.lonU + (p2.lonU - p1.lonU) * u };
            }
            out.push(C);
        }
    }
    out.push({ lat: pts[n - 1].lat, lonU: pts[n - 1].lonU });
    return out;
}

function smoothAltitudeProfile(alts, stepKm, totalKm = 100, mode = 'safe') {
    const n = alts.length; if (n < 5) return alts.slice();
    const isSafe = mode === 'safe';
    const sigma = isSafe
        ? Math.max(2.5 * stepKm, Math.min(28, totalKm * 0.10))
        : Math.max(1.2 * stepKm, Math.min(8, totalKm * 0.03));
    const half = Math.min(n - 1, Math.ceil(3 * sigma / Math.max(stepKm, 1e-6))), w = [];
    for (let k = -half; k <= half; k++) w.push(Math.exp(-0.5 * (k * stepKm / sigma) ** 2));
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        let sum = 0, wsum = 0;
        for (let k = -half; k <= half; k++) {
            const j = i + k;
            if (j >= 0 && j < n) { sum += alts[j] * w[k + half]; wsum += w[k + half]; }
        }
        out[i] = alts[i] + (sum / wsum - alts[i]) * Math.min(1, (Math.min(i, n - 1 - i) * stepKm) / (1.5 * sigma));
    }
    const passes = isSafe ? 12 : 4;
    for (let pass = 0; pass < passes; pass++) {
        for (let i = 1; i < n - 1; i++) out[i] = 0.25 * out[i - 1] + 0.5 * out[i] + 0.25 * out[i + 1];
    }
    const maxSlopeDeg = isSafe ? 6.5 : 28.0;
    const maxDh = Math.tan(maxSlopeDeg * NAV_DEG) * stepKm * 1000;
    for (let i = 1; i < n; i++) out[i] = Math.max(out[i - 1] - maxDh, Math.min(out[i - 1] + maxDh, out[i]));
    for (let i = n - 2; i >= 0; i--) out[i] = Math.max(out[i + 1] - maxDh, Math.min(out[i + 1] + maxDh, out[i]));
    return out.map(v => Number(v.toFixed(2)));
}

function buildRouteStatsFromContinuousPts(pts, mode, directKm, tileZoom = 5, wpCount = 0) {
    const segKm = [0];
    for (let i = 1; i < pts.length; i++) segKm.push(calculateMarsDistance(pts[i - 1].lat, pts[i - 1].lonU, pts[i].lat, pts[i].lonU));
    const L = segKm.reduce((x, y) => x + y, 0), spacing = L / Math.max(1, pts.length - 1);
    const smoothAlts = smoothAltitudeProfile(pts.map(p => getMolaElevationRaw(p.lat, normalizeLon(p.lonU))), spacing, L, mode);

    const getHazardAt = (lat, lon) => {
        for (const z of HAZARD_ZONES) if (isPointInPolygon(lat, lon, z.smoothCoords, z.bbox)) return { inHazard: true, name: z.name };
        if (typeof isPointInAnyActiveStorm === 'function' && isPointInAnyActiveStorm(lat, lon, 0)) return { inHazard: true, name: 'Активна пилова буря' };
        return { inHazard: false, name: null };
    };

    const path = pts.map((p, idx) => {
        const lon = normalizeLon(p.lonU), haz = getHazardAt(p.lat, lon);
        return { lat: p.lat, lon, unwrappedLon: p.lonU, alt: smoothAlts[idx], inHazard: haz.inHazard, hazardName: haz.name, cumDistKm: 0, cumNormalHours: 0, cumHazardBaseHours: 0, cumHazardHours: 0, cumHours: 0 };
    });

    let normalHours = 0, hazardBaseHours = 0, hazardDoubledHours = 0, totalHours = 0, hazardDistKm = 0;
    for (let i = 1; i < path.length; i++) {
        const segBaseHours = segKm[i] / 30;
        if (path[i].inHazard) {
            hazardDistKm += segKm[i];
            hazardBaseHours += segBaseHours;
            hazardDoubledHours += segBaseHours * 2;
            totalHours += segBaseHours * 2;
        } else {
            normalHours += segBaseHours;
            totalHours += segBaseHours;
        }
        path[i].cumDistKm = path[i - 1].cumDistKm + segKm[i];
        path[i].cumNormalHours = normalHours;
        path[i].cumHazardBaseHours = hazardBaseHours;
        path[i].cumHazardHours = hazardDoubledHours;
        path[i].cumHours = totalHours;
    }

    let asc = 0, desc = 0;
    for (let i = 1; i < path.length; i++) {
        const diff = path[i].alt - path[i - 1].alt;
        if (diff > 0) asc += diff; else desc -= diff;
    }

    const slopeWindowKm = Math.min(8, Math.max(0.2, L * 0.04)), k = Math.max(1, Math.ceil(slopeWindowKm / Math.max(spacing, 1e-6)));
    let peakSlope = 0, steepCount = 0, windows = 0;
    for (let i = 0; i + k < path.length; i++) {
        const slope = Math.atan(Math.abs(path[i + k].alt - path[i].alt) / Math.max(1, k * spacing * 1000)) / NAV_DEG;
        if (slope > peakSlope) peakSlope = slope;
        if (slope > 6) steepCount++;
        windows++;
    }
    const steepFrac = windows ? steepCount / windows : 0;

    let hazardHits = 0, stormHits = 0, craterHits = 0;
    for (const pt of path) {
        for (const z of HAZARD_ZONES) if (isPointInPolygon(pt.lat, pt.lon, z.smoothCoords, z.bbox)) { hazardHits++; break; }
        if (typeof isPointInAnyActiveStorm === 'function' && isPointInAnyActiveStorm(pt.lat, pt.lon, 0)) stormHits++;
        if (getCraterHazardAt(pt.lat, pt.lon) > 0.25 || MarsTileTerrainScanner.sampleAt(pt.lat, pt.lon, tileZoom) > 0.30) craterHits++;
    }
    hazardHits += stormHits;
    const hazardKm = hazardHits * spacing, hazardFrac = hazardHits / path.length, craterFrac = craterHits / path.length;
    const detourPct = directKm > 0.05 ? Math.max(0, (L / directKm - 1) * 100) : 0;
    const safetyScore = Math.max(5, Math.min(99, Math.round(100 - 120 * hazardFrac - 45 * craterFrac - 55 * steepFrac - 1.8 * Math.max(0, peakSlope - 6) - (hazardHits > 0 ? 8 : 0))));

    let diagnosis;
    if (wpCount > 0) {
        diagnosis = mode === 'safe'
            ? `БЕЗПЕЧНИЙ МАРШРУТ (через ${wpCount} вейпоінт${wpCount > 1 ? 'и' : ''}): дистанція ${L < 50 ? L.toFixed(1) : Math.round(L)} км, макс. нахил ${peakSlope.toFixed(1)}°.`
            : `ШВИДКИЙ МАРШРУТ (через ${wpCount} вейпоінт${wpCount > 1 ? 'и' : ''}): дистанція ${L < 50 ? L.toFixed(1) : Math.round(L)} км, час ${formatMarsDuration(totalHours)}.`;
        if (hazardHits > 0) diagnosis += ` ⚠️ У небезпечних зонах ≈ ${Math.round(hazardKm)} км (час ×2).`;
    } else if (mode === 'safe') {
        if (!hazardsAvoidanceActive) diagnosis = `ОБХІД ЗОН ВИМКНЕНО: маршрут оптимізовано лише за рельєфом. Макс. нахил ${peakSlope.toFixed(1)}°.`;
        else if (hazardHits === 0) diagnosis = `БЕЗПЕЧНИЙ МАРШРУТ: небезпечні зони та рухомі бурі оминуто. Макс. нахил ${peakSlope.toFixed(1)}°, подовження до ортодромії +${detourPct.toFixed(0)}%.`;
        else diagnosis = stormHits > 0
            ? `⚠️ УВАГА: маршрут перетинає рухому пилову бурю (≈ ${Math.round(stormHits * spacing)} км). Час у небезпеці ×2.`
            : `УВАГА: повний обхід неможливий — траверс небезпечних зон ≈ ${Math.round(hazardKm)} км (час у зоні ×2).`;
    } else {
        diagnosis = `ШВИДКИЙ МАРШРУТ: мінімальні витрати без обходу зон. Макс. нахил ${peakSlope.toFixed(1)}°, у небезпечних зонах ≈ ${Math.round(hazardKm)} км (час ×2).`;
    }

    return { path, totalDist: L, hazardDistKm, totalHours, normalHours, hazardBaseHours, hazardDoubledHours, maxSlope: peakSlope, totalAsc: asc, totalDesc: desc, safety: safetyScore, scanDiagnosis: diagnosis, hazardHits };
}

function computeLegControlPoints(startPt, endPt, mode, padScale = 1) {
    const grid = getNavGrid(startPt, endPt, padScale);
    const A = { lat: startPt.lat, lon: startPt.lon }, B = { lat: endPt.lat, lon: grid.endLonU };
    const directKm = calculateMarsDistance(A.lat, A.lon, B.lat, B.lon);
    if (directKm <= 0.05) {
        return { pts: [{ lat: A.lat, lonU: A.lon }, { lat: B.lat, lonU: B.lon }], directKm, grid };
    }

    const rawNodes = [A, ...planGridPath(grid, A, B, mode), B];
    const pulled = stringPullNavPath(grid, rawNodes, mode);
    const roughL = navPolylineLength(pulled);
    const coarseStepKm = Math.max(0.05, Math.min(NAV_MAX_STEP_KM * 1.6, roughL / 140));
    let pts = resampleNavPath(pulled, coarseStepKm, 220).pts;
    pts = elasticSmoothNavPath(pts, mode, grid, mode === 'safe' ? 65 : 35);
    return { pts, directKm, grid };
}

function computeNavRoute(startPt, endPt, mode, padScale = 1) {
    const { pts: controlPts, directKm, grid } = computeLegControlPoints(startPt, endPt, mode, padScale);
    let smoothPts = catmullRomSubdivide(controlPts, mode, grid, 3);
    const fineStepKm = Math.max(0.04, Math.min(NAV_MAX_STEP_KM, navPolylineLength(smoothPts.map(p => ({ lat: p.lat, lon: p.lonU }))) / 380));
    smoothPts = resampleNavPath(smoothPts.map(p => ({ lat: p.lat, lon: p.lonU })), fineStepKm, 520).pts;
    return buildRouteStatsFromContinuousPts(smoothPts, mode, directKm, grid.tileZoom, 0);
}

function computeMultiStopRoute(allPoints, mode) {
    if (!allPoints || allPoints.length < 2) return null;
    if (allPoints.length === 2) return computeNavRoute(allPoints[0], allPoints[1], mode);

    const combinedCtrl = [];
    const pinnedIndices = new Set([0]);
    let totalDirectKm = 0, lonShift = 0, maxTileZoom = 4;

    for (let i = 0; i < allPoints.length - 1; i++) {
        const leg = computeLegControlPoints(allPoints[i], allPoints[i + 1], mode);
        totalDirectKm += leg.directKm;
        if (leg.grid.tileZoom > maxTileZoom) maxTileZoom = leg.grid.tileZoom;

        const legPts = leg.pts;
        if (i === 0) {
            lonShift = 0;
            for (let k = 0; k < legPts.length; k++) combinedCtrl.push({ lat: legPts[k].lat, lonU: legPts[k].lonU });
        } else {
            const prevEndLonU = combinedCtrl[combinedCtrl.length - 1].lonU;
            lonShift = prevEndLonU - legPts[0].lonU;
            for (let k = 1; k < legPts.length; k++) combinedCtrl.push({ lat: legPts[k].lat, lonU: legPts[k].lonU + lonShift });
        }
        pinnedIndices.add(combinedCtrl.length - 1);
    }

    for (let pass = 0; pass < 14; pass++) {
        for (let i = 1; i < combinedCtrl.length - 1; i++) {
            if (pinnedIndices.has(i)) continue;
            const nLat = 0.25 * combinedCtrl[i - 1].lat + 0.5 * combinedCtrl[i].lat + 0.25 * combinedCtrl[i + 1].lat;
            const nLon = 0.25 * combinedCtrl[i - 1].lonU + 0.5 * combinedCtrl[i].lonU + 0.25 * combinedCtrl[i + 1].lonU;
            if (mode === 'safe' && !isPointBlockedForSafe(combinedCtrl[i].lat, combinedCtrl[i].lonU, null) && isPointBlockedForSafe(nLat, nLon, null)) continue;
            combinedCtrl[i].lat = nLat;
            combinedCtrl[i].lonU = nLon;
        }
    }

    let smoothPts = catmullRomSubdivide(combinedCtrl, mode, null, 3);
    const totalLen = navPolylineLength(smoothPts.map(p => ({ lat: p.lat, lon: p.lonU })));
    const fineStepKm = Math.max(0.04, Math.min(NAV_MAX_STEP_KM, totalLen / 460));
    smoothPts = resampleNavPath(smoothPts.map(p => ({ lat: p.lat, lon: p.lonU })), fineStepKm, 650).pts;
    return buildRouteStatsFromContinuousPts(smoothPts, mode, totalDirectKm, maxTileZoom, allPoints.length - 2);
}

function runRealTerrainAStar(startPt, endPt, mode) {
    return computeMultiStopRoute([startPt, ...(waypoints || []).filter(w => w && typeof w.lat === 'number' && typeof w.lon === 'number'), endPt], mode);
}

// ============================================================================
// 10. ВІДОБРАЖЕННЯ, ПЛАВНА АНІМАЦІЯ ПРОМАЛЬОВКИ, ТАЙМЕР І ПРИПАСИ
// ============================================================================
let routeRevealRafId = null;

function attachRouteTooltip(polyline, modeName, color) {
    polyline.bindTooltip('', { sticky: true, className: 'mars-tooltip' });
    polyline.on('mousemove', (e) => {
        const lat = Math.max(-90, Math.min(90, e.latlng.lat)), lon = normalizeLon(e.latlng.lng), alt = getMolaElevation(lat, lon);
        updateTelemetry(lat, lon);
        polyline.setTooltipContent(`<div style="font-family:'Space Grotesk',sans-serif; font-size:11px; line-height:1.4;"><span style="color:${color}; font-weight:700;">● ${modeName}</span><br><span style="font-family:'Space Mono',monospace; color:#FFF; font-weight:700; font-size:12px;">ВИСОТА: ${alt > 0 ? '+' : ''}${alt} м</span></div>`);
    });
}

function sliceRoutePathByRatio(path, ratio) {
    if (!path || path.length < 2 || ratio >= 0.999) return path;
    const exact = Math.max(1, ratio * (path.length - 1));
    const idx = Math.floor(exact), frac = exact - idx;
    const sliced = path.slice(0, idx + 1);
    if (idx + 1 < path.length && frac > 1e-3) {
        const a = path[idx], b = path[idx + 1];
        const uLon = a.unwrappedLon + (b.unwrappedLon - a.unwrappedLon) * frac;
        sliced.push({ lat: a.lat + (b.lat - a.lat) * frac, lon: normalizeLon(uLon), unwrappedLon: uLon });
    }
    return sliced;
}

function renderMultiWorldPolyline(group, segments, styleOptions, tooltipModeName, color, withCasing = false) {
    group.clearLayers();
    activeWorldOffsets.forEach(offset => {
        const shifted = segments.map(seg => seg.map(pt => [pt[0], pt[1] + offset * 360]));
        if (withCasing) {
            group.addLayer(L.polyline(shifted, {
                color: 'rgba(15, 23, 42, 0.58)',
                weight: (styleOptions.weight || 5) + 3.2,
                opacity: (styleOptions.opacity ?? 1) * 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                smoothFactor: 0.6,
                interactive: false,
                className: 'mars-route-line'
            }));
        }
        const line = L.polyline(shifted, {
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 0.6,
            className: 'mars-route-line',
            ...styleOptions
        });
        attachRouteTooltip(line, tooltipModeName, color);
        group.addLayer(line);
    });
}

function drawAllRoutes2D(animate = false) {
    if (routeRevealRafId) { cancelAnimationFrame(routeRevealRafId); routeRevealRafId = null; }
    if (!safeRouteData || !fastRouteData) return;

    const renderAtRatio = (ratio) => {
        const isSafeAct = activeRouteMode === 'safe';
        const fastSegs = splitPathAtAntimeridian(sliceRoutePathByRatio(fastRouteData.path, ratio));
        const safeSegs = splitPathAtAntimeridian(sliceRoutePathByRatio(safeRouteData.path, ratio));

        if (isSafeAct) {
            renderMultiWorldPolyline(fastPolylineGroup, fastSegs, { color: '#FF2E38', weight: 2.6, opacity: 0.38, dashArray: '6, 6' }, 'ШВИДКИЙ МАРШРУТ', '#FF2E38', false);
            renderMultiWorldPolyline(safePolylineGroup, safeSegs, { color: '#00FFAA', weight: 5.2, opacity: 1.0 }, 'БЕЗПЕЧНИЙ МАРШРУТ', '#00FFAA', true);
        } else {
            renderMultiWorldPolyline(safePolylineGroup, safeSegs, { color: '#00FFAA', weight: 2.6, opacity: 0.38, dashArray: '6, 6' }, 'БЕЗПЕЧНИЙ МАРШРУТ', '#00FFAA', false);
            renderMultiWorldPolyline(fastPolylineGroup, fastSegs, { color: '#FF2E38', weight: 5.2, opacity: 1.0 }, 'ШВИДКИЙ МАРШРУТ', '#FF2E38', true);
        }
    };

    if (!animate || is3DMode) {
        renderAtRatio(1);
        return;
    }

    const startTs = performance.now(), durationMs = 420;
    const stepAnim = (now) => {
        const t = Math.min(1, (now - startTs) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        renderAtRatio(Math.max(0.03, eased));
        if (t < 1) routeRevealRafId = requestAnimationFrame(stepAnim);
        else routeRevealRafId = null;
    };
    routeRevealRafId = requestAnimationFrame(stepAnim);
}

function formatMarsDuration(hours) { const totalMin = Math.max(0, Math.round(hours * 60)), h = Math.floor(totalMin / 60), m = totalMin % 60; return h === 0 ? `${m} хв` : `${h} год ${String(m).padStart(2, '0')} хв`; }
function formatTimerHMS(hours) { const t = Math.max(0, Math.round(hours * 3600)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }

const routeTimerState = { progress: 0, running: false, intervalId: null, lastTick: 0, currentPt: null };
function getActiveRouteObj() { return activeRouteMode === 'fast' ? fastRouteData : safeRouteData; }

function sampleRouteAtProgress(data, progress) {
    if (!data || !data.path || !data.path.length) return null;
    if (data.path.length === 1) return data.path[0];
    const p = Math.max(0, Math.min(1, progress)), exactIdx = p * (data.path.length - 1), i0 = Math.floor(exactIdx), i1 = Math.min(data.path.length - 1, i0 + 1), frac = exactIdx - i0;
    const a = data.path[i0], b = data.path[i1], inHazard = frac < 0.5 ? a.inHazard : b.inHazard;
    return { cumNormalHours: a.cumNormalHours + (b.cumNormalHours - a.cumNormalHours) * frac, cumHazardBaseHours: a.cumHazardBaseHours + (b.cumHazardBaseHours - a.cumHazardBaseHours) * frac, cumHazardHours: a.cumHazardHours + (b.cumHazardHours - a.cumHazardHours) * frac, cumHours: a.cumHours + (b.cumHours - a.cumHours) * frac, inHazard, hazardName: inHazard ? (b.hazardName || a.hazardName) : null };
}

function buildTimerTrackGradient(path) {
    if (!path || path.length < 2) return '#E2E8F0';
    const stops = []; let prevHaz = path[0].inHazard, startPct = 0;
    for (let i = 1; i < path.length; i++) {
        const pct = (i / (path.length - 1)) * 100;
        if (path[i].inHazard !== prevHaz || i === path.length - 1) { stops.push(`${prevHaz ? 'rgba(255, 46, 56, 0.38)' : 'rgba(16, 185, 129, 0.22)'} ${startPct.toFixed(1)}% ${pct.toFixed(1)}%`); prevHaz = path[i].inHazard; startPct = pct; }
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function updateRouteTimerUI() {
    const data = getActiveRouteObj(), box = document.getElementById('routeTimerBox'); if (!data || !box) return;
    const pt = sampleRouteAtProgress(data, routeTimerState.progress); routeTimerState.currentPt = pt;
    const isX2 = Boolean(pt && pt.inHazard && routeTimerState.progress < 1);
    box.classList.toggle('is-hazard', isX2);
    const badge = document.getElementById('timerMultBadge'), clock = document.getElementById('timerElapsed'), total = document.getElementById('timerTotal');
    const status = document.getElementById('timerZoneStatus'), breakdown = document.getElementById('timerBreakdown'), fill = document.getElementById('timerProgressFill'), btnPlay = document.getElementById('btnTimerPlayPause');
    if (badge) { badge.classList.toggle('is-x2', isX2); badge.innerText = isX2 ? '×2 НЕБЕЗПЕЧНА ЗОНА' : '×1 ШТАТНО'; }
    if (clock && pt) clock.innerText = formatTimerHMS(pt.cumHours);
    if (total) total.innerText = `/ ${formatTimerHMS(data.totalHours)}`;
    if (fill) fill.style.width = `${(routeTimerState.progress * 100).toFixed(1)}%`;
    if (breakdown && pt) breakdown.innerHTML = `Звичайний: <b>${formatTimerHMS(pt.cumNormalHours)}</b> · Небезпека: <b>${formatTimerHMS(pt.cumHazardBaseHours)} × 2 = ${formatTimerHMS(pt.cumHazardHours)}</b>`;
    if (status) status.innerText = routeTimerState.progress >= 1 ? '✅ Маршрут завершено (Точка B)' : (isX2 ? `⚠️ ×2: ${pt.hazardName || 'Небезпечна зона'}` : '🟢 Штатний рух (×1)');
    if (btnPlay) btnPlay.innerText = routeTimerState.progress >= 1 ? '▶ ЗАНОВО' : (routeTimerState.running ? '⏸ ПАУЗА' : '▶ СТАРТ');
}

function stepRouteTimer() {
    if (!routeTimerState.running) return;
    if (!getActiveRouteObj()) return pauseRouteTimer();
    const now = performance.now(), dtSec = Math.min(0.25, Math.max(0, (now - routeTimerState.lastTick) / 1000));
    routeTimerState.lastTick = now; routeTimerState.progress = Math.min(1, routeTimerState.progress + dtSec * 0.045);
    updateRouteTimerUI(); if (routeTimerState.progress >= 1) pauseRouteTimer();
}

function startRouteTimer(reset = false) {
    const data = getActiveRouteObj(); if (!data) return;
    if (reset || routeTimerState.progress >= 1) routeTimerState.progress = 0;
    const track = document.getElementById('timerProgressTrack'); if (track) track.style.background = buildTimerTrackGradient(data.path);
    routeTimerState.running = true; routeTimerState.lastTick = performance.now();
    if (routeTimerState.intervalId) clearInterval(routeTimerState.intervalId);
    routeTimerState.intervalId = setInterval(stepRouteTimer, 60); updateRouteTimerUI();
}
function pauseRouteTimer() { routeTimerState.running = false; if (routeTimerState.intervalId) { clearInterval(routeTimerState.intervalId); routeTimerState.intervalId = null; } updateRouteTimerUI(); }
function stopAndClearRouteTimer() { routeTimerState.running = false; routeTimerState.progress = 0; routeTimerState.currentPt = null; if (routeTimerState.intervalId) { clearInterval(routeTimerState.intervalId); routeTimerState.intervalId = null; } }

document.getElementById('btnTimerPlayPause')?.addEventListener('click', () => { if (routeTimerState.running) pauseRouteTimer(); else startRouteTimer(routeTimerState.progress >= 1); });
document.getElementById('btnTimerReset')?.addEventListener('click', () => startRouteTimer(true));

let supplyCrewCount = 2;
function updateSupplyCalculator() {
    const data = getActiveRouteObj(); if (!data) return;
    const crew = Math.max(1, Math.min(8, supplyCrewCount));
    const reserveMult = (document.getElementById('chkSupplyReserve')?.checked ?? true) ? 1.15 : 1.0;

    const o2Kg = data.totalHours * crew * 0.035 * reserveMult, o2Liters = Math.round(o2Kg * 714);
    const fuelLiters = Math.ceil((data.totalDist * 0.35 + (data.hazardDistKm || 0) * 0.175 + (data.totalAsc || 0) * 0.01) * reserveMult);
    const foodKg = data.totalHours * crew * 0.028 * reserveMult;
    const foodKcal = Math.round(data.totalHours * crew * 125 * reserveMult);
    const foodRations = data.totalHours > 0 ? Math.max(crew, Math.ceil((data.totalHours / 8) * crew * reserveMult)) : 0;
    const drinkWater = data.totalHours * crew * 0.105 * reserveMult;
    const techWater = (data.totalHours * crew * 0.065 + (data.hazardDistKm || 0) * 0.005) * reserveMult;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    set('supplyCrewVal', crew);
    set('supplyO2Val', `${o2Kg.toFixed(2)} кг`);
    set('supplyO2Sub', `≈ ${o2Liters.toLocaleString('uk-UA')} л O₂ (${crew} ос.)`);
    set('supplyFuelVal', `${fuelLiters.toLocaleString('uk-UA')} л`);
    set('supplyFuelSub', data.hazardDistKm > 1 ? 'База + підйом + небезпека' : 'База 0.35 л/км + підйом');
    set('supplyFoodVal', `${foodKg.toFixed(2)} кг`);
    set('supplyFoodSub', `Калорійність: ${foodKcal.toLocaleString('uk-UA')} ккал · Субліпайки: ${foodRations} шт.`);
    set('supplyWaterVal', `${(drinkWater + techWater).toFixed(1)} л`);
    set('supplyWaterSub', `Питна: ${drinkWater.toFixed(1)} л · Технічна/охолодження: ${techWater.toFixed(1)} л`);
}

document.getElementById('btnCrewMinus')?.addEventListener('click', () => { if (supplyCrewCount > 1) { supplyCrewCount--; updateSupplyCalculator(); } });
document.getElementById('btnCrewPlus')?.addEventListener('click', () => { if (supplyCrewCount < 8) { supplyCrewCount++; updateSupplyCalculator(); } });
document.getElementById('chkSupplyReserve')?.addEventListener('change', updateSupplyCalculator);

function buildRoute(fitCamera = true) {
    if (!ptA || !ptB) return;
    safePolylineGroup.clearLayers(); fastPolylineGroup.clearLayers();
    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);

    safeRouteData = runRealTerrainAStar(ptA, ptB, 'safe');
    fastRouteData = runRealTerrainAStar(ptA, ptB, 'fast');
    updateSeparateElevationCards();

    if (fitCamera && !is3DMode) map.fitBounds(getCylindricalRouteBounds(), { padding: [50, 50] });
    const reportEl = document.getElementById('routeReport');
    if (reportEl) reportEl.style.display = 'block';

    setActiveRoute(activeRouteMode || 'safe', fitCamera);
    if (fitCamera && reportEl) reportEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (typeof checkStormRouteCollisions === 'function') checkStormRouteCollisions();
}

const btnBuildRouteEl = document.getElementById('btnBuildRoute');
if (btnBuildRouteEl) {
    btnBuildRouteEl.innerText = 'ПІДТВЕРДИТИ';
    btnBuildRouteEl.onclick = () => {
        if (!ptA || !ptB) return alert("Оберіть Точку А (старт) та Точку В (фініш) на мапі!");
        isSosRouteActive = false;
        routeConfirmed = true;
        buildRoute(true);
    };
}

function updateSeparateElevationCards() {
    if (!safeRouteData || !fastRouteData) return;
    const sAlts = safeRouteData.path.map(p => p.alt), sMin = Math.round(Math.min(...sAlts)), sMax = Math.round(Math.max(...sAlts));
    document.getElementById('elevSafeMin').innerText = `${sMin > 0 ? '+' : ''}${sMin} м`; document.getElementById('elevSafeMax').innerText = `${sMax > 0 ? '+' : ''}${sMax} м`;
    document.getElementById('elevSafeDiff').innerText = `Δ ${sMax - sMin} м`; document.getElementById('elevSafeClimb').innerText = `+${Math.round(safeRouteData.totalAsc)} / -${Math.round(safeRouteData.totalDesc)} м`;
    const elSafeTime = document.getElementById('elevSafeTime'); if (elSafeTime) elSafeTime.innerText = formatMarsDuration(safeRouteData.totalHours);

    const fAlts = fastRouteData.path.map(p => p.alt), fMin = Math.round(Math.min(...fAlts)), fMax = Math.round(Math.max(...fAlts));
    document.getElementById('elevFastMin').innerText = `${fMin > 0 ? '+' : ''}${fMin} м`; document.getElementById('elevFastMax').innerText = `${fMax > 0 ? '+' : ''}${fMax} м`;
    document.getElementById('elevFastDiff').innerText = `Δ ${fMax - fMin} м`; document.getElementById('elevFastClimb').innerText = `+${Math.round(fastRouteData.totalAsc)} / -${Math.round(fastRouteData.totalDesc)} м`;
    const elFastTime = document.getElementById('elevFastTime'); if (elFastTime) elFastTime.innerText = formatMarsDuration(fastRouteData.totalHours);
}

window.setActiveRoute = function(mode, animateDraw = false) {
    activeRouteMode = mode;
    document.getElementById('tabSafe')?.classList.toggle('active', mode === 'safe');
    document.getElementById('tabFast')?.classList.toggle('active', mode === 'fast');
    document.querySelector('.elev-safe-card')?.classList.toggle('active', mode === 'safe');
    document.querySelector('.elev-fast-card')?.classList.toggle('active', mode === 'fast');

    const data = mode === 'safe' ? safeRouteData : fastRouteData;
    if (!data) return;
    drawAllRoutes2D(animateDraw);

    document.getElementById('metricDist').innerText = data.totalDist < 50 ? `${data.totalDist.toFixed(1)} км` : `${Math.round(data.totalDist)} км`;
    document.getElementById('metricSlope').innerText = `${data.maxSlope.toFixed(1)}°`;
    document.getElementById('metricClimb').innerText = `+${Math.round(data.totalAsc)} / -${Math.round(data.totalDesc)} м`;
    const sEl = document.getElementById('metricSafety');
    sEl.innerText = `${data.safety}%`;
    sEl.style.color = data.safety >= 75 ? '#00FFAA' : (data.safety > 40 ? '#FFD700' : '#FF2E38');

    const elTime = document.getElementById('metricTime'), elTimePenalty = document.getElementById('metricTimePenalty'), elTimeNote = document.getElementById('metricTimeNote');
    if (elTime) elTime.innerText = formatMarsDuration(data.totalHours);
    if (elTimePenalty) elTimePenalty.style.display = data.hazardBaseHours > 0.01 ? 'inline-block' : 'none';
    if (elTimeNote) elTimeNote.innerText = data.hazardBaseHours > 0.01 ? `Звичайний: ${formatMarsDuration(data.normalHours)} + Небезпека: ${formatMarsDuration(data.hazardBaseHours)} × 2 = ${formatMarsDuration(data.hazardDoubledHours)}` : 'Без затримок у небезпечних зонах (×1)';
    const diagEl = document.getElementById('scannerDiagnosis');
    if (diagEl) {
        diagEl.innerText = (isSosRouteActive ? '🆘 [SOS ПЕРЕНАПРАВЛЕННЯ] ' : '') + data.scanDiagnosis;
        diagEl.style.borderColor = data.safety < 50 ? '#FF2E38' : 'rgba(0, 255, 170, 0.3)';
    }

    resetChartHoverReadout();
    startRouteTimer(true);
    updateSupplyCalculator();
    update3DPinsAndPaths();
    renderDualElevationChart(-1);
};

function resetChartHoverReadout() {
    if (!safeRouteData || !fastRouteData) return;
    const sAlts = safeRouteData.path.map(p => p.alt), fAlts = fastRouteData.path.map(p => p.alt);
    const sMin = Math.round(Math.min(...sAlts)), sMax = Math.round(Math.max(...sAlts)), fMin = Math.round(Math.min(...fAlts)), fMax = Math.round(Math.max(...fAlts));
    const infoEl = document.getElementById('chartHoverInfo');
    if (infoEl) infoEl.innerHTML = `<span style="color:#00FFAA; margin-right:12px;">🟢 БЕЗП: ${sMin > 0 ? '+' : ''}${sMin}…${sMax > 0 ? '+' : ''}${sMax}м</span><span style="color:#FF2E38;">🔴 ШВИД: ${fMin > 0 ? '+' : ''}${fMin}…${fMax > 0 ? '+' : ''}${fMax}м</span>`;
}

document.getElementById('btnClearRoute')?.addEventListener('click', () => {
    if (routeRevealRafId) { cancelAnimationFrame(routeRevealRafId); routeRevealRafId = null; }
    stopAndClearRouteTimer(); if (typeof stopWazeNavigation === 'function') stopWazeNavigation();
    markerAGroup.clearLayers(); markerBGroup.clearLayers(); fastPolylineGroup.clearLayers(); safePolylineGroup.clearLayers(); waypointsLayerGroup.clearLayers();
    currentSelectedZoneId = null; selectedZoneGroup.clearLayers();
    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);
    ptA = ptB = fastRouteData = safeRouteData = safeHoverMarker = fastHoverMarker = null;
    waypoints = []; renderWaypointsUI(); routeConfirmed = false; isSosRouteActive = false; syncUI(); update3DPinsAndPaths();
    const rr = document.getElementById('routeReport'); if (rr) rr.style.display = 'none';
    if (typeof checkStormRouteCollisions === 'function') checkStormRouteCollisions();
    debouncedSaveCloudRoute();
});

function renderDualElevationChart(activeHoverRatio = -1) {
    if (!safeRouteData || !fastRouteData) return;
    const cvs = document.getElementById('elevationCanvas'); if (!cvs) return;
    const ctx = cvs.getContext('2d'); ctx.clearRect(0, 0, cvs.width, cvs.height);
    const safeP = safeRouteData.path, fastP = fastRouteData.path; if (!safeP.length || !fastP.length) return;
    const allAlts = [...safeP.map(p => p.alt), ...fastP.map(p => p.alt)], minAlt = Math.min(...allAlts), maxAlt = Math.max(...allAlts), range = Math.max(0.5, maxAlt - minAlt);
    const padLeft = 52, padRight = 10, padTop = 14, padBottom = 16, w = cvs.width - padLeft - padRight, h = cvs.height - padTop - padBottom;
    const maxLbl = Math.round(maxAlt), minLbl = Math.round(minAlt);
    ctx.font = "9px 'Space Mono', monospace"; ctx.fillStyle = '#64748B'; ctx.textAlign = 'right'; ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padLeft, padTop); ctx.lineTo(padLeft + w, padTop); ctx.stroke(); ctx.fillText(trL(`${maxLbl > 0 ? '+' : ''}${maxLbl}м`), padLeft - 6, padTop + 3);
    ctx.beginPath(); ctx.moveTo(padLeft, padTop + h); ctx.lineTo(padLeft + w, padTop + h); ctx.stroke(); ctx.fillText(trL(`${minLbl > 0 ? '+' : ''}${minLbl}м`), padLeft - 6, padTop + h + 3);

    const drawCurve = (pts, isActive, activeColor, dimColor) => {
        ctx.beginPath();
        pts.forEach((pt, i) => {
            const x = padLeft + (i / (pts.length - 1)) * w;
            const y = padTop + h - ((pt.alt - minAlt) / range) * h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = isActive ? activeColor : dimColor;
        ctx.lineWidth = isActive ? 2.6 : 1.6;
        if (!isActive) ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    };
    drawCurve(fastP, activeRouteMode === 'fast', '#FF2E38', 'rgba(255, 46, 56, 0.50)');
    drawCurve(safeP, activeRouteMode === 'safe', '#00FFAA', 'rgba(0, 200, 140, 0.50)');

    if (activeHoverRatio >= 0 && activeHoverRatio <= 1) {
        const hx = padLeft + activeHoverRatio * w;
        const sPt = safeP[Math.round(activeHoverRatio * (safeP.length - 1))];
        const fPt = fastP[Math.round(activeHoverRatio * (fastP.length - 1))];
        [[padTop + h - ((fPt.alt - minAlt) / range) * h, '#FF2E38'], [padTop + h - ((sPt.alt - minAlt) / range) * h, '#00FFAA']].forEach(([y, col]) => {
            ctx.beginPath(); ctx.arc(hx, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
        });
    }
}

const cvs = document.getElementById('elevationCanvas');
if (cvs) {
    cvs.addEventListener('mousemove', (e) => {
        if (!safeRouteData || !fastRouteData) return;
        const rect = cvs.getBoundingClientRect(), padLeft = 52, w = cvs.width - padLeft - 10;
        const ratio = Math.max(0, Math.min(w, (e.clientX - rect.left) * (cvs.width / rect.width) - padLeft)) / w;
        const sPt = safeRouteData.path[Math.round(ratio * (safeRouteData.path.length - 1))];
        const fPt = fastRouteData.path[Math.round(ratio * (fastRouteData.path.length - 1))];
        const allAlts = [...safeRouteData.path.map(p => p.alt), ...fastRouteData.path.map(p => p.alt)];
        const range = Math.max(...allAlts) - Math.min(...allAlts);
        const sA = range < 25 ? sPt.alt.toFixed(1) : Math.round(sPt.alt);
        const fA = range < 25 ? fPt.alt.toFixed(1) : Math.round(fPt.alt);
        document.getElementById('chartHoverInfo').innerHTML = `<span style="color:#059669; margin-right:12px;">🟢 БЕЗП: ${sPt.alt > 0 ? '+' : ''}${sA}м (${(ratio * safeRouteData.totalDist).toFixed(1)}км)</span><span style="color:#FF2E38;">🔴 ШВИД: ${fPt.alt > 0 ? '+' : ''}${fA}м (${(ratio * fastRouteData.totalDist).toFixed(1)}км)</span>`;
        renderDualElevationChart(ratio);

        if (!is3DMode) {
            const worldShift = Math.round((map.getCenter().lng - sPt.lon) / 360) * 360;
            if (!safeHoverMarker) safeHoverMarker = L.circleMarker([sPt.lat, sPt.lon + worldShift], { radius: 6, color: '#0F172A', weight: 2, fillColor: '#00FFAA', fillOpacity: 1 });
            if (!fastHoverMarker) fastHoverMarker = L.circleMarker([fPt.lat, fPt.lon + worldShift], { radius: 5, color: '#0F172A', weight: 2, fillColor: '#FF2E38', fillOpacity: 1 });
            safeHoverMarker.setLatLng([sPt.lat, sPt.lon + worldShift]);
            fastHoverMarker.setLatLng([fPt.lat, fPt.lon + worldShift]);
            if (!map.hasLayer(safeHoverMarker)) safeHoverMarker.addTo(map);
            if (!map.hasLayer(fastHoverMarker)) fastHoverMarker.addTo(map);
        }
    });
    cvs.addEventListener('mouseleave', () => {
        resetChartHoverReadout();
        renderDualElevationChart(-1);
        if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
        if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);
    });
}

// 12. АКАУНТИ ТА СИНХРОНІЗАЦІЯ
let currentUser = null, authTabMode = 'login', autoSaveTimer = null, syncToastTimer = null, sessionToken = null;
function authHeaders(extra = {}) { return sessionToken ? { ...extra, Authorization: `Bearer ${sessionToken}` } : extra; }
function clearLocalSession() { currentUser = null; sessionToken = null; renderAuthUI(false); }
function showSyncToast(message) {
    const toast = document.getElementById('syncToast'), msgEl = document.getElementById('syncToastMsg'); if (!toast || !msgEl) return;
    msgEl.innerText = message; toast.classList.add('show');
    if (syncToastTimer) clearTimeout(syncToastTimer);
    syncToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
function debouncedSaveCloudRoute(delay = 500) { if (!currentUser) return; if (autoSaveTimer) clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(() => saveRouteToAccount(false), delay); }

async function saveRouteToAccount(showToast = true) {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/save-route', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ username: currentUser, pointA: ptA ? { lat: ptA.lat, lon: ptA.lon } : null, pointB: ptB ? { lat: ptB.lat, lon: ptB.lon } : null, waypoints }) });
        if (res.status === 401) return (clearLocalSession(), showSyncToast('Сесія завершилась, увійдіть знову'));
        if (res.ok) { updateModalSyncView(ptA, ptB); if (showToast) showSyncToast('Маршрут збережено в PostgreSQL 💾'); }
    } catch (e) {}
}

async function loadRouteFromAccount(autoBuild = true) {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/load-route/${encodeURIComponent(currentUser)}`, { headers: authHeaders() });
        if (res.status === 401) return (clearLocalSession(), showSyncToast('Сесія завершилась, увійдіть знову'));
        const data = await res.json();
        if (res.ok && data.success) {
            if (data.pointA || data.pointB) { applyCloudRoutePoints(data.pointA, data.pointB, autoBuild, data.waypoints); showSyncToast(`Маршрут завантажено з PostgreSQL (${currentUser})`); }
            else showSyncToast('В акаунті ще немає збережених точок');
            updateModalSyncView(data.pointA, data.pointB);
        } else showSyncToast(data.error || 'Помилка завантаження даних');
    } catch (e) { showSyncToast('Помилка зв’язку з базою даних'); }
}

function updateModalSyncView(a, b) {
    const elA = document.getElementById('syncDispPointA'), elB = document.getElementById('syncDispPointB');
    if (elA) elA.innerText = a ? `${Number(a.lat).toFixed(2)}°, ${Number(a.lon).toFixed(2)}°` : 'Не встановлено';
    if (elB) elB.innerText = b ? `${Number(b.lat).toFixed(2)}°, ${Number(b.lon).toFixed(2)}°` : 'Не встановлено';
}

async function checkAuthSession() { renderAuthUI(false); }
function renderAuthUI(isLoggedIn, username = '') {
    const btnText = document.getElementById('accountBtnText'), btnAccount = document.getElementById('btnAccount'), dotAccount = document.getElementById('accountDot');
    const loggedOutView = document.getElementById('authLoggedOutView'), loggedInView = document.getElementById('authLoggedInView'), loggedInTitle = document.getElementById('loggedInUsernameTitle');
    if (isLoggedIn) {
        if (btnText) btnText.innerText = username; if (btnAccount) btnAccount.classList.add('logged-in'); if (dotAccount) dotAccount.classList.add('online');
        if (loggedOutView) loggedOutView.style.display = 'none'; if (loggedInView) loggedInView.style.display = 'block'; if (loggedInTitle) loggedInTitle.innerText = `РОСТЕР // ${username.toUpperCase()}`;
    } else {
        if (btnText) btnText.innerText = 'ВХІД / АКАУНТ'; if (btnAccount) btnAccount.classList.remove('logged-in'); if (dotAccount) dotAccount.classList.remove('online');
        if (loggedOutView) loggedOutView.style.display = 'block'; if (loggedInView) loggedInView.style.display = 'none';
    }
}

function initAccountModal() {
    const modal = document.getElementById('accountModal'), btnAccount = document.getElementById('btnAccount'), btnCloseModal = document.getElementById('btnCloseAccountModal');
    const tabLogin = document.getElementById('tabAuthLogin'), tabRegister = document.getElementById('tabAuthRegister'), authForm = document.getElementById('authForm');
    const btnSubmit = document.getElementById('btnSubmitAuth'), btnLogout = document.getElementById('btnLogout'), btnSaveCurrent = document.getElementById('btnSaveCurrentRoute'), btnLoadSaved = document.getElementById('btnLoadSavedRoute');
    const errBox = document.getElementById('authErrorMsg'), succBox = document.getElementById('authSuccessMsg');
    const showErr = (m) => { if (errBox) { errBox.innerText = m; errBox.style.display = 'block'; } if (succBox) succBox.style.display = 'none'; };
    const showSucc = (m) => { if (succBox) { succBox.innerText = m; succBox.style.display = 'block'; } if (errBox) errBox.style.display = 'none'; };
    const clearMsgs = () => { if (errBox) errBox.style.display = 'none'; if (succBox) succBox.style.display = 'none'; };

    if (btnAccount && modal) btnAccount.onclick = () => { clearMsgs(); modal.style.display = 'flex'; };
    if (btnCloseModal && modal) btnCloseModal.onclick = () => { modal.style.display = 'none'; };
    if (modal) modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    if (tabLogin && tabRegister) {
        tabLogin.onclick = () => { authTabMode = 'login'; tabLogin.classList.add('active'); tabRegister.classList.remove('active'); btnSubmit.innerText = 'УВІЙТИ В АКАУНТ'; clearMsgs(); };
        tabRegister.onclick = () => { authTabMode = 'register'; tabRegister.classList.add('active'); tabLogin.classList.remove('active'); btnSubmit.innerText = 'СТВОРИТИ АКАУНТ'; clearMsgs(); };
    }
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault(); clearMsgs();
            const u = document.getElementById('authUsername')?.value.trim() || '', p = document.getElementById('authPassword')?.value.trim() || '';
            if (u.length < 3 || p.length < 3) return showErr('Логін та пароль мають містити щонайменше 3 символи');
            btnSubmit.disabled = true; btnSubmit.innerText = 'ОБРОБКА...';
            try {
                const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, mode: authTabMode, pointA: ptA, pointB: ptB }) });
                const data = await res.json(); if (!res.ok) return showErr(data.error || 'Помилка авторизації');
                currentUser = data.user.username; sessionToken = data.token; renderAuthUI(true, currentUser); updateModalSyncView(data.user.point_a, data.user.point_b);
                if (authTabMode === 'register') showSucc('Акаунт успішно створено в PostgreSQL!');
                else if (data.user.point_a || data.user.point_b) { applyCloudRoutePoints(data.user.point_a, data.user.point_b, true, data.user.waypoints); showSucc('Вхід успішний! Завантажено збережений маршрут.'); }
                else if (ptA || ptB) { saveRouteToAccount(false); showSucc('Вхід успішний! Поточні точки збережено.'); }
                else showSucc('Вхід успішний!');
                setTimeout(() => { modal.style.display = 'none'; }, 1000);
            } catch (err) { showErr('Помилка підключення до сервера БД'); }
            finally { btnSubmit.disabled = false; btnSubmit.innerText = authTabMode === 'register' ? 'СТВОРИТИ АКАУНТ' : 'УВІЙТИ В АКАУНТ'; }
        };
    }
    if (btnLogout) btnLogout.onclick = () => { fetch('/api/logout', { method: 'POST', headers: authHeaders() }).catch(() => {}); clearLocalSession(); modal.style.display = 'none'; showSyncToast('Ви вийшли з акаунту'); };
    if (btnSaveCurrent) btnSaveCurrent.onclick = () => { if (!ptA && !ptB) return alert('Спочатку оберіть хоча б одну точку на мапі!'); saveRouteToAccount(true); };
    if (btnLoadSaved) btnLoadSaved.onclick = () => { loadRouteFromAccount(true); modal.style.display = 'none'; };
}

// 13. БУРІ ТА ПОГОДА
const activeStormLayers = new Map(), stormTextureCache = new Map();
function injectStormCloudStyles() {
    if (document.getElementById('stormCloudDynamicStyles')) return;
    const style = document.createElement('style'); style.id = 'stormCloudDynamicStyles';
    style.textContent = `
        .storm-tornado-img { width: 100%; height: 100%; display: block; transform-origin: 50% 50%; mix-blend-mode: normal !important; filter: drop-shadow(0 8px 22px rgba(10, 14, 24, 0.72)) contrast(1.22) brightness(1.06) !important; animation: stormTornadoSpin 14s linear infinite; pointer-events: none !important; }
        @keyframes stormTornadoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .storm-eye-dot { width: 10px; height: 10px; border-radius: 50%; background: #0F172A; border: 2px solid #F8FAFC; box-shadow: 0 0 10px rgba(255, 87, 34, 0.9); cursor: pointer; }
        .storm-popup-card { font-family: 'Space Grotesk', sans-serif; min-width: 220px; padding: 2px; }
        .spc-tag { font-size: 0.62rem; font-weight: 800; color: #FF5722; letter-spacing: 0.04em; margin-bottom: 4px; }
        .spc-title { font-size: 0.86rem; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
        .spc-grid { display: flex; flex-direction: column; gap: 3px; font-size: 0.72rem; color: #475569; }
    `;
    document.head.appendChild(style);
}

function makeStormTextureUrl(id) {
    if (stormTextureCache.has(id)) return stormTextureCache.get(id);
    let h = 2166136261; const s = String(id || 'mars_tornado');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const G = 64, perm = new Float32Array(G * G); for (let i = 0; i < G * G; i++) perm[i] = rand();
    const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return (perm[(yi & 63) * G + (xi & 63)] * (1 - su) + perm[(yi & 63) * G + ((xi + 1) & 63)] * su) * (1 - sv) + (perm[((yi + 1) & 63) * G + (xi & 63)] * (1 - su) + perm[((yi + 1) & 63) * G + ((xi + 1) & 63)] * su) * sv; };
    const fbm = (x, y) => { let val = 0, amp = 0.5, freq = 1; for (let i = 0; i < 4; i++) { val += amp * noise2(x * freq, y * freq); freq *= 2.05; amp *= 0.5; } return val; };
    const smoothstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

    const N = 256, cvs = document.createElement('canvas'); cvs.width = N; cvs.height = N;
    const ctx = cvs.getContext('2d'), imgData = ctx.createImageData(N, N), data = imgData.data;
    const arms = 3 + Math.floor(rand() * 2), dir = rand() < 0.5 ? 1 : -1, ox = rand() * 50, oy = rand() * 50;
    const stretchX = 0.86 + rand() * 0.28, stretchY = 0.86 + rand() * 0.28, rotAngle = rand() * Math.PI * 2, cosR = Math.cos(rotAngle), sinR = Math.sin(rotAngle);
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const nx = (px - N / 2) / (N / 2), ny = (py - N / 2) / (N / 2), rx = (nx * cosR - ny * sinR) / stretchX, ry = (nx * sinR + ny * cosR) / stretchY, r = Math.hypot(rx, ry);
        if (r >= 1.06) continue;
        const rEdge = r / (0.58 + fbm(nx * 2.2 + ox, ny * 2.2 + oy) * 0.48 + fbm(nx * 4.8 - oy, ny * 4.8 + ox) * 0.24);
        if (rEdge >= 1.0) continue;
        const ang = Math.atan2(ry, rx), logSpiral = ang + dir * (-5.6 * Math.log(r + 0.055) + 2.4 * r);
        const streak = fbm(Math.cos(logSpiral) * 2.6 + r * 6.0 + ox, Math.sin(logSpiral) * 2.6 + r * 6.0 + oy);
        const spiralArm = Math.pow(0.5 + 0.5 * Math.cos(arms * logSpiral + fbm(nx * 3.4 + ox, ny * 3.4 + oy) * 3.4), 1.45);
        const eyewall = Math.exp(-((r - 0.125) * (r - 0.125)) / 0.0028), eyeHole = smoothstep(0.03, 0.10, r);
        const cloudBand = Math.max(0, Math.min(1, (0.62 * spiralArm + 0.45 * (streak - 0.25) + 0.85 * eyewall) * (0.25 + 0.75 * eyeHole)));
        const funnelDarkness = (1.0 - eyeHole) * 0.9 + (1.0 - spiralArm) * 0.45 * smoothstep(0.65, 0.08, r);
        const alpha = Math.max(0, Math.min(255, Math.round(255 * smoothstep(1.0, 0.22, rEdge) * Math.min(1, Math.max(0.85 * (1 - eyeHole), 0.35 + 0.65 * cloudBand, 0.55 * funnelDarkness)))));
        const dustRim = smoothstep(0.35, 0.92, r) * spiralArm * 0.35, lum = 30 + 214 * cloudBand - 22 * funnelDarkness, idx = (py * N + px) * 4;
        data[idx] = Math.min(255, Math.max(0, Math.round(lum + 34 * dustRim - 8 * (1 - cloudBand))));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum + 8 * dustRim + 4 * cloudBand)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum - 16 * dustRim + 16 * cloudBand)));
        data[idx + 3] = alpha;
    }
    ctx.putImageData(imgData, 0, 0);
    const url = cvs.toDataURL('image/png'); stormTextureCache.set(id, url); return url;
}

function ensureStormMotionState(st) {
    if (typeof st._seed !== 'number') { let h = 0; const s = String(st.id || st.name || 'storm'); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; st._seed = (Math.abs(h) % 1000) / 100 + Math.random() * 2; }
    if (typeof st._phase !== 'number') st._phase = Math.random() * Math.PI * 2;
    if (!Array.isArray(st._trail)) st._trail = [{ lat: st.lat, lon: st.lon }];
}

window.isPointInAnyActiveStorm = function(lat, lon, extraMarginKm = 0) {
    if (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms?.length) return false;
    for (const st of MARS_STORM_STATE.storms) {
        const distKm = calculateShortestMarsDistance(lat, lon, st.lat, st.lon);
        if (distKm > st.radiusKm * 1.25 + extraMarginKm) continue;
        const seed = typeof st._seed === 'number' ? st._seed : 0, brng = seed ? getMarsBearingRad(st.lat, st.lon, lat, lon) : 0;
        if (distKm <= st.radiusKm * getStormContourWobble(brng, seed) + extraMarginKm) return true;
    }
    return false;
};

window.hasActiveStorms = () => MARS_STORM_STATE.active && MARS_STORM_STATE.storms?.length > 0;
window.getActiveStormCacheKey = () => (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms) ? 'nostorm' : MARS_STORM_STATE.storms.map(s => `${Math.round(s.lat * 8)},${Math.round(s.lon * 8)}`).join(';');
window.getStormImpactAtPoint = function(lat, lon) {
    if (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms) return { inStorm: false };
    for (const st of MARS_STORM_STATE.storms) { const d = calculateShortestMarsDistance(lat, lon, st.lat, st.lon); if (d <= st.outerRadiusKm) return { inStorm: true, stormName: st.name, windSpeed: st.windSpeedMs, tau: st.tau, distKm: Math.round(d) }; }
    return { inStorm: false };
};

window.update3DStormRings = function() {
    if (!myGlobe) return;
    myGlobe.ringsData(MARS_STORM_STATE.active ? MARS_STORM_STATE.storms.map(st => ({ lat: st.lat, lng: normalizeLon(st.lon), maxR: (st.radiusKm / MARS_RADIUS_KM) * (180 / Math.PI) * 0.95, propagationSpeed: 3.2, repeatPeriod: 1400, color: () => 'rgba(226, 232, 240, 0.85)' })) : [])
        .ringLat('lat').ringLng('lng').ringMaxRadius('maxR').ringPropagationSpeed('propagationSpeed').ringRepeatPeriod('repeatPeriod').ringColor('color');
};

window.update3DStormHtmlElements = function() {
    if (!myGlobe) return;
    const items = MARS_STORM_STATE.active ? MARS_STORM_STATE.storms.map(st => ({ id: st.id, lat: st.lat, lng: normalizeLon(st.lon), imgUrl: makeStormTextureUrl(st.id), label: `${st.regionName || st.name.split(' ')[0]} · ${Math.round(st.windSpeedMs)} м/с` })) : [];
    myGlobe.htmlElementsData(items).htmlLat('lat').htmlLng('lng').htmlAltitude(0.025).htmlElement(d => {
        const el = document.createElement('div'); el.style.pointerEvents = 'none';
        el.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; pointer-events:none;"><img src="${d.imgUrl}" style="width:76px; height:76px; animation:stormTornadoSpin 14s linear infinite; filter:drop-shadow(0 4px 14px rgba(0,0,0,0.85));" /><div class="storm-pill-badge" style="margin-top:2px;">🌪️ ${escHtml(d.label)}</div></div>`;
        return el;
    });
};

function computeStormForecast(st) {
    ensureStormMotionState(st); const points = []; let curLat = st.lat, curLon = st.lon, curHeading = st.headingDeg;
    for (let step = 1; step <= 20; step++) {
        const t = st._phase + step * 0.44;
        curHeading = (curHeading + (Math.sin(t * 1.3 + st._seed) * 28 + Math.cos(t * 2.5 + st._seed * 1.7) * 18) * 0.42 + 360) % 360;
        const distKm = st.speedKmH * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.8 + st._seed))) * 1.5, radH = (curHeading * Math.PI) / 180, radLat = (curLat * Math.PI) / 180, dR = distKm / MARS_RADIUS_KM;
        const nextLat = Math.asin(Math.sin(radLat) * Math.cos(dR) + Math.cos(radLat) * Math.sin(dR) * Math.cos(radH)) / (Math.PI / 180);
        const deltaLon = Math.atan2(Math.sin(radH) * Math.sin(dR) * Math.cos(radLat), Math.cos(dR) - Math.sin(radLat) * Math.sin((nextLat * Math.PI) / 180)) / (Math.PI / 180);
        curLat = Math.max(-75, Math.min(75, nextLat)); curLon = normalizeLon(curLon + deltaLon); points.push({ lat: curLat, lon: curLon, hours: step * 1.5 });
    }
    st.futureTrajectory = points;
}

let stormPhysicsTickCount = 0;
function updateStormPhysics() {
    if (!MARS_STORM_STATE.active) return;
    const now = performance.now(), dtMs = now - MARS_STORM_STATE.lastTick; MARS_STORM_STATE.lastTick = now;
    if (dtMs <= 0 || dtMs > 10000) return;
    const dtHours = (dtMs / 3600000) * MARS_STORM_STATE.speedMultiplier;
    MARS_STORM_STATE.storms.forEach(st => {
        ensureStormMotionState(st); st._phase += 0.045 + Math.random() * 0.035;
        st.headingDeg = (st.headingDeg + (Math.sin(st._phase * 1.3 + st._seed) * 14 + (Math.random() - 0.5) * 18) * 0.30 + 360) % 360;
        const distKm = st.speedKmH * (0.8 + 0.4 * Math.random()) * dtHours, radH = (st.headingDeg * Math.PI) / 180, radLat = (st.lat * Math.PI) / 180, dR = distKm / MARS_RADIUS_KM;
        let nextLat = Math.asin(Math.sin(radLat) * Math.cos(dR) + Math.cos(radLat) * Math.sin(dR) * Math.cos(radH)) / (Math.PI / 180);
        const nextLon = normalizeLon(st.lon + Math.atan2(Math.sin(radH) * Math.sin(dR) * Math.cos(radLat), Math.cos(dR) - Math.sin(radLat) * Math.sin((nextLat * Math.PI) / 180)) / (Math.PI / 180));
        if (nextLat > 72 || nextLat < -72) { nextLat = nextLat > 72 ? 72 : -72; st.headingDeg = (180 - st.headingDeg + 360) % 360; }
        st.lat = nextLat; st.lon = nextLon;
        const lastTrail = st._trail[st._trail.length - 1];
        if (!lastTrail || Math.hypot(nextLat - lastTrail.lat, nextLon - lastTrail.lon) > 0.25) { st._trail.push({ lat: nextLat, lon: nextLon }); if (st._trail.length > 25) st._trail.shift(); }
        computeStormForecast(st);
    });
    renderStorms2D(); if (is3DMode && myGlobe) { update3DStormRings(); update3DStormHtmlElements(); }
    updateStormModalUI(); checkStormRouteCollisions();
    stormPhysicsTickCount++;
    if (routeConfirmed && stormPhysicsTickCount % 2 === 0 && ptA && ptB && safeRouteData && hazardsAvoidanceActive && MARS_STORM_STATE.autoAvoidRoute) {
        const endpointsInside = isPointInAnyActiveStorm(ptA.lat, ptA.lon, 0) || isPointInAnyActiveStorm(ptB.lat, ptB.lon, 0), stormKey = getActiveStormCacheKey();
        if (!endpointsInside && stormKey !== MARS_STORM_STATE.lastAutoRerouteKey && MARS_STORM_STATE.storms.some(st => safeRouteData.path.some((pt, i) => i % 4 === 0 && calculateShortestMarsDistance(pt.lat, pt.lon, st.lat, st.lon) <= st.outerRadiusKm + 200))) {
            MARS_STORM_STATE.lastAutoRerouteKey = stormKey; navGridCache = {}; buildRoute(false);
        }
    }
    }

function buildStormPopupHtml(st) {
    return `<div class="storm-popup-card"><div class="spc-tag">🌪️ ТОРНАДО / ПИЛОВИЙ ВИХОР (MRO/MARCI)</div><div class="spc-title">${escHtml(st.name)}</div><div class="spc-grid"><div>ЕПІЦЕНТР: <b>${st.lat.toFixed(2)}°, ${st.lon.toFixed(2)}°</b></div><div>ШВИДКІСТЬ ВІТРУ: <b style="color:#FF2E38;">${st.windSpeedMs} м/с</b></div><div>ОПТИЧНА НЕПРОЗОРІСТЬ: <b style="color:#FF7043;">τ = ${st.tau}</b></div><div>ШВИДКІСТЬ ДРЕЙФУ: <b>${Math.round(st.speedKmH)} км/год</b></div><div>КУРС ЗМІЩЕННЯ: <b>${Math.round(st.headingDeg)}°</b></div></div></div>`;
}

window.renderStorms2D = function() {
    if (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms?.length) { stormLayerGroup.clearLayers(); activeStormLayers.clear(); return; }
    const wantedKeys = new Set();
    MARS_STORM_STATE.storms.forEach(st => {
        ensureStormMotionState(st);
        const ringBase = makeMarsCircleCoords(st.lat, st.lon, st.radiusKm, 42, st._seed), radiusDeg = (st.outerRadiusKm / MARS_RADIUS_KM) * (180 / Math.PI);
        const dLon = radiusDeg / Math.max(0.18, Math.cos(st.lat * Math.PI / 180));
        let prevLon = st.lon;
        const unwrappedTraj = (st.futureTrajectory || []).map(pt => { prevLon += ((pt.lon - prevLon + 180) % 360 + 360) % 360 - 180; return [pt.lat, prevLon]; });
        const stormImgUrl = makeStormTextureUrl(st.id);

        activeWorldOffsets.forEach(offset => {
            const key = `${st.id}__${offset}`; wantedKeys.add(key);
            const center = [st.lat, st.lon + offset * 360], stormBounds = [[Math.max(-89.9, st.lat - radiusDeg), st.lon - dLon + offset * 360], [Math.min(89.9, st.lat + radiusDeg), st.lon + dLon + offset * 360]];
            const hazardCoords = ringBase.map(p => [p[0], p[1] + offset * 360]), trajCoords = [center, ...unwrappedTraj.map(p => [p[0], p[1] + offset * 360])], popupHtml = buildStormPopupHtml(st);
            const existing = activeStormLayers.get(key);
            if (existing) { existing.satOverlay.setBounds(stormBounds); existing.hazardRing.setLatLngs(hazardCoords); existing.trajLine.setLatLngs(trajCoords); existing.marker.setLatLng(center); existing.marker.setPopupContent(popupHtml); return; }
            const satOverlay = new StormImageOverlay(stormImgUrl, stormBounds, { opacity: 0.94, interactive: false, pane: 'stormPane', alt: 'Торнадо на Марсі' });
            const hazardRing = L.polygon(hazardCoords, { renderer: stormVectorRenderer, pane: 'stormPane', color: '#94A3B8', fill: false, opacity: 0.48, weight: 1.5, dashArray: '5, 9', interactive: false });
            const trajLine = L.polyline(trajCoords, { renderer: stormVectorRenderer, pane: 'stormPane', color: '#FFA000', weight: 2.2, dashArray: '6, 6', opacity: 0.9, interactive: false });
            const stormPin = L.divIcon({ className: 'custom-pin', html: `<div class="storm-vortex-pin"><div class="storm-eye-dot" title="${escHtml(st.name)}"></div><div class="storm-pill-badge">🌪️ ${escHtml(st.regionName || st.name.split(' ')[0])} · ${Math.round(st.windSpeedMs)} м/с</div></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
            const marker = L.marker(center, { icon: stormPin, zIndexOffset: 500 });
            marker.bindPopup(popupHtml, { className: 'storm-leaflet-popup', offset: [0, -6], autoPan: false });
            marker.on('click', (e) => L.DomEvent.stopPropagation(e));
            stormLayerGroup.addLayer(satOverlay); stormLayerGroup.addLayer(hazardRing); stormLayerGroup.addLayer(trajLine); stormLayerGroup.addLayer(marker);
            activeStormLayers.set(key, { satOverlay, hazardRing, trajLine, marker });
        });
    });
    for (const [key, layers] of activeStormLayers.entries()) {
        if (!wantedKeys.has(key)) { stormLayerGroup.removeLayer(layers.satOverlay); stormLayerGroup.removeLayer(layers.hazardRing); stormLayerGroup.removeLayer(layers.trajLine); stormLayerGroup.removeLayer(layers.marker); activeStormLayers.delete(key); }
    }
};

function checkStormRouteCollisions() {
    const banner = document.getElementById('stormAlertBanner'), desc = document.getElementById('stormAlertDesc');
    if (!routeConfirmed || !MARS_STORM_STATE.active || !safeRouteData?.path?.length) { if (banner) banner.style.display = 'none'; return; }
    let minDistance = Infinity, threateningStorm = null;
    for (const st of MARS_STORM_STATE.storms) {
        const seed = typeof st._seed === 'number' ? st._seed : 0;
        for (const pt of safeRouteData.path) {
            const distKm = calculateShortestMarsDistance(pt.lat, pt.lon, st.lat, st.lon);
            if (distKm > st.radiusKm * 1.25) continue;
            const brng = seed ? getMarsBearingRad(st.lat, st.lon, pt.lat, pt.lon) : 0;
            if (distKm <= st.radiusKm * getStormContourWobble(brng, seed) && distKm < minDistance) { minDistance = distKm; threateningStorm = st; }
        }
    }
    if (threateningStorm) {
        if (banner && !MARS_STORM_STATE.bannerDismissed) { banner.style.display = 'flex'; if (desc) desc.innerText = `${threateningStorm.name} перетинає розрахований шлях ровера (дистанція до ядра: ${Math.round(minDistance)} км). Вітер ${threateningStorm.windSpeedMs} м/с, τ=${threateningStorm.tau}.`; }
        const endpointsInside = ptA && ptB && (isPointInAnyActiveStorm(ptA.lat, ptA.lon, 0) || isPointInAnyActiveStorm(ptB.lat, ptB.lon, 0)), stormKey = getActiveStormCacheKey(), now = performance.now();
        if (hazardsAvoidanceActive && MARS_STORM_STATE.autoAvoidRoute && !endpointsInside && stormKey !== MARS_STORM_STATE.lastAutoRerouteKey && (now - MARS_STORM_STATE.lastAutoRerouteTime > 5000)) {
            MARS_STORM_STATE.lastAutoRerouteTime = now; MARS_STORM_STATE.lastAutoRerouteKey = stormKey; navGridCache = {}; if (ptA && ptB) buildRoute(false);
        }
    } else { if (banner) banner.style.display = 'none'; MARS_STORM_STATE.bannerDismissed = false; }
}

async function fetchMarsWeather() {
    const fallbackStorms = [{ id: 'hellas_fallback', ...MARS_STORM_PRESETS.hellas }, { id: 'chryse_fallback', ...MARS_STORM_PRESETS.chryse }, { id: 'elysium_fallback', ...MARS_STORM_PRESETS.elysium }];
    try {
        const res = await fetch('/api/mars-weather');
        if (res.ok) {
            const d = await res.json();
            currentMarsWeather.sol = d.sol; currentMarsWeather.ls = d.ls; currentMarsWeather.season = d.season; currentMarsWeather.tau = d.tau;
            const g = d.ground; currentMarsWeather.hasGround = !!g;
            currentMarsWeather.min_temp = g ? g.min_temp : null; currentMarsWeather.max_temp = g ? g.max_temp : null; currentMarsWeather.pressure = g ? g.pressure : null; currentMarsWeather.wind_speed = g ? g.wind_speed : null;
            currentMarsWeather.wind_direction = g ? g.wind_direction : '—'; currentMarsWeather.atmo_opacity = g ? g.atmo_opacity : (d.stormSeason ? 'Сезон бур' : 'Спокійна атмосфера');
            currentMarsWeather.solar_efficiency = null; currentMarsWeather.remsLastSeen = d.remsLastSeen; currentMarsWeather.note = d.note; currentMarsWeather.updated = d.updated_at;
            if (!MARS_STORM_STATE.scenario) applyServerStorms((d.storms && d.storms.length) ? d.storms : fallbackStorms, d.stormSource);
        } else if (!MARS_STORM_STATE.storms.length) applyServerStorms(fallbackStorms, 'FALLBACK');
    } catch (e) { if (!MARS_STORM_STATE.storms.length) applyServerStorms(fallbackStorms, 'FALLBACK'); }
    updateWeatherUI(); applyHonestLabels();
}

function applyServerStorms(list, source) {
    const key = list.map(s => s.id).join('|'), changed = key !== MARS_STORM_STATE.serverKey;
    MARS_STORM_STATE.serverKey = key; MARS_STORM_STATE.source = source || '';
    MARS_STORM_STATE.storms = list.map(s => { const st = { ...s, futureTrajectory: [] }; ensureStormMotionState(st); return st; });
    MARS_STORM_STATE.storms.forEach(computeStormForecast); navGridCache = {}; renderStorms2D();
    if (is3DMode && myGlobe) { myGlobe.polygonsData(getActive3DFeatures()); update3DStormRings(); update3DStormHtmlElements(); }
    updateStormModalUI(); if (routeConfirmed && changed && ptA && ptB) buildRoute(false);
}

function applyHonestLabels() {
    const w = currentMarsWeather, dash = '—', set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    if (!w.hasGround) {
        ['widgetTemp','wTempDisp','widgetPressure','wPressureDisp','widgetWind','wWindSpeedDisp','wSolarDisp'].forEach(id => set(id, dash));
        ['widgetTempSub','wTempRange','widgetWindCourse','wWindDirDisp'].forEach(id => set(id, w.remsLastSeen ? `REMS: остання зміна ${w.remsLastSeen.date}` : 'REMS недоступний'));
    }
    set('widgetBadge', w.hasGround ? 'NASA REMS · LIVE' : 'МОДЕЛЬ · БЕЗ ЖИВИХ ДАНИХ');
    const n = MARS_STORM_STATE.storms.length;
    set('widgetStormName', n ? MARS_STORM_STATE.storms[0].name : 'Активних бур за моделлю немає');
    set('widgetStormDesc', n ? `${n} шт. · τ=${w.tau} · клімат MRO/MARCI` : `Ls ${w.ls}° — ${w.season}`);
    set('wOpacityDesc', w.note || ''); set('stormLiveStatusBadge', MARS_STORM_STATE.scenario ? '🧪 СЦЕНАРІЙ' : (n ? '🟠 МОДЕЛЬ ЗА КЛІМАТОМ' : '🟢 БУР НЕМАЄ'));
}

function updateWeatherUI() {
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('headerWeatherPill', `ПОГОДА: SOL ${currentMarsWeather.sol} | τ=${currentMarsWeather.tau}`);
    set('wSolDisp', `SOL ${currentMarsWeather.sol}`); set('wLsDisp', `Ls ${currentMarsWeather.ls}° • ${currentMarsWeather.season.split('(')[0]}`);
    if (currentMarsWeather.min_temp !== null && currentMarsWeather.max_temp !== null) { const avg = `${Math.round((currentMarsWeather.min_temp + currentMarsWeather.max_temp) / 2)} °C`; set('wTempDisp', avg); set('widgetTemp', avg); }
    set('wTempRange', `Мін: ${currentMarsWeather.min_temp}°C / Макс: ${currentMarsWeather.max_temp}°C`); set('wPressureDisp', `${currentMarsWeather.pressure} Па`); set('widgetPressure', `${currentMarsWeather.pressure} Па`);
    set('wTauDisp', `${currentMarsWeather.tau} [${currentMarsWeather.tau > 2 ? 'КРИТИЧНО' : 'ПОМІРНО'}]`); set('wOpacityDesc', currentMarsWeather.atmo_opacity);
    set('wWindSpeedDisp', `${currentMarsWeather.wind_speed} м/с`); set('widgetWind', `${currentMarsWeather.wind_speed} м/с`);
    set('wWindDirDisp', `Курс: ${currentMarsWeather.wind_direction}`); set('widgetWindCourse', `Курс: ${currentMarsWeather.wind_direction}`);
    set('wSolarDisp', `${currentMarsWeather.solar_efficiency}% ЕФЕКТ.`); set('widgetSol', `SOL ${currentMarsWeather.sol}`);
    set('widgetTauBadge', `τ = ${currentMarsWeather.tau} [${currentMarsWeather.tau > 2 ? 'ШТОРМОВЕ ЗАТЕМНЕННЯ' : 'СЕРПАНОК'}]`);
    set('widgetTempSub', `Мін ${currentMarsWeather.min_temp}° / Макс ${currentMarsWeather.max_temp}°`); set('widgetTau', `τ = ${currentMarsWeather.tau}`); set('widgetSeasonSub', `Ls ${currentMarsWeather.ls}° • ${currentMarsWeather.season.split('(')[0]}`);
    const st = MARS_STORM_STATE.storms[0]; if (st) { set('widgetStormName', st.name); set('widgetStormDesc', `Радіус ${st.radiusKm} км • Дрейф ${Math.round(st.speedKmH)} км/год`); }
}

function updateStormModalUI() {
    const st = MARS_STORM_STATE.storms[0]; if (!st) return;
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('siName', st.name); set('siCoords', `${st.lat.toFixed(2)}°, ${st.lon.toFixed(2)}° (${st.regionName || 'Марс'})`);
    set('siRadius', `${st.radiusKm} км (ядро) / ${st.outerRadiusKm} км (шлейф)`); set('siMotion', `${Math.round(st.speedKmH)} км/год • ${Math.round(st.headingDeg)}° (вітер ${st.windSpeedMs} м/с)`);
    const badge = document.getElementById('stormLiveStatusBadge'); if (badge) { badge.innerText = MARS_STORM_STATE.active ? '🟢 РУХ АКТИВНИЙ' : '⏸ НА ПАУЗІ'; badge.classList.toggle('paused', !MARS_STORM_STATE.active); }
}

window.spawnStormAtRegion = function(regionKey) {
    const preset = MARS_STORM_PRESETS[regionKey]; if (!preset) return;
    MARS_STORM_STATE.scenario = true; MARS_STORM_STATE.source = 'SCENARIO';
    if (!MARS_STORM_STATE.storms.length) { const st = { id: 'storm_custom_' + Date.now(), ...preset, futureTrajectory: [] }; ensureStormMotionState(st); MARS_STORM_STATE.storms.push(st); }
    else { Object.assign(MARS_STORM_STATE.storms[0], preset); MARS_STORM_STATE.storms[0]._trail = [{ lat: preset.lat, lon: preset.lon }]; ensureStormMotionState(MARS_STORM_STATE.storms[0]); }
    computeStormForecast(MARS_STORM_STATE.storms[0]); navGridCache = {}; renderStorms2D();
    if (is3DMode && myGlobe) { myGlobe.polygonsData(getActive3DFeatures()); update3DStormRings(); update3DStormHtmlElements(); }
    updateStormModalUI(); window.focusOnStorm(); if (routeConfirmed && ptA && ptB) buildRoute(false);
};

window.focusOnStorm = function() {
    if (!MARS_STORM_STATE.active) { const btn = document.getElementById('btnToggleStorms'); if (btn) btn.click(); else MARS_STORM_STATE.active = true; }
    if (!MARS_STORM_STATE.storms?.length) { window.spawnStormAtRegion('hellas'); return; }
    const st = MARS_STORM_STATE.storms[0];
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: st.lat, lng: normalizeLon(st.lon), altitude: 1.45 }, 1200);
    else map.flyTo([st.lat, st.lon + Math.round((map.getCenter().lng - st.lon) / 360) * 360], Math.max(map.getZoom(), 3.2), { duration: 1.2 });
    showWarning(`🌪️ ФОКУС НА БУРІ: ${st.name}`);
};

window.avoidActiveStormClick = function() { navGridCache = {}; if (ptA && ptB) { routeConfirmed = true; buildRoute(false); } else alert("Оберіть Точку А (старт) та Точку В (фініш) на мапі для побудови маршруту в обхід бурі!"); };
window.openMarsWeatherModal = function() { const modal = document.getElementById('weatherModal'); if (modal) modal.style.display = 'flex'; fetchMarsWeather(); updateStormModalUI(); };

function initWeatherAndStormModule() {
    injectStormCloudStyles();
    if (MARS_STORM_STATE.storms[0]) computeStormForecast(MARS_STORM_STATE.storms[0]);
    renderStorms2D(); fetchMarsWeather(); setInterval(fetchMarsWeather, 5 * 60 * 1000);
    const btnReal = document.getElementById('btnStormReal'); if (btnReal) btnReal.onclick = () => { MARS_STORM_STATE.scenario = false; MARS_STORM_STATE.serverKey = ''; fetchMarsWeather(); };
    if (MARS_STORM_STATE.intervalId) clearInterval(MARS_STORM_STATE.intervalId);
    MARS_STORM_STATE.intervalId = setInterval(updateStormPhysics, 1200);

    const btnToggleStorms = document.getElementById('btnToggleStorms');
    if (btnToggleStorms) {
        btnToggleStorms.onclick = () => {
            MARS_STORM_STATE.active = !MARS_STORM_STATE.active;
            btnToggleStorms.classList.toggle('active', MARS_STORM_STATE.active); btnToggleStorms.classList.toggle('inactive', !MARS_STORM_STATE.active);
            btnToggleStorms.innerHTML = MARS_STORM_STATE.active ? '<span class="btn-dot dot-storm pulse-storm"></span>БУРІ: ПОКАЗАНО' : '<span class="btn-dot dot-muted"></span>БУРІ: ПРИХОВАНО';
            const playPauseBtn = document.getElementById('btnStormPlayPause'); if (playPauseBtn) playPauseBtn.innerText = MARS_STORM_STATE.active ? '⏸ ПРИЗУПИНИТИ РУХ' : '▶ ВІДНОВИТИ РУХ';
            renderStorms2D(); if (is3DMode && myGlobe) { myGlobe.polygonsData(getActive3DFeatures()); update3DStormRings(); update3DStormHtmlElements(); }
            updateStormModalUI(); if (routeConfirmed && ptA && ptB && hazardsAvoidanceActive) buildRoute(false); else checkStormRouteCollisions();
        };
    }
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    bind('btnFocusStormHud', window.focusOnStorm); bind('btnFocusStorm', window.focusOnStorm); bind('btnOpenWeather', window.openMarsWeatherModal);
    bind('btnCloseWeatherModal', () => { const m = document.getElementById('weatherModal'); if (m) m.style.display = 'none'; });
    bind('btnStormFocus', () => { const m = document.getElementById('weatherModal'); if (m) m.style.display = 'none'; window.focusOnStorm(); });
    bind('btnStormSpawnRandom', () => { const keys = Object.keys(MARS_STORM_PRESETS); window.spawnStormAtRegion(keys[Math.floor(Math.random() * keys.length)]); });
    bind('btnRerouteAvoidStorm', () => { navGridCache = {}; if (ptA && ptB) { routeConfirmed = true; buildRoute(false); } });
    bind('btnDismissStormAlert', () => { MARS_STORM_STATE.bannerDismissed = true; const b = document.getElementById('stormAlertBanner'); if (b) b.style.display = 'none'; });
    bind('btnToggleWeatherWidget', () => { const w = document.getElementById('marsWeatherWidget'); if (w) w.classList.toggle('collapsed'); });
    const weatherModal = document.getElementById('weatherModal'); if (weatherModal) weatherModal.onclick = (e) => { if (e.target === weatherModal) weatherModal.style.display = 'none'; };
    bind('btnStormPlayPause', () => {
        MARS_STORM_STATE.active = !MARS_STORM_STATE.active;
        const b = document.getElementById('btnStormPlayPause'); if (b) b.innerText = MARS_STORM_STATE.active ? '⏸ ПРИЗУПИНИТИ РУХ' : '▶ ВІДНОВИТИ РУХ';
        if (btnToggleStorms) { btnToggleStorms.classList.toggle('active', MARS_STORM_STATE.active); btnToggleStorms.classList.toggle('inactive', !MARS_STORM_STATE.active); btnToggleStorms.innerHTML = MARS_STORM_STATE.active ? '<span class="btn-dot dot-storm pulse-storm"></span>БУРІ: ПОКАЗАНО' : '<span class="btn-dot dot-muted"></span>БУРІ: ПРИХОВАНО'; }
        updateStormModalUI(); renderStorms2D();
    });
    document.querySelectorAll('.sp-chip').forEach(c => c.onclick = (e) => { document.querySelectorAll('.sp-chip').forEach(x => x.classList.remove('active')); e.target.classList.add('active'); MARS_STORM_STATE.speedMultiplier = Number(e.target.dataset.speed || 150); });
    document.querySelectorAll('.reg-chip').forEach(c => c.onclick = (e) => { if (e.target.dataset.region) window.spawnStormAtRegion(e.target.dataset.region); });
    const chkAuto = document.getElementById('chkAutoAvoidStorm'); if (chkAuto) chkAuto.onchange = (e) => { MARS_STORM_STATE.autoAvoidRoute = e.target.checked; };
}

// ============================================================================
// 14. WAZE НАВІГАЦІЯ, ПОЗНАЧКИ ТА РАДІОЧАТ
// ============================================================================
const WAZE_NAV = { active: false, intervalId: null, progress: 0, currentCoord: null, headingDeg: 0, speedKmH: 30, lastTime: 0 };

function getRoverHeading(p1, p2) {
    if (!p1 || !p2) return 0;
    const dLon = ((p2.lon - p1.lon + 180) % 360 + 360) % 360 - 180;
    const y = Math.sin(dLon * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180);
    const x = Math.cos(p1.lat * Math.PI / 180) * Math.sin(p2.lat * Math.PI / 180) - Math.sin(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.cos(dLon * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function updateWazeRover2D() {
    wazeRoverMarkerGroup.clearLayers();
    if (!WAZE_NAV.active || !WAZE_NAV.currentCoord) return;
    activeWorldOffsets.forEach(offset => {
        const icon = L.divIcon({ className: 'custom-pin', html: `<div class="waze-rover-wrap"><div class="waze-rover-halo"></div><div class="waze-rover-arrow-box" style="transform: rotate(${WAZE_NAV.headingDeg}deg);">▲</div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
        wazeRoverMarkerGroup.addLayer(L.marker([WAZE_NAV.currentCoord.lat, WAZE_NAV.currentCoord.lon + offset * 360], { icon, zIndexOffset: 950 }));
    });
}

function startWazeNavigation() {
    const data = getActiveRouteObj(); if (!data?.path || data.path.length < 2) return showWarning('⚠️ Спочатку розрахуйте та підтвердіть маршрут!');
    WAZE_NAV.active = true; WAZE_NAV.progress = 0; WAZE_NAV.lastTime = performance.now();
    WAZE_NAV.currentCoord = { lat: data.path[0].lat, lon: data.path[0].lon }; WAZE_NAV.headingDeg = getRoverHeading(data.path[0], data.path[1]);
    const banner = document.getElementById('wazeNavBanner'); if (banner) banner.style.display = 'flex';
    const btnNav = document.getElementById('btnToggleNavigation'); if (btnNav) btnNav.innerHTML = '<span class="waze-car-icon">⏸</span> ЗУПИНИТИ НАВІГАЦІЮ';
    if (WAZE_NAV.intervalId) clearInterval(WAZE_NAV.intervalId);
    WAZE_NAV.intervalId = setInterval(stepWazeNavigation, 120);
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: data.path[0].lat, lng: normalizeLon(data.path[0].lon), altitude: 1.25 }, 1200);
    else map.flyTo([data.path[0].lat, data.path[0].lon + Math.round((map.getCenter().lng - data.path[0].lon) / 360) * 360], Math.max(map.getZoom(), 4.2), { duration: 1.0 });
    updateWazeNavHUD(); updateWazeRover2D(); showWarning('🚗 НАВІГАЦІЮ РОЗПОЧАТО: Слідуйте за вказівками Waze!');
}

function stopWazeNavigation() {
    WAZE_NAV.active = false; if (WAZE_NAV.intervalId) { clearInterval(WAZE_NAV.intervalId); WAZE_NAV.intervalId = null; }
    wazeRoverMarkerGroup.clearLayers();
    const banner = document.getElementById('wazeNavBanner'); if (banner) banner.style.display = 'none';
    const btnNav = document.getElementById('btnToggleNavigation'); if (btnNav) btnNav.innerHTML = '<span class="waze-car-icon">🚗</span> ПОЧАТИ НАВІГАЦІЮ (WAZE)';
}
function toggleWazeNavigation() { if (WAZE_NAV.active) stopWazeNavigation(); else startWazeNavigation(); }

function stepWazeNavigation() {
    if (!WAZE_NAV.active) return;
    const data = getActiveRouteObj(); if (!data?.path || data.path.length < 2) return stopWazeNavigation();
    const now = performance.now(), dtSec = Math.max(0.01, (now - WAZE_NAV.lastTime) / 1000); WAZE_NAV.lastTime = now;
    const currNode = data.path[Math.min(data.path.length - 1, Math.floor(WAZE_NAV.progress * (data.path.length - 1)))];
    WAZE_NAV.speedKmH = (currNode && currNode.inHazard) ? 16 : 32;
    WAZE_NAV.progress = Math.min(1, WAZE_NAV.progress + (WAZE_NAV.speedKmH * 3.5 / Math.max(1, data.totalDist)) * (dtSec / 3600) * 120);
    const nextExactIdx = WAZE_NAV.progress * (data.path.length - 1), ni0 = Math.floor(nextExactIdx), ni1 = Math.min(data.path.length - 1, ni0 + 1), frac = nextExactIdx - ni0, pA = data.path[ni0], pB = data.path[ni1];
    WAZE_NAV.currentCoord = { lat: pA.lat + (pB.lat - pA.lat) * frac, lon: normalizeLon(pA.unwrappedLon + (pB.unwrappedLon - pA.unwrappedLon) * frac) };
    WAZE_NAV.headingDeg = getRoverHeading(pA, pB); updateWazeNavHUD(); updateWazeRover2D();
    if (WAZE_NAV.progress >= 1) { stopWazeNavigation(); showWarning('🏁 ПУНКТ ПРИЗНАЧЕННЯ ДОСЯГНУТО! Маршрут завершено.'); }
}

function updateWazeNavHUD() {
    const data = getActiveRouteObj(); if (!data?.path) return;
    const remainingDist = Math.max(0, data.totalDist * (1 - WAZE_NAV.progress)), remainingHours = remainingDist / Math.max(1, WAZE_NAV.speedKmH);
    const elIcon = document.getElementById('wnbIcon'), elInstr = document.getElementById('wnbInstruction'), elDist = document.getElementById('wnbDist');
    const elSpeed = document.getElementById('wnbSpeed'), elRem = document.getElementById('wnbRemainingDist'), elEta = document.getElementById('wnbEta');
    if (elSpeed) elSpeed.innerText = `${Math.round(WAZE_NAV.speedKmH)} км/год`;
    if (elRem) elRem.innerText = remainingDist < 50 ? `${remainingDist.toFixed(1)} км` : `${Math.round(remainingDist)} км`;
    if (elEta) elEta.innerText = formatMarsDuration(remainingHours);

    let nextTargetName = 'Фініш (Точка B)', distToNextTarget = remainingDist, iconChar = '⬆';
    if (waypoints?.length) {
        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i], d = calculateMarsDistance(WAZE_NAV.currentCoord.lat, WAZE_NAV.currentCoord.lon, wp.lat, wp.lon);
            if (d > 5) { nextTargetName = wp.name || `Вейпоінт ${i + 1}`; distToNextTarget = d; iconChar = '↱'; break; }
        }
    }
    const curPt = data.path[Math.min(data.path.length - 1, Math.floor(WAZE_NAV.progress * (data.path.length - 1)))];
    if (curPt?.inHazard) { iconChar = '⚠️'; if (elInstr) elInstr.innerText = `УВАГА: ${curPt.hazardName || 'Зона підвищеної небезпеки'} (швидкість знижено)`; }
    else if (remainingDist < 30) { iconChar = '🏁'; if (elInstr) elInstr.innerText = 'Прибуття до Точки B (Фініш)'; }
    else if (elInstr) elInstr.innerText = `Рухайтесь до: ${nextTargetName}`;
    if (elIcon) elIcon.innerText = iconChar;
    if (elDist) elDist.innerText = distToNextTarget < 50 ? `${distToNextTarget.toFixed(1)} км` : `${Math.round(distToNextTarget)} км`;
}

let wazeReportsCache = [], wazeReportsPollId = null, chatPollId = null;
const REPORT_TYPE_CONFIG = {
    hazard: { label: 'Небезпека', icon: '⚠️', color: '#FF2E38', class: 'waze-type-hazard' },
    breakdown: { label: 'Зламаний ровер', icon: '🚜', color: '#F59E0B', class: 'waze-type-breakdown' },
    storm: { label: 'Буря', icon: '🌪️', color: '#FF5722', class: 'waze-type-storm' },
    ice: { label: 'Лід / Вода', icon: '🧊', color: '#06B6D4', class: 'waze-type-ice' },
    cache: { label: 'Схованка O₂', icon: '📦', color: '#10B981', class: 'waze-type-cache' },
    blocked: { label: 'Заблоковано', icon: '🛑', color: '#DC2626', class: 'waze-type-blocked' },
    landmark: { label: 'Артефакт', icon: '💎', color: '#8B5CF6', class: 'waze-type-landmark' },
    sos: { label: 'SOS Маяк', icon: '🆘', color: '#EF4444', class: 'waze-type-sos' }
};

async function fetchWazeReports() {
    try {
        const res = await fetch('/api/reports');
        if (res.status === 404) { if (wazeReportsPollId) { clearInterval(wazeReportsPollId); wazeReportsPollId = null; } return; }
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.reports)) { wazeReportsCache = data.reports; renderWazeReports2D(); }
    } catch (e) {}
}

function renderWazeReports2D() {
    wazeReportsGroup.clearLayers();
    if (!showWazeReports || !wazeReportsCache.length) return;
    wazeReportsCache.forEach(rep => {
        const conf = REPORT_TYPE_CONFIG[rep.type] || REPORT_TYPE_CONFIG.hazard, confirmsCount = rep.confirms ?? rep.confirmations ?? 0, repId = escHtml(rep.id);
        activeWorldOffsets.forEach(offset => {
            const icon = L.divIcon({ className: 'custom-pin', html: `<div class="waze-marker-wrap"><div class="waze-marker-pulse ${conf.class}-pulse"></div><div class="waze-marker-core ${conf.class}">${conf.icon}</div></div>`, iconSize: [32, 32], iconAnchor: [16, 16] });
            const marker = L.marker([rep.lat, rep.lon + offset * 360], { icon, zIndexOffset: 450 });
            marker.bindPopup(`<div class="waze-popup-box"><div class="wpb-tag" style="color:${conf.color};">${conf.icon} ${escHtml(conf.label)}</div><div class="wpb-title">${escHtml(rep.title || 'Позначка на мапі')}</div><div class="wpb-desc">${escHtml(rep.description || 'Без додаткового опису.')}</div><div class="wpb-meta"><span>👤 ${escHtml(rep.author || 'Астронавт')}</span><span>👍 ${confirmsCount} підтверджень</span></div><div class="wpb-actions"><button class="wpb-btn wpb-btn-primary" onclick="window.confirmWazeReport('${repId}')">👍 ПІДТВЕРДИТИ</button><button class="wpb-btn" onclick="window.addReportAsWaypoint('${repId}')">📍 ЯК ВЕЙПОІНТ</button></div></div>`, { className: 'mars-waze-popup', maxWidth: 280 });
            marker.on('click', (e) => L.DomEvent.stopPropagation(e)); wazeReportsGroup.addLayer(marker);
        });
    });
}

window.confirmWazeReport = async function(id) {
    try {
        const res = await fetch(`/api/reports/${encodeURIComponent(id)}/confirm`, { method: 'POST' }), data = await res.json();
        if (data.success) {
            const target = wazeReportsCache.find(r => String(r.id) === String(id));
            if (target) { const val = data.confirms ?? data.confirmations ?? ((target.confirms || 0) + 1); target.confirms = val; target.confirmations = val; }
            renderWazeReports2D(); showWarning('👍 Дякуємо! Позначку підтверджено.');
        }
    } catch (e) {}
};

window.addReportAsWaypoint = function(id) {
    const rep = wazeReportsCache.find(r => String(r.id) === String(id)); if (!rep) return;
    addWaypoint(rep.lat, rep.lon, `${rep.title} (${rep.type})`); map.closePopup();
};

let chatMessagesCache = [], isChatOpen = false, unreadChatCount = 0, attachedChatCoords = null;

function toggleAstronautChat(forceOpen = null) {
    const panel = document.getElementById('astronautChatPanel'); if (!panel) return;
    isChatOpen = (typeof forceOpen === 'boolean') ? forceOpen : panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', !isChatOpen); document.body.classList.toggle('chat-open', isChatOpen);
    if (isChatOpen) {
        unreadChatCount = 0; const badge = document.getElementById('chatUnreadBadge'); if (badge) badge.style.display = 'none';
        const feed = document.getElementById('chatMessages'); if (feed) feed.scrollTop = feed.scrollHeight;
        document.getElementById('chatInputText')?.focus();
    }
}

async function fetchChatMessages() {
    try {
        const res = await fetch('/api/chat');
        if (res.status === 404) { if (chatPollId) { clearInterval(chatPollId); chatPollId = null; } return; }
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages)) {
            const prevLen = chatMessagesCache.length; chatMessagesCache = data.messages; renderChatMessages();
            if (!isChatOpen && prevLen > 0 && chatMessagesCache.length > prevLen) {
                unreadChatCount += (chatMessagesCache.length - prevLen);
                const badge = document.getElementById('chatUnreadBadge'); if (badge) { badge.innerText = unreadChatCount; badge.style.display = 'inline-block'; }
            }
        }
    } catch (e) {}
}

function renderChatMessages() {
    const container = document.getElementById('chatMessages'); if (!container) return;
    container.innerHTML = chatMessagesCache.map(msg => {
        const isAlert = msg.isAlert || msg.is_alert || msg.type === 'alert' || (msg.text && msg.text.includes('🚨'));
        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : 'ЕФІР';
        const coords = msg.coords || (msg.lat != null && msg.lon != null ? { lat: Number(msg.lat), lon: Number(msg.lon) } : null);
        const coordsBtn = coords ? `<button class="cb-coords-btn" onclick="focusOnCoordinates(${Number(coords.lat)}, ${Number(coords.lon)})">📍 ${Number(coords.lat).toFixed(2)}°, ${Number(coords.lon).toFixed(2)}° (Показати)</button>` : '';
        return `<div class="chat-bubble ${isAlert ? 'chat-alert-msg' : ''}"><div class="cb-head"><span class="cb-callsign"><span class="btn-dot ${isAlert ? 'dot-red' : 'dot-green'}"></span>${escHtml(msg.author || msg.callsign || 'Космонавт')}</span><span class="cb-time">${escHtml(timeStr)}</span></div><div class="cb-text">${escHtml(msg.text || '')}</div>${coordsBtn}</div>`;
    }).join('');
    if (isChatOpen) container.scrollTop = container.scrollHeight;
}

window.focusOnCoordinates = function(lat, lon) {
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat, lng: normalizeLon(lon), altitude: 1.35 }, 1200);
    else map.flyTo([lat, lon + Math.round((map.getCenter().lng - lon) / 360) * 360], Math.max(map.getZoom(), 4.0), { duration: 1.0 });
    showWarning(`📍 ФОКУС НА КООРДИНАТАХ: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`);
};

async function sendChatMessage(text) {
    const cleanText = (text || '').trim(); if (!cleanText) return;
    const author = currentUser || document.getElementById('reportAuthor')?.value.trim() || 'Астронавт-1';
    try {
        const res = await fetch('/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author, callsign: author, text: cleanText, lat: attachedChatCoords ? attachedChatCoords.lat : null, lon: attachedChatCoords ? attachedChatCoords.lon : null, coords: attachedChatCoords ? { lat: attachedChatCoords.lat, lon: attachedChatCoords.lon } : null, channel: '142.800 MHz' })
        });
        if (res.ok) {
            attachedChatCoords = null;
            const bar = document.getElementById('chatAttachedCoordsBar'); if (bar) bar.style.display = 'none';
            const input = document.getElementById('chatInputText'); if (input) input.value = '';
            fetchChatMessages();
        } else showWarning('Сервер радіочату недоступний (запустіть node server.js)');
    } catch (e) { showWarning('Помилка передачі радіосигналу'); }
}

function initWazeAndChatModule() {
    const btnAddWp = document.getElementById('btnAddWaypoint'); if (btnAddWp) btnAddWp.onclick = () => { isPickingWaypoint = true; isPickingReportLoc = false; showWarning('📍 Клікніть на мапі для додавання вейпоінта...'); };
    const btnRev = document.getElementById('btnReverseRoute'); if (btnRev) btnRev.onclick = window.reverseRoute;
    const btnNav = document.getElementById('btnToggleNavigation'); if (btnNav) btnNav.onclick = toggleWazeNavigation;
    const btnStopNav = document.getElementById('btnStopNavigation'); if (btnStopNav) btnStopNav.onclick = stopWazeNavigation;
    const btnToggleChat = document.getElementById('btnToggleChat'); if (btnToggleChat) btnToggleChat.onclick = () => toggleAstronautChat();
    const btnCloseChat = document.getElementById('btnCloseChat'); if (btnCloseChat) btnCloseChat.onclick = () => toggleAstronautChat(false);
    const chatForm = document.getElementById('chatForm'); if (chatForm) chatForm.onsubmit = (e) => { e.preventDefault(); const input = document.getElementById('chatInputText'); if (input) sendChatMessage(input.value); };
    document.querySelectorAll('.quick-phrase-btn').forEach(btn => { btn.onclick = () => { const input = document.getElementById('chatInputText'); if (input) { input.value = btn.getAttribute('data-text'); input.focus(); } }; });

    const btnAttach = document.getElementById('btnChatAttachCoords');
    if (btnAttach) {
        btnAttach.onclick = () => {
            const c = ptA || (map ? map.getCenter() : { lat: 0, lng: 0 });
            attachedChatCoords = {
                lat: Number((c.lat).toFixed(4)),
                lon: Number((normalizeLon(c.lng ?? c.lon)).toFixed(4))
            };
            const bar = document.getElementById('chatAttachedCoordsBar');
            const txt = document.getElementById('chatAttachedCoordsText');
            if (bar && txt) {
                txt.innerText = `📍 ${attachedChatCoords.lat.toFixed(2)}°, ${attachedChatCoords.lon.toFixed(2)}°`;
                bar.style.display = 'flex';
            }
        };
    }

    const btnRemAttach = document.getElementById('btnRemoveAttachedCoords');
    if (btnRemAttach) {
        btnRemAttach.onclick = () => {
            attachedChatCoords = null;
            const bar = document.getElementById('chatAttachedCoordsBar');
            if (bar) bar.style.display = 'none';
        };
    }

    const btnOpenReport = document.getElementById('btnOpenReportModal');
    const reportModal = document.getElementById('reportModal');
    const btnCloseReport = document.getElementById('btnCloseReportModal');

    if (btnOpenReport && reportModal) {
        btnOpenReport.onclick = () => {
            const c = ptA || (map ? map.getCenter() : { lat: 0, lng: 0 });
            pendingReportCoords = {
                lat: Number((c.lat).toFixed(4)),
                lon: Number((normalizeLon(c.lng ?? c.lon)).toFixed(4))
            };
            const disp = document.getElementById('reportCoordsDisp');
            if (disp) disp.innerText = `Координати: ${pendingReportCoords.lat.toFixed(2)}°, ${pendingReportCoords.lon.toFixed(2)}°`;
            reportModal.style.display = 'flex';
        };
    }
    if (btnCloseReport && reportModal) {
        btnCloseReport.onclick = () => {
            reportModal.style.display = 'none';
            isPickingReportLoc = false;
        };
    }
    if (reportModal) {
        reportModal.onclick = (e) => {
            if (e.target === reportModal) {
                reportModal.style.display = 'none';
                isPickingReportLoc = false;
            }
        };
    }

    document.querySelectorAll('.report-type-selector .rtype-chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.report-type-selector .rtype-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const radio = chip.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        };
    });

    const btnUseRoverLoc = document.getElementById('btnUseRoverLoc');
    if (btnUseRoverLoc) {
        btnUseRoverLoc.onclick = () => {
            btnUseRoverLoc.classList.add('active');
            document.getElementById('btnPickLocOnMap')?.classList.remove('active');
            isPickingReportLoc = false;
            const c = ptA || (map ? map.getCenter() : { lat: 0, lng: 0 });
            pendingReportCoords = {
                lat: Number((c.lat).toFixed(4)),
                lon: Number((normalizeLon(c.lng ?? c.lon)).toFixed(4))
            };
            const disp = document.getElementById('reportCoordsDisp');
            if (disp) disp.innerText = `Координати: ${pendingReportCoords.lat.toFixed(2)}°, ${pendingReportCoords.lon.toFixed(2)}°`;
        };
    }

    const btnPickLocOnMap = document.getElementById('btnPickLocOnMap');
    if (btnPickLocOnMap) {
        btnPickLocOnMap.onclick = () => {
            btnPickLocOnMap.classList.add('active');
            btnUseRoverLoc?.classList.remove('active');
            isPickingReportLoc = true;
            isPickingWaypoint = false;
            if (reportModal) reportModal.style.display = 'none';
            showWarning('🎯 Клікніть на мапі в місці розташування події...');
        };
    }

    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.onsubmit = async (e) => {
            e.preventDefault();
            const activeChip = document.querySelector('.report-type-selector .rtype-chip.active');
            const type = activeChip ? activeChip.getAttribute('data-type') : 'hazard';
            const title = document.getElementById('reportTitle')?.value.trim();
            const description = document.getElementById('reportDesc')?.value.trim();
            const author = document.getElementById('reportAuthor')?.value.trim() || currentUser || 'Астронавт-1';

            if (!title) return alert('Будь ласка, вкажіть заголовок позначки!');

            try {
                const payload = {
                    type,
                    title,
                    description,
                    lat: pendingReportCoords.lat,
                    lon: pendingReportCoords.lon,
                    author
                };
                const res = await fetch('/api/reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    if (reportModal) reportModal.style.display = 'none';
                    const tInput = document.getElementById('reportTitle');
                    const dInput = document.getElementById('reportDesc');
                    if (tInput) tInput.value = '';
                    if (dInput) dInput.value = '';
                    showWarning(`📡 Позначку "${title}" опубліковано на мапі та в радіочаті!`);
                    fetchWazeReports();
                    fetchChatMessages();
                } else {
                    showWarning('Сервер позначок недоступний (запустіть node server.js)');
                }
            } catch (err) {
                alert('Помилка публікації позначки');
            }
        };
    }

    fetchWazeReports();
    fetchChatMessages();
    wazeReportsPollId = setInterval(fetchWazeReports, 6000);
    chatPollId = setInterval(fetchChatMessages, 3500);
}

// СТАРТ ЗАСТОСУНКУ
syncWorldLayers(true);
renderZonesList();
setHazardVisibility(true);
setSafeVisibility(true);
setBasesVisibility(true);
initAccountModal();
checkAuthSession();
initWeatherAndStormModule();
initWazeAndChatModule();

if (window.I18N) I18N.onChange(() => { if (safeRouteData && fastRouteData) renderDualElevationChart(-1); });