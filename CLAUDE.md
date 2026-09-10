# PomoDRIVE

Pomodoro timer and planner. One Next.js codebase ships as the website, the
Android/iOS apps (Capacitor) and the Windows/macOS/Linux apps (Electron).
README.md has the commands.

## Add a feature once, ship it everywhere

- Build features in `src/` (pages in `src/app`, components, hooks, API routes
  in `src/app/api`). The website deploys them directly; the apps pick them up on
  the next `npm run build:static` plus native build.
- Call the API with relative paths (`fetch("/api/...")`, `apiJson("/api/...")`).
  Inside the apps `src/lib/platform.js` redirects those to the server
  automatically, so feature code never checks the platform.
- Pages must stay static-exportable: client components, no dynamic route
  segments (use query params, e.g. `/tasks/routine?projectId=`), `useSearchParams`
  wrapped in `<Suspense>`, no server actions, no `next/headers` in pages.
- Anything that differs per platform (browser vs native APIs) goes through
  `src/lib/platform.js` (`getPlatform()`, `openExternal()`, `onDeepLink()`).
  Do not sprinkle `window.Capacitor` or `window.pomodrive` checks around.
- Sign-in uses `src/components/auth/SignInButton.jsx` everywhere. Do not render
  `GoogleLogin` directly outside that file and `/auth/native`.
- Server-only code stays in `src/app/api`, `src/lib/db.js`,
  `src/lib/authTokens.js`, `src/models` and `src/proxy.js`; the static export
  drops `src/app/api` and `src/proxy.js`.

## Layout

- `src/` shared frontend plus API routes (the website)
- `src/proxy.js` CORS so the app shells can call the API
- `scripts/build-web-static.mjs` static export to `dist/web` and `native/desktop/www`
- `capacitor.config.js`, `native/android`, `native/ios` mobile shells
- `native/desktop` Electron shell (its own package.json)
