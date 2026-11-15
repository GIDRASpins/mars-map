const MARS_RADIUS_KM = 3389.5;
let activeWorldOffsets = [-1, 0, 1];
const MARS_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg';

const MARS_STORM_PRESETS = {
    hellas: { name: '[СЦЕНАРІЙ] Циклон «Діабло» (Hellas Cyclone DS-01)', regionName: 'Hellas Planitia (Рівнина Еллада)', lat: -28.0, lon: 70.0, headingDeg: 62, speedKmH: 48, radiusKm: 520, outerRadiusKm: 860, windSpeedMs: 34.5, tau: 2.85 },
    chryse: { name: '[СЦЕНАРІЙ] Пиловий шквал «Хриса» (Chryse Storm DS-02)', regionName: 'Chryse Planitia (Рівнина Хриса)', lat: 24.5, lon: -42.0, headingDeg: 115, speedKmH: 44, radiusKm: 480, outerRadiusKm: 800, windSpeedMs: 31.8, tau: 2.65 },
    valles: { name: '[СЦЕНАРІЙ] Каньйонний тайфун «Марінер» (Valles Front DS-03)', regionName: 'Valles Marineris (Долина Марінера)', lat: -13.5, lon: -65.0, headingDeg: 84, speedKmH: 54, radiusKm: 450, outerRadiusKm: 760, windSpeedMs: 38.2, tau: 3.10 },
    elysium: { name: '[СЦЕНАРІЙ] Вулканічний вихор «Елізій» (Elysium Vortex DS-04)', regionName: 'Elysium Planitia (Рівнина Елізій)', lat: 12.0, lon: 148.0, headingDeg: 135, speedKmH: 38, radiusKm: 470, outerRadiusKm: 790, windSpeedMs: 29.5, tau: 2.40 },
    utopia: { name: '[СЦЕНАРІЙ] Полярний пиловий фронт «Утопія» (Utopia Front DS-05)', regionName: 'Utopia Planitia (Рівнина Утопія)', lat: 44.0, lon: 115.0, headingDeg: 95, speedKmH: 46, radiusKm: 530, outerRadiusKm: 880, windSpeedMs: 33.0, tau: 2.75 }
};

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

// ============================================================================
// 1. КАТАЛОГ ЗОН ТА БАЗ МАРСА
// ============================================================================
const MARS_ZONES = [
    {
        id: 'planum_boreum', name: 'Північна полярна шапка (Planum Boreum)', type: 'hazard', isPolar: true,
        coords: [
            [74.34,-180],[74.0,-175],[73.75,-170],[73.6,-165],[73.55,-160],[73.57,-155],[73.64,-150],[73.72,-145],[73.78,-140],[73.83,-135],
            [73.84,-130],[73.83,-125],[73.82,-120],[73.82,-115],[73.86,-110],[73.95,-105],[74.08,-100],[74.23,-95],[74.39,-90],[74.51,-85],
            [74.56,-80],[74.51,-75],[74.34,-70],[74.06,-65],[73.69,-60],[73.27,-55],[72.85,-50],[72.49,-45],[72.24,-40],[72.15,-35],
            [72.24,-30],[72.51,-25],[72.95,-20],[73.5,-15],[74.11,-10],[74.72,-5],[75.27,0],[75.71,5],[76.0,10],[76.14,15],[76.12,20],
            [75.99,25],[75.76,30],[75.48,35],[75.17,40],[74.86,45],[74.55,50],[74.26,55],[73.97,60],[73.66,65],[73.34,70],[73.0,75],
            [72.64,80],[72.3,85],[72.0,90],[71.79,95],[71.69,100],[71.76,105],[71.99,110],[72.38,115],[72.91,120],[73.54,125],[74.2,130],
            [74.83,135],[75.37,140],[75.76,145],[75.98,150],[76.0,155],[75.85,160],[75.55,165],[75.17,170],[74.74,175],[74.34,180],[89.99,180],[89.99,-180]
        ]
    },
    {
        id: 'planum_australe', name: 'Південна полярна шапка (Planum Australe)', type: 'hazard', isPolar: true,
        coords: [
            [-74.34,-180],[-74.0,-175],[-73.75,-170],[-73.6,-165],[-73.55,-160],[-73.57,-155],[-73.64,-150],[-73.72,-145],[-73.78,-140],[-73.83,-135],
            [-73.84,-130],[-73.83,-125],[-73.82,-120],[-73.82,-115],[-73.86,-110],[-73.95,-105],[-74.08,-100],[-74.23,-95],[-74.39,-90],[-74.51,-85],
            [-74.56,-80],[-74.51,-75],[-74.34,-70],[-74.06,-65],[-73.69,-60],[-73.27,-55],[-72.85,-50],[-72.49,-45],[-72.24,-40],[-72.15,-35],
            [-72.24,-30],[-72.51,-25],[-72.95,-20],[-73.5,-15],[-74.11,-10],[-74.72,-5],[-75.27,0],[-75.71,5],[-76.0,10],[-76.14,15],[-76.12,20],
            [-75.99,25],[-75.76,30],[-75.48,35],[-75.17,40],[-74.86,45],[-74.55,50],[-74.26,55],[-73.97,60],[-73.66,65],[-73.34,70],[-73.0,75],
            [-72.64,80],[-72.3,85],[-72.0,90],[-71.79,95],[-71.69,100],[-71.76,105],[-71.99,110],[-72.38,115],[-72.91,120],[-73.54,125],[-74.2,130],
            [-74.83,135],[-75.37,140],[-75.76,145],[-75.98,150],[-76.0,155],[-75.85,160],[-75.55,165],[-75.17,170],[-74.74,175],[-74.34,180],[-89.99,180],[-89.99,-180]
        ]
    },
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

let showHazardZones = true, showSafeZones = true, showBases = true;
let hazardsAvoidanceActive = true, is3DMode = false, toastTimeout = null;
let activeZoneFilter = 'all', currentSelectedZoneId = null;
let safeHoverMarker = null, fastHoverMarker = null, isSosRouteActive = false;

// 2. ГЕОМЕТРІЯ
function normalizeLon(lon) { return ((lon + 180) % 360 + 360) % 360 - 180; }

function isPointInPolygon(lat, lon, poly, bbox) {
    if (lat < bbox[0] || lat > bbox[1] || lon < bbox[2] || lon > bbox[3]) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
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
        const brng = (i / steps) * Math.PI * 2;
        const dR = (radiusKm * getStormContourWobble(brng, seed)) / MARS_RADIUS_KM;
        const p2 = Math.asin(Math.sin(p1) * Math.cos(dR) + Math.cos(p1) * Math.sin(dR) * Math.cos(brng));
        const l2 = l1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(p1), Math.cos(dR) - Math.sin(p1) * Math.sin(p2));
        const rawLon = l2 / rad;
        prevLon += ((rawLon - prevLon + 180) % 360 + 360) % 360 - 180;
        pts.push([p2 / rad, prevLon]);
    }
    return pts;
}

// 3. MOLA МОДЕЛЬ
function getMolaElevation(lat, lon) {
    let elev = -1500 + Math.sin((lat - 8) * Math.PI / 180) * -2700;
    elev += Math.sin(lat * 0.12 + 0.3) * Math.cos(lon * 0.12) * 600;
    elev += Math.sin(lat * 0.35) * Math.cos(lon * 0.35) * 250;
    const dTharsis = Math.hypot((lat - 1) * 1.3, lon + 95);
    if (dTharsis < 38) elev += Math.cos((dTharsis / 38) * (Math.PI / 2)) * 6200;
    const dOly = Math.hypot(lat - 18.4, lon + 133.8);
    if (dOly < 5.5) elev += dOly > 3.6 ? (4000 + (5.5 - dOly) * 3500) : (11000 + (3.6 - dOly) * 2800);
    const dAsc = Math.hypot(lat - 11.8, lon + 104.5);
    if (dAsc < 4.5) elev += (4.5 - dAsc) * 2600;
    const dPav = Math.hypot(lat - 0.8, lon + 113.0);
    if (dPav < 4.0) elev += (4.0 - dPav) * 2200;
    const dArs = Math.hypot(lat + 9.0, lon + 121.0);
    if (dArs < 4.5) elev += (4.5 - dArs) * 2400;
    const dEly = Math.hypot(lat - 25.0, lon - 147.2);
    if (dEly < 5.0) elev += (5.0 - dEly) * 2200;
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
    if (dHel < 18.0) {
        elev += dHel > 12.0 ? Math.sin(((dHel - 12.0) / 6.0) * Math.PI) * 2400 : -Math.cos((dHel / 12.0) * (Math.PI / 2)) * 5600;
    }
    return Math.round(elev);
}

let lastTeleTime = 0;
function updateTelemetry(lat, lon) {
    const elLat = document.getElementById('teleLat'), elLon = document.getElementById('teleLon'), elAlt = document.getElementById('teleAlt');
    if (!elLat || !elLon || !elAlt) return;
    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) { elLat.innerText = '---'; elLon.innerText = '---'; elAlt.innerText = '---'; return; }
    const clampedLat = Math.max(-90, Math.min(90, lat)), clampedLon = normalizeLon(lon), alt = getMolaElevation(clampedLat, clampedLon);
    elLat.innerText = `${clampedLat.toFixed(4)}°`; elLon.innerText = `${clampedLon.toFixed(4)}°`; elAlt.innerText = `${alt > 0 ? '+' : ''}${alt} M`;
}

// 4. LEAFLET 2D
const map = L.map('map', {
    crs: L.CRS.EPSG4326, center: [0, 0], zoom: 2, zoomSnap: 0.05,
    preferCanvas: true, worldCopyJump: false, maxBounds: [[-90, -1e9], [90, 1e9]], maxBoundsViscosity: 1.0
});

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
new MarsCylindricalLayer({ tileSize: 256, updateWhenIdle: false, keepBuffer: 2 }).addTo(map);

function computeVisibleWorldOffsets() {
    const b = map.getBounds();
    const minO = Math.floor((b.getWest() + 180) / 360) - 1, maxO = Math.ceil((b.getEast() - 180) / 360) + 1;
    const offsets = [];
    for (let o = minO; o <= maxO; o++) offsets.push(o);
    return offsets;
}

function updatePoleToPoleZoom() {
    const h = map.getSize().y;
    if (!h) return;
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
    else { if (map.hasLayer(hazardLayerGroup)) map.removeLayer(hazardLayerGroup); }
    if (showSafeZones) { if (!map.hasLayer(safeLayerGroup)) map.addLayer(safeLayerGroup); }
    else { if (map.hasLayer(safeLayerGroup)) map.removeLayer(safeLayerGroup); }
}

function renderBases2D() {
    baseLayerGroup.clearLayers();
    if (!showBases) return;
    MARS_BASES.forEach(b => {
        activeWorldOffsets.forEach(offset => {
            const icon = L.divIcon({
                className: 'custom-pin',
                html: `<div class="mars-base-pin" title="${b.name}"><div class="mars-base-badge">⌂</div><div class="mars-base-label">${b.shortName}</div></div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            });
            const marker = L.marker([b.lat, b.lon + offset * 360], { icon, zIndexOffset: 380 });
            marker.on('click', (e) => { L.DomEvent.stopPropagation(e); handleCoordinateSelect(b.lat, b.lon); });
            baseLayerGroup.addLayer(marker);
        });
    });
}

window.focusOnBase = function(baseId) {
    const b = MARS_BASES.find(x => x.id === baseId);
    if (!b) return;
    if (b.zoneId) highlightSelectedZone(b.zoneId);
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: b.lat, lng: normalizeLon(b.lon), altitude: 1.35 }, 1200);
    else {
        const closestOffset = Math.round((map.getCenter().lng - b.lon) / 360);
        map.flyTo([b.lat, b.lon + closestOffset * 360], Math.max(map.getZoom(), 3.2), { duration: 1.2 });
    }
    showWarning(`🏠 БАЗА: ${b.name} (${b.type})`);
};

function highlightSelectedZone(zoneId) {
    currentSelectedZoneId = zoneId || null;
    selectedZoneGroup.clearLayers();
    if (!zoneId) return;
    const zone = MARS_ZONES.find(z => z.id === zoneId);
    if (!zone) return;
    const isHaz = zone.type === 'hazard';
    activeWorldOffsets.forEach(offset => {
        const hl = L.polygon(zone.smoothCoords.map(pt => [pt[0], pt[1] + offset * 360]), {
            color: isHaz ? '#FF5722' : '#00FFAA', fillColor: isHaz ? '#FF5722' : '#00FFAA',
            fillOpacity: 0.38, weight: 4.5, lineCap: 'round', lineJoin: 'round', dashArray: '8, 6', className: 'zone-selected-glow'
        });
        selectedZoneGroup.addLayer(hl);
    });
}

function rerenderRoutes2D() {
    if (!safeRouteData || !fastRouteData) return;
    renderMultiWorldPolyline(fastPolylineGroup, splitPathAtAntimeridian(fastRouteData.path), {
        color: '#FF2E38', weight: activeRouteMode === 'fast' ? 5 : 2.5, opacity: activeRouteMode === 'fast' ? 1 : 0.35, dashArray: '5, 6'
    }, 'ШВИДКИЙ МАРШРУТ', '#FF2E38');
    renderMultiWorldPolyline(safePolylineGroup, splitPathAtAntimeridian(safeRouteData.path), {
        color: '#00FFAA', weight: activeRouteMode === 'safe' ? 5 : 2.5, opacity: activeRouteMode === 'safe' ? 1 : 0.35
    }, 'БЕЗПЕЧНИЙ МАРШРУТ', '#00FFAA');
}

function syncWorldLayers(force = false) {
    if (isMarkerDragging) return;
    const nextOffsets = computeVisibleWorldOffsets();
    const changed = force || nextOffsets.length !== activeWorldOffsets.length ||
        nextOffsets[0] !== activeWorldOffsets[0] || nextOffsets[nextOffsets.length - 1] !== activeWorldOffsets[activeWorldOffsets.length - 1];
    if (!changed) return;
    activeWorldOffsets = nextOffsets;
    renderZones2D(); renderBases2D();
    if (currentSelectedZoneId) highlightSelectedZone(currentSelectedZoneId);
    updateMarkerLayers(); rerenderRoutes2D();
    if (typeof renderStorms2D === 'function') renderStorms2D();
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
    const now = performance.now();
    if (now - lastTeleTime < 40) return;
    lastTeleTime = now;
    updateTelemetry(e.latlng.lat, e.latlng.lng);
});

// 5. 3D GLOBE
function getSphericalSignedArea(ring) {
    const pts = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ? ring.slice(0, -1) : ring;
    if (pts.length < 3) return 0;
    const toRad = Math.PI / 180;
    let total = 0;
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
            else {
                const sinO = Math.sin(omega), a = Math.sin((1 - t) * omega) / sinO, b = Math.sin(t * omega) / sinO;
                xi = a * x1 + b * x2; yi = a * y1 + b * y2; zi = a * z1 + b * z2;
            }
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
    const edge = coords.slice(0, -2);
    const poleLat = isNorth ? 89.9 : -89.9;
    const west = edge.filter(p => p[1] <= 0).map(p => [p[1], p[0]]);
    const east = edge.filter(p => p[1] >= 0).map(p => [p[1], p[0]]);
    if (isNorth) {
        return [[ [[-180, poleLat], [0, poleLat], ...west.slice().reverse(), [-180, poleLat]] ], [ [[0, poleLat], [180, poleLat], ...east.slice().reverse(), [0, poleLat]] ]];
    }
    return [[ [...west, [0, poleLat], [-180, poleLat], west[0]] ], [ [...east, [180, poleLat], [0, poleLat], east[0]] ]];
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
    const pts = showBases ? MARS_BASES.map(b => ({
        id: b.id, lat: b.lat, lng: normalizeLon(b.lon), name: b.name, type: b.type, color: '#38BDF8', radius: 0.42, altitude: 0.025
    })) : [];
    myGlobe.pointsData(pts).pointLat('lat').pointLng('lng').pointColor('color').pointRadius('radius').pointAltitude('altitude')
        .pointLabel(d => `<div style="background:rgba(15,23,42,0.92);color:#fff;padding:6px 10px;border-radius:8px;border:1px solid #38BDF8;font-family:'Space Grotesk',sans-serif;font-size:12px;"><b>🏠 ${d.name}</b><br><span style="color:#94A3B8;font-size:11px;">${d.type}</span></div>`)
        .onPointClick(d => { if (d) handleCoordinateSelect(d.lat, d.lng); });
}

try {
    myGlobe = Globe()(document.getElementById('globe-container'))
        .globeImageUrl(MARS_TEXTURE_URL).backgroundColor('#050608').showAtmosphere(true).atmosphereColor('#ff5533').atmosphereAltitude(0.12)
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
    btnTop.classList.toggle('active', showHazardZones); btnTop.classList.toggle('inactive', !showHazardZones);
    btnTop.innerHTML = `<span class="btn-dot ${showHazardZones ? 'dot-red' : 'dot-muted'}"></span>НЕБЕЗПЕКИ: ${showHazardZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`;
    document.getElementById('switchToggleHazards').classList.toggle('active', showHazardZones);
    update2DLayerVisibility(); if (myGlobe) myGlobe.polygonsData(getActive3DFeatures());
}

function setSafeVisibility(visible) {
    showSafeZones = visible;
    const btnTop = document.getElementById('btnVisSafe');
    btnTop.classList.toggle('active', showSafeZones); btnTop.classList.toggle('inactive', !showSafeZones);
    btnTop.innerHTML = `<span class="btn-dot ${showSafeZones ? 'dot-green' : 'dot-muted'}"></span>БЕЗПЕЧНІ: ${showSafeZones ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`;
    document.getElementById('switchToggleSafe').classList.toggle('active', showSafeZones);
    update2DLayerVisibility(); if (myGlobe) myGlobe.polygonsData(getActive3DFeatures());
}

function setBasesVisibility(visible) {
    showBases = visible;
    const btnTop = document.getElementById('btnVisBases');
    if (btnTop) {
        btnTop.classList.toggle('active', showBases); btnTop.classList.toggle('inactive', !showBases);
        btnTop.innerHTML = `<span class="btn-dot ${showBases ? 'dot-base' : 'dot-muted'}"></span>БАЗИ: ${showBases ? 'ПОКАЗАНО' : 'ПРИХОВАНО'}`;
    }
    const sw = document.getElementById('switchToggleBases');
    if (sw) sw.classList.toggle('active', showBases);
    renderBases2D(); update3DBases();
}

document.getElementById('btnVisHazards').onclick = () => setHazardVisibility(!showHazardZones);
document.getElementById('btnVisSafe').onclick = () => setSafeVisibility(!showSafeZones);
document.getElementById('btnVisBases')?.addEventListener('click', () => setBasesVisibility(!showBases));
document.getElementById('switchToggleHazards').onclick = () => setHazardVisibility(!showHazardZones);
document.getElementById('switchToggleSafe').onclick = () => setSafeVisibility(!showSafeZones);
document.getElementById('switchToggleBases')?.addEventListener('click', () => setBasesVisibility(!showBases));

document.getElementById('btnToggleHazards').onclick = (e) => {
    hazardsAvoidanceActive = !hazardsAvoidanceActive;
    e.target.classList.toggle('active', hazardsAvoidanceActive);
    e.target.innerText = hazardsAvoidanceActive ? "A* ОБМЕЖЕННЯ: УВІМК" : "A* ОБМЕЖЕННЯ: ВИМК";
    if (routeConfirmed && ptA && ptB) buildRoute(false);
};

document.getElementById('btnToggleView').onclick = () => {
    const btn = document.getElementById('btnToggleView');
    is3DMode = !is3DMode;
    btn.classList.toggle('is-3d', is3DMode);
    const label = is3DMode ? 'Перемкнути на 2D карту' : 'Перемкнути на 3D карту';
    btn.title = label; btn.setAttribute('aria-label', label);
    document.getElementById('map').style.display = is3DMode ? 'none' : 'block';
    document.getElementById('globe-container').style.display = is3DMode ? 'block' : 'none';
    if (!is3DMode) { map.invalidateSize(); updatePoleToPoleZoom(); syncWorldLayers(true); }
    else if (myGlobe) {
        myGlobe.width(window.innerWidth).height(window.innerHeight);
        if (!globeInitializedView) {
            globeInitializedView = true;
            const c = map.getCenter();
            myGlobe.pointOfView({ lat: c.lat, lng: normalizeLon(c.lng), altitude: 2.1 }, 0);
        }
        myGlobe.polygonsData(getActive3DFeatures()); update3DBases();
        if (typeof update3DStormRings === 'function') update3DStormRings();
        update3DPinsAndPaths();
    }
};

document.getElementById('btnToggleSidebar').onclick = () => {
    const sb = document.getElementById('sidebar'), toggleBtn = document.getElementById('btnToggleSidebar');
    sb.classList.toggle('collapsed'); toggleBtn.classList.toggle('collapsed');
    toggleBtn.innerText = sb.classList.contains('collapsed') ? '❯' : '❮';
};

const btnCloseSidebarMobile = document.getElementById('btnCloseSidebarMobile');
if (btnCloseSidebarMobile) {
    btnCloseSidebarMobile.onclick = () => {
        const sb = document.getElementById('sidebar'), toggleBtn = document.getElementById('btnToggleSidebar');
        sb.classList.add('collapsed'); toggleBtn.classList.add('collapsed'); toggleBtn.innerText = '❯';
    };
}
if (window.innerWidth <= 768) {
    const sb = document.getElementById('sidebar'), toggleBtn = document.getElementById('btnToggleSidebar');
    if (sb && toggleBtn) { sb.classList.add('collapsed'); toggleBtn.classList.add('collapsed'); toggleBtn.innerText = '❯'; }
}

function showWarning(msg) {
    const toast = document.getElementById('warningToast');
    document.getElementById('warningMsg').innerText = msg;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 6500);
}

// 7. СПИСОК ЗОН ТА БАЗ
function renderZonesList(searchQuery = '') {
    const container = document.getElementById('zonesListContainer'), query = searchQuery.toLowerCase().trim();
    if (activeZoneFilter === 'base') {
        const filteredBases = MARS_BASES.filter(b => !query || b.name.toLowerCase().includes(query) || b.type.toLowerCase().includes(query) || b.id.includes(query));
        if (filteredBases.length === 0) { container.innerHTML = `<div style="font-size:0.72rem; color:#64748B; padding:10px; text-align:center;">Баз не знайдено</div>`; return; }
        container.innerHTML = filteredBases.map(b => `
            <div class="zone-item base-item" onclick="focusOnBase('${b.id}')">
                <div class="zone-item-head"><span class="zone-item-title"><span class="btn-dot dot-base"></span>${b.name}</span><button class="zone-item-btn" onclick="event.stopPropagation(); focusOnBase('${b.id}')">⌖</button></div>
            </div>
        `).join('');
        return;
    }
    const filtered = MARS_ZONES.filter(z => (activeZoneFilter === 'all' || z.type === activeZoneFilter) && (!query || z.name.toLowerCase().includes(query) || z.id.includes(query)));
    if (filtered.length === 0) { container.innerHTML = `<div style="font-size:0.72rem; color:#64748B; padding:10px; text-align:center;">Зон не знайдено</div>`; return; }
    container.innerHTML = filtered.map(z => {
        const isHaz = z.type === 'hazard';
        return `<div class="zone-item ${isHaz ? 'hazard-item' : 'safe-item'}" onclick="focusOnZone('${z.id}')"><div class="zone-item-head"><span class="zone-item-title"><span class="btn-dot ${isHaz ? 'dot-red' : 'dot-green'}"></span>${z.name}</span><button class="zone-item-btn" onclick="event.stopPropagation(); focusOnZone('${z.id}')">⌖</button></div></div>`;
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
document.getElementById('zoneFilterInput')?.addEventListener('input', (e) => renderZonesList(e.target.value));

window.focusOnZone = function(zoneId) {
    const zone = MARS_ZONES.find(z => z.id === zoneId);
    if (!zone) return;
    highlightSelectedZone(zoneId);
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: zone.centroid[0], lng: zone.centroid[1], altitude: 1.5 }, 1200);
    else {
        const closestOffset = Math.round((map.getCenter().lng - zone.centroid[1]) / 360);
        map.flyTo([zone.centroid[0], zone.centroid[1] + closestOffset * 360], Math.max(map.getZoom(), 2.8), { duration: 1.2 });
    }
    showWarning(`ФОКУС: ${zone.name}`); displayZoneDetails(zoneId);
    const sel = document.getElementById('zoneSelect');
    if (sel && sel.value !== zoneId) sel.value = zoneId;
};

function populateZoneSelect() {
    const select = document.getElementById('zoneSelect');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Оберіть зону Марса...</option>';
    MARS_ZONES.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone.id; option.textContent = zone.name; select.appendChild(option);
    });
}

function displayZoneDetails(zoneId) {
    const zone = MARS_ZONES.find(z => z.id === zoneId);
    if (!zone) return;
    const card = document.getElementById('zoneInfoCard'), nameEl = document.getElementById('cardZoneName'), terrainEl = document.getElementById('cardTerrainType');
    if (nameEl) nameEl.innerText = zone.name;
    if (terrainEl) terrainEl.innerText = zone.type === 'hazard' ? "Кам'янистий / Скелястий каньйон" : "Піщаний / Базальтова рівнина";
    let weatherStatus = "Ясно, легкий пиловий серпанок", zoneTemp = zone.type === 'hazard' ? "-78 °C" : "-55 °C";
    if (typeof getStormImpactAtPoint === 'function') {
        const zLat = zone.centroid ? zone.centroid[0] : zone.coords[0][0], zLon = zone.centroid ? zone.centroid[1] : zone.coords[0][1];
        const stormInfo = getStormImpactAtPoint(zLat, zLon);
        if (stormInfo && stormInfo.inStorm) {
            weatherStatus = `⚠️ ШТОРМ: ${stormInfo.stormName} (${stormInfo.windSpeed} м/с, τ=${stormInfo.tau})`;
            zoneTemp = "-84 °C (сильне затемнення)";
        }
    }
    document.getElementById('cardIcePresence').innerText = zone.type === 'hazard' ? "Ні" : "Присутній (глибина ~1.2м)";
    document.getElementById('cardWeather').innerText = weatherStatus;
    document.getElementById('cardTime').innerText = "14:32 MTC";
    document.getElementById('cardTemp').innerText = zoneTemp;
    if (card) card.style.display = 'block';
}

document.getElementById('zoneSelect')?.addEventListener('change', (e) => { if (e.target.value) focusOnZone(e.target.value); });
document.getElementById('btnCloseZoneCard')?.addEventListener('click', () => {
    const card = document.getElementById('zoneInfoCard');
    if (card) card.style.display = 'none';
    currentSelectedZoneId = null; selectedZoneGroup.clearLayers();
    const select = document.getElementById('zoneSelect');
    if (select) select.value = "";
});
populateZoneSelect();

// 8. МАРКЕРИ ТА МАРШРУТИ
let ptA = null, ptB = null, fastRouteData = null, safeRouteData = null, activeRouteMode = 'safe';
let routeConfirmed = false, liveDragRouteTimer = null, lastLiveRouteTime = 0;

function scheduleLiveRouteRebuild() {
    if (!routeConfirmed || !ptA || !ptB) return;
    const now = performance.now(), elapsed = now - lastLiveRouteTime;
    if (elapsed >= 160) { lastLiveRouteTime = now; buildRoute(false); }
    else if (!liveDragRouteTimer) {
        liveDragRouteTimer = setTimeout(() => {
            liveDragRouteTimer = null; lastLiveRouteTime = performance.now();
            if (routeConfirmed && ptA && ptB) buildRoute(false);
        }, 160 - elapsed);
    }
}

function makeNothingPin(letter, isRed) {
    const bg = isRed ? '#FF2E38' : '#00F0FF', textCol = isRed ? '#FFFFFF' : '#000000';
    return L.divIcon({
        className: 'custom-pin',
        html: `<div style="background:${bg}; color:${textCol}; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk'; font-weight:800; font-size:11px; border:2px solid #000; box-shadow:0 0 12px ${bg};">${letter}</div>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
    });
}

function renderSyncedMarker(group, pt, letter, isRed, onPointDrag, onPointChange) {
    group.clearLayers();
    if (!pt) return;
    activeWorldOffsets.forEach(offset => {
        const marker = L.marker([pt.lat, pt.lon + offset * 360], { icon: makeNothingPin(letter, isRed), draggable: true });
        marker._worldOffset = offset;
        marker.on('dragstart', () => { isMarkerDragging = true; });
        marker.on('drag', (e) => {
            const raw = e.target.getLatLng(), normL = normalizeLon(raw.lng);
            group.eachLayer(m => { if (m !== marker) m.setLatLng([raw.lat, normL + m._worldOffset * 360]); });
            onPointDrag({ lat: Math.max(-90, Math.min(90, Number(Number(raw.lat).toFixed(4)))), lon: Number(normL.toFixed(4)) });
        });
        marker.on('dragend', (e) => {
            isMarkerDragging = false;
            const raw = e.target.getLatLng();
            onPointChange({ lat: Math.max(-90, Math.min(90, Number(Number(raw.lat).toFixed(4)))), lon: Number(normalizeLon(raw.lng).toFixed(4)) });
        });
        group.addLayer(marker);
    });
}

function updateMarkerLayers() {
    renderSyncedMarker(markerAGroup, ptA, 'A', false,
        (dragPt) => { ptA = dragPt; syncUI(); if (routeConfirmed) scheduleLiveRouteRebuild(); },
        (newPt) => { ptA = newPt; updateMarkerLayers(); syncUI(); if (routeConfirmed && ptB) buildRoute(false); debouncedSaveCloudRoute(); }
    );
    renderSyncedMarker(markerBGroup, ptB, 'B', true,
        (dragPt) => { ptB = dragPt; syncUI(); if (routeConfirmed) scheduleLiveRouteRebuild(); },
        (newPt) => { ptB = newPt; updateMarkerLayers(); syncUI(); if (routeConfirmed && ptA) buildRoute(false); debouncedSaveCloudRoute(); }
    );
}

function splitPathAtAntimeridian(path) {
    if (!path || path.length < 2) return path ? [path.map(p => [p.lat, normalizeLon(p.lon)])] : [];
    const segments = [];
    let currentSegment = [];
    for (let i = 0; i < path.length; i++) {
        const pt = path[i], currLon = normalizeLon(pt.lon), currLat = pt.lat;
        if (i === 0) { currentSegment.push([currLat, currLon]); continue; }
        const prevLon = normalizeLon(path[i - 1].lon), prevLat = path[i - 1].lat, dLon = currLon - prevLon;
        if (Math.abs(dLon) > 180) {
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
    if (ptB) labels.push({ lat: ptB.lat, lng: ptB.lon, text: 'B', color: '#FF2E38' });
    myGlobe.labelsData(labels).labelLat('lat').labelLng('lng').labelText('text').labelSize(1.8).labelDotRadius(0.6).labelColor('color').labelResolution(3).labelAltitude(0.018);
    if (typeof update3DStormRings === 'function') update3DStormRings();
    if (typeof update3DStormHtmlElements === 'function') update3DStormHtmlElements();
    const paths = [];
    if (safeRouteData && fastRouteData) {
        const safeSegs = splitPathAtAntimeridian(safeRouteData.path), fastSegs = splitPathAtAntimeridian(fastRouteData.path);
        if (activeRouteMode === 'safe') {
            fastSegs.forEach(seg => paths.push({ coords: seg, color: 'rgba(255,46,56,0.35)' }));
            safeSegs.forEach(seg => paths.push({ coords: seg, color: '#00FFAA' }));
        } else {
            safeSegs.forEach(seg => paths.push({ coords: seg, color: 'rgba(0,255,170,0.35)' }));
            fastSegs.forEach(seg => paths.push({ coords: seg, color: '#FF2E38' }));
        }
    }
    myGlobe.pathsData(paths).pathPoints('coords').pathPointLat(p => p[0]).pathPointLng(p => p[1])
        .pathColor('color').pathDashLength(0.03).pathDashGap(0.015).pathDashAnimateTime(3500).pathStroke(2.6).pathAltitude(0.010);
}

function applyCloudRoutePoints(pointA, pointB, autoBuild = true) {
    isSosRouteActive = false;
    ptA = (pointA && typeof pointA.lat === 'number') ? { lat: Number(pointA.lat), lon: Number(normalizeLon(pointA.lon)) } : null;
    ptB = (pointB && typeof pointB.lat === 'number') ? { lat: Number(pointB.lat), lon: Number(normalizeLon(pointB.lon)) } : null;
    updateMarkerLayers(); syncUI();
    if (autoBuild && ptA && ptB) { routeConfirmed = true; buildRoute(true); }
    else { routeConfirmed = false; stopAndClearRouteTimer(); update3DPinsAndPaths(); }
}

function handleCoordinateSelect(rawLat, rawLon) {
    isSosRouteActive = false;
    const lat = Math.max(-90, Math.min(90, Number(Number(rawLat).toFixed(4)))), lon = Number(normalizeLon(rawLon).toFixed(4));
    if (!ptA) { ptA = { lat, lon }; routeConfirmed = false; }
    else if (!ptB) { ptB = { lat, lon }; routeConfirmed = false; }
    else {
        ptA = { lat, lon }; ptB = null; routeConfirmed = false;
        stopAndClearRouteTimer(); fastPolylineGroup.clearLayers(); safePolylineGroup.clearLayers();
        fastRouteData = safeRouteData = null; document.getElementById('routeReport').style.display = 'none';
    }
    updateMarkerLayers(); syncUI(); update3DPinsAndPaths(); debouncedSaveCloudRoute();
}

map.on('click', (e) => { if (!isMapDragging) handleCoordinateSelect(e.latlng.lat, e.latlng.lng); });

function syncUI() {
    document.getElementById('dispPointA').innerText = ptA ? `${ptA.lat.toFixed(2)}°, ${ptA.lon.toFixed(2)}°` : 'Клікніть на мапі...';
    document.getElementById('dispPointB').innerText = ptB ? `${ptB.lat.toFixed(2)}°, ${ptB.lon.toFixed(2)}°` : 'Клікніть на мапі...';
}

function getCylindricalRouteBounds() {
    if (safeRouteData && safeRouteData.path && safeRouteData.path.length > 0) {
        const lats = safeRouteData.path.map(p => p.lat), uLons = safeRouteData.path.map(p => p.unwrappedLon);
        const minU = Math.min(...uLons), maxU = Math.max(...uLons);
        const shift = 360 * Math.round((map.getCenter().lng - (minU + maxU) / 2) / 360);
        return [[Math.min(...lats), minU + shift], [Math.max(...lats), maxU + shift]];
    }
    const dLon = ((ptB.lon - ptA.lon + 180) % 360 + 360) % 360 - 180, endLonU = ptA.lon + dLon;
    const shift = 360 * Math.round((map.getCenter().lng - (ptA.lon + endLonU) / 2) / 360);
    return [[Math.min(ptA.lat, ptB.lat), Math.min(ptA.lon, endLonU) + shift], [Math.max(ptA.lat, ptB.lat), Math.max(ptA.lon, endLonU) + shift]];
}

window.setPresetRoute = function(lat1, lon1, lat2, lon2) {
    isSosRouteActive = false; ptA = null; ptB = null;
    handleCoordinateSelect(lat1, lon1); handleCoordinateSelect(lat2, lon2);
    routeConfirmed = true; buildRoute(false); debouncedSaveCloudRoute();
    if (is3DMode && myGlobe) {
        const dLon = ((lon2 - lon1 + 180) % 360 + 360) % 360 - 180;
        myGlobe.pointOfView({ lat: (lat1 + lat2) / 2, lng: normalizeLon(lon1 + dLon / 2), altitude: 1.5 }, 1500);
    } else map.flyToBounds(getCylindricalRouteBounds(), { padding: [50, 50] });
};

// 8.1. SOS ЕКСТРЕНЕ ПЕРЕНАПРАВЛЕННЯ
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
        const tLat = localBase ? localBase.lat : currentSafeZone.centroid[0];
        const tLon = localBase ? localBase.lon : currentSafeZone.centroid[1];
        if (!((typeof isPointInAnyActiveStorm === 'function') && isPointInAnyActiveStorm(tLat, tLon, 20))) {
            return { zone: currentSafeZone, base: localBase || null, lat: tLat, lon: tLon, distKm: calculateShortestMarsDistance(fromPt.lat, fromPt.lon, tLat, tLon), alreadyInsideSafe: true };
        }
    }

    let bestClear = null, bestAny = null;
    SAFE_ZONES.forEach(z => {
        const candidates = [];
        const baseInZone = MARS_BASES.find(b => b.zoneId === z.id);
        if (baseInZone) candidates.push({ lat: baseInZone.lat, lon: baseInZone.lon, base: baseInZone });
        candidates.push({ lat: z.centroid[0], lon: z.centroid[1], base: baseInZone || null });
        const [cLat, cLon] = z.centroid;
        for (const v of z.smoothCoords) {
            for (const t of [0.08, 0.18]) candidates.push({ lat: v[0] + (cLat - v[0]) * t, lon: v[1] + (cLon - v[1]) * t, base: baseInZone || null });
        }
        for (const cand of candidates) {
            if (!isPointInPolygon(cand.lat, cand.lon, z.smoothCoords, z.bbox) || isPointInAnyHazardZone(cand.lat, cand.lon)) continue;
            const distKm = calculateShortestMarsDistance(fromPt.lat, fromPt.lon, cand.lat, cand.lon);
            const item = { zone: z, base: cand.base, lat: cand.lat, lon: cand.lon, distKm, alreadyInsideSafe: false };
            if (!bestAny || distKm < bestAny.distKm) bestAny = item;
            const inStorm = (typeof isPointInAnyActiveStorm === 'function') && isPointInAnyActiveStorm(cand.lat, cand.lon, 25);
            if (!inStorm && (!bestClear || distKm < bestClear.distKm)) bestClear = item;
        }
    });
    return bestClear || bestAny;
}

window.triggerSOS = function() {
    if (!ptA) return showWarning('🆘 SOS: Спочатку встановіть Точку A (ровер) на мапі або оберіть базу!');
    const target = findNearestSafeZoneTarget(ptA);
    if (!target) return showWarning('🆘 SOS: Не вдалося знайти безпечну зону!');

    if (!hazardsAvoidanceActive) {
        hazardsAvoidanceActive = true;
        const btnH = document.getElementById('btnToggleHazards');
        if (btnH) { btnH.classList.add('active'); btnH.innerText = 'A* ОБМЕЖЕННЯ: УВІМК'; }
    }
    ptB = { lat: Number(target.lat.toFixed(4)), lon: Number(normalizeLon(target.lon).toFixed(4)) };
    isSosRouteActive = true; activeRouteMode = 'safe'; routeConfirmed = true;
    updateMarkerLayers(); syncUI(); highlightSelectedZone(target.zone.id);
    navGridCache = {}; buildRoute(true); debouncedSaveCloudRoute();

    if (is3DMode && myGlobe) {
        const dLon = ((ptB.lon - ptA.lon + 180) % 360 + 360) % 360 - 180;
        myGlobe.pointOfView({ lat: (ptA.lat + ptB.lat) / 2, lng: normalizeLon(ptA.lon + dLon / 2), altitude: 1.5 }, 1300);
    }
    const distKm = safeRouteData ? Math.round(safeRouteData.totalDist) : Math.round(target.distKm);
    showWarning(target.alreadyInsideSafe ? `🆘 SOS: Ровер у зоні "${target.zone.name}". Курс до притулку (~${distKm} км).` : `🆘 SOS ЕВАКУАЦІЯ: Перенаправлено до ${target.zone.name} (~${distKm} км).`);
};

document.getElementById('btnSosTop')?.addEventListener('click', window.triggerSOS);
document.getElementById('btnSosSidebar')?.addEventListener('click', window.triggerSOS);

// 9. АЛГОРИТМ A* ТА ЧАС З ПОДВОЄННЯМ Х2
const NAV_DEG = Math.PI / 180, NAV_KM_PER_DEG = MARS_RADIUS_KM * NAV_DEG;
const NAV_GRAD_BASE_DEG = 0.12, NAV_BUFFER_KM = 15, NAV_SAFE_LIMIT_DEG = 15, NAV_FAST_LIMIT_DEG = 25;
const NAV_DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1],[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

class FastMinHeap {
    constructor(capacity = 1024) { this.nodes = new Int32Array(capacity); this.costs = new Float64Array(capacity); this.size = 0; }
    grow() { const cap = this.nodes.length * 2, n = new Int32Array(cap), c = new Float64Array(cap); n.set(this.nodes); c.set(this.costs); this.nodes = n; this.costs = c; }
    push(node, cost) {
        if (this.size === this.nodes.length) this.grow();
        let i = this.size++; this.nodes[i] = node; this.costs[i] = cost;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.costs[i] < this.costs[p]) { [this.nodes[i], this.nodes[p]] = [this.nodes[p], this.nodes[i]]; [this.costs[i], this.costs[p]] = [this.costs[p], this.costs[i]]; i = p; }
            else break;
        }
    }
    pop() {
        if (this.size === 0) return -1;
        const top = this.nodes[0], last = --this.size;
        this.nodes[0] = this.nodes[last]; this.costs[0] = this.costs[last];
        let i = 0; const half = this.size >> 1;
        while (i < half) {
            const l = (i << 1) + 1, r = l + 1, best = (r < this.size && this.costs[r] < this.costs[l]) ? r : l;
            if (this.costs[best] < this.costs[i]) { [this.nodes[i], this.nodes[best]] = [this.nodes[best], this.nodes[i]]; [this.costs[i], this.costs[best]] = [this.costs[best], this.costs[i]]; i = best; }
            else break;
        }
        return top;
    }
}

function navToVec(lat, lon) { const la = lat * NAV_DEG, lo = lon * NAV_DEG, c = Math.cos(la); return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)]; }

function makeGreatCircle(lat1, lon1, lat2, lon2) {
    const p1 = navToVec(lat1, lon1), p2 = navToVec(lat2, lon2);
    const omega = Math.acos(Math.max(-1, Math.min(1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]))), sinO = Math.sin(omega);
    return {
        distKm: omega * MARS_RADIUS_KM,
        at(t) {
            if (omega < 1e-9 || sinO < 1e-9) return { lat: lat1 + (lat2 - lat1) * t, lon: lon1 + (lon2 - lon1) * t };
            const a = Math.sin((1 - t) * omega) / sinO, b = Math.sin(t * omega) / sinO;
            const x = a * p1[0] + b * p2[0], y = a * p1[1] + b * p2[1], z = a * p1[2] + b * p2[2];
            const lat = Math.asin(Math.max(-1, Math.min(1, z))) / NAV_DEG, lonN = Math.atan2(y, x) / NAV_DEG;
            return { lat, lon: lonN + 360 * Math.round((lon1 - lonN) / 360) };
        }
    };
}

let navGridCache = {};
function buildTerrainGrid(startPt, endPt, padScale = 1) {
    const shortestDLon = ((endPt.lon - startPt.lon + 180) % 360 + 360) % 360 - 180, endLonU = startPt.lon + shortestDLon;
    const latLo = Math.min(startPt.lat, endPt.lat), latHi = Math.max(startPt.lat, endPt.lat);
    const spanDeg = Math.max(latHi - latLo, Math.abs(shortestDLon), 1);
    const padLat = Math.max(6, Math.min(70, (0.35 * spanDeg + 5) * padScale));
    const padLon = Math.min(120, padLat / Math.max(0.3, Math.cos(((latLo + latHi) / 2) * NAV_DEG)));
    const minLat = Math.max(-89.5, Math.min(latLo - padLat, latLo)), maxLat = Math.min(89.5, Math.max(latHi + padLat, latHi));
    let minLon = Math.min(startPt.lon, endLonU) - padLon, maxLon = Math.max(startPt.lon, endLonU) + padLon;
    if (maxLon - minLon > 350) { const extra = (maxLon - minLon - 350) / 2; minLon += extra; maxLon -= extra; }

    const latRange = maxLat - minLat, lonRange = maxLon - minLon;
    const step = Math.max(0.12, Math.max(latRange, lonRange) / 240);
    const rows = Math.ceil(latRange / step) + 1, cols = Math.ceil(lonRange / step) + 1;
    const latStep = latRange / (rows - 1), lonStep = lonRange / (cols - 1), total = rows * cols;
    const cellKm = Math.max(latStep, lonStep) * NAV_KM_PER_DEG, stormSafetyMarginKm = Math.max(55, cellKm * 1.8);

    const latGrid = new Float64Array(rows), lonGrid = new Float64Array(cols);
    for (let r = 0; r < rows; r++) latGrid[r] = minLat + r * latStep;
    for (let c = 0; c < cols; c++) lonGrid[c] = minLon + c * lonStep;

    const elev = new Float32Array(total), grad = new Float32Array(total), zoneH = new Uint8Array(total), zoneS = new Uint8Array(total), insideH = new Uint8Array(total);
    const d = NAV_GRAD_BASE_DEG / 2;
    for (let r = 0; r < rows; r++) {
        const lat = latGrid[r], cosLat = Math.max(0.05, Math.cos(lat * NAV_DEG));
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c, lonN = normalizeLon(lonGrid[c]);
            elev[idx] = getMolaElevation(lat, lonN);
            const gLat = (getMolaElevation(Math.min(90, lat + d), lonN) - getMolaElevation(Math.max(-90, lat - d), lonN)) / (NAV_GRAD_BASE_DEG * NAV_KM_PER_DEG * 1000);
            const gLon = (getMolaElevation(lat, normalizeLon(lonGrid[c] + d)) - getMolaElevation(lat, normalizeLon(lonGrid[c] - d))) / (NAV_GRAD_BASE_DEG * NAV_KM_PER_DEG * cosLat * 1000);
            grad[idx] = Math.hypot(gLat, gLon);

            if (hazardsAvoidanceActive) {
                for (const z of HAZARD_ZONES) { if (isPointInPolygon(lat, lonN, z.smoothCoords, z.bbox)) { insideH[idx] = 1; break; } }
                if (!insideH[idx] && typeof isPointInAnyActiveStorm === 'function' && isPointInAnyActiveStorm(lat, lonN, stormSafetyMarginKm)) insideH[idx] = 1;
            }
            for (const z of SAFE_ZONES) { if (isPointInPolygon(lat, lonN, z.smoothCoords, z.bbox)) { zoneS[idx] = 1; break; } }
        }
    }
    const m = Math.max(1, Math.min(3, Math.ceil(NAV_BUFFER_KM / cellKm))), tmp = new Uint8Array(total), near = new Uint8Array(total);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let v = 0; for (let k = Math.max(0, c - m); k <= Math.min(cols - 1, c + m) && !v; k++) v = insideH[r * cols + k]; tmp[r * cols + c] = v;
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let v = 0; for (let k = Math.max(0, r - m); k <= Math.min(rows - 1, r + m) && !v; k++) v = tmp[k * cols + c]; near[r * cols + c] = v;
    }
    for (let i = 0; i < total; i++) zoneH[i] = insideH[i] ? 2 : (near[i] ? 1 : 0);

    const distTbl = new Float64Array(rows * NAV_DIRS.length).fill(Infinity);
    for (let r = 0; r < rows; r++) for (let k = 0; k < NAV_DIRS.length; k++) {
        const nr = r + NAV_DIRS[k][0];
        if (nr >= 0 && nr < rows) distTbl[r * NAV_DIRS.length + k] = calculateMarsDistance(latGrid[r], 0, latGrid[nr], NAV_DIRS[k][1] * lonStep);
    }
    return { rows, cols, total, minLat, minLon, latStep, lonStep, cellKm, latGrid, lonGrid, elev, grad, zoneH, zoneS, distTbl, endLonU };
}

function navSlopeFactor(thetaDeg, mode) {
    if (mode === 'safe') { let f = 1 + (thetaDeg / 7) ** 2; if (thetaDeg > NAV_SAFE_LIMIT_DEG) f += 40 + 25 * (thetaDeg - NAV_SAFE_LIMIT_DEG); return f; }
    let f = 1 + (thetaDeg / 14) ** 2; if (thetaDeg > NAV_FAST_LIMIT_DEG) f += 40 + 25 * (thetaDeg - NAV_FAST_LIMIT_DEG); return f;
}
function navZoneTerms(zh, zs, mode) {
    if (mode === 'safe') return [zh === 2 ? 50 : (zh === 1 ? 1.5 : 0), zs ? 0.8 : 1.0];
    return [zh === 2 ? 0.15 : 0, 1.0];
}
function navEdgeCost(distKm, h1, h2, g1, g2, add, mul, mode) {
    const theta = Math.atan(Math.max(Math.abs(h2 - h1) / (distKm * 1000), 0.5 * (g1 + g2))) / NAV_DEG;
    return distKm * (navSlopeFactor(theta, mode) + add) * mul;
}

function computeNavRoute(startPt, endPt, mode, padScale) {
    const grid = getNavGrid(startPt, endPt, padScale);
    const A = { lat: startPt.lat, lon: startPt.lon }, B = { lat: endPt.lat, lon: grid.endLonU };
    const directKm = calculateMarsDistance(A.lat, A.lon, B.lat, B.lon);
    let nodes = [A, B];
    if (directKm > 0.5) nodes = smoothNavPath(grid, [A, ...planGridPath(grid, A, B, mode), B], mode);

    const { pts, L } = resampleNavPath(nodes), spacing = L / Math.max(1, pts.length - 1);
    const ROVER_BASE_SPEED_KMH = 30;
    const getHazardAt = (lat, lon) => {
        for (const z of HAZARD_ZONES) if (isPointInPolygon(lat, lon, z.smoothCoords, z.bbox)) return { inHazard: true, name: z.name };
        if (typeof isPointInAnyActiveStorm === 'function' && isPointInAnyActiveStorm(lat, lon, 0)) return { inHazard: true, name: 'Активна пилова буря' };
        return { inHazard: false, name: null };
    };

    const path = pts.map(p => {
        const lon = normalizeLon(p.lonU);
        const haz = getHazardAt(p.lat, lon);
        return {
            lat: p.lat, lon, unwrappedLon: p.lonU, alt: getMolaElevation(p.lat, lon),
            inHazard: haz.inHazard, hazardName: haz.name,
            cumDistKm: 0, cumNormalHours: 0, cumHazardBaseHours: 0, cumHazardHours: 0, cumHours: 0
        };
    });

    let normalHours = 0, hazardBaseHours = 0, hazardDoubledHours = 0, totalHours = 0, hazardDistKm = 0;
    for (let i = 1; i < path.length; i++) {
        const segBaseHours = spacing / ROVER_BASE_SPEED_KMH;
        if (path[i].inHazard) {
            hazardDistKm += spacing;
            hazardBaseHours += segBaseHours;
            hazardDoubledHours += segBaseHours * 2;
            totalHours += segBaseHours * 2;
        } else {
            normalHours += segBaseHours;
            totalHours += segBaseHours;
        }
        path[i].cumDistKm = path[i - 1].cumDistKm + spacing;
        path[i].cumNormalHours = normalHours;
        path[i].cumHazardBaseHours = hazardBaseHours;
        path[i].cumHazardHours = hazardDoubledHours;
        path[i].cumHours = totalHours;
    }

    let asc = 0, desc = 0;
    for (let i = 1; i < path.length; i++) { const diff = path[i].alt - path[i - 1].alt; if (diff > 0) asc += diff; else desc -= diff; }
    const k = Math.max(1, Math.ceil(8 / Math.max(spacing, 1e-6)));
    let peakSlope = 0, steepCount = 0, windows = 0;
    for (let i = 0; i + k < path.length; i++) {
        const slope = Math.atan(Math.abs(path[i + k].alt - path[i].alt) / (k * spacing * 1000)) / NAV_DEG;
        if (slope > peakSlope) peakSlope = slope;
        if (slope > 10) steepCount++;
        windows++;
    }
    const steepFrac = windows ? steepCount / windows : 0;

    let hazardHits = 0, stormHits = 0;
    for (const pt of path) {
        for (const z of HAZARD_ZONES) if (isPointInPolygon(pt.lat, pt.lon, z.smoothCoords, z.bbox)) { hazardHits++; break; }
        if (typeof isPointInAnyActiveStorm === 'function' && isPointInAnyActiveStorm(pt.lat, pt.lon, 0)) stormHits++;
    }
    hazardHits += stormHits;
    const hazardKm = hazardHits * spacing, hazardFrac = hazardHits / path.length, detourPct = directKm > 0.5 ? Math.max(0, (L / directKm - 1) * 100) : 0;
    const safetyScore = Math.max(5, Math.min(99, Math.round(100 - 120 * hazardFrac - 60 * steepFrac - 1.5 * Math.max(0, peakSlope - 12) - (hazardHits > 0 ? 8 : 0))));

    let diagnosis;
    if (mode === 'safe') {
        if (!hazardsAvoidanceActive) diagnosis = `ОБХІД ЗОН ВИМКНЕНО: маршрут оптимізовано лише за рельєфом. Макс. нахил ${peakSlope.toFixed(1)}°.`;
        else if (hazardHits === 0) diagnosis = `БЕЗПЕЧНИЙ МАРШРУТ: небезпечні зони та рухомі бурі оминуто. Макс. нахил ${peakSlope.toFixed(1)}°, подовження до ортодромії +${detourPct.toFixed(0)}%.`;
        else diagnosis = stormHits > 0
            ? `⚠️ УВАГА: маршрут перетинає рухому пилову бурю (≈ ${Math.round(stormHits * spacing)} км). Час у небезпеці ×2.`
            : `УВАГА: повний обхід неможливий — траверс небезпечних зон ≈ ${Math.round(hazardKm)} км (час у зоні ×2).`;
    } else diagnosis = `ШВИДКИЙ МАРШРУТ: мінімальні витрати без обходу зон. Макс. нахил ${peakSlope.toFixed(1)}°, у небезпечних зонах ≈ ${Math.round(hazardKm)} км (час у зоні ×2).`;

    return {
        path, totalDist: L, hazardDistKm, totalHours, normalHours, hazardBaseHours, hazardDoubledHours,
        maxSlope: peakSlope, totalAsc: asc, totalDesc: desc, safety: safetyScore, scanDiagnosis: diagnosis, hazardHits
    };
}

// 10. ВІДОБРАЖЕННЯ ТА ТАЙМЕР В БОКОВОМУ МЕНЮ
function attachRouteTooltip(polyline, modeName, color) {
    polyline.bindTooltip('', { sticky: true, className: 'mars-tooltip' });
    polyline.on('mousemove', (e) => {
        const lat = Math.max(-90, Math.min(90, e.latlng.lat)), lon = normalizeLon(e.latlng.lng);
        updateTelemetry(lat, lon);
        const alt = getMolaElevation(lat, lon);
        polyline.setTooltipContent(`<div style="font-family:'Space Grotesk',sans-serif; font-size:11px; line-height:1.4;"><span style="color:${color}; font-weight:700;">● ${modeName}</span><br><span style="font-family:'Space Mono',monospace; color:#FFF; font-weight:700; font-size:12px;">ВИСОТА: ${alt > 0 ? '+' : ''}${alt} м</span></div>`);
    });
}

function renderMultiWorldPolyline(group, segments, styleOptions, tooltipModeName, color) {
    group.clearLayers();
    activeWorldOffsets.forEach(offset => {
        const line = L.polyline(segments.map(seg => seg.map(pt => [pt[0], pt[1] + offset * 360])), styleOptions);
        attachRouteTooltip(line, tooltipModeName, color);
        group.addLayer(line);
    });
}

function formatMarsDuration(hours) {
    const totalMin = Math.max(0, Math.round(hours * 60)), h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h === 0 ? `${m} хв` : `${h} год ${String(m).padStart(2, '0')} хв`;
}

function formatTimerHMS(hours) {
    const totalSec = Math.max(0, Math.round(hours * 3600)), h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const routeTimerState = { progress: 0, running: false, intervalId: null, lastTick: 0, currentPt: null };
function getActiveRouteObj() { return activeRouteMode === 'fast' ? fastRouteData : safeRouteData; }

function sampleRouteAtProgress(data, progress) {
    if (!data || !data.path || data.path.length === 0) return null;
    if (data.path.length === 1) return data.path[0];
    const p = Math.max(0, Math.min(1, progress)), exactIdx = p * (data.path.length - 1);
    const i0 = Math.floor(exactIdx), i1 = Math.min(data.path.length - 1, i0 + 1), frac = exactIdx - i0;
    const a = data.path[i0], b = data.path[i1];
    const inHazard = frac < 0.5 ? a.inHazard : b.inHazard;
    return {
        cumNormalHours: a.cumNormalHours + (b.cumNormalHours - a.cumNormalHours) * frac,
        cumHazardBaseHours: a.cumHazardBaseHours + (b.cumHazardBaseHours - a.cumHazardBaseHours) * frac,
        cumHazardHours: a.cumHazardHours + (b.cumHazardHours - a.cumHazardHours) * frac,
        cumHours: a.cumHours + (b.cumHours - a.cumHours) * frac,
        inHazard, hazardName: inHazard ? (b.hazardName || a.hazardName) : null
    };
}

function buildTimerTrackGradient(path) {
    if (!path || path.length < 2) return '#E2E8F0';
    const stops = []; let prevHaz = path[0].inHazard, startPct = 0;
    for (let i = 1; i < path.length; i++) {
        const pct = (i / (path.length - 1)) * 100;
        if (path[i].inHazard !== prevHaz || i === path.length - 1) {
            stops.push(`${prevHaz ? 'rgba(255, 46, 56, 0.38)' : 'rgba(16, 185, 129, 0.22)'} ${startPct.toFixed(1)}% ${pct.toFixed(1)}%`);
            prevHaz = path[i].inHazard; startPct = pct;
        }
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function updateRouteTimerUI() {
    const data = getActiveRouteObj();
    const box = document.getElementById('routeTimerBox'), badge = document.getElementById('timerMultBadge');
    const clock = document.getElementById('timerElapsed'), total = document.getElementById('timerTotal');
    const status = document.getElementById('timerZoneStatus'), breakdown = document.getElementById('timerBreakdown');
    const fill = document.getElementById('timerProgressFill'), btnPlay = document.getElementById('btnTimerPlayPause');
    if (!data || !box) return;

    const pt = sampleRouteAtProgress(data, routeTimerState.progress);
    routeTimerState.currentPt = pt;
    const isX2 = Boolean(pt && pt.inHazard && routeTimerState.progress < 1);
    box.classList.toggle('is-hazard', isX2);
    if (badge) { badge.classList.toggle('is-x2', isX2); badge.innerText = isX2 ? '×2 НЕБЕЗПЕЧНА ЗОНА' : '×1 ШТАТНО'; }
    if (clock && pt) clock.innerText = formatTimerHMS(pt.cumHours);
    if (total) total.innerText = `/ ${formatTimerHMS(data.totalHours)}`;
    if (fill) fill.style.width = `${(routeTimerState.progress * 100).toFixed(1)}%`;
    if (breakdown && pt) {
        breakdown.innerHTML = `Звичайний: <b>${formatTimerHMS(pt.cumNormalHours)}</b> · Небезпека: <b>${formatTimerHMS(pt.cumHazardBaseHours)} × 2 = ${formatTimerHMS(pt.cumHazardHours)}</b>`;
    }
    if (status) {
        if (routeTimerState.progress >= 1) status.innerText = '✅ Маршрут завершено (Точка B)';
        else if (isX2) status.innerText = `⚠️ ×2: ${pt.hazardName || 'Небезпечна зона'}`;
        else status.innerText = '🟢 Штатний рух (×1)';
    }
    if (btnPlay) btnPlay.innerText = routeTimerState.progress >= 1 ? '▶ ЗАНОВО' : (routeTimerState.running ? '⏸ ПАУЗА' : '▶ СТАРТ');
}

function stepRouteTimer() {
    if (!routeTimerState.running) return;
    const data = getActiveRouteObj();
    if (!data) return pauseRouteTimer();
    const now = performance.now();
    const dtSec = Math.min(0.25, Math.max(0, (now - routeTimerState.lastTick) / 1000));
    routeTimerState.lastTick = now;
    routeTimerState.progress = Math.min(1, routeTimerState.progress + dtSec * 0.045);
    updateRouteTimerUI();
    if (routeTimerState.progress >= 1) pauseRouteTimer();
}

function startRouteTimer(reset = false) {
    const data = getActiveRouteObj();
    if (!data) return;
    if (reset || routeTimerState.progress >= 1) routeTimerState.progress = 0;
    const track = document.getElementById('timerProgressTrack');
    if (track) track.style.background = buildTimerTrackGradient(data.path);
    routeTimerState.running = true; routeTimerState.lastTick = performance.now();
    if (routeTimerState.intervalId) clearInterval(routeTimerState.intervalId);
    routeTimerState.intervalId = setInterval(stepRouteTimer, 60);
    updateRouteTimerUI();
}

function pauseRouteTimer() {
    routeTimerState.running = false;
    if (routeTimerState.intervalId) { clearInterval(routeTimerState.intervalId); routeTimerState.intervalId = null; }
    updateRouteTimerUI();
}

function stopAndClearRouteTimer() {
    routeTimerState.running = false; routeTimerState.progress = 0; routeTimerState.currentPt = null;
    if (routeTimerState.intervalId) { clearInterval(routeTimerState.intervalId); routeTimerState.intervalId = null; }
}

document.getElementById('btnTimerPlayPause')?.addEventListener('click', () => {
    if (routeTimerState.running) pauseRouteTimer(); else startRouteTimer(routeTimerState.progress >= 1);
});
document.getElementById('btnTimerReset')?.addEventListener('click', () => startRouteTimer(true));

// КАЛЬКУЛЯТОР ПРИПАСІВ
let supplyCrewCount = 2;
function updateSupplyCalculator() {
    const data = getActiveRouteObj();
    if (!data) return;
    const crew = Math.max(1, Math.min(8, supplyCrewCount));
    const useReserve = document.getElementById('chkSupplyReserve')?.checked ?? true;
    const reserveMult = useReserve ? 1.15 : 1.0;

    const o2Kg = data.totalHours * crew * 0.035 * reserveMult;
    const o2Liters = Math.round(o2Kg * 714);
    const baseFuel = data.totalDist * 0.35, hazardFuel = (data.hazardDistKm || 0) * 0.175, climbFuel = (data.totalAsc || 0) * 0.01;
    const fuelLiters = Math.ceil((baseFuel + hazardFuel + climbFuel) * reserveMult);
    const drinkWater = data.totalHours * crew * 0.105 * reserveMult;
    const techWater = (data.totalHours * crew * 0.065 + (data.hazardDistKm || 0) * 0.005) * reserveMult;
    const totalWater = drinkWater + techWater;

    const crewDisp = document.getElementById('supplyCrewVal'); if (crewDisp) crewDisp.innerText = crew;
    const elO2 = document.getElementById('supplyO2Val'), elO2Sub = document.getElementById('supplyO2Sub');
    if (elO2) elO2.innerText = `${o2Kg.toFixed(2)} кг`; if (elO2Sub) elO2Sub.innerText = `≈ ${o2Liters.toLocaleString('uk-UA')} л O₂ (${crew} ос.)`;
    const elFuel = document.getElementById('supplyFuelVal'), elFuelSub = document.getElementById('supplyFuelSub');
    if (elFuel) elFuel.innerText = `${fuelLiters.toLocaleString('uk-UA')} л`;
    if (elFuelSub) elFuelSub.innerText = data.hazardDistKm > 1 ? 'База + підйом + небезпека' : 'База 0.35 л/км + підйом';
    const elWater = document.getElementById('supplyWaterVal'), elWaterSub = document.getElementById('supplyWaterSub');
    if (elWater) elWater.innerText = `${totalWater.toFixed(1)} л`;
    if (elWaterSub) elWaterSub.innerText = `Питна: ${drinkWater.toFixed(1)} л · Технічна/охолодження: ${techWater.toFixed(1)} л`;
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

    renderMultiWorldPolyline(fastPolylineGroup, splitPathAtAntimeridian(fastRouteData.path), { color: '#FF2E38', weight: 3.5, dashArray: '5, 6' }, 'ШВИДКИЙ МАРШРУТ', '#FF2E38');
    renderMultiWorldPolyline(safePolylineGroup, splitPathAtAntimeridian(safeRouteData.path), { color: '#00FFAA', weight: 5.0 }, 'БЕЗПЕЧНИЙ МАРШРУТ', '#00FFAA');

    updateSeparateElevationCards();
    if (fitCamera && !is3DMode) map.fitBounds(getCylindricalRouteBounds(), { padding: [50, 50] });
    const reportEl = document.getElementById('routeReport'); reportEl.style.display = 'block';
    setActiveRoute(activeRouteMode || 'safe');
    if (fitCamera) reportEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (typeof checkStormRouteCollisions === 'function') checkStormRouteCollisions();
}

const btnBuildRouteEl = document.getElementById('btnBuildRoute');
if (btnBuildRouteEl) {
    btnBuildRouteEl.innerText = 'ПІДТВЕРДИТИ';
    btnBuildRouteEl.onclick = () => {
        if (!ptA || !ptB) return alert("Оберіть Точку А (старт) та Точку В (фініш) на мапі!");
        isSosRouteActive = false; routeConfirmed = true; buildRoute(true);
    };
}

function updateSeparateElevationCards() {
    if (!safeRouteData || !fastRouteData) return;
    const sAlts = safeRouteData.path.map(p => p.alt), sMin = Math.min(...sAlts), sMax = Math.max(...sAlts);
    document.getElementById('elevSafeMin').innerText = `${sMin > 0 ? '+' : ''}${sMin} м`;
    document.getElementById('elevSafeMax').innerText = `${sMax > 0 ? '+' : ''}${sMax} м`;
    document.getElementById('elevSafeDiff').innerText = `Δ ${sMax - sMin} м`;
    document.getElementById('elevSafeClimb').innerText = `+${Math.round(safeRouteData.totalAsc)} / -${Math.round(safeRouteData.totalDesc)} м`;
    const elSafeTime = document.getElementById('elevSafeTime'); if (elSafeTime) elSafeTime.innerText = formatMarsDuration(safeRouteData.totalHours);

    const fAlts = fastRouteData.path.map(p => p.alt), fMin = Math.min(...fAlts), fMax = Math.max(...fAlts);
    document.getElementById('elevFastMin').innerText = `${fMin > 0 ? '+' : ''}${fMin} м`;
    document.getElementById('elevFastMax').innerText = `${fMax > 0 ? '+' : ''}${fMax} м`;
    document.getElementById('elevFastDiff').innerText = `Δ ${fMax - fMin} м`;
    document.getElementById('elevFastClimb').innerText = `+${Math.round(fastRouteData.totalAsc)} / -${Math.round(fastRouteData.totalDesc)} м`;
    const elFastTime = document.getElementById('elevFastTime'); if (elFastTime) elFastTime.innerText = formatMarsDuration(fastRouteData.totalHours);
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
    sEl.innerText = `${data.safety}%`; sEl.style.color = data.safety >= 75 ? '#00FFAA' : (data.safety > 40 ? '#FFD700' : '#FF2E38');

    const elTime = document.getElementById('metricTime'), elTimePenalty = document.getElementById('metricTimePenalty'), elTimeNote = document.getElementById('metricTimeNote');
    if (elTime) elTime.innerText = formatMarsDuration(data.totalHours);
    if (elTimePenalty) elTimePenalty.style.display = data.hazardBaseHours > 0.01 ? 'inline-block' : 'none';
    if (elTimeNote) {
        elTimeNote.innerText = data.hazardBaseHours > 0.01
            ? `Звичайний: ${formatMarsDuration(data.normalHours)} + Небезпека: ${formatMarsDuration(data.hazardBaseHours)} × 2 = ${formatMarsDuration(data.hazardDoubledHours)}`
            : 'Без затримок у небезпечних зонах (×1)';
    }
    const diagPrefix = isSosRouteActive ? '🆘 [SOS ПЕРЕНАПРАВЛЕННЯ] ' : '';
    document.getElementById('scannerDiagnosis').innerText = diagPrefix + data.scanDiagnosis;
    document.getElementById('scannerDiagnosis').style.borderColor = data.safety < 50 ? '#FF2E38' : 'rgba(0, 255, 170, 0.3)';

    resetChartHoverReadout(); startRouteTimer(true); updateSupplyCalculator(); update3DPinsAndPaths(); renderDualElevationChart(-1);
};

function resetChartHoverReadout() {
    if (!safeRouteData || !fastRouteData) return;
    const sAlts = safeRouteData.path.map(p => p.alt), fAlts = fastRouteData.path.map(p => p.alt);
    const sMin = Math.min(...sAlts), sMax = Math.max(...sAlts), fMin = Math.min(...fAlts), fMax = Math.max(...fAlts);
    document.getElementById('chartHoverInfo').innerHTML = `<span style="color:#00FFAA; margin-right:12px;">🟢 БЕЗП: ${sMin > 0 ? '+' : ''}${sMin}…${sMax > 0 ? '+' : ''}${sMax}м</span><span style="color:#FF2E38;">🔴 ШВИД: ${fMin > 0 ? '+' : ''}${fMin}…${fMax > 0 ? '+' : ''}${fMax}м</span>`;
}

document.getElementById('btnClearRoute').onclick = () => {
    stopAndClearRouteTimer();
    markerAGroup.clearLayers(); markerBGroup.clearLayers(); fastPolylineGroup.clearLayers(); safePolylineGroup.clearLayers();
    currentSelectedZoneId = null; selectedZoneGroup.clearLayers();
    if (safeHoverMarker && map.hasLayer(safeHoverMarker)) map.removeLayer(safeHoverMarker);
    if (fastHoverMarker && map.hasLayer(fastHoverMarker)) map.removeLayer(fastHoverMarker);
    ptA = ptB = fastRouteData = safeRouteData = safeHoverMarker = fastHoverMarker = null;
    routeConfirmed = false; isSosRouteActive = false;
    syncUI(); update3DPinsAndPaths(); document.getElementById('routeReport').style.display = 'none';
    if (typeof checkStormRouteCollisions === 'function') checkStormRouteCollisions();
    debouncedSaveCloudRoute();
};

// 11. ГРАФІК ВИСОТ
function renderDualElevationChart(activeHoverRatio = -1) {
    if (!safeRouteData || !fastRouteData) return;
    const cvs = document.getElementById('elevationCanvas'), ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    const safeP = safeRouteData.path, fastP = fastRouteData.path;
    if (!safeP.length || !fastP.length) return;

    const allAlts = [...safeP.map(p => p.alt), ...fastP.map(p => p.alt)];
    const minAlt = Math.min(...allAlts), maxAlt = Math.max(...allAlts), range = Math.max(1, maxAlt - minAlt);
    const padLeft = 52, padRight = 10, padTop = 14, padBottom = 16, w = cvs.width - padLeft - padRight, h = cvs.height - padTop - padBottom;

    ctx.font = "9px 'Space Mono', monospace"; ctx.fillStyle = '#64748B'; ctx.textAlign = 'right';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padLeft, padTop); ctx.lineTo(padLeft + w, padTop); ctx.stroke();
    ctx.fillText(`${maxAlt > 0 ? '+' : ''}${maxAlt}м`, padLeft - 6, padTop + 3);
    ctx.beginPath(); ctx.moveTo(padLeft, padTop + h); ctx.lineTo(padLeft + w, padTop + h); ctx.stroke();
    ctx.fillText(`${minAlt > 0 ? '+' : ''}${minAlt}м`, padLeft - 6, padTop + h + 3);

    const drawCurve = (pts, isActive, activeColor, dimColor) => {
        ctx.beginPath();
        pts.forEach((pt, i) => {
            const x = padLeft + (i / (pts.length - 1)) * w, y = padTop + h - ((pt.alt - minAlt) / range) * h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = isActive ? activeColor : dimColor; ctx.lineWidth = isActive ? 2.6 : 1.6;
        if (!isActive) ctx.setLineDash([4, 3]);
        ctx.stroke(); ctx.setLineDash([]);
    };
    drawCurve(fastP, activeRouteMode === 'fast', '#FF2E38', 'rgba(255, 46, 56, 0.55)');
    drawCurve(safeP, activeRouteMode === 'safe', '#00FFAA', 'rgba(0, 255, 170, 0.55)');

    if (activeHoverRatio >= 0 && activeHoverRatio <= 1) {
        const hx = padLeft + activeHoverRatio * w;
        const sPt = safeP[Math.round(activeHoverRatio * (safeP.length - 1))], fPt = fastP[Math.round(activeHoverRatio * (fastP.length - 1))];
        const ySafe = padTop + h - ((sPt.alt - minAlt) / range) * h, yFast = padTop + h - ((fPt.alt - minAlt) / range) * h;
        [[yFast, '#FF2E38'], [ySafe, '#00FFAA']].forEach(([y, col]) => {
            ctx.beginPath(); ctx.arc(hx, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
        });
    }
}

const cvs = document.getElementById('elevationCanvas');
cvs.addEventListener('mousemove', (e) => {
    if (!safeRouteData || !fastRouteData) return;
    const rect = cvs.getBoundingClientRect(), padLeft = 52, w = cvs.width - padLeft - 10;
    const ratio = Math.max(0, Math.min(w, (e.clientX - rect.left) * (cvs.width / rect.width) - padLeft)) / w;
    const sPt = safeRouteData.path[Math.round(ratio * (safeRouteData.path.length - 1))], fPt = fastRouteData.path[Math.round(ratio * (fastRouteData.path.length - 1))];
    document.getElementById('chartHoverInfo').innerHTML = `<span style="color:#00FFAA; margin-right:12px;">🟢 БЕЗП: ${sPt.alt > 0 ? '+' : ''}${sPt.alt}м (${Math.round(ratio * safeRouteData.totalDist)}км)</span><span style="color:#FF2E38;">🔴 ШВИД: ${fPt.alt > 0 ? '+' : ''}${fPt.alt}м (${Math.round(ratio * fastRouteData.totalDist)}км)</span>`;
    renderDualElevationChart(ratio);
});
cvs.addEventListener('mouseleave', () => { resetChartHoverReadout(); renderDualElevationChart(-1); });

// 12. АКАУНТИ ТА СИНХРОНІЗАЦІЯ
let currentUser = null, authTabMode = 'login', autoSaveTimer = null, syncToastTimer = null, sessionToken = null;
function authHeaders(extra = {}) { return sessionToken ? { ...extra, Authorization: `Bearer ${sessionToken}` } : extra; }
function clearLocalSession() { currentUser = null; sessionToken = null; renderAuthUI(false); }

function showSyncToast(message) {
    const toast = document.getElementById('syncToast'), msgEl = document.getElementById('syncToastMsg');
    if (!toast || !msgEl) return;
    msgEl.innerText = message; toast.classList.add('show');
    if (syncToastTimer) clearTimeout(syncToastTimer);
    syncToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function debouncedSaveCloudRoute(delay = 500) {
    if (!currentUser) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveRouteToAccount(false), delay);
}

async function saveRouteToAccount(showToast = true) {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/save-route', {
            method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ username: currentUser, pointA: ptA ? { lat: ptA.lat, lon: ptA.lon } : null, pointB: ptB ? { lat: ptB.lat, lon: ptB.lon } : null })
        });
        if (res.status === 401) return (clearLocalSession(), showSyncToast('Сесія завершилась, увійдіть знову'));
        if (res.ok) { updateModalSyncView(ptA, ptB); if (showToast) showSyncToast('Маршрут збережено в PostgreSQL 💾'); }
    } catch (e) { console.error('Помилка звернення до сервера БД:', e); }
}

async function loadRouteFromAccount(autoBuild = true) {
    if (!currentUser) return;
    try {
        const res = await fetch(`/api/load-route/${encodeURIComponent(currentUser)}`, { headers: authHeaders() });
        if (res.status === 401) return (clearLocalSession(), showSyncToast('Сесія завершилась, увійдіть знову'));
        const data = await res.json();
        if (res.ok && data.success) {
            if (data.pointA || data.pointB) { applyCloudRoutePoints(data.pointA, data.pointB, autoBuild); showSyncToast(`Маршрут завантажено з PostgreSQL (${currentUser})`); }
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
    const btnText = document.getElementById('accountBtnText'), btnAccount = document.getElementById('btnAccount');
    const dotAccount = document.getElementById('accountDot'), loggedOutView = document.getElementById('authLoggedOutView');
    const loggedInView = document.getElementById('authLoggedInView'), loggedInTitle = document.getElementById('loggedInUsernameTitle');
    if (isLoggedIn) {
        if (btnText) btnText.innerText = username; if (btnAccount) btnAccount.classList.add('logged-in');
        if (dotAccount) dotAccount.classList.add('online'); if (loggedOutView) loggedOutView.style.display = 'none';
        if (loggedInView) loggedInView.style.display = 'block'; if (loggedInTitle) loggedInTitle.innerText = `РОСТЕР // ${username.toUpperCase()}`;
    } else {
        if (btnText) btnText.innerText = 'ВХІД / АКАУНТ'; if (btnAccount) btnAccount.classList.remove('logged-in');
        if (dotAccount) dotAccount.classList.remove('online'); if (loggedOutView) loggedOutView.style.display = 'block';
        if (loggedInView) loggedInView.style.display = 'none';
    }
}

function initAccountModal() {
    const modal = document.getElementById('accountModal'), btnAccount = document.getElementById('btnAccount'), btnCloseModal = document.getElementById('btnCloseAccountModal');
    const tabLogin = document.getElementById('tabAuthLogin'), tabRegister = document.getElementById('tabAuthRegister'), authForm = document.getElementById('authForm');
    const btnSubmit = document.getElementById('btnSubmitAuth'), btnLogout = document.getElementById('btnLogout');
    const btnSaveCurrent = document.getElementById('btnSaveCurrentRoute'), btnLoadSaved = document.getElementById('btnLoadSavedRoute');
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
                const data = await res.json();
                if (!res.ok) return showErr(data.error || 'Помилка авторизації');
                currentUser = data.user.username; sessionToken = data.token;
                renderAuthUI(true, currentUser); updateModalSyncView(data.user.point_a, data.user.point_b);
                if (authTabMode === 'register') showSucc('Акаунт успішно створено в PostgreSQL!');
                else if (data.user.point_a || data.user.point_b) { applyCloudRoutePoints(data.user.point_a, data.user.point_b, true); showSucc('Вхід успішний! Завантажено збережений маршрут.'); }
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
    const style = document.createElement('style');
    style.id = 'stormCloudDynamicStyles';
    style.textContent = `
        .storm-tornado-img { width: 100%; height: 100%; display: block; transform-origin: 50% 50%; mix-blend-mode: normal !important; filter: drop-shadow(0 8px 22px rgba(10, 14, 24, 0.72)) contrast(1.22) brightness(1.06) !important; animation: stormTornadoSpin 14s linear infinite; pointer-events: none !important; }
        @keyframes stormTornadoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .storm-eye-dot { width: 10px; height: 10px; border-radius: 50%; background: #0F172A; border: 2px solid #F8FAFC; box-shadow: 0 0 10px rgba(255, 87, 34, 0.9); cursor: pointer; }
    `;
    document.head.appendChild(style);
}

function makeStormTextureUrl(id) {
    if (stormTextureCache.has(id)) return stormTextureCache.get(id);
    let h = 2166136261; const s = String(id || 'mars_tornado');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const G = 64, perm = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) perm[i] = rand();
    const noise2 = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
        return (perm[(yi & 63) * G + (xi & 63)] * (1 - su) + perm[(yi & 63) * G + ((xi + 1) & 63)] * su) * (1 - sv) + (perm[((yi + 1) & 63) * G + (xi & 63)] * (1 - su) + perm[((yi + 1) & 63) * G + ((xi + 1) & 63)] * su) * sv;
    };
    const fbm = (x, y) => { let val = 0, amp = 0.5, freq = 1; for (let i = 0; i < 4; i++) { val += amp * noise2(x * freq, y * freq); freq *= 2.05; amp *= 0.5; } return val; };
    const smoothstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

    const N = 256, cvs = document.createElement('canvas'); cvs.width = N; cvs.height = N;
    const ctx = cvs.getContext('2d'), imgData = ctx.createImageData(N, N), data = imgData.data;
    const arms = 3 + Math.floor(rand() * 2), dir = rand() < 0.5 ? 1 : -1, ox = rand() * 50, oy = rand() * 50;
    const stretchX = 0.86 + rand() * 0.28, stretchY = 0.86 + rand() * 0.28, rotAngle = rand() * Math.PI * 2, cosR = Math.cos(rotAngle), sinR = Math.sin(rotAngle);

    for (let py = 0; py < N; py++) {
        for (let px = 0; px < N; px++) {
            const nx = (px - N / 2) / (N / 2), ny = (py - N / 2) / (N / 2);
            const rx = (nx * cosR - ny * sinR) / stretchX, ry = (nx * sinR + ny * cosR) / stretchY, r = Math.hypot(rx, ry);
            if (r >= 1.06) continue;
            const shapeWarp = fbm(nx * 2.2 + ox, ny * 2.2 + oy) * 0.48 + fbm(nx * 4.8 - oy, ny * 4.8 + ox) * 0.24;
            const rEdge = r / (0.58 + shapeWarp);
            if (rEdge >= 1.0) continue;
            const ang = Math.atan2(ry, rx), logSpiral = ang + dir * (-5.6 * Math.log(r + 0.055) + 2.4 * r);
            const streak = fbm(Math.cos(logSpiral) * 2.6 + r * 6.0 + ox, Math.sin(logSpiral) * 2.6 + r * 6.0 + oy);
            const spiralArm = Math.pow(0.5 + 0.5 * Math.cos(arms * logSpiral + fbm(nx * 3.4 + ox, ny * 3.4 + oy) * 3.4), 1.45);
            const eyewall = Math.exp(-((r - 0.125) * (r - 0.125)) / 0.0028), eyeHole = smoothstep(0.03, 0.10, r);
            const cloudBand = Math.max(0, Math.min(1, (0.62 * spiralArm + 0.45 * (streak - 0.25) + 0.85 * eyewall) * (0.25 + 0.75 * eyeHole)));
            const funnelDarkness = (1.0 - eyeHole) * 0.9 + (1.0 - spiralArm) * 0.45 * smoothstep(0.65, 0.08, r);
            const edgeAlpha = smoothstep(1.0, 0.22, rEdge), coreAlpha = Math.max(0.85 * (1 - eyeHole), 0.35 + 0.65 * cloudBand, 0.55 * funnelDarkness);
            const alpha = Math.max(0, Math.min(255, Math.round(255 * edgeAlpha * Math.min(1, coreAlpha))));
            const dustRim = smoothstep(0.35, 0.92, r) * spiralArm * 0.35, lum = 30 + 214 * cloudBand - 22 * funnelDarkness, idx = (py * N + px) * 4;
            data[idx] = Math.min(255, Math.max(0, Math.round(lum + 34 * dustRim - 8 * (1 - cloudBand))));
            data[idx + 1] = Math.min(255, Math.max(0, Math.round(lum + 8 * dustRim + 4 * cloudBand)));
            data[idx + 2] = Math.min(255, Math.max(0, Math.round(lum - 16 * dustRim + 16 * cloudBand)));
            data[idx + 3] = alpha;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    const url = cvs.toDataURL('image/png');
    stormTextureCache.set(id, url);
    return url;
}

function ensureStormMotionState(st) {
    if (typeof st._seed !== 'number') {
        let h = 0; const s = String(st.id || st.name || 'storm');
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        st._seed = (Math.abs(h) % 1000) / 100 + Math.random() * 2;
    }
    if (typeof st._phase !== 'number') st._phase = Math.random() * Math.PI * 2;
    if (!Array.isArray(st._trail)) st._trail = [{ lat: st.lat, lon: st.lon }];
}

window.isPointInAnyActiveStorm = function(lat, lon, extraMarginKm = 0) {
    if (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms || MARS_STORM_STATE.storms.length === 0) return false;
    for (const st of MARS_STORM_STATE.storms) {
        const distKm = calculateShortestMarsDistance(lat, lon, st.lat, st.lon);
        if (distKm > st.radiusKm * 1.25 + extraMarginKm) continue;
        const seed = typeof st._seed === 'number' ? st._seed : 0, brng = seed ? getMarsBearingRad(st.lat, st.lon, lat, lon) : 0;
        if (distKm <= st.radiusKm * getStormContourWobble(brng, seed) + extraMarginKm) return true;
    }
    return false;
};

window.hasActiveStorms = () => MARS_STORM_STATE.active && MARS_STORM_STATE.storms && MARS_STORM_STATE.storms.length > 0;
window.getActiveStormCacheKey = () => (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms) ? 'nostorm' : MARS_STORM_STATE.storms.map(s => `${Math.round(s.lat * 8)},${Math.round(s.lon * 8)}`).join(';');

window.getStormImpactAtPoint = function(lat, lon) {
    if (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms) return { inStorm: false };
    for (const st of MARS_STORM_STATE.storms) {
        const distKm = calculateShortestMarsDistance(lat, lon, st.lat, st.lon);
        if (distKm <= st.outerRadiusKm) return { inStorm: true, stormName: st.name, windSpeed: st.windSpeedMs, tau: st.tau, distKm: Math.round(distKm) };
    }
    return { inStorm: false };
};

window.update3DStormRings = function() {
    if (!myGlobe) return;
    const rings = MARS_STORM_STATE.active ? MARS_STORM_STATE.storms.map(st => ({
        lat: st.lat, lng: normalizeLon(st.lon), maxR: (st.radiusKm / MARS_RADIUS_KM) * (180 / Math.PI) * 0.95,
        propagationSpeed: 3.2, repeatPeriod: 1400, color: () => 'rgba(226, 232, 240, 0.85)'
    })) : [];
    myGlobe.ringsData(rings).ringLat('lat').ringLng('lng').ringMaxRadius('maxR').ringPropagationSpeed('propagationSpeed').ringRepeatPeriod('repeatPeriod').ringColor('color');
};

window.update3DStormHtmlElements = function() {
    if (!myGlobe) return;
    const items = MARS_STORM_STATE.active ? MARS_STORM_STATE.storms.map(st => ({
        id: st.id, lat: st.lat, lng: normalizeLon(st.lon), imgUrl: makeStormTextureUrl(st.id), label: `${st.regionName || st.name.split(' ')[0]} · ${Math.round(st.windSpeedMs)} м/с`
    })) : [];
    myGlobe.htmlElementsData(items).htmlLat('lat').htmlLng('lng').htmlAltitude(0.025).htmlElement(d => {
        const el = document.createElement('div'); el.style.pointerEvents = 'none';
        el.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; pointer-events:none;"><img src="${d.imgUrl}" style="width:76px; height:76px; animation:stormTornadoSpin 14s linear infinite; filter:drop-shadow(0 4px 14px rgba(0,0,0,0.85));" /><div class="storm-pill-badge" style="margin-top:2px;">🌪️ ${d.label}</div></div>`;
        return el;
    });
};

function computeStormForecast(st) {
    ensureStormMotionState(st);
    const points = []; let curLat = st.lat, curLon = st.lon, curHeading = st.headingDeg; const stepHours = 1.5;
    for (let step = 1; step <= 20; step++) {
        const t = st._phase + step * 0.44;
        curHeading = (curHeading + (Math.sin(t * 1.3 + st._seed) * 28 + Math.cos(t * 2.5 + st._seed * 1.7) * 18) * 0.42 + 360) % 360;
        const distKm = st.speedKmH * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.8 + st._seed))) * stepHours;
        const radHeading = (curHeading * Math.PI) / 180, radLat = (curLat * Math.PI) / 180, dR = distKm / MARS_RADIUS_KM;
        const nextLat = Math.asin(Math.sin(radLat) * Math.cos(dR) + Math.cos(radLat) * Math.sin(dR) * Math.cos(radHeading)) / (Math.PI / 180);
        const deltaLon = Math.atan2(Math.sin(radHeading) * Math.sin(dR) * Math.cos(radLat), Math.cos(dR) - Math.sin(radLat) * Math.sin((nextLat * Math.PI) / 180)) / (Math.PI / 180);
        curLat = Math.max(-75, Math.min(75, nextLat)); curLon = normalizeLon(curLon + deltaLon);
        points.push({ lat: curLat, lon: curLon, hours: step * stepHours });
    }
    st.futureTrajectory = points;
}

let stormPhysicsTickCount = 0;
function updateStormPhysics() {
    if (!MARS_STORM_STATE.active) return;
    const now = performance.now(), dtMs = now - MARS_STORM_STATE.lastTick;
    MARS_STORM_STATE.lastTick = now;
    if (dtMs <= 0 || dtMs > 10000) return;
    const dtHours = (dtMs / 3600000) * MARS_STORM_STATE.speedMultiplier;

    MARS_STORM_STATE.storms.forEach(st => {
        ensureStormMotionState(st);
        st._phase += 0.045 + Math.random() * 0.035;
        st.headingDeg = (st.headingDeg + (Math.sin(st._phase * 1.3 + st._seed) * 14 + (Math.random() - 0.5) * 18) * 0.30 + 360) % 360;
        const distKm = st.speedKmH * (0.8 + 0.4 * Math.random()) * dtHours;
        const radHeading = (st.headingDeg * Math.PI) / 180, radLat = (st.lat * Math.PI) / 180, dR = distKm / MARS_RADIUS_KM;
        let nextLat = Math.asin(Math.sin(radLat) * Math.cos(dR) + Math.cos(radLat) * Math.sin(dR) * Math.cos(radHeading)) / (Math.PI / 180);
        const deltaLon = Math.atan2(Math.sin(radHeading) * Math.sin(dR) * Math.cos(radLat), Math.cos(dR) - Math.sin(radLat) * Math.sin((nextLat * Math.PI) / 180)) / (Math.PI / 180);
        const nextLon = normalizeLon(st.lon + deltaLon);
        if (nextLat > 72) { nextLat = 72; st.headingDeg = (180 - st.headingDeg + 360) % 360; }
        else if (nextLat < -72) { nextLat = -72; st.headingDeg = (180 - st.headingDeg + 360) % 360; }
        st.lat = nextLat; st.lon = nextLon;
        const lastTrail = st._trail[st._trail.length - 1];
        if (!lastTrail || Math.hypot(nextLat - lastTrail.lat, nextLon - lastTrail.lon) > 0.25) {
            st._trail.push({ lat: nextLat, lon: nextLon });
            if (st._trail.length > 25) st._trail.shift();
        }
        computeStormForecast(st);
    });

    renderStorms2D();
    if (is3DMode && myGlobe) { update3DStormRings(); update3DStormHtmlElements(); }
    updateStormModalUI(); checkStormRouteCollisions();

    stormPhysicsTickCount++;
    if (routeConfirmed && stormPhysicsTickCount % 2 === 0 && ptA && ptB && safeRouteData && hazardsAvoidanceActive && MARS_STORM_STATE.autoAvoidRoute) {
        const endpointsInside = isPointInAnyActiveStorm(ptA.lat, ptA.lon, 0) || isPointInAnyActiveStorm(ptB.lat, ptB.lon, 0);
        const stormKey = getActiveStormCacheKey();
        if (!endpointsInside && stormKey !== MARS_STORM_STATE.lastAutoRerouteKey) {
            const nearRoute = MARS_STORM_STATE.storms.some(st =>
                safeRouteData.path.some((pt, i) => i % 4 === 0 && calculateShortestMarsDistance(pt.lat, pt.lon, st.lat, st.lon) <= st.outerRadiusKm + 200)
            );
            if (nearRoute) { MARS_STORM_STATE.lastAutoRerouteKey = stormKey; navGridCache = {}; buildRoute(false); }
        }
    }
}

function buildStormPopupHtml(st) {
    return `<div class="storm-popup-card"><div class="spc-tag">🌪️ ТОРНАДО / ПИЛОВИЙ ВИХОР (MRO/MARCI)</div><div class="spc-title">${st.name}</div><div class="spc-grid"><div>ЕПІЦЕНТР: <b>${st.lat.toFixed(2)}°, ${st.lon.toFixed(2)}°</b></div><div>ШВИДКІСТЬ ВІТРУ: <b style="color:#FF2E38;">${st.windSpeedMs} м/с</b></div><div>ОПТИЧНА НЕПРОЗОРІСТЬ: <b style="color:#FF7043;">τ = ${st.tau}</b></div><div>ШВИДКІСТЬ ДРЕЙФУ: <b>${Math.round(st.speedKmH)} км/год</b></div><div>КУРС ЗМІЩЕННЯ: <b>${Math.round(st.headingDeg)}°</b></div></div></div>`;
}

window.renderStorms2D = function() {
    if (!MARS_STORM_STATE.active || !MARS_STORM_STATE.storms || MARS_STORM_STATE.storms.length === 0) {
        stormLayerGroup.clearLayers(); activeStormLayers.clear(); return;
    }
    const wantedKeys = new Set();
    MARS_STORM_STATE.storms.forEach(st => {
        ensureStormMotionState(st);
        const ringBase = makeMarsCircleCoords(st.lat, st.lon, st.radiusKm, 42, st._seed);
        const radiusDeg = (st.outerRadiusKm / MARS_RADIUS_KM) * (180 / Math.PI);
        const dLon = radiusDeg / Math.max(0.18, Math.cos(st.lat * Math.PI / 180));
        let prevLon = st.lon;
        const unwrappedTraj = (st.futureTrajectory || []).map(pt => {
            prevLon += ((pt.lon - prevLon + 180) % 360 + 360) % 360 - 180;
            return [pt.lat, prevLon];
        });
        const stormImgUrl = makeStormTextureUrl(st.id);

        activeWorldOffsets.forEach(offset => {
            const key = `${st.id}__${offset}`; wantedKeys.add(key);
            const center = [st.lat, st.lon + offset * 360];
            const stormBounds = [[Math.max(-89.9, st.lat - radiusDeg), st.lon - dLon + offset * 360], [Math.min(89.9, st.lat + radiusDeg), st.lon + dLon + offset * 360]];
            const hazardCoords = ringBase.map(p => [p[0], p[1] + offset * 360]);
            const trajCoords = [center, ...unwrappedTraj.map(p => [p[0], p[1] + offset * 360])];
            const popupHtml = buildStormPopupHtml(st);

            const existing = activeStormLayers.get(key);
            if (existing) {
                existing.satOverlay.setBounds(stormBounds); existing.hazardRing.setLatLngs(hazardCoords);
                existing.trajLine.setLatLngs(trajCoords); existing.marker.setLatLng(center); existing.marker.setPopupContent(popupHtml);
                return;
            }
            const satOverlay = new StormImageOverlay(stormImgUrl, stormBounds, { opacity: 0.94, interactive: false, pane: 'stormPane', alt: 'Торнадо на Марсі' });
            const hazardRing = L.polygon(hazardCoords, { renderer: stormVectorRenderer, pane: 'stormPane', color: '#94A3B8', fill: true, fillColor: '#94A3B8', fillOpacity: 0.001, opacity: 0.48, weight: 1.5, dashArray: '5, 9', interactive: true });
            const trajLine = L.polyline(trajCoords, { renderer: stormVectorRenderer, pane: 'stormPane', color: '#FFA000', weight: 2.2, dashArray: '6, 6', opacity: 0.9, interactive: false });
            const stormPin = L.divIcon({ className: 'custom-pin', html: `<div class="storm-vortex-pin"><div class="storm-eye-dot" title="${st.name}"></div><div class="storm-pill-badge">🌪️ ${st.regionName || st.name.split(' ')[0]} · ${Math.round(st.windSpeedMs)} м/с</div></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
            const marker = L.marker(center, { icon: stormPin, zIndexOffset: 500 });
            marker.bindPopup(popupHtml, { className: 'storm-leaflet-popup', offset: [0, -6], autoPan: false });
            marker.on('click', (e) => L.DomEvent.stopPropagation(e));
            hazardRing.on('click', (e) => { L.DomEvent.stopPropagation(e); marker.openPopup(); });

            stormLayerGroup.addLayer(satOverlay); stormLayerGroup.addLayer(hazardRing); stormLayerGroup.addLayer(trajLine); stormLayerGroup.addLayer(marker);
            activeStormLayers.set(key, { satOverlay, hazardRing, trajLine, marker });
        });
    });

    for (const [key, layers] of activeStormLayers.entries()) {
        if (!wantedKeys.has(key)) {
            stormLayerGroup.removeLayer(layers.satOverlay); stormLayerGroup.removeLayer(layers.hazardRing);
            stormLayerGroup.removeLayer(layers.trajLine); stormLayerGroup.removeLayer(layers.marker);
            activeStormLayers.delete(key);
        }
    }
};

function checkStormRouteCollisions() {
    const banner = document.getElementById('stormAlertBanner'), desc = document.getElementById('stormAlertDesc');
    if (!routeConfirmed || !MARS_STORM_STATE.active || !safeRouteData || !safeRouteData.path || safeRouteData.path.length === 0) {
        if (banner) banner.style.display = 'none'; return;
    }
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
        if (banner && !MARS_STORM_STATE.bannerDismissed) {
            banner.style.display = 'flex';
            if (desc) desc.innerText = `${threateningStorm.name} перетинає розрахований шлях ровера (дистанція до ядра: ${Math.round(minDistance)} км). Вітер ${threateningStorm.windSpeedMs} м/с, τ=${threateningStorm.tau}.`;
        }
        const endpointsInside = ptA && ptB && (isPointInAnyActiveStorm(ptA.lat, ptA.lon, 0) || isPointInAnyActiveStorm(ptB.lat, ptB.lon, 0));
        const stormKey = getActiveStormCacheKey(), now = performance.now();
        if (hazardsAvoidanceActive && MARS_STORM_STATE.autoAvoidRoute && !endpointsInside && stormKey !== MARS_STORM_STATE.lastAutoRerouteKey && (now - MARS_STORM_STATE.lastAutoRerouteTime > 5000)) {
            MARS_STORM_STATE.lastAutoRerouteTime = now; MARS_STORM_STATE.lastAutoRerouteKey = stormKey; navGridCache = {};
            if (ptA && ptB) buildRoute(false);
        }
    } else {
        if (banner) banner.style.display = 'none';
        MARS_STORM_STATE.bannerDismissed = false;
    }
}

async function fetchMarsWeather() {
    try {
        const res = await fetch('/api/mars-weather');
        if (res.ok) {
            const d = await res.json();
            currentMarsWeather.sol = d.sol; currentMarsWeather.ls = d.ls; currentMarsWeather.season = d.season; currentMarsWeather.tau = d.tau;
            const g = d.ground; currentMarsWeather.hasGround = !!g;
            currentMarsWeather.min_temp = g ? g.min_temp : null; currentMarsWeather.max_temp = g ? g.max_temp : null;
            currentMarsWeather.pressure = g ? g.pressure : null; currentMarsWeather.wind_speed = g ? g.wind_speed : null;
            currentMarsWeather.wind_direction = g ? g.wind_direction : '—';
            currentMarsWeather.atmo_opacity = g ? g.atmo_opacity : (d.stormSeason ? 'Сезон бур' : 'Спокійна атмосфера');
            currentMarsWeather.solar_efficiency = null; currentMarsWeather.remsLastSeen = d.remsLastSeen;
            currentMarsWeather.note = d.note; currentMarsWeather.updated = d.updated_at;
            if (!MARS_STORM_STATE.scenario) applyServerStorms(d.storms || [], d.stormSource);
        } else if (!MARS_STORM_STATE.storms.length) {
            applyServerStorms([{ id: 'hellas_fallback', ...MARS_STORM_PRESETS.hellas }], 'FALLBACK');
        }
    } catch (e) {
        if (!MARS_STORM_STATE.storms.length) applyServerStorms([{ id: 'hellas_fallback', ...MARS_STORM_PRESETS.hellas }], 'FALLBACK');
    }
    updateWeatherUI(); applyHonestLabels();
}

function applyServerStorms(list, source) {
    const key = list.map(s => s.id).join('|'), changed = key !== MARS_STORM_STATE.serverKey;
    MARS_STORM_STATE.serverKey = key; MARS_STORM_STATE.source = source || '';
    MARS_STORM_STATE.storms = list.map(s => { const st = { ...s, futureTrajectory: [] }; ensureStormMotionState(st); return st; });
    MARS_STORM_STATE.storms.forEach(computeStormForecast);
    navGridCache = {}; renderStorms2D();
    if (is3DMode && myGlobe) { myGlobe.polygonsData(getActive3DFeatures()); update3DStormRings(); update3DStormHtmlElements(); }
    updateStormModalUI();
    if (routeConfirmed && changed && ptA && ptB) buildRoute(false);
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
    set('wOpacityDesc', w.note || '');
    set('stormLiveStatusBadge', MARS_STORM_STATE.scenario ? '🧪 СЦЕНАРІЙ' : (n ? '🟠 МОДЕЛЬ ЗА КЛІМАТОМ' : '🟢 БУР НЕМАЄ'));
}

function updateWeatherUI() {
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('headerWeatherPill', `ПОГОДА: SOL ${currentMarsWeather.sol} | τ=${currentMarsWeather.tau}`);
    set('wSolDisp', `SOL ${currentMarsWeather.sol}`);
    set('wLsDisp', `Ls ${currentMarsWeather.ls}° • ${currentMarsWeather.season.split('(')[0]}`);
    if (currentMarsWeather.min_temp !== null && currentMarsWeather.max_temp !== null) {
        const avg = `${Math.round((currentMarsWeather.min_temp + currentMarsWeather.max_temp) / 2)} °C`;
        set('wTempDisp', avg); set('widgetTemp', avg);
    }
    set('wTempRange', `Мін: ${currentMarsWeather.min_temp}°C / Макс: ${currentMarsWeather.max_temp}°C`);
    set('wPressureDisp', `${currentMarsWeather.pressure} Па`); set('widgetPressure', `${currentMarsWeather.pressure} Па`);
    set('wTauDisp', `${currentMarsWeather.tau} [${currentMarsWeather.tau > 2 ? 'КРИТИЧНО' : 'ПОМІРНО'}]`);
    set('wOpacityDesc', currentMarsWeather.atmo_opacity);
    set('wWindSpeedDisp', `${currentMarsWeather.wind_speed} м/с`); set('widgetWind', `${currentMarsWeather.wind_speed} м/с`);
    set('wWindDirDisp', `Курс: ${currentMarsWeather.wind_direction}`); set('widgetWindCourse', `Курс: ${currentMarsWeather.wind_direction}`);
    set('wSolarDisp', `${currentMarsWeather.solar_efficiency}% ЕФЕКТ.`);
    set('widgetSol', `SOL ${currentMarsWeather.sol}`);
    set('widgetTauBadge', `τ = ${currentMarsWeather.tau} [${currentMarsWeather.tau > 2 ? 'ШТОРМОВЕ ЗАТЕМНЕННЯ' : 'СЕРПАНОК'}]`);
    set('widgetTempSub', `Мін ${currentMarsWeather.min_temp}° / Макс ${currentMarsWeather.max_temp}°`);
    set('widgetTau', `τ = ${currentMarsWeather.tau}`);
    set('widgetSeasonSub', `Ls ${currentMarsWeather.ls}° • ${currentMarsWeather.season.split('(')[0]}`);
    const st = MARS_STORM_STATE.storms[0];
    if (st) { set('widgetStormName', st.name); set('widgetStormDesc', `Радіус ${st.radiusKm} км • Дрейф ${Math.round(st.speedKmH)} км/год`); }
}

function updateStormModalUI() {
    const st = MARS_STORM_STATE.storms[0];
    if (!st) return;
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('siName', st.name); set('siCoords', `${st.lat.toFixed(2)}°, ${st.lon.toFixed(2)}° (${st.regionName || 'Марс'})`);
    set('siRadius', `${st.radiusKm} км (ядро) / ${st.outerRadiusKm} км (шлейф)`);
    set('siMotion', `${Math.round(st.speedKmH)} км/год • ${Math.round(st.headingDeg)}° (вітер ${st.windSpeedMs} м/с)`);
    const badge = document.getElementById('stormLiveStatusBadge');
    if (badge) { badge.innerText = MARS_STORM_STATE.active ? '🟢 РУХ АКТИВНИЙ' : '⏸ НА ПАУЗІ'; badge.classList.toggle('paused', !MARS_STORM_STATE.active); }
}

window.spawnStormAtRegion = function(regionKey) {
    const preset = MARS_STORM_PRESETS[regionKey];
    if (!preset) return;
    MARS_STORM_STATE.scenario = true; MARS_STORM_STATE.source = 'SCENARIO';
    if (MARS_STORM_STATE.storms.length === 0) {
        const st = { id: 'storm_custom_' + Date.now(), ...preset, futureTrajectory: [] };
        ensureStormMotionState(st); MARS_STORM_STATE.storms.push(st);
    } else {
        Object.assign(MARS_STORM_STATE.storms[0], preset);
        MARS_STORM_STATE.storms[0]._trail = [{ lat: preset.lat, lon: preset.lon }];
        ensureStormMotionState(MARS_STORM_STATE.storms[0]);
    }
    computeStormForecast(MARS_STORM_STATE.storms[0]);
    navGridCache = {}; renderStorms2D();
    if (is3DMode && myGlobe) { myGlobe.polygonsData(getActive3DFeatures()); update3DStormRings(); update3DStormHtmlElements(); }
    updateStormModalUI(); window.focusOnStorm();
    if (routeConfirmed && ptA && ptB) buildRoute(false);
};

window.focusOnStorm = function() {
    if (!MARS_STORM_STATE.active) {
        const btn = document.getElementById('btnToggleStorms');
        if (btn) btn.click(); else MARS_STORM_STATE.active = true;
    }
    if (!MARS_STORM_STATE.storms || MARS_STORM_STATE.storms.length === 0) { window.spawnStormAtRegion('hellas'); return; }
    const st = MARS_STORM_STATE.storms[0];
    if (is3DMode && myGlobe) myGlobe.pointOfView({ lat: st.lat, lng: normalizeLon(st.lon), altitude: 1.45 }, 1200);
    else {
        const closestOffset = Math.round((map.getCenter().lng - st.lon) / 360);
        map.flyTo([st.lat, st.lon + closestOffset * 360], Math.max(map.getZoom(), 3.2), { duration: 1.2 });
    }
};

window.avoidActiveStormClick = function() {
    navGridCache = {};
    if (ptA && ptB) { routeConfirmed = true; buildRoute(false); }
    else alert("Оберіть Точку А (старт) та Точку В (фініш) на мапі для побудови маршруту в обхід бурі!");
};

window.openMarsWeatherModal = function() {
    const modal = document.getElementById('weatherModal');
    if (modal) modal.style.display = 'flex';
    fetchMarsWeather(); updateStormModalUI();
};

function initWeatherAndStormModule() {
    injectStormCloudStyles();
    if (MARS_STORM_STATE.storms[0]) computeStormForecast(MARS_STORM_STATE.storms[0]);
    renderStorms2D(); fetchMarsWeather();
    setInterval(fetchMarsWeather, 5 * 60 * 1000);

    const btnReal = document.getElementById('btnStormReal');
    if (btnReal) btnReal.onclick = () => { MARS_STORM_STATE.scenario = false; MARS_STORM_STATE.serverKey = ''; fetchMarsWeather(); };
    if (MARS_STORM_STATE.intervalId) clearInterval(MARS_STORM_STATE.intervalId);
    MARS_STORM_STATE.intervalId = setInterval(updateStormPhysics, 1200);

    const btnToggleStorms = document.getElementById('btnToggleStorms');
    if (btnToggleStorms) {
        btnToggleStorms.onclick = () => {
            MARS_STORM_STATE.active = !MARS_STORM_STATE.active;
            btnToggleStorms.classList.toggle('active', MARS_STORM_STATE.active);
            btnToggleStorms.classList.toggle('inactive', !MARS_STORM_STATE.active);
            btnToggleStorms.innerHTML = MARS_STORM_STATE.active
                ? '<span class="btn-dot dot-storm pulse-storm"></span>БУРІ: ПОКАЗАНО'
                : '<span class="btn-dot dot-muted"></span>БУРІ: ПРИХОВАНО';
            const playPauseBtn = document.getElementById('btnStormPlayPause');
            if (playPauseBtn) playPauseBtn.innerText = MARS_STORM_STATE.active ? '⏸ ПРИЗУПИНИТИ РУХ' : '▶ ВІДНОВИТИ РУХ';
            renderStorms2D();
            if (is3DMode && myGlobe) { myGlobe.polygonsData(getActive3DFeatures()); update3DStormRings(); update3DStormHtmlElements(); }
            updateStormModalUI();
            if (routeConfirmed && ptA && ptB && hazardsAvoidanceActive) buildRoute(false);
            else checkStormRouteCollisions();
        };
    }

    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    bind('btnFocusStormHud', window.focusOnStorm);
    bind('btnFocusStorm', window.focusOnStorm);
    bind('btnOpenWeather', window.openMarsWeatherModal);
    bind('btnCloseWeatherModal', () => { document.getElementById('weatherModal').style.display = 'none'; });
    bind('btnStormFocus', () => { document.getElementById('weatherModal').style.display = 'none'; window.focusOnStorm(); });
    bind('btnStormSpawnRandom', () => { const keys = Object.keys(MARS_STORM_PRESETS); window.spawnStormAtRegion(keys[Math.floor(Math.random() * keys.length)]); });
    bind('btnRerouteAvoidStorm', () => { navGridCache = {}; if (ptA && ptB) { routeConfirmed = true; buildRoute(false); } });
    bind('btnDismissStormAlert', () => { MARS_STORM_STATE.bannerDismissed = true; const b = document.getElementById('stormAlertBanner'); if (b) b.style.display = 'none'; });
    bind('btnToggleWeatherWidget', () => { const w = document.getElementById('marsWeatherWidget'); if (w) w.classList.toggle('collapsed'); });

    const weatherModal = document.getElementById('weatherModal');
    if (weatherModal) weatherModal.onclick = (e) => { if (e.target === weatherModal) weatherModal.style.display = 'none'; };

    bind('btnStormPlayPause', () => {
        MARS_STORM_STATE.active = !MARS_STORM_STATE.active;
        const b = document.getElementById('btnStormPlayPause');
        if (b) b.innerText = MARS_STORM_STATE.active ? '⏸ ПРИЗУПИНИТИ РУХ' : '▶ ВІДНОВИТИ РУХ';
        if (btnToggleStorms) {
            btnToggleStorms.classList.toggle('active', MARS_STORM_STATE.active);
            btnToggleStorms.classList.toggle('inactive', !MARS_STORM_STATE.active);
            btnToggleStorms.innerHTML = MARS_STORM_STATE.active ? '<span class="btn-dot dot-storm pulse-storm"></span>БУРІ: ПОКАЗАНО' : '<span class="btn-dot dot-muted"></span>БУРІ: ПРИХОВАНО';
        }
        updateStormModalUI(); renderStorms2D();
    });

    document.querySelectorAll('.sp-chip').forEach(chip => {
        chip.onclick = (e) => {
            document.querySelectorAll('.sp-chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            MARS_STORM_STATE.speedMultiplier = Number(e.target.dataset.speed || 150);
        };
    });
    document.querySelectorAll('.reg-chip').forEach(chip => {
        chip.onclick = (e) => { if (e.target.dataset.region) window.spawnStormAtRegion(e.target.dataset.region); };
    });
    const chkAuto = document.getElementById('chkAutoAvoidStorm');
    if (chkAuto) chkAuto.onchange = (e) => { MARS_STORM_STATE.autoAvoidRoute = e.target.checked; };
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