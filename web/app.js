/* Sleepy Pay UI logic. Depends on upi.js (SleepyUpi). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var inputCard = $('inputCard'), payCard = $('payCard');
  var manual = $('manual'), amount = $('amount');
  var inputMsg = $('inputMsg'), payMsg = $('payMsg');
  var video = $('video'), scanBtn = $('scanBtn');
  var stream = null, scanning = false;

  function say(el, text, kind) {
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function showPayment(p) {
    $('payeeName').textContent = p.name || 'Unknown payee';
    $('payeeVpa').textContent = p.vpa;
    amount.value = p.amount || '';
    amount.dataset.vpa = p.vpa;
    inputCard.classList.add('hide');
    payCard.classList.remove('hide');
    say(payMsg, p.note ? 'Note from QR: ' + p.note : '');
  }

  function handleInput(text) {
    var r = SleepyUpi.parseAny(text);
    if (!r.ok) { say(inputMsg, r.error, 'bad'); return false; }
    say(inputMsg, '');
    showPayment(r);
    return true;
  }

  function copy(text, okMsg) {
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t);
      say(payMsg, ok ? okMsg : 'Could not copy. Select and copy it manually.', ok ? 'ok' : 'bad');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { say(payMsg, okMsg, 'ok'); }, fallback);
    } else { fallback(); }
  }

  // ---- QR scanning (on-device, no network). Needs the BarcodeDetector API. ----
  function stopScan() {
    scanning = false;
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    video.classList.add('hide');
    video.srcObject = null;
  }

  async function startScan() {
    if (!('BarcodeDetector' in window)) {
      say(inputMsg, 'QR scanning is not supported in this browser. Use Chrome on Android, or paste the UPI ID.', 'bad');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (e) {
      say(inputMsg, 'Camera permission denied or unavailable.', 'bad');
      return;
    }
    var detector = new BarcodeDetector({ formats: ['qr_code'] });
    video.srcObject = stream;
    video.classList.remove('hide');
    await video.play();
    say(inputMsg, 'Point the camera at a UPI QR code…');
    scanning = true;

    (async function loop() {
      while (scanning) {
        try {
          var codes = await detector.detect(video);
          if (codes.length && codes[0].rawValue) {
            var value = codes[0].rawValue;
            if (handleInput(value)) { stopScan(); return; }
            // Not a UPI code: keep scanning, message already shown.
          }
        } catch (e) { /* frame not ready, try again */ }
        await new Promise(function (r) { setTimeout(r, 250); });
      }
    })();
  }

  scanBtn.addEventListener('click', function () {
    if (scanning) { stopScan(); say(inputMsg, ''); } else { startScan(); }
  });
  $('useManual').addEventListener('click', function () { handleInput(manual.value); });
  manual.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleInput(manual.value); });

  $('copyVpa').addEventListener('click', function () { copy(amount.dataset.vpa || '', 'UPI ID copied'); });
  $('copyAmt').addEventListener('click', function () {
    var a = SleepyUpi.normalizeAmount(amount.value);
    if (a === null) { say(payMsg, 'Enter a valid amount first (up to 2 decimals).', 'bad'); return; }
    amount.value = a;
    copy(a, 'Amount copied');
  });
  $('resetBtn').addEventListener('click', function () {
    payCard.classList.add('hide'); inputCard.classList.remove('hide');
    manual.value = ''; amount.value = ''; say(payMsg, ''); say(inputMsg, '');
  });

  // Offline support: cache the app shell.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
