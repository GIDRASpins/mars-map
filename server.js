const express = require('express');
const { Pool } = require('pg');
const path = require('path');
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

// Роздаємо статичні файли (index.html, script.js, style.css)
app.use(express.static(path.join(__dirname)));

// АВТОМАТИЧНЕ СТВОРЕННЯ ТАБЛИЦІ В POSTGRESQL ПРИ СТАРТІ
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

    console.log('✅ Таблиця mars_users успішно перевірена / створена в базі даних!');
    client.release();
  } catch (err) {
    console.error('❌ Помилка підключення/створення таблиці:', err.message);
  }
}

initializeDatabase();

// Реєстрація та вхід
app.post('/api/auth', async (req, res) => {
  const { username, password, mode, pointA, pointB } = req.body;

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
        return res.status(400).json({ error: 'Користувач із таким логіном уже зареєстрований' });
      }

      const insertRes = await pool.query(
        `INSERT INTO mars_users (username, password, point_a, point_b)
         VALUES ($1, $2, $3, $4)
         RETURNING username, point_a, point_b`,
        [
          username.trim(),
          password,
          pointA ? JSON.stringify(pointA) : null,
          pointB ? JSON.stringify(pointB) : null
        ]
      );

      return res.json({
        success: true,
        message: 'Акаунт успішно зареєстровано в базі даних!',
        user: insertRes.rows[0]
      });
    } else {
      // Режим login
      if (!existing || existing.password !== password) {
        return res.status(401).json({ error: 'Невірний логін або пароль' });
      }

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
    console.error('Помилка /api/auth:', err);
    res.status(500).json({ error: 'Помилка бази даних на сервері' });
  }
});

// Збереження точок маршруту
app.post('/api/save-route', async (req, res) => {
  const { username, pointA, pointB } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Користувача не вказано' });
  }

  try {
    await pool.query(
      `UPDATE mars_users
       SET point_a = $1, point_b = $2, updated_at = NOW()
       WHERE LOWER(username) = LOWER($3)`,
      [
        pointA ? JSON.stringify(pointA) : null,
        pointB ? JSON.stringify(pointB) : null,
        username.trim()
      ]
    );

    res.json({ success: true, message: 'Маршрут збережено в PostgreSQL' });
  } catch (err) {
    console.error('Помилка /api/save-route:', err);
    res.status(500).json({ error: 'Не вдалося зберегти маршрут' });
  }
});

// Завантаження збережених точок
app.get('/api/load-route/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      'SELECT point_a, point_b FROM mars_users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
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

// Маршрутизація сторінки
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
});