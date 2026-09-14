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
  `src/lib/authTokens.js`, `src/lib/sessionAuth.js`, `src/lib/mcp`,
  `src/lib/ai`, `src/lib/news` (except `src/lib/news/client.js` and
  `schedule.js`), `src/lib/notebook/server.js`, `src/models` and
  `src/proxy.js`; the static export drops `src/app/api` and `src/proxy.js`.
  Never import those modules from a page or component.
- Routes that hold private data verify the session JWT with `requireUser()`
  from `src/lib/sessionAuth.js` rather than trusting the `user-id` header.
  It accepts only tokens carrying the `purpose: "session"` claim that
  `issueSessionToken()` sets.

## Notebook

- Data: `NotebookFolder` (nested through `parent`), `NotebookDocument`
  (a note: `tabs[]` with `parent` for subtabs, up to three levels) and
  `NotebookSettings` (one per user: the Brain subjects and saved views).
  Routes live in `src/app/api/notebook/*`; the shared rules (limits, DTOs,
  tab-tree checks, derived fields) in `src/lib/notebook/server.js`.
- Tab content is HTML from the editor. The browser sanitises it with the
  allow-list in `src/lib/notebook/sanitize.js` on load and before save;
  the server only strips scripts/handlers (`stripDangerousHtml`). Extend
  the allow-list rather than bypassing it.
- Saving a tab recomputes `preview`, `wordCount` and `links` (titles
  written as `[[Note title]]`) in `deriveDocument()`, so lists and the
  Brain graph never load tab contents. Keep new derived fields there.
- The suggested subjects every notebook starts with are in
  `src/lib/notebook/subjects.js`; `ensureSettings()` seeds them once per
  user. The rest of `src/lib/notebook` (`client.js`, `subjects.js`,
  `text.js`, `tree.js`, `sanitize.js`) is shared with the browser.
- The page keeps its state in the query string (`?view=`, `?folder=`,
  `?doc=`, `?tab=`, `?subject=`) so links and reloads keep their place.

## Projects and milestones

- A planner project (`Project`: name, description, headerColor, template,
  startDate, endDate) owns `ProjectMilestone` documents (name, description,
  order, status, startDate, endDate) and `Task` documents; a task may point
  at one milestone through `Task.milestone` (subtasks always follow their
  parent). The older `Milestone` model is the timer's session label, not a
  project milestone.
- Projects, milestones and tasks all carry an optional `startDate`/`endDate`
  span (the timeline). A task's `scheduledDate` is something else: the day it
  sits on in the week plan. Every route rejects an end before its start; the
  browser helpers are `spanOf()`, `formatDateRange()` and `isInvalidRange()`
  in `src/lib/milestones.js`.
- Milestone progress is never stored: `milestoneProgress()` in
  `src/lib/milestones.js` derives it from the tasks assigned to the milestone
  (a completed milestone reads 100 %). Statuses live there too.
- Routes: `src/app/api/project-milestones` (CRUD + `/reorder`),
  `src/app/api/projects/structure` (adds reviewed milestones and tasks in one
  request) and `src/app/api/projects/suggest` (AI suggestions, session JWT
  required, returns nothing that is stored). The planner routes use the same
  identity headers as `/api/projects` and `/api/tasks`; the browser helper is
  `apiJson()` in `src/lib/plannerApi.js`.
- Templates are data in `src/lib/projectTemplates.js` (shared with the
  browser); AI prompts and schemas in `src/lib/ai/planning.js` (server only).
  Both only feed the review screen (`StructureReview`): the user selects,
  edits and reorders before `/api/projects/structure` creates anything.
- Planner UI lives in `src/components/planner`: the shared `TaskRow`,
  the project "⋮" modal (`ProjectManageModal`), the creation flow
  (`NewProjectModal`), the suggestion dialog (`SuggestDialog`) and the Tasks
  tab views (board column strip, `ProjectPageView`, `TimelineView`: one row
  per project, a lane per dated milestone, marks for dated tasks; a project
  without dates spans its contents). The Tasks tab keeps its view in
  `?view=` and the open project in `?project=`.

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
