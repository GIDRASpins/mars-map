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

// Віддаємо ТІЛЬКИ файли фронтенду (server.js, package.json тощо більше не доступні з браузера)
const PUBLIC_FILES = ['index.html', 'script.js', 'style.css'];
PUBLIC_FILES.forEach((file) => {
  app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
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
  return { lat, lon };
}

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

// Збереження точок маршруту (тільки для власника сесії)
app.post('/api/save-route', requireAuth, async (req, res) => {
  const { pointA, pointB } = req.body || {};
  const a = cleanPoint(pointA);
  const b = cleanPoint(pointB);

  try {
    await pool.query(
      `UPDATE mars_users
       SET point_a = $1, point_b = $2, updated_at = NOW()
       WHERE id = $3`,
      [a ? JSON.stringify(a) : null, b ? JSON.stringify(b) : null, req.user.id]
    );

    res.json({ success: true, message: 'Маршрут збережено в PostgreSQL' });
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
      'SELECT point_a, point_b FROM mars_users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }

    res.json({
      success: true,
      pointA: result.rows[0].point_a,
      pointB: result.rows[0].point_b
    });
  } catch (err) {
    console.error('Помилка /api/load-route:', err);
    res.status(500).json({ error: 'Помилка зчитування з бази даних' });
  }
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

// Маршрутизація сторінки
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
});