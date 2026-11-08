const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Отримуємо URL бази з Railway
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

console.log('🔍 Статус підключення: ', connectionString ? 'DATABASE_URL знайдено' : '❌ DATABASE_URL НЕ ЗНАЙДЕНО!');

const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' || (connectionString && !connectionString.includes('localhost'))
    ? { rejectUnauthorized: false }
    : false
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Створення таблиці
async function initializeDatabase() {
  if (!connectionString) return;
  try {
    const client = await pool.connect();
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
    console.log('✅ Таблиця mars_users готова до запису');
    client.release();
  } catch (err) {
    console.error('❌ Помилка БД при старті:', err.message);
  }
}
initializeDatabase();

// Реєстрація / Вхід
app.post('/api/auth', async (req, res) => {
  const { username, password, mode, pointA, pointB } = req.body;
  console.log(`📡 [Отримано запит /api/auth] Режим: ${mode}, Користувач: ${username}`);

  if (!username || !password) {
    return res.status(400).json({ error: 'Логін та пароль є обов’язковими' });
  }

  try {
    const userRes = await pool.query(
      'SELECT * FROM mars_users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    const existing = userRes.rows[0];

    if (mode === 'register') {
      if (existing) {
        console.log(`⚠️ Користувач ${username} вже існує`);
        return res.status(400).json({ error: 'Користувач із таким логіном уже зареєстрований' });
      }

      // ТУТ ВИПРАВЛЕНО: додано явний каст $3::jsonb та $4::jsonb
      const insertRes = await pool.query(
        `INSERT INTO mars_users (username, password, point_a, point_b)
         VALUES ($1, $2, $3::jsonb, $4::jsonb)
         RETURNING id, username, point_a, point_b`,
        [
          username.trim(),
          password,
          pointA ? JSON.stringify(pointA) : null,
          pointB ? JSON.stringify(pointB) : null
        ]
      );

      console.log(`🎉 [УСПІХ] Користувача ${username} успішно ЗАПИСАНО В БАЗУ з ID: ${insertRes.rows[0].id}`);

      return res.json({
        success: true,
        message: 'Акаунт збережено в базі даних!',
        user: insertRes.rows[0]
      });
    } else {
      // Login
      if (!existing || existing.password !== password) {
        return res.status(401).json({ error: 'Невірний логін або пароль' });
      }

      console.log(`🔑 [УСПІХ] Користувач ${username} увійшов в акаунт`);
      return res.json({
        success: true,
        message: 'Вхід успішний!',
        user: {
          username: existing.username,
          point_a: existing.point_a,
          point_b: existing.point_b
        }
      });
    }
  } catch (err) {
    console.error('❌ ПОМИЛКА SQL В /api/auth:', err);
    res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
  }
});

// Збереження точок
app.post('/api/save-route', async (req, res) => {
  const { username, pointA, pointB } = req.body;

  if (!username) return res.status(400).json({ error: 'Користувача не вказано' });

  try {
    // ТУТ ВИПРАВЛЕНО: додано явний каст $1::jsonb та $2::jsonb
    await pool.query(
      `UPDATE mars_users
       SET point_a = $1::jsonb, point_b = $2::jsonb, updated_at = NOW()
       WHERE LOWER(username) = LOWER($3)`,
      [
        pointA ? JSON.stringify(pointA) : null,
        pointB ? JSON.stringify(pointB) : null,
        username.trim()
      ]
    );

    console.log(`💾 Маршрут користувача ${username} оновлено в базі`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ ПОМИЛКА SQL В /api/save-route:', err);
    res.status(500).json({ error: 'Не вдалося зберегти точки: ' + err.message });
  }
});

// Завантаження точок
app.get('/api/load-route/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      'SELECT point_a, point_b FROM mars_users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не знайдено' });
    res.json({ success: true, pointA: result.rows[0].point_a, pointB: result.rows[0].point_b });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
});
