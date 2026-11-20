/* Sleepy Pay: card bill tracker logic. Pure functions, no DOM, works in browser and Node.
 *
 * Privacy rule: this module only ever deals with a nickname and the LAST 4 digits.
 * It rejects anything longer, so a full card number can never be stored by accident.
 * It never reads, stores or processes real card data, and nothing leaves the device.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SleepyCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var STORAGE_KEY = 'sleepy-pay.cards.v1';
  var SOON_DAYS = 3;       // "due soon" threshold
  var OVERDUE_LOOKBACK = 7; // days after a missed due date we still flag it as overdue

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); } // m is 0-based
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function utcDay(y, m, d) { return Date.UTC(y, m, d) / 86400000; }

  // Date -> {y, m, d} using the device's local calendar day.
  function ymd(date) { return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() }; }

  // Due on day 31 in a 30-day month means the 30th, and so on.
  function clampDay(y, m, day) { return Math.min(day, daysInMonth(y, m)); }

  // Next occurrence of day-of-month on or after "now" (today counts).
  function nextOccurrence(day, now) {
    var t = ymd(now);
    var d = clampDay(t.y, t.m, day);
    if (d >= t.d) return { y: t.y, m: t.m, d: d };
    var m = t.m + 1, y = t.y;
    if (m > 11) { m = 0; y += 1; }
    return { y: y, m: m, d: clampDay(y, m, day) };
  }

  // Most recent occurrence of day-of-month strictly before today.
  function prevOccurrence(day, now) {
    var t = ymd(now);
    var d = clampDay(t.y, t.m, day);
    if (d < t.d) return { y: t.y, m: t.m, d: d };
    var m = t.m - 1, y = t.y;
    if (m < 0) { m = 11; y -= 1; }
    return { y: y, m: m, d: clampDay(y, m, day) };
  }

  function diffDays(a, b) { return utcDay(a.y, a.m, a.d) - utcDay(b.y, b.m, b.d); }

  function isDay(n) { return Number.isInteger(n) && n >= 1 && n <= 31; }

  // Money: whole rupees or up to 2 decimals. Returns a Number or null.
  function parseMoney(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/[,₹\s]/g, '');
    if (s === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Number(s);
  }

  // Validates raw form input and returns { ok, error } or { ok, card }.
  function validateCard(input) {
    var nickname = String(input.nickname || '').trim();
    if (!nickname) return { ok: false, error: 'Give the card a nickname, like "HDFC Millennia".' };
    if (nickname.length > 40) return { ok: false, error: 'Nickname is too long (40 characters max).' };

    var last4 = String(input.last4 || '').replace(/\s/g, '');
    if (last4.length > 4) {
      return { ok: false, error: 'Enter only the LAST 4 digits. Sleepy Pay never stores a full card number.' };
    }
    if (!/^\d{4}$/.test(last4)) return { ok: false, error: 'Last 4 digits must be exactly 4 numbers.' };

    var dueDay = Number(input.dueDay);
    if (!isDay(dueDay)) return { ok: false, error: 'Due day must be a day of the month (1 to 31).' };

    var stmt = input.statementDay === '' || input.statementDay == null ? null : Number(input.statementDay);
    if (stmt !== null && !isDay(stmt)) return { ok: false, error: 'Statement day must be 1 to 31, or left blank.' };

    var limit = parseMoney(input.limit);
    if (Number.isNaN(limit) || (limit !== null && limit <= 0)) {
      return { ok: false, error: 'Credit limit must be a positive amount, or left blank.' };
    }

    return {
      ok: true,
      card: {
        id: input.id || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        nickname: nickname,
        last4: last4,
        dueDay: dueDay,
        statementDay: stmt,
        limit: limit,
        outstanding: null,
        paidFor: null,      // ISO due date that was marked paid, e.g. "2026-12-05"
        addedOn: input.addedOn || null,
      },
    };
  }

  // Works out where a card stands today.
  // level: 'overdue' | 'today' | 'soon' | 'ok' | 'paid'
  function status(card, now) {
    now = now || new Date();
    var next = nextOccurrence(card.dueDay, now);
    var nextIso = iso(next.y, next.m, next.d);
    var daysLeft = diffDays(next, ymd(now));

    // Missed a recent due date that was never marked paid? (Only if the card existed back then.)
    var prev = prevOccurrence(card.dueDay, now);
    var prevIso = iso(prev.y, prev.m, prev.d);
    var sincePrev = diffDays(ymd(now), prev);
    var existedThen = !card.addedOn || card.addedOn <= prevIso;
    if (existedThen && sincePrev <= OVERDUE_LOOKBACK && card.paidFor !== prevIso) {
      return { level: 'overdue', due: prevIso, daysLeft: -sincePrev };
    }

    if (card.paidFor === nextIso) return { level: 'paid', due: nextIso, daysLeft: daysLeft };
    if (daysLeft === 0) return { level: 'today', due: nextIso, daysLeft: 0 };
    if (daysLeft <= SOON_DAYS) return { level: 'soon', due: nextIso, daysLeft: daysLeft };
    return { level: 'ok', due: nextIso, daysLeft: daysLeft };
  }

  // Marks the bill currently in play as paid: the overdue one if there is one, else the next one.
  function markPaid(card, now) {
    var s = status(card, now);
    return Object.assign({}, card, { paidFor: s.due });
  }

  // Utilization as a whole percent, or null if limit/outstanding are not both known.
  function utilization(card) {
    if (!card.limit || card.outstanding === null || card.outstanding === undefined) return null;
    return Math.round((card.outstanding / card.limit) * 100);
  }

  // Most urgent first: overdue, then by days left. Paid cards sink to the bottom.
  function sortCards(cards, now) {
    var rank = { overdue: 0, today: 1, soon: 2, ok: 3, paid: 4 };
    return cards.slice().sort(function (a, b) {
      var sa = status(a, now), sb = status(b, now);
      if (rank[sa.level] !== rank[sb.level]) return rank[sa.level] - rank[sb.level];
      return sa.daysLeft - sb.daysLeft;
    });
  }

  // Plain-language line for the UI.
  function describe(s) {
    if (s.level === 'overdue') {
      var n = -s.daysLeft;
      return 'Overdue by ' + n + (n === 1 ? ' day' : ' days');
    }
    if (s.level === 'paid') return 'Paid. Next due ' + s.due;
    if (s.level === 'today') return 'Due today';
    if (s.daysLeft === 1) return 'Due tomorrow';
    return 'Due in ' + s.daysLeft + ' days';
  }

  // ---- storage (localStorage, injected so tests can fake it) ----
  function load(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function save(storage, cards) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(cards)); return true; } catch (e) { return false; }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    validateCard: validateCard,
    status: status,
    markPaid: markPaid,
    utilization: utilization,
    sortCards: sortCards,
    describe: describe,
    parseMoney: parseMoney,
    load: load,
    save: save,
  };
});
