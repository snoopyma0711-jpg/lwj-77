const { prepare, exec } = require('./database');
const { v4: uuidv4 } = require('uuid');

const LOCK_DURATION_SECONDS = 300;

function parseDate(dateStr) {
  if (!dateStr) return null;
  let normalized = dateStr.replace('T', ' ').replace('Z', '');
  if (normalized.includes('.')) {
    normalized = normalized.split('.')[0];
  }
  const d = new Date(normalized + 'Z');
  if (isNaN(d.getTime())) {
    return new Date(dateStr);
  }
  return d;
}

function formatSQLiteDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function isExpired(expiresAtStr) {
  const expiresAt = parseDate(expiresAtStr);
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}

function getConsecutiveSeats(tierId, count) {
  const seats = prepare(`
    SELECT * FROM seats
    WHERE tier_id = ? AND status = 'available'
    ORDER BY row_label, seat_number
  `).all(tierId);

  const groups = {};
  for (const seat of seats) {
    if (!groups[seat.row_label]) {
      groups[seat.row_label] = [];
    }
    groups[seat.row_label].push(seat);
  }

  let bestGroup = null;
  let bestStartIdx = -1;

  for (const rowLabel of Object.keys(groups)) {
    const rowSeats = groups[rowLabel];
    for (let i = 0; i <= rowSeats.length - count; i++) {
      let consecutive = true;
      for (let j = 1; j < count; j++) {
        if (rowSeats[i + j].seat_number !== rowSeats[i].seat_number + j) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) {
        if (!bestGroup || rowSeats[i].seat_number < bestGroup[bestStartIdx].seat_number) {
          bestGroup = rowSeats;
          bestStartIdx = i;
        }
      }
    }
  }

  if (bestGroup) {
    return bestGroup.slice(bestStartIdx, bestStartIdx + count);
  }
  return null;
}

function hasActiveLock(userId) {
  const locks = prepare(`
    SELECT * FROM locks
    WHERE user_id = ? AND status = 'locked'
  `).all(userId);

  for (const lock of locks) {
    if (!isExpired(lock.expires_at)) {
      return true;
    }
  }
  return false;
}

function getUserActiveLock(userId) {
  const locks = prepare(`
    SELECT * FROM locks
    WHERE user_id = ? AND status = 'locked'
  `).all(userId);

  for (const lock of locks) {
    if (!isExpired(lock.expires_at)) {
      return lock;
    }
  }
  return null;
}

function expireOldLocks() {
  const lockedLocks = prepare(`
    SELECT * FROM locks
    WHERE status = 'locked'
  `).all();

  let expiredCount = 0;
  for (const lock of lockedLocks) {
    if (isExpired(lock.expires_at)) {
      releaseLock(lock.id, 'timeout');
      expiredCount++;
    }
  }

  return expiredCount;
}

function releaseLock(lockId, reason = 'released') {
  const lock = prepare('SELECT * FROM locks WHERE id = ?').get(lockId);
  if (!lock || lock.status !== 'locked') return null;

  const seatIds = JSON.parse(lock.seat_ids);

  const placeholders = seatIds.map(() => '?').join(',');
  prepare(`
    UPDATE seats SET status = 'available'
    WHERE id IN (${placeholders})
  `).run(...seatIds);

  prepare(`
    UPDATE locks SET status = ? WHERE id = ?
  `).run(reason === 'timeout' ? 'expired' : 'released', lockId);

  prepare(`
    UPDATE waitlist_entries SET status = 'waiting'
    WHERE id = ?
  `).run(lock.waitlist_entry_id);

  return lock;
}

function runAllocation(showId, tierId, triggerType, triggerDetail) {
  expireOldLocks();

  const logId = uuidv4();
  prepare(`
    INSERT INTO allocation_logs (id, show_id, tier_id, trigger_type, trigger_detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(logId, showId, tierId, triggerType, triggerDetail);

  const waitlist = prepare(`
    SELECT we.*, u.name as user_name
    FROM waitlist_entries we
    JOIN users u ON we.user_id = u.id
    WHERE we.show_id = ? AND we.tier_id = ? AND we.status = 'waiting'
    ORDER BY we.submitted_at ASC
  `).all(showId, tierId);

  const availableSeats = prepare(`
    SELECT COUNT(*) as count FROM seats
    WHERE tier_id = ? AND status = 'available'
  `).get(tierId).count;

  let remainingSeats = availableSeats;
  let rank = 0;
  let allocatedCount = 0;

  for (const entry of waitlist) {
    rank++;

    if (remainingSeats <= 0) {
      break;
    }

    const userHasLock = hasActiveLock(entry.user_id);

    let action = '';
    let reason = '';
    let allocatedSeats = null;
    let consecutiveCount = 0;

    if (userHasLock) {
      const existingLock = getUserActiveLock(entry.user_id);
      action = 'skipped';
      reason = `用户已在另一演出锁定名额，等待其确认或超时`;
    } else {
      const needConsecutive = entry.max_consecutive_seats;

      if (needConsecutive > 1) {
        const consecutiveSeats = getConsecutiveSeats(tierId, needConsecutive);
        if (consecutiveSeats) {
          allocatedSeats = consecutiveSeats;
          consecutiveCount = needConsecutive;
          action = 'allocated';
          reason = `找到${needConsecutive}个连座，满足需求`;
        } else if (remainingSeats >= needConsecutive) {
          action = 'skipped';
          reason = `有${remainingSeats}张票但找不到${needConsecutive}个连座，不降级为散座`;
        } else {
          action = 'skipped';
          reason = `剩余${remainingSeats}张票，不足${needConsecutive}张连座需求`;
        }
      } else {
        const seat = prepare(`
          SELECT * FROM seats
          WHERE tier_id = ? AND status = 'available'
          ORDER BY row_label, seat_number
          LIMIT 1
        `).get(tierId);

        if (seat) {
          allocatedSeats = [seat];
          consecutiveCount = 1;
          action = 'allocated';
          reason = '单座需求，分配成功';
        } else {
          action = 'skipped';
          reason = '无可用座位';
        }
      }
    }

    prepare(`
      INSERT INTO allocation_log_items
      (id, log_id, waitlist_entry_id, user_id, user_name, action, reason, seat_count, consecutive, rank)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), logId, entry.id, entry.user_id, entry.user_name,
      action, reason,
      allocatedSeats ? allocatedSeats.length : 0,
      consecutiveCount,
      rank
    );

    if (action === 'allocated' && allocatedSeats) {
      const lockId = uuidv4();
      const seatIds = allocatedSeats.map(s => s.id);

      const placeholders = seatIds.map(() => '?').join(',');
      prepare(`
        UPDATE seats SET status = 'locked'
        WHERE id IN (${placeholders})
      `).run(...seatIds);

      const expiresAt = formatSQLiteDate(new Date(Date.now() + LOCK_DURATION_SECONDS * 1000));

      prepare(`
        INSERT INTO locks (id, user_id, show_id, waitlist_entry_id, seat_ids, tier_id, consecutive_count, locked_at, expires_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'locked')
      `).run(
        lockId, entry.user_id, showId, entry.id,
        JSON.stringify(seatIds), tierId, consecutiveCount, expiresAt
      );

      prepare(`
        UPDATE waitlist_entries SET status = 'pending_confirmation'
        WHERE id = ?
      `).run(entry.id);

      remainingSeats -= allocatedSeats.length;
      allocatedCount++;
    }
  }

  return { logId, allocatedCount };
}

function confirmLock(lockId) {
  expireOldLocks();

  const lock = prepare('SELECT * FROM locks WHERE id = ?').get(lockId);
  if (!lock || lock.status !== 'locked') {
    return { success: false, error: '锁定不存在或已失效' };
  }

  if (isExpired(lock.expires_at)) {
    releaseLock(lockId, 'timeout');
    return { success: false, error: '锁定已超时' };
  }

  const seatIds = JSON.parse(lock.seat_ids);
  const placeholders = seatIds.map(() => '?').join(',');

  prepare(`
    UPDATE seats SET status = 'sold'
    WHERE id IN (${placeholders})
  `).run(...seatIds);

  prepare(`
    UPDATE locks SET status = 'confirmed' WHERE id = ?
  `).run(lockId);

  prepare(`
    UPDATE waitlist_entries SET status = 'confirmed' WHERE id = ?
  `).run(lock.waitlist_entry_id);

  const bookingId = uuidv4();
  prepare(`
    INSERT INTO confirmed_bookings (id, user_id, show_id, tier_id, seat_ids, consecutive_count, lock_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    bookingId, lock.user_id, lock.show_id, lock.tier_id,
    lock.seat_ids, lock.consecutive_count, lockId
  );

  return { success: true, bookingId };
}

function cancelWaitlistEntry(entryId) {
  const entry = prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(entryId);
  if (!entry) return { success: false, error: '候补记录不存在' };

  if (entry.status === 'pending_confirmation') {
    const lock = prepare(`
      SELECT * FROM locks WHERE waitlist_entry_id = ? AND status = 'locked'
    `).get(entryId);
    if (lock) {
      releaseLock(lock.id, 'user_cancelled');
    }
  }

  prepare(`
    UPDATE waitlist_entries SET status = 'cancelled' WHERE id = ?
  `).run(entryId);

  if (entry.status === 'waiting' || entry.status === 'pending_confirmation') {
    setTimeout(() => {
      runAllocation(entry.show_id, entry.tier_id, 'waitlist_cancel', '用户取消候补');
    }, 100);
  }

  return { success: true };
}

function refundTicket(seatId) {
  expireOldLocks();

  const seat = prepare('SELECT * FROM seats WHERE id = ?').get(seatId);
  if (!seat) return { success: false, error: '座位不存在' };

  if (seat.status !== 'sold') {
    return { success: false, error: '该座位未售出，无法退票' };
  }

  prepare(`
    UPDATE seats SET status = 'available', refunded_at = datetime('now')
    WHERE id = ?
  `).run(seatId);

  const result = runAllocation(seat.show_id, seat.tier_id, 'refund', `座位 ${seat.row_label}${seat.seat_number} 退票`);

  return { success: true, ...result };
}

function addWaitlistEntry(userId, showId, tierId, maxConsecutiveSeats = 1) {
  expireOldLocks();

  const existing = prepare(`
    SELECT * FROM waitlist_entries
    WHERE user_id = ? AND show_id = ? AND tier_id = ? AND status IN ('waiting', 'pending_confirmation')
  `).get(userId, showId, tierId);

  if (existing) {
    return { success: false, error: '已在该票档候补队列中' };
  }

  const entryId = uuidv4();
  prepare(`
    INSERT INTO waitlist_entries (id, user_id, show_id, tier_id, max_consecutive_seats, status)
    VALUES (?, ?, ?, ?, ?, 'waiting')
  `).run(entryId, userId, showId, tierId, maxConsecutiveSeats);

  const availableCount = prepare(`
    SELECT COUNT(*) as count FROM seats
    WHERE tier_id = ? AND status = 'available'
  `).get(tierId).count;

  if (availableCount > 0) {
    setTimeout(() => {
      runAllocation(showId, tierId, 'new_waitlist', '新用户加入候补');
    }, 100);
  }

  return { success: true, entryId };
}

module.exports = {
  getConsecutiveSeats,
  hasActiveLock,
  expireOldLocks,
  releaseLock,
  runAllocation,
  confirmLock,
  cancelWaitlistEntry,
  refundTicket,
  addWaitlistEntry,
  LOCK_DURATION_SECONDS,
  isExpired,
  parseDate,
  formatSQLiteDate,
};
