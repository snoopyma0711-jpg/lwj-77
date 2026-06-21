const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'waitlist.db');

let db = null;
let SQL = null;
let initPromise = null;

async function initDatabase() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    SQL = await initSqlJs();

    if (!fs.existsSync(path.dirname(dbPath))) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    const createTables = [
      `CREATE TABLE IF NOT EXISTS shows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        venue TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS ticket_tiers (
        id TEXT PRIMARY KEY,
        show_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        seat_section TEXT NOT NULL,
        total_seats INTEGER NOT NULL,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS seats (
        id TEXT PRIMARY KEY,
        tier_id TEXT NOT NULL,
        show_id TEXT NOT NULL,
        row_label TEXT,
        seat_number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        sold_order INTEGER,
        refunded_at TEXT,
        FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE CASCADE,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS waitlist_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        show_id TEXT NOT NULL,
        tier_id TEXT NOT NULL,
        max_consecutive_seats INTEGER NOT NULL DEFAULT 1,
        submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'waiting',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
        FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS locks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        show_id TEXT NOT NULL,
        waitlist_entry_id TEXT NOT NULL,
        seat_ids TEXT NOT NULL,
        tier_id TEXT NOT NULL,
        consecutive_count INTEGER NOT NULL,
        locked_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'locked',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
        FOREIGN KEY (waitlist_entry_id) REFERENCES waitlist_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS allocation_logs (
        id TEXT PRIMARY KEY,
        show_id TEXT NOT NULL,
        tier_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_detail TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS allocation_log_items (
        id TEXT PRIMARY KEY,
        log_id TEXT NOT NULL,
        waitlist_entry_id TEXT,
        user_id TEXT,
        user_name TEXT,
        action TEXT NOT NULL,
        reason TEXT,
        seat_count INTEGER,
        consecutive INTEGER,
        rank INTEGER,
        FOREIGN KEY (log_id) REFERENCES allocation_logs(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS confirmed_bookings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        show_id TEXT NOT NULL,
        tier_id TEXT NOT NULL,
        seat_ids TEXT NOT NULL,
        consecutive_count INTEGER NOT NULL,
        confirmed_at TEXT NOT NULL DEFAULT (datetime('now')),
        lock_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
        FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE CASCADE
      )`,
    ];

    for (const sql of createTables) {
      db.run(sql);
    }

    saveDatabase();
    return db;
  })();

  return initPromise;
}

let saveTimer = null;
function saveDatabase() {
  if (!db) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (e) {
      console.error('保存数据库失败:', e.message);
    }
  }, 100);
}

function prepare(sql) {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(sql);

  return {
    run: function(...params) {
      try {
        stmt.bind(params);
        stmt.step();
      } finally {
        stmt.reset();
      }
      saveDatabase();
      return { changes: 1 };
    },
    get: function(...params) {
      stmt.bind(params);
      let row = undefined;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.reset();
      return row;
    },
    all: function(...params) {
      stmt.bind(params);
      const result = [];
      while (stmt.step()) {
        result.push(stmt.getAsObject());
      }
      stmt.reset();
      return result;
    },
    free: function() {
      stmt.free();
    }
  };
}

function exec(sql) {
  if (!db) throw new Error('Database not initialized');
  const statements = sql.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      db.run(stmt);
    }
  }
  saveDatabase();
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  save: saveDatabase,
  getDb: () => db,
  isInitialized: () => !!db,
};
