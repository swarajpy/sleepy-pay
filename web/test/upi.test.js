const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidVpa, normalizeAmount, parseUpiLink, parseAny } = require('../upi.js');

test('valid and invalid UPI IDs', () => {
  assert.equal(isValidVpa('shop.1@okbank'), true);
  assert.equal(isValidVpa('a-b_c@ybl'), true);
  assert.equal(isValidVpa('nohandle'), false);
  assert.equal(isValidVpa('x@'), false);
  assert.equal(isValidVpa('@bank'), false);
  assert.equal(isValidVpa(''), false);
  assert.equal(isValidVpa(null), false);
});

test('amount normalization', () => {
  assert.equal(normalizeAmount('10'), '10.00');
  assert.equal(normalizeAmount('10.5'), '10.50');
  assert.equal(normalizeAmount(' 99.99 '), '99.99');
  assert.equal(normalizeAmount('0'), null);
  assert.equal(normalizeAmount('-5'), null);
  assert.equal(normalizeAmount('1.234'), null);
  assert.equal(normalizeAmount('abc'), null);
});

test('parses a typical merchant QR link', () => {
  const r = parseUpiLink('upi://pay?pa=chai.wala@okaxis&pn=Chai%20Wala&am=20&cu=INR&tn=Tea');
  assert.deepEqual(r, { ok: true, vpa: 'chai.wala@okaxis', name: 'Chai Wala', amount: '20.00', note: 'Tea' });
});

test('QR without amount leaves amount null', () => {
  const r = parseUpiLink('upi://pay?pa=shop@ybl&pn=Shop');
  assert.equal(r.ok, true);
  assert.equal(r.amount, null);
});

test('rejects bad links', () => {
  assert.equal(parseUpiLink('https://example.com').ok, false);
  assert.equal(parseUpiLink('upi://pay?pn=NoId').ok, false);
  assert.equal(parseUpiLink('upi://pay?pa=bad&am=5').ok, false);
  assert.equal(parseUpiLink('upi://pay?pa=shop@ybl&am=-3').ok, false);
  assert.equal(parseUpiLink(undefined).ok, false);
});

test('parseAny accepts links and bare UPI IDs', () => {
  assert.equal(parseAny('upi://pay?pa=shop@ybl').ok, true);
  const r = parseAny('  friend@okhdfcbank ');
  assert.equal(r.ok, true);
  assert.equal(r.vpa, 'friend@okhdfcbank');
  assert.equal(parseAny('hello world').ok, false);
});
