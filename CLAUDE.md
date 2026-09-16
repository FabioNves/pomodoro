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
  `src/lib/ai`, `src/lib/news` (except `src/lib/news/client.js`,
  `schedule.js`, `kinds.js`, `locales.js` and `topicSuggestions.js`, which
  are shared with the browser), `src/lib/notebook/server.js`, `src/models` and
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

## Routine tasks and the calendar

- A `RoutineTask` says when it happens through `frequencies` (`daily`, weekday
  keys, `weekly`, `custom`, and the `monthly` flag), `monthly` rules (first
  Monday of the month, first week, the 15th, last day, …), an optional
  `startMinute` (time of day) and an optional `startDate`/`endDate` range.
  `routineOccursOn()` in `src/lib/routineSchedule.js` is the one place that
  decides whether a routine falls on a date; every display (planner grid,
  calendar, dashboard) asks it rather than reading `frequencies` itself, and
  `virtualRoutineTask()` builds the dashed calendar rows it produces.
- Monthly rules are validated with `isValidMonthlyRule()` on the API and
  kept in the same shape client side; `RoutineFrequencyPicker` reports
  `{ frequencies, monthly }` together so the flag and the rules stay in sync.
- Weeks start on Monday or Sunday, per the device preference in
  `src/lib/weekSettings.js` (`useWeekSettings()` in components). Never
  assume Monday: use `getWeekStartOf()`, `dayIndexOf()`, `weekDates()`,
  `weekDayLabels()` and `weeksOfYear()` from `src/utils/timeUtils.js`, and
  derive day names from a plan's real dates. A `WeekPlan.weekStart` is the
  first day of that plan's week (whatever the setting was when it was
  created); `days[i].dayOfWeek` is the offset from it. The planner sidebar
  (`WeekPicker`) lists every week of a year and creates a plan on click, so
  there is no "add week" flow to keep in sync.
- Auto-scheduled routines with a `startMinute` render as blocks on the week
  calendar; dropping or ticking one materialises it as a real week task.
  `WeekCalendar` auto-scrolls while a block is dragged, a range is selected
  or a block is resized near its top or bottom edge (`createEdgeScroller`).

## AI news briefing

- Retrieval goes through MCP only (`src/lib/mcp`): servers are named in env
  vars, tools are discovered at runtime, and each capability (web search,
  news search, page fetch) is routed to the server that serves it best. Do
  not call a search provider's REST API directly from feature code.
- Briefing kinds and their time windows live in `src/lib/news/kinds.js`. Add
  a window or change a reach there, never inline in retrieval or a prompt.
- A run is made of **editions**: the reader keeps one list of them
  (`NewsPreference.editions`), each naming a location or group of locations
  and the briefings it runs in (`kinds: ["daily","weekly","monthly"]`, a
  custom schedule runs the daily ones). `editionsForKind()` picks a run's
  editions; a kind no edition runs in gets a single worldwide one. Each edition plans, searches, summarises and validates on its
  own, in its own language, and is stored as an entry in `Briefing.editions`
  with its stories tagged (`BriefingStory.edition/language/outputLanguage/
  countries`). The run is ready when any edition produced stories.
- A `NewsTopic` carries `editions`: the edition keys it is followed in, empty
  for all of them. `topicsForEdition()` in `generate.js` resolves a run's
  topics per edition, and the implicit worldwide edition ("main") always gets
  every topic, so scoping can never leave a briefing with nothing to search.
  Suggested topics are grouped data in `src/lib/news/topicSuggestions.js`
  (shared with the browser).
- Countries and languages are data in `src/lib/news/locales.js` (shared with
  the browser): the code and English name each provider wants, Brave's
  `search_lang` values, the national outlets that count as reputable in a
  region. Add a country or an outlet there, not in retrieval or a component.
- One edition fills most of a 300 s function, so a run spans several
  invocations: each runs one edition, claims it atomically and asks
  `/api/news/briefings/continue` (Bearer `CRON_SECRET`) to run the next. A
  broken chain is picked up by the cron or by the dashboard, which sees
  `stalled` on the briefing and asks for the next edition itself.
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
