/* Sleepy Pay: card bill tracker UI. Depends on cards.js (SleepyCards).
 * All text from the user is rendered with textContent, never innerHTML. */
(function () {
  'use strict';
  var C = window.SleepyCards;
  var $ = function (id) { return document.getElementById(id); };

  var cards = C.load(window.localStorage);

  function persist() {
    if (!C.save(window.localStorage, cards)) {
      say('Could not save. Storage may be full or blocked in this browser.', 'bad');
    }
  }

  function say(text, kind) {
    var el = $('cardMsg');
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function todayIso() {
    var n = new Date();
    return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2);
  }

  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---- tabs ----
  function showTab(name) {
    var pay = name === 'pay';
    $('viewPay').classList.toggle('hide', !pay);
    $('viewCards').classList.toggle('hide', pay);
    $('tabPay').setAttribute('aria-selected', String(pay));
    $('tabCards').setAttribute('aria-selected', String(!pay));
  }
  $('tabPay').addEventListener('click', function () { showTab('pay'); });
  $('tabCards').addEventListener('click', function () { showTab('cards'); });

  // ---- banner shown on both tabs ----
  function renderBanner() {
    var b = $('dueBanner');
    var now = new Date();
    var urgent = C.sortCards(cards, now).filter(function (c) {
      var l = C.status(c, now).level;
      return l === 'overdue' || l === 'today' || l === 'soon';
    });
    if (!urgent.length) { b.classList.add('hide'); b.textContent = ''; return; }
    var hasOverdue = urgent.some(function (c) { return C.status(c, now).level === 'overdue'; });
    b.className = 'banner' + (hasOverdue ? ' bad' : '');
    b.textContent = urgent.slice(0, 3).map(function (c) {
      return c.nickname + ' •••• ' + c.last4 + ': ' + C.describe(C.status(c, now));
    }).join('  |  ') + (urgent.length > 3 ? '  |  +' + (urgent.length - 3) + ' more' : '');
  }

  // ---- list ----
  function renderBills() {
    var list = $('billList');
    list.textContent = '';
    $('emptyBills').classList.toggle('hide', cards.length > 0);
    var now = new Date();

    C.sortCards(cards, now).forEach(function (c) {
      var s = C.status(c, now);
      var box = el('div', 'bill');

      var head = el('div');
      head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
      var title = el('h3', '', c.nickname + '  •••• ' + c.last4);
      title.style.wordBreak = 'break-word';
      head.appendChild(title);
      head.appendChild(el('span', 'chip ' + s.level, C.describe(s)));
      box.appendChild(head);

      var meta = 'Due on day ' + c.dueDay + ' of each month' + (s.level === 'paid' ? '' : ' (next: ' + s.due + ')');
      if (c.statementDay) meta += '. Statement on day ' + c.statementDay + '.';
      box.appendChild(el('div', 'meta', meta));

      var u = C.utilization(c);
      if (u !== null) {
        var line = 'Outstanding ' + inr(c.outstanding) + ' of ' + inr(c.limit) + ' limit (' + u + '% used)';
        if (u >= 30) line += '. Many people try to keep this under about 30%.';
        box.appendChild(el('div', 'meta', line));
      } else if (c.outstanding) {
        box.appendChild(el('div', 'meta', 'Outstanding ' + inr(c.outstanding)));
      }

      var row = el('div', 'row');
      if (s.level !== 'paid') {
        var paid = el('button', '', 'Mark paid');
        paid.addEventListener('click', function () { update(c.id, C.markPaid(c, new Date())); });
        row.appendChild(paid);
      }
      var amt = el('button', 'secondary', 'Set outstanding');
      amt.addEventListener('click', function () {
        var v = window.prompt('Current outstanding amount in ₹ (you type this from your statement):',
          c.outstanding == null ? '' : String(c.outstanding));
        if (v === null) return;
        var n = C.parseMoney(v);
        if (n === null || Number.isNaN(n)) { say('Enter a valid amount, like 12500 or 12500.50.', 'bad'); return; }
        update(c.id, Object.assign({}, c, { outstanding: n }));
      });
      row.appendChild(amt);
      var del = el('button', 'secondary', 'Delete');
      del.addEventListener('click', function () {
        if (window.confirm('Delete ' + c.nickname + ' •••• ' + c.last4 + '?')) {
          cards = cards.filter(function (x) { return x.id !== c.id; });
          persist(); renderAll();
        }
      });
      row.appendChild(del);
      box.appendChild(row);
      list.appendChild(box);
    });
  }

  function update(id, next) {
    cards = cards.map(function (x) { return x.id === id ? next : x; });
    persist(); say(''); renderAll();
  }

  function renderAll() { renderBills(); renderBanner(); }

  // ---- add form ----
  $('addCard').addEventListener('click', function () {
    var r = C.validateCard({
      nickname: $('cNick').value,
      last4: $('cLast4').value,
      dueDay: $('cDue').value,
      statementDay: $('cStmt').value,
      limit: $('cLimit').value,
      addedOn: todayIso(),
    });
    if (!r.ok) { say(r.error, 'bad'); return; }
    var dup = cards.some(function (c) {
      return c.last4 === r.card.last4 && c.nickname.toLowerCase() === r.card.nickname.toLowerCase();
    });
    if (dup) { say('You already added this card.', 'bad'); return; }
    cards.push(r.card);
    persist();
    ['cNick', 'cLast4', 'cDue', 'cStmt', 'cLimit'].forEach(function (id) { $(id).value = ''; });
    say('Card added.', 'ok');
    renderAll();
  });

  // Re-check when the app comes back to the foreground (days may have passed).
  document.addEventListener('visibilitychange', function () { if (!document.hidden) renderAll(); });

  renderAll();
})();
