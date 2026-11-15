const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway передає підключення через DATABASE_URL або DATABASE_PUBLIC_URL
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' || (connectionString && !connectionString.includes('localhost'))
    ? { rejectUnauthorized: false }
    : false
});

app.use(cors());
app.use(express.json());

// Віддаємо файли фронтенду та зображення (server.js, package.json захищені)
const PUBLIC_FILES = ['index.html', 'script.js', 'style.css', 'i18n.js'];
PUBLIC_FILES.forEach((file) => {
  app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
});

// ============================================================================
// АВТОГЕНЕРАЦІЯ ЗОБРАЖЕНЬ БУР (без залежностей): PNG створюється на сервері,
// зберігається в storm-cache/ і віддається всім користувачам однаково
// ============================================================================
const zlib = require('zlib');
const fs = require('fs');
const CRC_T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (const x of b) c = CRC_T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
function strHash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeNoise(seed) {
  const r = rng(seed), P = new Float32Array(65536); for (let i = 0; i < 65536; i++) P[i] = r();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return (at(xi, yi) * (1 - su) + at(xi + 1, yi) * su) * (1 - sv) + (at(xi, yi + 1) * (1 - su) + at(xi + 1, yi + 1) * su) * sv; };
}
function fbm(n, x, y) { let s = 0, a = .5; for (let i = 0; i < 5; i++) { s += a * n(x, y); x *= 2.03; y *= 2.03; a *= .5; } return s; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function stormPng(id) {
  const N = 256, seed = strHash(id), rnd = rng(seed), n = makeNoise(seed + 7), buf = Buffer.alloc(N * N * 4);
  const arms = 2 + Math.floor(rnd() * 2), twist = 2.4 + rnd() * 2, dir = rnd() < .5 ? 1 : -1, ox = rnd() * 50, oy = rnd() * 50;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x - N / 2) / (N / 2), dy = (y - N / 2) / (N / 2), r = Math.hypot(dx, dy), o = (y * N + x) * 4;
    if (r >= 1) continue;
    const ang = Math.atan2(dy, dx) + dir * twist * r * 2.2;
    const warp = fbm(n, dx * 3 + ox, dy * 3 + oy), band = 0.5 + 0.5 * Math.cos(arms * ang + warp * 3);
    const d = Math.min(1, Math.max(0, 0.25 + 0.65 * band * (1 - r * 0.45) + 0.7 * (fbm(n, dx * 6 + oy, dy * 6 + ox) - 0.5))) * (0.65 + 0.35 * sstep(0.02, 0.22, r));
    buf[o] = Math.min(255, Math.round(185 + 70 * d));
    buf[o + 1] = Math.min(255, Math.round(105 + 115 * d));
    buf[o + 2] = Math.min(255, Math.round(55 + 95 * d));
    buf[o + 3] = Math.min(255, Math.round(255 * sstep(1, 0.42, r) * (0.45 + 0.55 * d)));
  }
  return encodePng(N, N, buf);
}
const STORM_CACHE_DIR = path.join(__dirname, 'storm-cache');
function ensureStormImage(id) {
  if (!/^[\w-]{1,60}$/.test(id)) return null;
  const f = path.join(STORM_CACHE_DIR, id + '.png');
  try { fs.mkdirSync(STORM_CACHE_DIR, { recursive: true }); if (!fs.existsSync(f)) fs.writeFileSync(f, stormPng(id)); return f; }
  catch (e) { return null; }
}
app.get('/storm-img/:id.png', (req, res) => {
  const id = req.params.id;
  if (!/^[\w-]{1,60}$/.test(id)) return res.status(400).end();
  res.set('Cache-Control', 'public, max-age=86400');
  const f = ensureStormImage(id);
  if (f) return res.sendFile(f);
  res.type('png').send(stormPng(id));
});

// ============================================================================
// ПРОКСІ ТАЙЛІВ NASA TREK (для аналізу видимих кратерів та крутизни рельєфу)
// ============================================================================
const ALLOWED_TREK_LAYERS = new Set([
  'Mars_Viking_MDIM21_ClrMosaic_global_232m',
  'Mars_MGS_MOLA_ClrShade_merge_global_463m',
  'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw'
]);
const marsTileCache = new Map();

app.get('/api/mars-tile/:layer/:z/:y/:x', async (req, res) => {
  const { layer, z, y, x } = req.params;
  const xClean = String(x).replace(/\.(jpg|png)$/i, '');
  const zi = parseInt(z, 10), yi = parseInt(y, 10), xi = parseInt(xClean, 10);

  if (!ALLOWED_TREK_LAYERS.has(layer) || !Number.isInteger(zi) || zi < 0 || zi > 8 || yi < 0 || xi < 0) {
    return res.status(400).end();
  }
  const numRows = Math.pow(2, zi), numCols = 2 * numRows;
  if (yi >= numRows || xi >= numCols) return res.status(404).end();

  const key = `${layer}/${zi}/${yi}/${xi}`;
  if (marsTileCache.has(key)) {
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(marsTileCache.get(key));
  }

  try {
    const url = `https://trek.nasa.gov/tiles/Mars/EQ/${layer}/1.0.0/default/default028mm/${zi}/${yi}/${xi}.jpg`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return res.status(resp.status).end();

    const buf = Buffer.from(await resp.arrayBuffer());
    if (marsTileCache.size >= 300) {
      marsTileCache.delete(marsTileCache.keys().next().value);
    }
    marsTileCache.set(key, buf);
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) {
    res.status(502).end();
  }
});

// Дозволяємо роздачу зображень для бурі та погоди
app.get(/\.(png|jpg|jpeg|webp|svg)$/i, (req, res) => {
  const safePath = path.join(__dirname, path.basename(req.path));
  res.sendFile(safePath, (err) => {
    if (err) res.status(404).end();
  });
});

// ============================================================================
// ПАРОЛІ (scrypt) ТА СЕСІЇ
// ============================================================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO mars_sessions (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Потрібна авторизація' });

  try {
    const result = await pool.query(
      `SELECT u.id, u.username
       FROM mars_sessions s
       JOIN mars_users u ON u.id = s.user_id
       WHERE s.token = $1`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Сесія недійсна, увійдіть знову' });
    }
    req.user = result.rows[0];
    req.token = token;
    next();
  } catch (err) {
    console.error('Помилка requireAuth:', err);
    res.status(500).json({ error: 'Помилка бази даних на сервері' });
  }
}

function cleanPoint(p) {
  if (!p) return null;
  const lat = Number(p.lat);
  const lon = Number(p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, name: p.name || null };
}

function cleanWaypoints(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(cleanPoint).filter(Boolean);
}

// ============================================================================
// IN-MEMORY FALLBACK ДЛЯ ПОЗНАЧОК WAZE ТА РАДІОЧАТУ
// (Працює завжди, навіть коли PostgreSQL вимкнено або локально)
// ============================================================================
let inMemoryReports = [
  {
    id: 1,
    type: 'breakdown',
    title: 'Зламане шасі ровера Curiosity-04',
    description: 'Застряг у піщаній пастці на схилі кратера. Потрібна допомога або акумулятор.',
    lat: -14.2,
    lon: -65.5,
    author: 'Curiosity-04',
    confirms: 3,
    created_at: new Date(Date.now() - 25 * 60000).toISOString()
  },
  {
    id: 2,
    type: 'ice',
    title: 'Поклади водяного льоду на глибині 25 см',
    description: 'Виявлено спектрометром. Чистота льоду понад 85%, придатний для екстракції.',
    lat: 44.5,
    lon: -160.2,
    author: 'Arcadia-Surveyor',
    confirms: 5,
    created_at: new Date(Date.now() - 48 * 60000).toISOString()
  },
  {
    id: 3,
    type: 'hazard',
    title: 'Глибока тріщина та осип каменю',
    description: 'Урвище понад 15 метрів, A* маршрут краще прокладати на 20 км північніше.',
    lat: -8.5,
    lon: -88.0,
    author: 'Ares-Lead',
    confirms: 4,
    created_at: new Date(Date.now() - 85 * 60000).toISOString()
  },
  {
    id: 4,
    type: 'cache',
    title: 'Аварійний схрон: 2 балони O2 та батарея',
    description: 'Сховано біля базальтової скелі в маркованому контейнері #7.',
    lat: 18.2,
    lon: 76.5,
    author: 'Perseverance-Base',
    confirms: 6,
    created_at: new Date(Date.now() - 110 * 60000).toISOString()
  },
  {
    id: 5,
    type: 'storm',
    title: 'Локальний пиловий смерч (висота ~1.2 км)',
    description: 'Рухається зі швидкістю 35 км/год на схід, знижує видимість до 20 метрів.',
    lat: -26.0,
    lon: 68.0,
    author: 'Hellas-Observer',
    confirms: 2,
    created_at: new Date(Date.now() - 15 * 60000).toISOString()
  }
];

let inMemoryChat = [
  {
    id: 1,
    author: 'База «Єзеро»',
    callsign: 'HQ-Control',
    text: 'Всім роверам сектора 4: сонячна буря сповільнює радіолінк. Працюємо на резервній частоті 142.8 MHz.',
    lat: 18.5,
    lon: 77.1,
    is_alert: false,
    created_at: new Date(Date.now() - 90 * 60000).toISOString()
  },
  {
    id: 2,
    author: 'Ares-Lead',
    callsign: 'Ares-1',
    text: 'Прибув у Долину Марінера. Попереду небезпечний спуск, поставив позначку урвища на мапі.',
    lat: -8.5,
    lon: -88.0,
    is_alert: true,
    created_at: new Date(Date.now() - 60 * 60000).toISOString()
  },
  {
    id: 3,
    author: 'Curiosity-04',
    callsign: 'Curiosity',
    text: 'SOS! Застряг у дюні. Колеса 2 і 4 пробуксовують. Надіслав позначку на карту, хто поруч?',
    lat: -14.2,
    lon: -65.5,
    is_alert: true,
    created_at: new Date(Date.now() - 25 * 60000).toISOString()
  },
  {
    id: 4,
    author: 'Arcadia-Surveyor',
    callsign: 'Ice-Hunter',
    text: 'Підтверджую поклади льоду біля Аркадії! Зразки зібрано. Запасів вистачить усій колонії.',
    lat: 44.5,
    lon: -160.2,
    is_alert: false,
    created_at: new Date(Date.now() - 18 * 60000).toISOString()
  },
  {
    id: 5,
    author: 'Perseverance-Base',
    callsign: 'Percy-Ops',
    text: 'Curiosity, тримайся, дрон Ingenuity-Next вже передає оновлену телеметрію маршруту.',
    lat: 18.5,
    lon: 77.1,
    is_alert: false,
    created_at: new Date(Date.now() - 8 * 60000).toISOString()
  }
];
let nextReportId = 6;
let nextMessageId = 6;

// ============================================================================
// АВТОМАТИЧНЕ СТВОРЕННЯ ТАБЛИЦЬ В POSTGRESQL ПРИ СТАРТІ
// ============================================================================
async function initializeDatabase() {
  if (!connectionString) {
    console.warn('⚠️ DATABASE_URL не знайдено! Перевірте вкладку Variables у Railway.');
    return;
  }

  try {
    const client = await pool.connect();
    console.log('🔌 Підключено до PostgreSQL!');

    await client.query(`
      CREATE TABLE IF NOT EXISTS mars_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        point_a JSONB DEFAULT NULL,
        point_b JSONB DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mars_sessions (
        token VARCHAR(64) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES mars_users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Додаємо колонку waypoints до mars_users (якщо ще немає)
    await client.query(`
      ALTER TABLE mars_users ADD COLUMN IF NOT EXISTS waypoints JSONB DEFAULT NULL;
    `);

    // Таблиця позначок космонавтів (Waze alerts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS mars_reports (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lon DOUBLE PRECISION NOT NULL,
        author VARCHAR(100) NOT NULL,
        confirms INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Таблиця повідомлень космічного радіочату
    await client.query(`
      CREATE TABLE IF NOT EXISTS mars_messages (
        id SERIAL PRIMARY KEY,
        author VARCHAR(100) NOT NULL,
        callsign VARCHAR(100),
        text TEXT NOT NULL,
        lat DOUBLE PRECISION DEFAULT NULL,
        lon DOUBLE PRECISION DEFAULT NULL,
        is_alert BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Унікальність логіну без урахування регістру (бо перевірка йде через LOWER)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS mars_users_username_lower_idx
      ON mars_users (LOWER(username));
    `);

    console.log('✅ Таблиці mars_users та mars_sessions перевірено / створено!');
    client.release();
  } catch (err) {
    console.error('❌ Помилка підключення/створення таблиць:', err.message);
  }
}

initializeDatabase();

// ============================================================================
// API
// ============================================================================

// Реєстрація та вхід
app.post('/api/auth', async (req, res) => {
  const { username, password, mode, pointA, pointB } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'Логін та пароль є обов’язковими' });
  }
  const login = username.trim();
  if (login.length > 100 || password.length > 200) {
    return res.status(400).json({ error: 'Логін або пароль занадто довгі' });
  }

  try {
    const userRes = await pool.query(
      'SELECT * FROM mars_users WHERE LOWER(username) = LOWER($1)',
      [login]
    );
    const existing = userRes.rows[0];

    if (mode === 'register') {
      if (existing) {
        return res.status(400).json({ error: 'Користувач із таким логіном уже зареєстрований' });
      }

      const a = cleanPoint(pointA);
      const b = cleanPoint(pointB);

      const insertRes = await pool.query(
        `INSERT INTO mars_users (username, password, point_a, point_b)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, point_a, point_b`,
        [login, hashPassword(password), a ? JSON.stringify(a) : null, b ? JSON.stringify(b) : null]
      );
      const user = insertRes.rows[0];
      const token = await createSession(user.id);

      return res.json({
        success: true,
        message: 'Акаунт успішно зареєстровано в базі даних!',
        token,
        user: { username: user.username, point_a: user.point_a, point_b: user.point_b }
      });
    }

    // Режим login
    if (!existing || !verifyPassword(password, existing.password)) {
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }

    const token = await createSession(existing.id);
    return res.json({
      success: true,
      message: 'Вхід успішний!',
      token,
      user: {
        username: existing.username,
        point_a: existing.point_a,
        point_b: existing.point_b
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Користувач із таким логіном уже зареєстрований' });
    }
    console.error('Помилка /api/auth:', err);
    res.status(500).json({ error: 'Помилка бази даних на сервері' });
  }
});

// Вихід (видаляє сесію)
app.post('/api/logout', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM mars_sessions WHERE token = $1', [req.token]);
    res.json({ success: true });
  } catch (err) {
    console.error('Помилка /api/logout:', err);
    res.status(500).json({ error: 'Помилка бази даних на сервері' });
  }
});

// Збереження точок маршруту (включаючи вейпоінти) (тільки для власника сесії)
app.post('/api/save-route', requireAuth, async (req, res) => {
  const { pointA, pointB, waypoints } = req.body || {};
  const a = cleanPoint(pointA);
  const b = cleanPoint(pointB);
  const wp = cleanWaypoints(waypoints);

  try {
    await pool.query(
      `UPDATE mars_users
       SET point_a = $1, point_b = $2, waypoints = $3, updated_at = NOW()
       WHERE id = $4`,
      [a ? JSON.stringify(a) : null, b ? JSON.stringify(b) : null, wp.length ? JSON.stringify(wp) : null, req.user.id]
    );

    res.json({ success: true, message: 'Маршрут та вейпоінти збережено в PostgreSQL' });
  } catch (err) {
    console.error('Помилка /api/save-route:', err);
    res.status(500).json({ error: 'Не вдалося зберегти маршрут' });
  }
});

// Завантаження збережених точок (тільки свої)
app.get('/api/load-route/:username', requireAuth, async (req, res) => {
  if (req.params.username.trim().toLowerCase() !== req.user.username.toLowerCase()) {
    return res.status(403).json({ error: 'Немає доступу до чужого акаунту' });
  }

  try {
    const result = await pool.query(
      'SELECT point_a, point_b, waypoints FROM mars_users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }

    res.json({
      success: true,
      pointA: result.rows[0].point_a,
      pointB: result.rows[0].point_b,
      waypoints: result.rows[0].waypoints || []
    });
  } catch (err) {
    console.error('Помилка /api/load-route:', err);
    res.status(500).json({ error: 'Помилка зчитування з бази даних' });
  }
});

// ============================================================================
// ПОЗНАЧКИ КОСМОНАВТІВ (WAZE ALERTS & HAZARDS)
// ============================================================================
app.get('/api/reports', async (req, res) => {
  try {
    if (connectionString) {
      const result = await pool.query('SELECT * FROM mars_reports ORDER BY created_at DESC LIMIT 150');
      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, reports: result.rows });
      }
    }
  } catch (e) {
    console.warn('Postgres /api/reports fallback to in-memory:', e.message);
  }
  res.json({ success: true, reports: inMemoryReports });
});

app.post('/api/reports', async (req, res) => {
  const { type, title, description, lat, lon, author } = req.body || {};
  const cleanLat = Number(lat);
  const cleanLon = Number(lon);
  if (!type || !title || !Number.isFinite(cleanLat) || !Number.isFinite(cleanLon)) {
    return res.status(400).json({ error: 'Некоректні параметри позначки' });
  }

  const report = {
    id: nextReportId++,
    type: String(type).slice(0, 50),
    title: String(title).slice(0, 200),
    description: description ? String(description).slice(0, 500) : '',
    lat: cleanLat,
    lon: cleanLon,
    author: author ? String(author).slice(0, 100) : 'Астронавт',
    confirms: 1,
    created_at: new Date().toISOString()
  };

  // Автоматичне сповіщення в космічний радіочат про нову позначку
  const chatMsg = {
    id: nextMessageId++,
    author: report.author,
    callsign: report.author,
    text: `🚨 [WAZE ПОЗНАЧКА: ${report.title.toUpperCase()}] ${report.description || 'Подія на мапі'}`,
    lat: cleanLat,
    lon: cleanLon,
    is_alert: true,
    created_at: new Date().toISOString()
  };
  inMemoryChat.push(chatMsg);
  inMemoryReports.unshift(report);

  try {
    if (connectionString) {
      const dbRes = await pool.query(
        `INSERT INTO mars_reports (type, title, description, lat, lon, author, confirms)
         VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *`,
        [report.type, report.title, report.description, report.lat, report.lon, report.author]
      );
      if (dbRes.rows && dbRes.rows[0]) {
        report.id = dbRes.rows[0].id;
      }
      await pool.query(
        `INSERT INTO mars_messages (author, callsign, text, lat, lon, is_alert)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [chatMsg.author, chatMsg.callsign, chatMsg.text, chatMsg.lat, chatMsg.lon]
      ).catch(() => {});
    }
  } catch (e) {
    console.warn('Postgres insert report fallback to memory:', e.message);
  }

  res.json({ success: true, report });
});

app.post('/api/reports/:id/confirm', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rep = inMemoryReports.find(r => r.id === id);
  if (rep) rep.confirms = (rep.confirms || 1) + 1;

  try {
    if (connectionString) {
      await pool.query('UPDATE mars_reports SET confirms = confirms + 1 WHERE id = $1', [id]);
    }
  } catch (e) {
    console.warn('Confirm postgres error:', e.message);
  }

  res.json({ success: true, confirms: rep ? rep.confirms : 1 });
});

// ============================================================================
// КОСМІЧНИЙ РАДІОЧАТ КОСМОНАВТІВ (MARS COMM-LINK)
// ============================================================================
app.get('/api/chat', async (req, res) => {
  try {
    if (connectionString) {
      const result = await pool.query('SELECT * FROM mars_messages ORDER BY created_at ASC LIMIT 100');
      if (result.rows && result.rows.length > 0) {
        return res.json({ success: true, messages: result.rows });
      }
    }
  } catch (e) {
    console.warn('Postgres /api/chat fallback to memory:', e.message);
  }
  res.json({ success: true, messages: inMemoryChat });
});

app.post('/api/chat', async (req, res) => {
  const { author, callsign, text, lat, lon } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Повідомлення не може бути порожнім' });
  }

  const cleanLat = lat != null && Number.isFinite(Number(lat)) ? Number(lat) : null;
  const cleanLon = lon != null && Number.isFinite(Number(lon)) ? Number(lon) : null;

  const msg = {
    id: nextMessageId++,
    author: author ? String(author).trim().slice(0, 100) : 'Астронавт',
    callsign: callsign ? String(callsign).trim().slice(0, 100) : (author || 'Rover-1'),
    text: String(text).trim().slice(0, 500),
    lat: cleanLat,
    lon: cleanLon,
    is_alert: false,
    created_at: new Date().toISOString()
  };

  inMemoryChat.push(msg);
  if (inMemoryChat.length > 150) inMemoryChat.shift();

  try {
    if (connectionString) {
      const dbRes = await pool.query(
        `INSERT INTO mars_messages (author, callsign, text, lat, lon, is_alert)
         VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
        [msg.author, msg.callsign, msg.text, msg.lat, msg.lon]
      );
      if (dbRes.rows && dbRes.rows[0]) msg.id = dbRes.rows[0].id;
    }
  } catch (e) {
    console.warn('Postgres insert chat fallback to memory:', e.message);
  }

  res.json({ success: true, message: msg });
});

// Діагностика: відкрийте /api/health у браузері, щоб побачити, до якої бази підключений сервер
app.get('/api/health', async (req, res) => {
  if (!connectionString) {
    return res.status(500).json({ ok: false, error: 'DATABASE_URL не задано у Variables сервісу mars-map' });
  }
  try {
    const info = await pool.query('SELECT current_database() AS db, inet_server_addr()::text AS server');
    const users = await pool.query('SELECT COUNT(*)::int AS count FROM mars_users');
    res.json({ ok: true, database: info.rows[0].db, users: users.rows[0].count });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================================
// ПОГОДА НА МАРСІ: реальний час/сезон (Mars24) + REMS Curiosity (якщо свіжі дані)
// + кліматологія пилових бур (треки за спостереженнями MRO/MARCI)
// ============================================================================
const R_MARS = 3389.5;
function marsTime(ms) {
  const T = (ms / 86400000 + 2440587.5 + (37 + 32.184) / 86400) - 2451545.0;
  const rad = Math.PI / 180, M = (19.3871 + 0.52402073 * T) % 360;
  const pbs = [[2.2353,49.409,.0071],[2.7543,168.173,.0057],[1.1177,191.837,.0039],[15.7866,21.736,.0037],[2.1354,15.704,.0021],[2.4694,95.528,.0020],[32.8493,49.095,.0018]]
    .reduce((s, [p, ph, a]) => s + a * Math.cos((0.985626 * T / p + ph) * rad), 0);
  const eoc = (10.691 + 3e-7 * T) * Math.sin(M * rad) + 0.623 * Math.sin(2 * M * rad) + 0.05 * Math.sin(3 * M * rad) + 0.005 * Math.sin(4 * M * rad) + pbs;
  const ls = (((270.3871 + 0.524038496 * T) % 360) + eoc + 360) % 360;
  const msd = (T + 2451545.0 - 2405522.0028779) / 1.0274912517;
  return { ls: Number(ls.toFixed(1)), msd, sol: Math.floor(msd - 49269.2455), marsYear: Math.floor((msd - 28890.5) / 668.6) + 1 };
}
function destPoint(lat, lon, hdg, km) {
  const r = Math.PI / 180, d = km / R_MARS, h = hdg * r, p = lat * r;
  const p2 = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(h));
  const l2 = lon * r + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(p2));
  return { lat: p2 / r, lon: ((l2 / r + 540) % 360) - 180 };
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// w: [Ls_від, Ls_до, імовірність, інтенсивність]. Це клімат, а не спостереження.
const STORM_TRACKS = [
  { id: 'acidalia', region: 'Acidalia Planitia', lat: 48, lon: -25, sp: [6, 25], w: [[0, 75, .55, .7], [150, 360, .9, 1.1]] },
  { id: 'utopia', region: 'Utopia Planitia', lat: 46, lon: 112, sp: [6, 25], w: [[0, 75, .55, .7], [150, 360, .9, 1.1]] },
  { id: 'arcadia', region: 'Arcadia Planitia', lat: 47, lon: -165, sp: [6, 25], w: [[0, 75, .5, .7], [150, 360, .85, 1.1]] },
  { id: 'chryse', region: 'Chryse Planitia', lat: 22, lon: -42, sp: [8, 15], w: [[200, 330, .55, 1.1]] },
  { id: 'hellas', region: 'Hellas Planitia', lat: -42, lon: 70, sp: [6, 15], w: [[180, 320, .75, 1.3]] },
  { id: 'argyre', region: 'Argyre Planitia', lat: -50, lon: -42, sp: [5, 15], w: [[180, 320, .55, 1.1]] },
  { id: 'noachis', region: 'Noachis Terra', lat: -38, lon: 10, sp: [6, 20], w: [[200, 330, .45, 1.1]] },
  { id: 'daedalia', region: 'Daedalia Planum', lat: -22, lon: -130, sp: [6, 20], w: [[200, 320, .5, 1.1]] }
];

const MIN_STORMS = 3;
function climatologyStorms(msd, ls, nowMs) {
  const LIFE_H = 4, out = [], curHour = Math.floor(nowMs / 3600000);
  const active = STORM_TRACKS.map((t, i) => ({ t, i, w: t.w.find(x => ls >= x[0] && ls < x[1]) })).filter(x => x.w);
  const season = ls >= 180 && ls <= 330;

  const build = (t, w, hh, k, r, age, tag) => {
    const lat0 = t.lat + (r() - .5) * 2 * t.sp[0], lon0 = t.lon + (r() - .5) * 2 * t.sp[1];
    const heading = Math.round((90 + (r() - .5) * 70 + 360) % 360), speed = Math.round((30 + r() * 40) * (0.8 + 0.4 * w[3]));
    const p = destPoint(lat0, lon0, heading, speed * age);
    const life = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(age, LIFE_H - 0.01) / LIFE_H);
    const radius = Math.max(150, Math.round((220 + r() * 260) * w[3] * life));
    return {
      id: `${t.id}-${hh}-${tag}${k}`, name: `Пиловий шторм · ${t.region}`, regionName: t.region,
      lat: Number(p.lat.toFixed(2)), lon: Number(p.lon.toFixed(2)), headingDeg: heading, speedKmH: speed,
      radiusKm: radius, outerRadiusKm: Math.round(radius * 1.6), startedAt: new Date(nowMs - age * 3600000).toISOString(),
      windSpeedMs: Number((14 + 10 * w[3] * r()).toFixed(1)), tau: Number((0.8 + 1.4 * w[3] * r()).toFixed(2))
    };
  };

  if (active.length) {
    for (let hh = curHour - LIFE_H + 1; hh <= curHour; hh++) {
      const r = rng(hh * 7919 + 13);
      let n = Math.floor(r() * (season ? 3 : 2)) + (hh === curHour ? 1 : 0);
      n = Math.min(n, season ? 3 : 2);
      for (let k = 0; k < n; k++) {
        const { t, w } = active[Math.floor(r() * active.length)];
        const age = (nowMs - hh * 3600000) / 3600000;
        if (age >= LIFE_H) continue;
        out.push(build(t, w, hh, k, r, age, ''));
      }
    }
  }

  if (out.length < MIN_STORMS) {
    const r = rng(curHour * 104729 + 7), used = new Set(out.map(o => o.id.split('-')[0]));
    const pool = STORM_TRACKS.filter(t => !used.has(t.id));
    for (let k = 0; out.length < MIN_STORMS && pool.length; k++) {
      const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const age = 0.3 + r() * (LIFE_H - 1.0);
      out.push(build(t, [0, 360, .6, .9], curHour, k, r, age, 'm'));
    }
  }
  return out;
}

let cachedMarsWeather = null, lastWeatherFetchTime = 0;
async function fetchRems() {
  try {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 1500);
    const resp = await fetch('https://api.maas2.jiinxt.com/', { signal: c.signal });
    clearTimeout(t);
    if (!resp.ok) return null;
    const j = await resp.json(), d = Array.isArray(j.results) ? j.results[0] : j;
    if (!d || !d.terrestrial_date) return null;
    const ageDays = (Date.now() - Date.parse(d.terrestrial_date)) / 86400000;
    return { fresh: ageDays <= 14, ageDays: Math.round(ageDays), sol: d.sol, date: d.terrestrial_date,
      min_temp: d.min_temp, max_temp: d.max_temp, pressure: d.pressure, atmo_opacity: d.atmo_opacity,
      wind_speed: d.wind_speed, wind_direction: d.wind_direction };
  } catch (e) { return null; }
}

app.get('/api/mars-weather', async (req, res) => {
  const now = Date.now();
  if (cachedMarsWeather && now - lastWeatherFetchTime < 5 * 60 * 1000) return res.json(cachedMarsWeather);
  const mt = marsTime(now), rems = await fetchRems();
  const storms = climatologyStorms(mt.msd, mt.ls, now);
  storms.forEach(st => ensureStormImage(st.id));
  cachedMarsWeather = {
    success: true, updated_at: new Date(now).toISOString(),
    sol: mt.sol, ls: mt.ls, marsYear: mt.marsYear,
    season: mt.ls < 90 ? 'Північна весна (південна осінь)' : mt.ls < 180 ? 'Північне літо (південна зима)' : mt.ls < 270 ? 'Північна осінь (південна весна) — сезон бур' : 'Північна зима (південне літо) — сезон бур',
    stormSeason: mt.ls >= 180 && mt.ls <= 330,
    ground: rems && rems.fresh ? rems : null,
    remsLastSeen: rems ? { date: rems.date, ageDays: rems.ageDays } : null,
    tau: Number((0.5 + (storms.length ? Math.max(...storms.map(s => s.tau)) * 0.1 : 0)).toFixed(2)),
    storms, stormSource: 'CLIMATOLOGY_MRO_MARCI',
    note: 'Положення бур — модель за кліматологією треків (MRO/MARCI), а не живе спостереження: відкритого API з полігонами бур у реальному часі не існує. Поза сезоном бур для наочності показано кілька слабших штормів.'
  };
  lastWeatherFetchTime = now;
  res.json(cachedMarsWeather);
});

// Маршрутизація сторінки
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
});