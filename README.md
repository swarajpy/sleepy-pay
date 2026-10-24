# 🌙 Sleepy Pay

Offline UPI payments over NPCI's `*99#` USSD service. Scan a UPI QR code (no internet needed), and Sleepy Pay gives you the exact UPI ID and amount to use in the `*99#` session.

This is an original codebase. It is not a fork of any other project.

| Folder | What it is |
|---|---|
| `android/` | Native Android app (Kotlin, CameraX + on-device ML Kit QR scanning) |
| `web/` | Installable web version (PWA), useful for iPhone and quick demos |

## Get the Android APK (no Android Studio needed)

1. Push this repo to GitHub.
2. Open the **Actions** tab, then **Build Android APK**, then **Run workflow** (it also runs on every push to `main`).
3. When it finishes, download `sleepy-pay-debug-apk` from the run's Artifacts, unzip it, and install `app-debug.apk` on your phone (allow "install unknown apps" once).

Or open the `android/` folder in Android Studio and press Run.

## How it works

1. Scan a merchant UPI QR (or paste a UPI ID / `upi://pay?...` link).
2. The payee and amount are parsed on-device.
3. Tap **Open \*99#**, pick *Send Money → UPI ID*, paste the copied ID and amount, enter your UPI PIN.

Nothing is sent to any server.

## Status and known limits (be realistic)

- **The Android project has not been compiled or run yet.** It was written without access to an Android SDK. Expect to fix a few build errors on the first CI run. The UPI parser has tests: `node --test` in `web/` passes, and the Kotlin port has matching JUnit tests that CI runs.
- **You still do the `*99#` steps by hand.** The app opens the dialer, but does not type into the USSD menu. Full automation needs an Accessibility Service, which brings fragile menu-parsing code and Play Store policy problems.
- **`*99#` limits:** it only works on SIMs/operators that support USSD banking (Jio currently does not), the user's bank must support `*99#`, and per-transaction limits are low.
- **Regulation:** the app only helps the user dial the official NPCI service and never touches money. If you ever hold, route or process funds, you need RBI-regulated partners.
- **Debug build only.** A Play Store release needs a signing key and a release build.

## License

MIT, see `LICENSE`.
