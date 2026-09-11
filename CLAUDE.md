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
  `src/lib/authTokens.js`, `src/lib/mcp`, `src/lib/ai`, `src/lib/news`
  (except `src/lib/news/client.js` and `schedule.js`), `src/models` and
  `src/proxy.js`; the static export drops `src/app/api` and `src/proxy.js`.
  Never import those modules from a page or component.

## AI news briefing

- Retrieval goes through MCP only (`src/lib/mcp`): servers are named in env
  vars, tools are discovered at runtime, and each capability (web search,
  news search, page fetch) is routed to the server that serves it best. Do
  not call a search provider's REST API directly from feature code.
- Briefing kinds and their time windows live in `src/lib/news/kinds.js`. Add
  a window or change a reach there, never inline in retrieval or a prompt.
- The AI layer (`src/lib/ai`) only sees retrieved material and returns
  source ids; `src/lib/news/validate.js` maps ids back to stored articles and
  drops anything unsupported. Keep that split: MCP retrieves, OpenAI
  interprets, the app stores and presents.
- News routes verify the session JWT with `requireUser()` from
  `src/lib/news/auth.js` (not the `user-id` header, which is unverified). It
  accepts only tokens carrying the `purpose: "session"` claim that
  `issueSessionToken()` sets, so a token signed with the same secret
  elsewhere is not a session. The browser helper is `newsApi()` in
  `src/lib/news/client.js`.
- Anything the model writes is checked before it is stored: quotes must be
  verbatim in the cited sources, URLs are stripped from prose, and stories
  whose source ids do not resolve are dropped. Add new model-written fields
  to `groundBriefing()` rather than saving them straight through.

## Layout

- `src/` shared frontend plus API routes (the website)
- `src/proxy.js` CORS so the app shells can call the API
- `scripts/build-web-static.mjs` static export to `dist/web` and `native/desktop/www`
- `capacitor.config.js`, `native/android`, `native/ios` mobile shells
- `native/desktop` Electron shell (its own package.json)
