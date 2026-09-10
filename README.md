# PomoDRIVE

A Pomodoro timer with projects, a weekly planner, habits and analytics.

One codebase, every platform:

| Target | What runs | Commands |
| --- | --- | --- |
| Website + API | Next.js on Vercel (https://pomodrive.vercel.app) | `npm run dev`, `npm run build` |
| Android / iOS | Capacitor shell around the static frontend | `npm run mobile:android`, `npm run mobile:ios` |
| Windows / macOS / Linux | Electron shell around the static frontend | `npm run desktop:dev`, `npm run desktop:build` |

Every screen and feature lives in `src/`. Build a feature there once, deploy
the website, rebuild the apps; nothing is written per platform. `CLAUDE.md`
lists the few rules that keep it that way.

## How the apps work

- `npm run build:static` exports the frontend (everything in `src/` except the
  API routes) to `dist/web` and `native/desktop/www`. The API address and the
  sign-in site are baked in from `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WEB_URL`
  (default: https://pomodrive.vercel.app).
- The shells load that bundle locally and talk to the deployed API.
  `src/lib/platform.js` redirects relative `/api/...` calls to the server and
  `src/proxy.js` adds the CORS headers the shells need.
- Sign-in: Google blocks its sign-in inside app webviews, so the apps open the
  website's `/auth/native` page in the system browser. After Google returns,
  the website sends the user back with a `pomodrive://auth?code=...` deep link
  and the app exchanges that two-minute code for a session at
  `/api/auth/handoff`.
- Notifications: the mobile app uses native local notifications; the website
  and desktop app use the browser Notification API (`src/utils/notifications.js`).

## Setup

1. `npm install`, copy `.env.example` to `.env` and fill it in.
2. Website: `npm run dev`, then open http://localhost:3500.
3. Desktop: `npm --prefix native/desktop install` once, then `npm run desktop:dev`.
   Installers: `npm run desktop:build` writes to `native/desktop/release/`
   (run it on each OS you ship for).
4. Android: needs a JDK 21 and the Android SDK (Android Studio).
   `npm run mobile:android` builds the frontend, syncs it and opens Android
   Studio. For a debug APK from the terminal:
   `cd native/android && ./gradlew assembleDebug` (set `JAVA_HOME` to a JDK 21
   if Android Studio's bundled JDK is older).
5. iOS: `npm run mobile:ios` on a Mac with Xcode. The project is already
   generated under `native/ios`.

## Live reload in the apps

Point a shell at the dev server instead of the bundled files:

```bash
# Android (phone and PC on the same network)
CAP_SERVER_URL=http://<your-lan-ip>:3500 npx cap run android

# Desktop
ELECTRON_DEV_URL=http://localhost:3500 npm --prefix native/desktop start
```

## Shipping a change

1. Build the feature in `src/` and test it with `npm run dev`.
2. Deploy the website (push to `main`; Vercel builds it). The apps use the new
   API immediately.
3. If the UI changed, rebuild the apps: `npm run desktop:build`, and
   `npm run mobile:sync` followed by a build in Android Studio / Xcode.

## Where the platform glue lives

- `src/lib/platform.js`: platform detection, API redirection, external links, deep links
- `src/components/auth/SignInButton.jsx`, `src/app/auth/native/page.js`: sign-in on every platform
- `src/app/api/auth/handoff/route.js`, `src/lib/authTokens.js`: the code-for-session exchange
- `capacitor.config.js`, `native/android`, `native/ios`: mobile shells
  (deep link registered in `AndroidManifest.xml` and `Info.plist`)
- `native/desktop`: Electron shell (`main.js`, `preload.js`, `electron-builder.yml`)
- `scripts/build-web-static.mjs`: the static export both shells bundle
