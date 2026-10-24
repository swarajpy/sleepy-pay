/* Sleepy Pay: UPI payment-link parsing. Pure functions, no DOM, works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SleepyUpi = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // UPI ID (VPA) looks like name@handle, e.g. shop.1@okbank
  function isValidVpa(v) {
    return typeof v === 'string' && /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(v);
  }

  // Returns a string with exactly 2 decimals, or null if invalid / not positive.
  function normalizeAmount(a) {
    const s = String(a).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const n = Number(s);
    if (!(n > 0)) return null;
    return n.toFixed(2);
  }

  // Parses a upi://pay?... link (what merchant QR codes contain).
  function parseUpiLink(text) {
    if (typeof text !== 'string') return { ok: false, error: 'No data' };
    const raw = text.trim();
    if (!/^upi:\/\/pay\?/i.test(raw)) return { ok: false, error: 'Not a UPI payment link' };
    const params = new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
    const vpa = (params.get('pa') || '').trim();
    if (!isValidVpa(vpa)) return { ok: false, error: 'Missing or invalid UPI ID' };

    let amount = null;
    const am = params.get('am');
    if (am !== null && am.trim() !== '') {
      amount = normalizeAmount(am);
      if (amount === null) return { ok: false, error: 'Invalid amount in QR code' };
    }
    return {
      ok: true,
      vpa: vpa,
      name: (params.get('pn') || '').trim(),
      amount: amount,
      note: (params.get('tn') || '').trim(),
    };
  }

  // Accepts either a upi:// link or a bare UPI ID typed/pasted by the user.
  function parseAny(text) {
    if (typeof text !== 'string') return { ok: false, error: 'No data' };
    const t = text.trim();
    if (/^upi:\/\//i.test(t)) return parseUpiLink(t);
    if (isValidVpa(t)) return { ok: true, vpa: t, name: '', amount: null, note: '' };
    return { ok: false, error: 'Enter a UPI ID like name@bank, or scan a UPI QR code' };
  }

  return { isValidVpa, normalizeAmount, parseUpiLink, parseAny };
});
