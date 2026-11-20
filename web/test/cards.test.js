const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../cards.js');

// Local-time date helper (the module works on the device's local calendar day).
const d = (y, m, day) => new Date(y, m - 1, day, 12, 0, 0);

function card(over) {
  const r = C.validateCard(Object.assign(
    { nickname: 'Test Card', last4: '1234', dueDay: 15, statementDay: '', limit: '' }, over));
  assert.equal(r.ok, true, r.error);
  return Object.assign(r.card, over && over.__patch);
}

test('accepts a normal card and trims input', () => {
  const r = C.validateCard({ nickname: '  HDFC Millennia ', last4: ' 4 2 1 1 ', dueDay: '5', statementDay: '20', limit: '1,50,000' });
  assert.equal(r.ok, true);
  assert.equal(r.card.nickname, 'HDFC Millennia');
  assert.equal(r.card.last4, '4211');
  assert.equal(r.card.dueDay, 5);
  assert.equal(r.card.statementDay, 20);
  assert.equal(r.card.limit, 150000);
});

test('refuses anything longer than 4 digits (never store a full card number)', () => {
  const r = C.validateCard({ nickname: 'X', last4: '4111111111111111', dueDay: 5 });
  assert.equal(r.ok, false);
  assert.match(r.error, /LAST 4/);
  assert.equal(C.validateCard({ nickname: 'X', last4: '12345', dueDay: 5 }).ok, false);
});

test('rejects bad fields', () => {
  assert.equal(C.validateCard({ nickname: '', last4: '1234', dueDay: 5 }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '12a4', dueDay: 5 }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '123', dueDay: 5 }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '1234', dueDay: 0 }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '1234', dueDay: 32 }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '1234', dueDay: 5.5 }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '1234', dueDay: 5, statementDay: 40 }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '1234', dueDay: 5, limit: 'abc' }).ok, false);
  assert.equal(C.validateCard({ nickname: 'X', last4: '1234', dueDay: 5, limit: '0' }).ok, false);
});

test('days left counts today as zero and rolls into next month', () => {
  const c = card({ dueDay: 15 });
  assert.deepEqual(C.status(c, d(2026, 11, 10)), { level: 'ok', due: '2026-11-15', daysLeft: 5 });
  assert.equal(C.status(c, d(2026, 11, 12)).level, 'soon');
  assert.equal(C.status(c, d(2026, 11, 15)).level, 'today');
  // Day after the due date: overdue by 1 (never marked paid).
  const after = C.status(c, d(2026, 11, 16));
  assert.equal(after.level, 'overdue');
  assert.equal(after.daysLeft, -1);
});

test('rolls over the year end', () => {
  const c = card({ dueDay: 5 });
  assert.deepEqual(C.status(c, d(2026, 12, 20)), { level: 'ok', due: '2027-01-05', daysLeft: 16 });
});

test('due day 31 clamps to short months', () => {
  const c = card({ dueDay: 31 });
  assert.equal(C.status(c, d(2027, 2, 10)).due, '2027-02-28');
  assert.equal(C.status(c, d(2028, 2, 10)).due, '2028-02-29'); // leap year
  assert.equal(C.status(c, d(2026, 11, 10)).due, '2026-11-30');
});

test('marking paid clears overdue and shows paid until the next cycle', () => {
  const c = card({ dueDay: 15 });
  const paid = C.markPaid(c, d(2026, 11, 16)); // overdue one gets paid
  assert.equal(paid.paidFor, '2026-11-15');
  assert.equal(C.status(paid, d(2026, 11, 16)).level, 'ok');
  assert.equal(C.status(paid, d(2026, 11, 16)).due, '2026-12-15');

  const early = C.markPaid(c, d(2026, 11, 10)); // paying ahead of time
  assert.equal(C.status(early, d(2026, 11, 10)).level, 'paid');
  assert.equal(C.status(early, d(2026, 11, 14)).level, 'paid');
  assert.equal(C.status(early, d(2026, 11, 20)).level, 'ok'); // cycle moved on
});

test('overdue only lasts a week and ignores dates before the card was added', () => {
  const c = card({ dueDay: 15 });
  assert.equal(C.status(c, d(2026, 11, 22)).level, 'overdue'); // 7 days
  assert.equal(C.status(c, d(2026, 11, 23)).level, 'ok');      // 8 days, stop nagging

  const fresh = Object.assign({}, c, { addedOn: '2026-11-17' }); // added after the due date
  assert.equal(C.status(fresh, d(2026, 11, 18)).level, 'ok');
});

test('utilization needs both limit and outstanding', () => {
  const c = card({ limit: '100000' });
  assert.equal(C.utilization(c), null);
  assert.equal(C.utilization(Object.assign({}, c, { outstanding: 25000 })), 25);
  assert.equal(C.utilization(Object.assign({}, c, { outstanding: 0 })), 0);
  assert.equal(C.utilization(Object.assign({}, c, { limit: null, outstanding: 500 })), null);
});

test('sorting puts the most urgent card first and paid last', () => {
  const now = d(2026, 11, 10);
  const far = card({ nickname: 'Far', dueDay: 28 });
  const soon = card({ nickname: 'Soon', dueDay: 12 });
  const late = Object.assign(card({ nickname: 'Late', dueDay: 8 }), { addedOn: '2026-01-01' });
  const paid = C.markPaid(card({ nickname: 'Paid', dueDay: 11 }), now);
  const order = C.sortCards([paid, far, soon, late], now).map((c) => c.nickname);
  assert.deepEqual(order, ['Late', 'Soon', 'Far', 'Paid']);
});

test('describe gives plain wording', () => {
  assert.equal(C.describe({ level: 'overdue', daysLeft: -1 }), 'Overdue by 1 day');
  assert.equal(C.describe({ level: 'overdue', daysLeft: -3 }), 'Overdue by 3 days');
  assert.equal(C.describe({ level: 'today', daysLeft: 0 }), 'Due today');
  assert.equal(C.describe({ level: 'soon', daysLeft: 1 }), 'Due tomorrow');
  assert.equal(C.describe({ level: 'ok', daysLeft: 9 }), 'Due in 9 days');
});

test('storage round-trips and survives corrupt data', () => {
  const mem = {};
  const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  assert.deepEqual(C.load(storage), []);
  const c = card({});
  assert.equal(C.save(storage, [c]), true);
  assert.equal(C.load(storage)[0].nickname, 'Test Card');
  mem[C.STORAGE_KEY] = '{not json';
  assert.deepEqual(C.load(storage), []);
  mem[C.STORAGE_KEY] = '{"a":1}';
  assert.deepEqual(C.load(storage), []);
});
