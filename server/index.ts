import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import pool, { initDB } from './db';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) {
      res.status(400).json({ error: '用户名不能为空，密码至少4位' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);

    const [rows] = await pool.execute<any[]>(
      'SELECT id, username, created_at FROM users WHERE username = ?', [username]
    );
    res.json({ user: rows[0] });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: '用户名已存在' });
    } else {
      console.error('[register]', err);
      res.status(500).json({ error: '服务器错误' });
    }
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: '请输入用户名和密码' });
      return;
    }

    const [rows] = await pool.execute<any[]>(
      'SELECT id, username, password, created_at FROM users WHERE username = ?', [username]
    );
    if (rows.length === 0) {
      res.status(401).json({ error: '用户名不存在或密码错误' });
      return;
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: '用户名不存在或密码错误' });
      return;
    }

    res.json({ user: { id: user.id, username: user.username, created_at: user.created_at } });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/user/:username
app.get('/api/user/:username', async (req, res) => {
  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT id, username, created_at FROM users WHERE username = ?', [req.params.username]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[user]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[server] API running on http://localhost:${PORT}`);
  });
});

export default app;
