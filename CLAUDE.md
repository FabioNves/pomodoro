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
  `src/lib/ai`, `src/lib/access/server.js`, `src/lib/access/admin.js`,
  `src/lib/access/connections.js`, `src/lib/usage`, `src/lib/news` (except `src/lib/news/client.js`,
  `schedule.js`, `kinds.js`, `locales.js` and `topicSuggestions.js`, which
  are shared with the browser), `src/lib/notebook/server.js`,
  `src/lib/business/server.js`, `src/models` and
  `src/proxy.js`; the static export drops `src/app/api` and `src/proxy.js`.
  Never import those modules from a page or component.
- Routes that hold private data verify the session JWT with
  `await requireUser()` from `src/lib/sessionAuth.js` rather than trusting
  the `user-id` header. It accepts only tokens carrying the
  `purpose: "session"` claim that `issueSessionToken()` sets, rejects
  sessions revoked from the admin page, and refuses features the caller's
  plan lacks (see "Roles, plans and feature gating").

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
- Besides the note views the sidebar has two of its own: `?view=quotes` and
  `?view=posts`. Both load their own lists (they are not part of
  `GET /api/notebook`, which only returns their `counts`), so a big
  collection never slows the notes down.

## Quotes

- A `NotebookQuote` (text, author, source, origin, verified, active) belongs
  to a `NotebookQuoteAuthor` through `authorKey`, the normalised name from
  `authorKey()` in `src/lib/notebook/quotes.js`. Switching an author off
  takes all of its quotes out of the dashboard machine without deleting
  anything; a single quote can be switched off on its own.
- `GET /api/notebook/quotes?scope=active` is what the dashboard asks for:
  active quotes of active authors, and nothing else. The shared rules and
  the fallback quotes are in `src/lib/notebook/quotes.js` (browser too), the
  DTOs and the duplicate check in `quotesServer.js` (server only).
- The dashboard shows `QuoteSlotMachine` (`src/components/quotes`) under the
  greeting, every day rather than only once the day's blocks are done: a
  reader with no week plan would otherwise never see it. With no quotes of
  their own they get `DEFAULT_QUOTES` and an offer to save some, so the
  machine is never empty. The caption still marks a finished day.
- Whether it is there at all is a device preference,
  `src/lib/dashboardSettings.js` with `useDashboardSettings()`, set under
  Settings > Dashboard. Follow that module for any further dashboard
  preference rather than adding one to the timer or week settings.
- AI suggestions go through `POST /api/notebook/quotes/suggest` (feature
  `ai_quotes`, session JWT). It takes an author, optionally a `work` (a book,
  essay or speech) to take the quotes from, and a theme; a named work also
  becomes the search and the fallback `source`. Nothing is stored: the browser
  reviews the candidates and posts back the ones the user keeps. With `useWeb` the MCP
  layer retrieves pages first (`src/lib/notebook/quoteResearch.js`) and the
  model may only quote from them; `src/lib/ai/quotes.js` then checks every
  quote verbatim against the page it cites and the route drops the rest.
  Without material the model answers from memory and every quote is stored
  `verified: false`, which the UI shows. A 429 from OpenAI is the account's
  own rate limit: `chatJson` waits and retries, and what is left reaches the
  browser as `retryAfter` seconds rather than a bare failure. Editing a quote's words clears the
  flag, because they are the user's words then, not the source's.
- The save route never takes `verified` from the browser. The suggest route
  signs its finding (`issueQuoteProof()`) and the save route checks that
  signature, so the badge cannot be claimed by a hand-made request. It says
  "found on the page", which is what was actually checked: the words appear
  on the page cited. A quote-listing page can still attribute them to the
  wrong person, so do not upgrade that wording to a claim of authorship.
- "View more" on the full-size slot machine opens the quote player
  (`src/components/quotes/QuotesPlayer.jsx`): authors in a side navigation
  (chips on phones), one quote at a time on a stage, a list to jump around,
  and an auto mode that moves on at reading pace or reads each quote aloud.
  The compact machine in the notebook has no View more (`expandable`
  defaults to `!compact`), because the notebook already lists every quote.
- Voices: "Device" is the browser's own speech synthesis (free, offline);
  "AI voice" is the `ai_voice` feature (premium), drawn locked with the
  Premium badge for anyone else. `POST /api/notebook/quotes/speech` only reads
  a quote the reader has, or a built-in one, looked up on the server: never
  text from the request, so it cannot voice arbitrary words. Every clip is
  kept in `QuoteSpeech` by model, voice and words, so a quote is paid for once
  per voice, and a reader can have at most `QUOTE_VOICE_DAILY_LIMIT` (200)
  new clips made a day; kept clips always replay. The model is
  `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`, whose cost row is in
  `src/lib/usage/track.js`); the voices are `QUOTE_VOICES` in
  `src/lib/notebook/quotes.js`, narrowed by `voicesForModel()` for the older
  tts-1 models. Browser helpers, including the silent-clip unlock phones need
  before sound can start from a timer, are in
  `src/lib/notebook/quoteVoice.js`.
- In the player, the voice the reader picks is remembered; a voice that fails
  mid-session is replaced for that session only (`voiceFallback`), never
  saved over the pick. "Read this one" starts from the tap itself rather than
  from an effect, and the order is kept with the list it was built for, so
  closing, reopening and picking an author never put a stale quote on stage.

## Saved posts

- A `NotebookPost` is an image, a video or just a link the reader kept from
  Instagram, TikTok and the rest. Platforms, media types, the upload chunk
  size and the browser-side helpers live in `src/lib/notebook/posts.js`
  (shared); thumbnails and drop/paste handling in `media.js` (browser only,
  it uses canvas); the storage rules in `postsServer.js` (server only).
- Files are stored in Mongo, not on a disk a serverless host does not have:
  `NotebookPostFile` holds the metadata and `NotebookPostChunk` the bytes in
  `UPLOAD_CHUNK_SIZE` pieces, so every request stays under the 4.5 MB body
  limit. The browser starts an upload, PUTs the pieces and only then creates
  the post (`src/lib/notebook/postUpload.js`). Limits come from
  `NOTEBOOK_POST_MAX_MB` and `NOTEBOOK_POSTS_QUOTA_MB`.
- Thumbnails are made on the device before the upload, so the grid loads
  small JPEGs and the server never decodes anything.
- `<img>` and `<video>` cannot send the session header, so media is served
  by `/api/notebook/posts/file` against an HMAC in the URL (`mediaUrl()`),
  which also answers byte ranges so videos seek. The owner is part of what
  is signed and is checked again when the file is loaded, so a link that
  leaks cannot be pointed at anyone else's media. It is the one notebook
  route without `requireUser()`; never widen it to serve anything the
  signature does not name.
- Media URLs are relative, and only `fetch` and axios are redirected inside
  the app shells, so every `src` goes through `apiUrl()` from
  `src/lib/platform.js`. Forget that and the picture is simply missing in
  the phone and desktop apps while the website looks fine.

## Business

- Admin only for now: the `business` feature is in no plan (see "Roles,
  plans and feature gating"). Everyone else gets no tab, the 404 page and
  404s from `/api/business/*`; the page shows the admin an "Admin only" chip.
- A `Business` owns six `BusinessPhase` documents (define, build, launch,
  operate, measure, improve), the `BusinessWorkItem` documents under them,
  `BusinessDependency` edges between work items ("`item` cannot start before
  `dependsOn` is completed"), `BusinessMetric` numbers and a
  `BusinessActivity` log. Routes live in `src/app/api/business/*` (the
  business itself, `/items`, `/dependencies`, `/metrics`, `/loops`) and
  verify the session JWT; DTOs, ownership checks, the snapshot and the seed
  are in `src/lib/business/server.js` (server only).
- Nothing about progress or status is stored. A work item keeps
  `not_started`, `in_progress` or `completed`; **blocked**, **ready**, phase
  progress and status, overall progress and the next actions are derived by
  `summarize()` in `src/lib/business/engine.js`, pure functions shared by the
  routes (which answer 409 `{ code: "blocked", blockers }` to starting
  blocked work, and `{ code: "cycle" }` to a circular prerequisite) and the
  browser (which recomputes the whole page the moment an item changes). Put
  a new rule there, never in a component or a route, and never add a stored
  percentage. Progress counts completed work only: in progress is not half.
- The phases are not a wizard. A prerequisite always names a work item, not
  a phase, so later phases open up piece by piece. Do not add a "Next"
  button or gate a phase workspace behind another phase.
- The six phases, their areas, the statuses, business types and limits are
  data in `src/lib/business/phases.js`; what a new business starts with (work
  items, the prerequisites between them, which business types get which) in
  `blueprint.js`; metric defaults and formatting in `metrics.js`. All three
  are shared with the browser. The blueprint is copied when a business is
  created, so editing it never changes an existing business.
- The cycle is continuous: `Business.loops` holds improvement loops, each a
  chain of one work item per phase (`BusinessWorkItem.loop`), created by
  `POST /api/business/loops`. 100 % shows the prompt for the next loop, never
  a "finished" screen.
- The page keeps its place in the query string: `?b=` the business (absent
  means the first one), `?phase=` the open workspace, `?item=` the open work
  item, which also opens its phase behind it. `setParams()` in `BusinessApp`
  builds on the last query it asked for, because the router applies a change
  a moment later and two changes in a row would otherwise undo each other.
- UI lives in `src/components/business`: `BusinessApp` (data, URL, optimistic
  updates with rollback), `BusinessOverview`, `PhaseMap` (one set of cards;
  only the connectors change shape between desktop and phone),
  `PhaseWorkspace` (an area per card), `WorkItemDialog`, `MetricsPanel`,
  `CyclePanel`. A phase workspace gets its extra blocks from the phase's
  `panels` in `phases.js`. `area.module` and `BusinessMetric.source` are
  where a future module (CRM, finance, inventory…) attaches; `link` on a
  work item points at a screen that already does the work.
- `StatusPill` is `inline-flex` itself, so hide it with a wrapper
  (`<span className="hidden sm:inline-flex">`), not with `hidden` on the pill.
- The main menu now has six tabs, which do not fit beside the logo and the
  account below about 1100 px: `NavLink` in `src/components/Navbar.jsx` shows
  icons at `md`, labels at `lg` and both from `xl`. Check 768 px and 1024 px
  before adding a seventh.

## Projects and milestones

- A planner project (`Project`: name, description, headerColor, template,
  startDate, endDate) owns `ProjectMilestone` documents (name, description,
  order, status, startDate, endDate) and `Task` documents; a task may point
  at one milestone through `Task.milestone` (subtasks always follow their
  parent). The older `Milestone` model is the timer's session label, not a
  project milestone. A `RoutineTask` is what the UI calls a **cycle**.
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

## Cycles (routine tasks) and the calendar

- A `RoutineTask` is a **cycle** in the UI. It says when it happens through `frequencies` (`daily`, weekday
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
- Whether a cycle occurrence still needs its dashed auto row is decided by
  `occurrencesHandled()` in `src/lib/weekPlanView.js`, which the planner
  calendar, the schedule list and the dashboard all ask. A real week task
  answers for the occurrence of the day it came from: moving a cycle task
  records `originDay` (`originDayAfterMove()`, used by the move route and by
  both optimistic updates), and dragging a dashed occurrence to another day
  makes it real there with `originDay` set to the day it left. So the day it
  left does not grow a fresh copy and the day it went to keeps its own
  occurrence. An origin only counts on a day the cycle really runs
  (`occursOnFor()`); otherwise the task answers for the day it sits on.
  Never go back to "is there a task for this routine on this day", which is
  what regenerated them.
- A week task can belong to a project from the add form, and change project,
  duplicate or be deleted from its "⋮" menu (`TaskEditPopover`). The menu
  edits the project of the task itself: a cycle task without one follows its
  cycle, and the empty choice says so ("Same as its cycle"). The picker is
  `ProjectSelect` with `projectOptionsFrom()`; a copy is built by
  `duplicateTaskFields()` so the calendar and the list make the same one (it
  copies the stored block length, never the estimate, which the API may
  refuse as a length). All of it lives in
  `src/components/weekplan/WeekPlanShared.jsx`.
- Notes show in a card beside a task while the pointer rests on it, with a
  Copy button (`useNotesPeek()` + `NotesButton`, one card per view; tapping
  the notes icon pins it, for phones). Do not put notes back into `title`
  tooltips: nothing can be copied from those.
- The calendar also accepts a task dragged in from outside it (the Tasks
  column of the split view). HTML5 drag data cannot be read before the drop,
  so the source leaves its payload in `src/lib/plannerDrag.js` and marks the
  drag with `PLANNER_DRAG_TYPE`; the drop becomes a week task in the same
  project, as the add form's Todo picker does.

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

## The planner

- Four sections in `TABS` (`src/app/planner/page.js`): tasks, calendar,
  schedule and **routines**, which holds habits and cycles behind
  `ROUTINE_VIEWS` (`?view=habits|cycles`). They are still two features in the
  registry, so `tabFeature` picks the one the open view needs.
- A **cycle** is a recurring task. Only the name changed: the model is still
  `RoutineTask`, the route still `/api/routine-tasks`, and the registry key
  still `routines`. Rename labels, not the data. `routineOccursOn()` and the
  rest of `src/lib/routineSchedule.js` keep their names too.
- `LEGACY_TABS` and `LEGACY_VIEWS` map older links (`?tab=habits`, and the
  `?tab=rituals` the section briefly used) onto the current section and view.
- The section list (`renderSectionNav()`) is part of every sidebar through
  `withSections()`, on every tab, and the sidebar is what the phone drawer
  shows. There is no horizontal tab strip; do not bring one back for a new
  section, add it to `TABS`.
- The calendar has a split view, Calendar + Tasks, kept in the URL as
  `?tab=calendar&view=split` and switched by the "Tasks" button in its header
  (named "Tasks column" for screen readers, since the Tasks section is a
  button too). The column is `TasksPanel` (`src/components/planner`): pending
  tasks by project, quick add, and each task dragged onto a day or sent to one
  from its menu. It needs lg (1024 px) and up; below that the button and the
  column are simply not drawn.

## The timer

- The countdown is **not** page state. It lives in `TimerProvider`
  (`src/components/timer/TimerProvider.jsx`), mounted once in the root
  layout, so a session survives navigation and reloads. Never put a
  `setInterval` countdown in a page or re-create timer state next to a panel.
- The run itself is data in `src/lib/timerMachine.js` (shared with the
  browser): pure transitions plus `secondsLeft()`, which derives the time
  left from `runningSince`/`remaining`. Time is never counted down in state,
  so every consumer agrees and a reload is exact. Add a transition there, not
  in the provider.
- Two contexts: `useTimerDisplay()` changes twice a second (the panel and
  `TimerBadge` read it) and `useTimerControls()` is stable (pages read it).
  A page that only starts the timer or names the session must take the
  control one, otherwise it re-renders on every tick.
- `TimerControls` is a view over the provider. The dashboard and `/timer`
  both render it and show the same running session; neither owns state.
- The provider saves the finished session to `/api/sessions` itself, using
  the context a page registered with `setSessionContext({ projectId, title,
  tasks })`. Pages react to a save by watching `completedAt`; they must not
  post a session themselves, or one session is written twice.
- The timer is reached from the dashboard, not from the navbar: `NAV_ITEMS`
  in `src/components/Navbar.jsx` deliberately has no Timer entry, and
  `TimerBadge` is the way back to a running session.

## Roles, plans and feature gating

- Roles are `admin` (email in `ADMIN_EMAILS`, default the owner's), `premium`
  (unexpired `User.plan === "premium"`) and `free`. `roleOfUser()` in
  `src/lib/access/server.js` is the only place that decides; nothing stored
  or sent by the client is a role. An admin's `User.viewAs` lowers the
  effective role for previews (`effectiveRole()`), never raises it.
- The feature registry is `FEATURE_CATALOGUE` in `src/lib/access/features.js`
  (shared with the browser) merged with the `AccessConfig` document by
  `normalizeRegistry()`. Add a feature there, with its defaults, and it
  appears in the admin table, the pricing page and the gate. Never hardcode
  a feature list in a page.
- Gate every premium feature twice. Server: `requireUser()` (session routes)
  and `validateIdentityHeaders()` (planner routes) look up the feature behind
  the path (`featureForPath()`) and answer 403 when the plan lacks it; pass
  `feature: "..."` for a route that needs a more specific key. Browser: wrap
  the control in `<Locked feature="...">` or the screen in `<LockedScreen>`
  from `src/components/access/Gate.jsx`; locked controls are drawn greyed
  out with a lock that links to `/pricing`, never hidden and never a dialog.
- The one exception is a feature that is enabled but in **no plan**: it is
  admin only (`isAdminOnly()` in `features.js`). Nobody else is told it
  exists: the verdict is `hidden` rather than `locked`, `NAV_ITEMS` drops it,
  `<Locked>` renders nothing, `<LockedScreen>` renders the app's 404, the
  pricing API leaves it out and the gate answers 404 like the admin routes.
  It follows the effective role, so an admin previewing as Premium or Free
  does not see it either. This is how an unreleased feature ships (Business
  does today); opening it up is ticking a plan under Admin > Subscriptions.
  Until `/api/me` answers, the browser takes the catalogue default, so change
  the catalogue too when a feature is released for good.
- `requireUser()` is async: it verifies the JWT, loads the user (so revoked
  sessions and plan changes apply at once), records usage and gates. Always
  `await` it. Admin routes use `requireAdmin()` from `src/lib/access/admin.js`
  and answer 404, not 403, to anyone else; `/admin` renders `notFound()`.
- Account things (Settings, the admin page, the view-as switcher, pricing)
  belong in `src/components/nav/UserMenu.jsx`, not in `NAV_ITEMS`: the main
  menu is for the app's screens. The Pricing button shows for anyone not on
  Premium; the welcome page has no navbar, so it carries its own link.
- The browser learns its role from `GET /api/me` through `AccessProvider`
  (`src/lib/access/client.js`, mounted in the root layout); components call
  `useAccess()` / `useFeatureGate()`. The admin bar (`ViewAsBar`) and the
  Connection report (`src/components/admin/ConnectionStatus.jsx`, canonical
  home `/admin?tab=connections`) only render for the real admin, and the
  Connection block in News > Settings is hidden while previewing.
- Usage: `recordRequest()` / `recordExternalCall()` in `src/lib/usage/track.js`
  write `UsageEvent` rows after the response (`next/server` `after()`); the
  OpenAI and MCP wrappers already call them. Attribute background work to a
  user with `withUsageContext()`.

## Layout

- `src/` shared frontend plus API routes (the website)
- `src/proxy.js` CORS so the app shells can call the API
- `scripts/build-web-static.mjs` static export to `dist/web` and `native/desktop/www`
- `capacitor.config.js`, `native/android`, `native/ios` mobile shells
- `native/desktop` Electron shell (its own package.json)
