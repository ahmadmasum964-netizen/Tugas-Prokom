const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { run, all, get, init } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function getUserByName(name) {
  return get('SELECT * FROM users WHERE name = ?', [name]);
}

async function createUser(name, { role = 'member', accountType = '', accountName = '', accountNumber = '' } = {}) {
  const normalizedName = name.trim();
  const normalizedRole = normalizedName.toLowerCase() === 'bandahara' ? 'admin' : role;
  const existing = await getUserByName(normalizedName);

  if (existing) {
    if (
      accountType !== '' ||
      accountName !== '' ||
      accountNumber !== '' ||
      existing.role !== normalizedRole
    ) {
      await run(
        'UPDATE users SET role = ?, account_type = ?, account_name = ?, account_number = ? WHERE id = ?',
        [normalizedRole, accountType || existing.account_type, accountName || existing.account_name, accountNumber || existing.account_number, existing.id]
      );
    }
    return getUserByName(normalizedName);
  }

  await run(
    'INSERT INTO users (name, role, account_type, account_name, account_number) VALUES (?, ?, ?, ?, ?)',
    [normalizedName, normalizedRole, accountType, accountName, accountNumber]
  );
  return getUserByName(normalizedName);
}

async function updateUserAccount(id, accountType, accountName, accountNumber) {
  await run(
    'UPDATE users SET account_type = ?, account_name = ?, account_number = ? WHERE id = ?',
    [accountType, accountName, accountNumber, id]
  );
  return get('SELECT * FROM users WHERE id = ?', [id]);
}

function formatTransaction(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    type: row.type,
    amount: row.amount,
    description: row.description || '',
    category: row.category || '-',
    created_at: row.created_at,
  };
}

function formatNotification(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    message: row.message,
    created_at: row.created_at,
  };
}

app.get('/api/users', async (req, res) => {
  try {
    if (req.query.name) {
      const user = await get('SELECT * FROM users WHERE name = ?', [req.query.name]);
      if (!user) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      }
      return res.json(user);
    }

    const rows = await all(
      'SELECT id, name, role, account_type, account_name, account_number FROM users ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { name, accountType, accountName, accountNumber } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama pengguna diperlukan.' });
  }

  try {
    const user = await createUser(name.trim(), {
      accountType: accountType || '',
      accountName: accountName || '',
      accountNumber: accountNumber || '',
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  const userId = Number(req.params.id);
  const { accountType, accountName, accountNumber } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'ID pengguna tidak valid.' });
  }

  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const updatedUser = await updateUserAccount(userId, accountType || '', accountName || '', accountNumber || '');
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  const userName = req.query.user;
  const whereUser = userName ? 'WHERE u.name = ?' : '';
  const params = userName ? [userName] : [];

  try {
    const transactions = await all(`
      SELECT t.id, t.type, t.amount, t.description, t.category, t.created_at, u.id AS user_id, u.name AS user_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ${whereUser}
      ORDER BY t.created_at DESC, t.id DESC
    `, params);

    const formatted = transactions.map(formatTransaction);
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function broadcastExpenseNotification(transaction) {
  const users = await all('SELECT id, name FROM users');
  const message = `Pengeluaran kas sebesar Rp ${transaction.amount.toLocaleString('id-ID')} untuk ${transaction.category || 'biaya umum'} oleh ${transaction.user_name}. ${transaction.description ? 'Catatan: ' + transaction.description : ''}`;

  for (const user of users) {
    await run(
      'INSERT INTO notifications (user_id, transaction_id, message) VALUES (?, ?, ?)',
      [user.id, transaction.id, message]
    );
  }

  io.emit('notification', {
    message,
    transaction_id: transaction.id,
    created_at: new Date().toISOString(),
  });
}

app.post('/api/transactions', async (req, res) => {
  const { userName, type, amount, description, category } = req.body;
  if (!userName || !type || !amount) {
    return res.status(400).json({ error: 'Data transaksi tidak lengkap.' });
  }

  const normalizedType = type === 'expense' ? 'expense' : 'income';
  const parsedAmount = parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Jumlah harus angka lebih dari 0.' });
  }

  try {
    const user = await createUser(userName.trim());
    const result = await run(
      'INSERT INTO transactions (user_id, type, amount, description, category) VALUES (?, ?, ?, ?, ?)',
      [user.id, normalizedType, parsedAmount, description || '', category || '']
    );

    const transaction = await get(
      `SELECT t.id, t.type, t.amount, t.description, t.category, t.created_at, u.id AS user_id, u.name AS user_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ?`,
      [result.lastID]
    );

    const formatted = formatTransaction(transaction);
    io.emit('transaction:created', formatted);

    if (normalizedType === 'expense') {
      await broadcastExpenseNotification(formatted);
    }

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/summary', async (req, res) => {
  const userName = req.query.user;
  const userCondition = userName ? 'WHERE u.name = ?' : '';
  const params = userName ? [userName] : [];

  try {
    const totals = await all(
      `SELECT u.name AS user_name, 
              SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS total_income,
              SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS total_expense
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       ${userCondition}
       GROUP BY u.id
       ORDER BY u.name`,
      params
    );

    const summary = totals.map(row => ({
      user_name: row.user_name,
      total_income: row.total_income || 0,
      total_expense: row.total_expense || 0,
      balance: (row.total_income || 0) - (row.total_expense || 0),
    }));

    const global = await get(
      `SELECT 
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS total_income,
        SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS total_expense
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       ${userCondition}`,
      params
    );

    res.json({
      users: summary,
      global: {
        total_income: global.total_income || 0,
        total_expense: global.total_expense || 0,
        balance: (global.total_income || 0) - (global.total_expense || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  const userName = req.query.name;
  const whereUser = userName ? 'WHERE u.name = ?' : '';
  const params = userName ? [userName] : [];

  try {
    const notifications = await all(
      `SELECT n.id, n.user_id, n.message, n.created_at
       FROM notifications n
       JOIN users u ON n.user_id = u.id
       ${whereUser}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 20`,
      params
    );
    res.json(notifications.map(formatNotification));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', socket => {
  console.log('Socket connected', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected', socket.id));
});

const PORT = process.env.PORT || 3000;
const rawHost = process.env.HOST || '0.0.0.0';
const HOST = rawHost.replace(/^https?:\/\//, '');
const DISPLAY_HOST = HOST === '0.0.0.0' ? 'localhost' : HOST;

init()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Server berjalan di http://${DISPLAY_HOST}:${PORT}`);
      console.log('Buka browser dengan URL: http://' + DISPLAY_HOST + ':' + PORT);
    });

    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} sudah digunakan. Hentikan server lain atau gunakan PORT yang berbeda.`);
      } else {
        console.error(err);
      }
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('Gagal inisialisasi database:', err);
    process.exit(1);
  });
