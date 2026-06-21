const { initDatabase, prepare, exec } = require('./database');
const { v4: uuidv4 } = require('uuid');
const { runAllocation } = require('./allocationService');

async function seedData() {
  await initDatabase();
  console.log('开始初始化演示数据...');

  const shows = [
    {
      id: 'show_001',
      name: '周杰伦「嘉年华」世界巡回演唱会-北京站',
      date: '2026-07-15 19:30',
      venue: '国家体育场（鸟巢）'
    },
    {
      id: 'show_002',
      name: '五月天「回到那一天」演唱会-上海站',
      date: '2026-07-20 19:00',
      venue: '上海体育场'
    },
    {
      id: 'show_003',
      name: '林俊杰「JJ20」世界巡回演唱会-广州站',
      date: '2026-08-05 20:00',
      venue: '广州天河体育中心'
    }
  ];

  const tiersConfig = [
    { showId: 'show_001', tiers: [
      { id: 'tier_001_1', name: '内场VIP', price: 2000, section: '内场A区', rows: 5, seatsPerRow: 20 },
      { id: 'tier_001_2', name: '内场A', price: 1580, section: '内场B区', rows: 8, seatsPerRow: 30 },
      { id: 'tier_001_3', name: '看台一等', price: 980, section: '看台1层', rows: 10, seatsPerRow: 40 },
      { id: 'tier_001_4', name: '看台二等', price: 580, section: '看台2层', rows: 12, seatsPerRow: 50 },
      { id: 'tier_001_5', name: '看台三等', price: 380, section: '看台3层', rows: 15, seatsPerRow: 60 },
    ]},
    { showId: 'show_002', tiers: [
      { id: 'tier_002_1', name: '内场VIP', price: 1880, section: '内场A区', rows: 5, seatsPerRow: 18 },
      { id: 'tier_002_2', name: '内场A', price: 1280, section: '内场B区', rows: 7, seatsPerRow: 25 },
      { id: 'tier_002_3', name: '看台一等', price: 780, section: '看台1层', rows: 10, seatsPerRow: 35 },
      { id: 'tier_002_4', name: '看台二等', price: 480, section: '看台2层', rows: 12, seatsPerRow: 45 },
    ]},
    { showId: 'show_003', tiers: [
      { id: 'tier_003_1', name: '内场VIP', price: 1680, section: '内场A区', rows: 4, seatsPerRow: 15 },
      { id: 'tier_003_2', name: '内场A', price: 1080, section: '内场B区', rows: 6, seatsPerRow: 20 },
      { id: 'tier_003_3', name: '看台一等', price: 680, section: '看台1层', rows: 8, seatsPerRow: 30 },
      { id: 'tier_003_4', name: '看台二等', price: 380, section: '看台2层', rows: 10, seatsPerRow: 40 },
    ]}
  ];

  const users = [
    { id: 'user_001', name: '张三', phone: '13800138001' },
    { id: 'user_002', name: '李四', phone: '13800138002' },
    { id: 'user_003', name: '王五', phone: '13800138003' },
    { id: 'user_004', name: '赵六', phone: '13800138004' },
    { id: 'user_005', name: '孙七', phone: '13800138005' },
    { id: 'user_006', name: '周八', phone: '13800138006' },
    { id: 'user_007', name: '吴九', phone: '13800138007' },
    { id: 'user_008', name: '郑十', phone: '13800138008' },
    { id: 'user_009', name: '陈一', phone: '13800138009' },
    { id: 'user_010', name: '刘二', phone: '13800138010' },
    { id: 'user_011', name: '林小明', phone: '13800138011' },
    { id: 'user_012', name: '黄小红', phone: '13800138012' },
    { id: 'user_013', name: '杨小华', phone: '13800138013' },
    { id: 'user_014', name: '朱小丽', phone: '13800138014' },
    { id: 'user_015', name: '马小强', phone: '13800138015' },
    { id: 'user_016', name: '胡小芳', phone: '13800138016' },
    { id: 'user_017', name: '郭小伟', phone: '13800138017' },
    { id: 'user_018', name: '何小燕', phone: '13800138018' },
    { id: 'user_019', name: '罗小军', phone: '13800138019' },
    { id: 'user_020', name: '梁小梅', phone: '13800138020' },
  ];

  exec('DELETE FROM allocation_log_items');
  exec('DELETE FROM allocation_logs');
  exec('DELETE FROM confirmed_bookings');
  exec('DELETE FROM locks');
  exec('DELETE FROM waitlist_entries');
  exec('DELETE FROM seats');
  exec('DELETE FROM ticket_tiers');
  exec('DELETE FROM shows');
  exec('DELETE FROM users');

  const insertShow = prepare(`
    INSERT INTO shows (id, name, date, venue) VALUES (?, ?, ?, ?)
  `);

  for (const show of shows) {
    insertShow.run(show.id, show.name, show.date, show.venue);
  }

  const insertTier = prepare(`
    INSERT INTO ticket_tiers (id, show_id, name, price, seat_section, total_seats)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertSeat = prepare(`
    INSERT INTO seats (id, tier_id, show_id, row_label, seat_number, status)
    VALUES (?, ?, ?, ?, ?, 'sold')
  `);

  for (const showTiers of tiersConfig) {
    for (const tier of showTiers.tiers) {
      const totalSeats = tier.rows * tier.seatsPerRow;
      insertTier.run(tier.id, showTiers.showId, tier.name, tier.price, tier.section, totalSeats);

      for (let r = 1; r <= tier.rows; r++) {
        for (let s = 1; s <= tier.seatsPerRow; s++) {
          const seatId = `seat_${tier.id}_${r}_${s}`;
          const rowLabel = String.fromCharCode(64 + r);
          insertSeat.run(seatId, tier.id, showTiers.showId, rowLabel, s);
        }
      }
    }
  }

  const insertUser = prepare(`
    INSERT INTO users (id, name, phone) VALUES (?, ?, ?)
  `);

  for (const user of users) {
    insertUser.run(user.id, user.name, user.phone);
  }

  const waitlistEntries = [
    { userId: 'user_001', showId: 'show_001', tierId: 'tier_001_1', maxConsecutive: 2, submittedOffset: 0 },
    { userId: 'user_002', showId: 'show_001', tierId: 'tier_001_2', maxConsecutive: 1, submittedOffset: 1 },
    { userId: 'user_003', showId: 'show_001', tierId: 'tier_001_2', maxConsecutive: 3, submittedOffset: 2 },
    { userId: 'user_004', showId: 'show_001', tierId: 'tier_001_3', maxConsecutive: 2, submittedOffset: 3 },
    { userId: 'user_005', showId: 'show_001', tierId: 'tier_001_2', maxConsecutive: 4, submittedOffset: 4 },
    { userId: 'user_006', showId: 'show_001', tierId: 'tier_001_4', maxConsecutive: 2, submittedOffset: 5 },
    { userId: 'user_007', showId: 'show_001', tierId: 'tier_001_3', maxConsecutive: 1, submittedOffset: 6 },
    { userId: 'user_008', showId: 'show_001', tierId: 'tier_001_2', maxConsecutive: 2, submittedOffset: 7 },
    { userId: 'user_009', showId: 'show_001', tierId: 'tier_001_1', maxConsecutive: 1, submittedOffset: 8 },
    { userId: 'user_010', showId: 'show_001', tierId: 'tier_001_5', maxConsecutive: 3, submittedOffset: 9 },
    { userId: 'user_011', showId: 'show_002', tierId: 'tier_002_1', maxConsecutive: 2, submittedOffset: 0 },
    { userId: 'user_012', showId: 'show_002', tierId: 'tier_002_2', maxConsecutive: 3, submittedOffset: 1 },
    { userId: 'user_013', showId: 'show_002', tierId: 'tier_002_3', maxConsecutive: 1, submittedOffset: 2 },
    { userId: 'user_014', showId: 'show_002', tierId: 'tier_002_2', maxConsecutive: 2, submittedOffset: 3 },
    { userId: 'user_001', showId: 'show_002', tierId: 'tier_002_1', maxConsecutive: 1, submittedOffset: 4 },
    { userId: 'user_015', showId: 'show_003', tierId: 'tier_003_2', maxConsecutive: 2, submittedOffset: 0 },
    { userId: 'user_016', showId: 'show_003', tierId: 'tier_003_3', maxConsecutive: 4, submittedOffset: 1 },
    { userId: 'user_017', showId: 'show_003', tierId: 'tier_003_1', maxConsecutive: 2, submittedOffset: 2 },
    { userId: 'user_002', showId: 'show_003', tierId: 'tier_003_2', maxConsecutive: 1, submittedOffset: 3 },
  ];

  const insertWaitlist = prepare(`
    INSERT INTO waitlist_entries (id, user_id, show_id, tier_id, max_consecutive_seats, submitted_at, status)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?), 'waiting')
  `);

  for (let i = 0; i < waitlistEntries.length; i++) {
    const entry = waitlistEntries[i];
    const entryId = `waitlist_${i + 1}`;
    const offset = `-${entry.submittedOffset * 5} minutes`;
    insertWaitlist.run(entryId, entry.userId, entry.showId, entry.tierId, entry.maxConsecutive, offset);
  }

  const makeAvailable = (seatIds) => {
    const placeholders = seatIds.map(() => '?').join(',');
    prepare(`UPDATE seats SET status = 'available' WHERE id IN (${placeholders})`).run(...seatIds);
  };

  makeAvailable([
    'seat_tier_001_2_2_5',
    'seat_tier_001_2_2_6',
  ]);

  makeAvailable([
    'seat_tier_001_3_3_10',
  ]);

  makeAvailable([
    'seat_tier_001_4_5_15',
    'seat_tier_001_4_5_16',
    'seat_tier_001_4_5_17',
  ]);

  makeAvailable([
    'seat_tier_002_1_1_8',
    'seat_tier_002_1_1_9',
  ]);

  makeAvailable([
    'seat_tier_002_2_3_5',
    'seat_tier_002_2_3_6',
    'seat_tier_002_2_3_7',
  ]);

  makeAvailable([
    'seat_tier_003_2_2_3',
    'seat_tier_003_2_2_4',
  ]);

  console.log('演示数据初始化完成！');
  console.log(`  - 演出: ${shows.length} 场`);
  console.log(`  - 用户: ${users.length} 人`);
  console.log(`  - 候补请求: ${waitlistEntries.length} 条`);

  console.log('\n执行初始递补分配...');
  for (const show of shows) {
    const showTiers = tiersConfig.find(t => t.showId === show.id);
    for (const tier of showTiers.tiers) {
      runAllocation(show.id, tier.id, 'initial', '系统初始化');
    }
  }
  console.log('初始递补分配完成！');
}

seedData().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
