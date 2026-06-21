const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, prepare, exec } = require('./database');
const allocationService = require('./allocationService');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

app.use((req, res, next) => {
  try {
    allocationService.expireOldLocks();
  } catch (e) {
    console.error('清理过期锁定出错:', e.message);
  }
  next();
});

app.get('/api/shows', (req, res) => {
  const shows = prepare('SELECT * FROM shows ORDER BY date ASC').all();
  res.json(shows);
});

app.get('/api/shows/:showId', (req, res) => {
  const show = prepare('SELECT * FROM shows WHERE id = ?').get(req.params.showId);
  if (!show) return res.status(404).json({ error: '演出不存在' });
  res.json(show);
});

app.get('/api/shows/:showId/tiers', (req, res) => {
  const tiers = prepare(`
    SELECT tt.*,
      (SELECT COUNT(*) FROM seats s WHERE s.tier_id = tt.id AND s.status = 'available') as available_seats,
      (SELECT COUNT(*) FROM seats s WHERE s.tier_id = tt.id AND s.status = 'sold') as sold_seats,
      (SELECT COUNT(*) FROM seats s WHERE s.tier_id = tt.id AND s.status = 'locked') as locked_seats,
      (SELECT COUNT(*) FROM waitlist_entries we WHERE we.tier_id = tt.id AND we.status = 'waiting') as waitlist_count
    FROM ticket_tiers tt
    WHERE tt.show_id = ?
    ORDER BY tt.price ASC
  `).all(req.params.showId);
  res.json(tiers);
});

app.get('/api/shows/:showId/seats', (req, res) => {
  const { tierId } = req.query;
  let query = 'SELECT * FROM seats WHERE show_id = ?';
  const params = [req.params.showId];
  if (tierId) {
    query += ' AND tier_id = ?';
    params.push(tierId);
  }
  query += ' ORDER BY tier_id, row_label, seat_number';
  const seats = prepare(query).all(...params);
  res.json(seats);
});

app.get('/api/shows/:showId/waitlist', (req, res) => {
  const { tierId } = req.query;
  let query = `
    SELECT we.*, u.name as user_name, u.phone as user_phone
    FROM waitlist_entries we
    JOIN users u ON we.user_id = u.id
    WHERE we.show_id = ?
  `;
  const params = [req.params.showId];
  if (tierId) {
    query += ' AND we.tier_id = ?';
    params.push(tierId);
  }
  query += ' ORDER BY we.submitted_at ASC';
  const entries = prepare(query).all(...params);
  res.json(entries);
});

app.get('/api/shows/:showId/locks', (req, res) => {
  const locks = prepare(`
    SELECT l.*, u.name as user_name, tt.name as tier_name
    FROM locks l
    JOIN users u ON l.user_id = u.id
    JOIN ticket_tiers tt ON l.tier_id = tt.id
    WHERE l.show_id = ?
    ORDER BY l.locked_at DESC
  `).all(req.params.showId);
  res.json(locks);
});

app.get('/api/shows/:showId/bookings', (req, res) => {
  const bookings = prepare(`
    SELECT cb.*, u.name as user_name, tt.name as tier_name
    FROM confirmed_bookings cb
    JOIN users u ON cb.user_id = u.id
    JOIN ticket_tiers tt ON cb.tier_id = tt.id
    WHERE cb.show_id = ?
    ORDER BY cb.confirmed_at DESC
  `).all(req.params.showId);
  res.json(bookings);
});

app.get('/api/shows/:showId/allocation-logs', (req, res) => {
  const logs = prepare(`
    SELECT * FROM allocation_logs
    WHERE show_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.params.showId);
  res.json(logs);
});

app.get('/api/allocation-logs/:logId', (req, res) => {
  const log = prepare('SELECT * FROM allocation_logs WHERE id = ?').get(req.params.logId);
  if (!log) return res.status(404).json({ error: '日志不存在' });

  const items = prepare(`
    SELECT * FROM allocation_log_items
    WHERE log_id = ?
    ORDER BY rank ASC
  `).all(req.params.logId);

  res.json({ ...log, items });
});

app.post('/api/waitlist', (req, res) => {
  const { userId, showId, tierId, maxConsecutiveSeats } = req.body;
  if (!userId || !showId || !tierId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  const result = allocationService.addWaitlistEntry(
    userId, showId, tierId, maxConsecutiveSeats || 1
  );
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

app.delete('/api/waitlist/:entryId', (req, res) => {
  const result = allocationService.cancelWaitlistEntry(req.params.entryId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/seats/:seatId/refund', (req, res) => {
  const result = allocationService.refundTicket(req.params.seatId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/locks/:lockId/confirm', (req, res) => {
  const result = allocationService.confirmLock(req.params.lockId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/locks/:lockId/release', (req, res) => {
  const lock = allocationService.releaseLock(req.params.lockId, 'admin_released');
  if (lock) {
    setTimeout(() => {
      allocationService.runAllocation(lock.show_id, lock.tier_id, 'admin_release', '运营手动释放锁定');
    }, 100);
    res.json({ success: true, lock });
  } else {
    res.status(400).json({ error: '锁定不存在或已释放' });
  }
});

app.post('/api/shows/:showId/tiers/:tierId/allocate', (req, res) => {
  const result = allocationService.runAllocation(
    req.params.showId, req.params.tierId,
    'manual_trigger', '运营手动触发递补'
  );
  res.json(result);
});

app.get('/api/users', (req, res) => {
  const users = prepare('SELECT * FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

app.get('/api/users/:userId/locks', (req, res) => {
  const locks = prepare(`
    SELECT l.*, s.name as show_name, tt.name as tier_name
    FROM locks l
    JOIN shows s ON l.show_id = s.id
    JOIN ticket_tiers tt ON l.tier_id = tt.id
    WHERE l.user_id = ? AND l.status = 'locked'
    ORDER BY l.locked_at DESC
  `).all(req.params.userId);
  res.json(locks);
});

app.get('/api/users/:userId/bookings', (req, res) => {
  const bookings = prepare(`
    SELECT cb.*, s.name as show_name, tt.name as tier_name
    FROM confirmed_bookings cb
    JOIN shows s ON cb.show_id = s.id
    JOIN ticket_tiers tt ON cb.tier_id = tt.id
    WHERE cb.user_id = ?
    ORDER BY cb.confirmed_at DESC
  `).all(req.params.userId);
  res.json(bookings);
});

app.get('/api/health', (req, res) => {
  allocationService.expireOldLocks();
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (fs.existsSync(publicPath)) {
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

async function startServer() {
  await initDatabase();
  console.log('数据库初始化完成');

  allocationService.expireOldLocks();

  setInterval(() => {
    try {
      allocationService.expireOldLocks();
    } catch (e) {
      console.error('定时清理过期锁定出错:', e.message);
    }
  }, 10000);

  app.listen(PORT, () => {
    console.log(`候补递补服务运行在 http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
