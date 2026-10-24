# 🌙 Sleepy Pay

Offline UPI payments over NPCI's `*99#` USSD service. Scan a UPI QR code (no internet needed), and Sleepy Pay hands you the exact UPI ID and amount to use in the `*99#` session.

This is an original codebase. It is not a fork of any other project.

## How it works

1. Scan a merchant UPI QR (or paste a UPI ID / `upi://pay?...` link).
2. Sleepy Pay parses the payee and amount on-device.
3. Tap **Open \*99#**, pick *Send Money → UPI ID*, paste the copied ID and amount, enter your UPI PIN.

Nothing is sent to any server. It is a static PWA, so it works offline once loaded once.

## Run it

```bash
python3 -m http.server 8080   # any static server works
# open http://localhost:8080 (camera and service workers need localhost or HTTPS)
```

Deploy the folder as-is to GitHub Pages, Vercel or Netlify (HTTPS required for camera + offline).

## Test

```bash
node --test
```

## Known limits (be realistic)

- **QR scanning uses the browser's `BarcodeDetector`**, which works in Chrome on Android but not in iOS Safari or Firefox. On those, users paste the UPI ID. To support them, bundle a JS QR decoder such as `jsQR` into `vendor/` and use it as a fallback in `app.js`.
- **You still do the `*99#` steps by hand.** A PWA cannot drive the dialer. Full automation needs an Android app with an Accessibility Service, which brings Play Store policy and sideloading problems.
- **`*99#` limits:** it only works with SIMs/operators that support USSD banking (Jio currently does not), the user's bank must be enabled for `*99#`, and per-transaction limits are low.
- **Regulation:** this app only helps the user dial the official NPCI service and never touches money. If you ever hold, route or process funds, you need RBI-regulated partners.

## Roadmap ideas

- jsQR fallback for iOS and Firefox
- Hindi / Marathi UI
- Saved payees (local storage)
- Android wrapper (Trusted Web Activity) for a Play Store listing

## License

MIT, see `LICENSE`.
