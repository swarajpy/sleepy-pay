<p align="center"><img src="web/icon.svg" width="96" alt="Sleepy Pay logo"></p>

# Sleepy Pay

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

## Card bill tracker (web app)

The **Card bills** tab tracks credit card due dates, entirely on your device.

- You enter a nickname and the **last 4 digits only**. Anything longer is rejected, so a full card number can never be stored.
- Shows days left, due today, overdue (for a week after a missed date), and a banner on both tabs when a bill is due within 3 days.
- **Mark paid**, plus an optional hand-entered outstanding amount and credit limit to show utilization.
- Data lives in `localStorage`. No account, no network, no bank or card connection.

Limits to know about: it is manual (no SMS reading or bank sync), and a web app cannot reliably send background notifications while closed, so reminders appear when you open it. Android native support for this tab has not been added yet.

## Status and known limits (be realistic)

- **The Android project has not been compiled or run yet.** It was written without access to an Android SDK. Expect to fix a few build errors on the first CI run. The UPI parser has tests: `node --test` in `web/` passes, and the Kotlin port has matching JUnit tests that CI runs.
- **You still do the `*99#` steps by hand.** The app opens the dialer, but does not type into the USSD menu. Full automation needs an Accessibility Service, which brings fragile menu-parsing code and Play Store policy problems.
- **`*99#` limits:** it only works on SIMs/operators that support USSD banking (Jio currently does not), the user's bank must support `*99#`, and per-transaction limits are low.
- **Regulation:** the app only helps the user dial the official NPCI service and never touches money. If you ever hold, route or process funds, you need RBI-regulated partners.
- **Debug build only.** A Play Store release needs a signing key and a release build.

## License

MIT, see `LICENSE`.
