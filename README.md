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

## Notebook

The **Notebook** tab is a lightweight document editor for your notes
(quotes are under Notebook > Quotes, where **Find with AI** takes an author,
optionally a book or other work to draw the quotes from, and a theme; the
dashboard shows them on a slot machine you can pull, which Settings >
Dashboard turns off):

- Rich text (headings, lists, checklists, colours, links, alignment) with
  autosave. Each note can have tabs and subtabs, like Google Docs tabs.
- Folders and subfolders in the sidebar, with drag and drop, plus search
  across titles, subjects and note contents.
- Views: **Folders**, **All notes** (filter by subject), **Brain** and any
  saved views you create (a folder and/or subjects, list or grid, sort).
- **Brain** is an Obsidian-style graph: subjects are the hubs (a set of
  suggested subjects is there from the start, add or delete any), notes
  attach to the subjects they carry, and writing `[[Note title]]` inside a
  note links it to that note. The links also show under the editor.

Everything is stored per user (`NotebookFolder`, `NotebookDocument`,
`NotebookSettings`) behind `/api/notebook/*`, which verifies the session
token like the news routes do.

## Business

The **Business** tab is for creating, setting up, running, measuring and
improving a business. It is not a wizard and not a checklist: a business is
six connected phases that are all open at once, each with its own progress.

**Define → Build → Launch → Operate → Measure → Improve → back to Define**

- **Create your business** asks for a name and the kind of business (and,
  optionally, a line about it and its currency). The six phases, a first set
  of work items for each, the prerequisites between them and the default
  metrics are generated from that; a service business gets no inventory, a
  software business no stock to count. Everything can be renamed, removed,
  added to and rewired afterwards.
- **Overview.** "Your business is 42% operational", the six phases as
  connected cards (number, name, percentage, bar, status, and what the phase
  is waiting on), the next actions, Business health, the continuous cycle and
  recent activity. On a phone the cards stack, with the same connections.
- **Progress is derived, never typed in.** A phase is its completed work
  items over all of its work items (work in progress counts once it is
  completed: three of five done is 60 %); the business is the average of the
  six phases. Each status is worked out too: *Not started*, *In progress*,
  *Blocked* (a prerequisite is not completed), *Ready* (every prerequisite
  is) and *Completed*.
- **Dependencies** are between work items, never whole phases, so later
  phases open up piece by piece while earlier ones are still being refined.
  A blocked item names exactly what blocks it, every name is a link to that
  prerequisite, and when the blockers are blocked themselves the dialog says
  where to start. The server refuses to start or complete blocked work;
  a prerequisite that would go round in a circle is refused as well.
  Completing an item updates its phase, the business, what it unlocks and the
  next actions at once, with no reload.
- **Phase workspaces** (`?phase=define`) group the work into areas (Business
  identity, Pricing, Payments, Inventory…), each a card of its own; add
  items or whole areas. Measure also holds all the metrics, Improve the
  improvement loops. A work item (`?item=`) has a status, a description of
  what done looks like, notes, what it waits on and what it unlocks.
- **Business health** holds the numbers you keep an eye on (revenue,
  customers, costs, conversion, retention, and any of your own), each with an
  optional target and the change since the last value. "Open work" is counted
  from the work items.
- **The cycle never ends.** Completing all six phases is a checkpoint, not a
  finish line: an **improvement loop** ("New pricing strategy") adds one step
  to every phase, Define through Improve, each waiting on the one before, so
  the phases it passes through open up again.

Everything is stored per user (`Business`, `BusinessPhase`,
`BusinessWorkItem`, `BusinessDependency`, `BusinessMetric`,
`BusinessActivity`) behind `/api/business/*`, which verifies the session token
like the notebook and news routes do. An account can hold several businesses;
the page keeps the chosen one in `?b=`.

Business is **admin only** for now: it is in neither plan, so only the admin
sees the tab (with an "Admin only" chip on the page); for everyone else it
does not exist. Tick Free or Premium for it under Admin > Subscriptions to
open it up.

## Projects, milestones and templates

The Planner's **Tasks** tab has three views (kept in the URL as `?view=`):
**Board** (the original project columns, now with a milestone strip between
the project header and its tasks), **Project** (one project: information,
milestones, then tasks grouped under their milestone plus an *Unassigned*
section) and **Timeline** (one row per project on a shared time axis: the
project bar, a lane per dated milestone with its progress, small marks for
dated tasks, a today line, weeks/months zoom; projects without dates span
their dated contents, and projects with nothing dated are listed below).

- Projects, milestones and tasks can all have a start date and an end date.
  Projects get them when created or in the "⋮" modal, milestones in their
  form or inline, tasks through "Set start/end…" in the task menu. A task's
  scheduled date (the day it sits on in the week plan) is separate.
- A project's "⋮" opens a modal with three tabs: the project (name,
  description, dates, colour, delete), its milestones (add manually or with
  AI, edit, reorder by drag or buttons, status, dates, complete, delete)
  and its tasks (move any task between milestones).
- Milestones have a name, description, order, status (planned, in progress,
  on hold, completed) and dates; progress is derived from the tasks
  assigned to them. Deleting a milestone keeps its tasks as unassigned.
- **Create new project** asks for a name and description, then offers
  *Start from scratch*, *Use a template* (14 templates in
  `src/lib/projectTemplates.js`) or *Suggest a structure with AI*. Both the
  template and the AI output land on a review screen where milestones and
  tasks can be selected, renamed, reordered, removed or added before
  anything is created.
- On the project page, **Suggest milestones** asks what you want to
  accomplish and proposes milestones; every milestone has **Suggest tasks**.
  AI suggestions need `OPENAI_API_KEY` and a signed-in user; templates and
  manual milestones work without either.

## AI news briefing

The **News** tab builds a personalised daily, weekly or monthly briefing from
real, current web sources. Nothing is written from the model's memory:

1. OpenAI turns the user's topics into search queries.
2. The app, acting as an **MCP client** (`src/lib/mcp`), runs those searches
   and fetches the best pages through one or more MCP servers. Tools are
   discovered at runtime, and each capability is routed to whichever
   configured server does it best: Brave has a real news tool that returns
   publication dates but cannot fetch a page, Tavily extracts full article
   text but has no news mode, so configuring both gives you dated news and
   full-text summaries. Routing is automatic and can be pinned with
   `MCP_ROUTE_SEARCH` / `MCP_ROUTE_NEWS` / `MCP_ROUTE_FETCH`.
3. OpenAI ranks, de-duplicates and summarises the retrieved material,
   referencing sources only by id.
4. `src/lib/news/validate.js` keeps only stories whose sources resolve to
   retrieved articles, and the briefing is stored (`Briefing`,
   `BriefingStory`, `NewsArticle`).

Briefings come in three windows, each with its own retrieval reach, and the
AI picks the important stories out of whatever the window returns:

| Briefing | Covers | Format |
| --- | --- | --- |
| Daily | the past 24 to 48 hours | top stories, worth knowing, trends |
| Weekly | the past 7 days | plus biggest developments and what you missed |
| Monthly | the past month | same roundup, selected on lasting significance |

### Regions and languages

A briefing can be split into **editions**, set up once under Settings →
Editions. An edition picks a country or a group of countries, the language to
search in, whether it covers your topics there or the region's most important
news, the language it is written in (its own, or translated into any of the
listed languages), and which briefings it runs in: daily, weekly, monthly, or
several at once. You write an edition once and tick the cadences it belongs
to, rather than rebuilding the same list for each. So a weekly run can be your usual topics worldwide
followed by the top news of Portugal in Portuguese, France in French and
Germany translated into English. Without editions a run behaves as it always
did: one worldwide briefing about your topics.

The briefing screen gives each language a tab, with that language's editions
as sections you open and close; saved stories get the same language tabs, and
a story summarised from another language says so. **Generate now** opens a
menu when the briefing has more than one edition: build all of them, or pick
a single region to refresh without rebuilding the rest.

Locale support comes from what the servers actually accept (`src/lib/news/
locales.js`): Brave takes a country code and its own language codes, Tavily
takes a full country name and has no language field, and a parameter a server
does not declare is never sent. In a regional edition that country's
established outlets count as reputable sources.

An edition is a full search-and-summarise pass, so a run with several of them
takes a few minutes per edition and is built one edition at a time, each in
its own server invocation (they hand over through `/api/news/briefings/
continue`, authorised with `CRON_SECRET`). Editions appear as they finish, so
you can read the first while the rest are still being built; if a hand-off is
lost, the page or the next cron run picks the briefing up where it stopped.
Up to 12 editions per kind.

Configuration (all server side, see `.env.example`): `OPENAI_API_KEY`,
`MCP_SERVER_URL` (or named servers such as `MCP_SERVER_BRAVE_COMMAND`, and
`MCP_SERVER_COMMAND` for a local stdio server in development) and
`CRON_SECRET`.

Scheduled briefings: `vercel.json` runs `/api/news/cron` daily at 06:00 UTC,
which works on every Vercel plan. The route is idempotent and delivers each
user's most recent due cycle in their own timezone, so on a Pro plan change
the schedule to `0 * * * *` (hourly) to honour delivery times to the hour.
Each run serves the longest-overdue users first, hands each briefing off to
its own invocation (running an edition itself when it cannot), resumes runs
whose hand-off was lost, and retries a cycle that failed for a transient
reason (up to three attempts). Any external scheduler can call the same route with
`Authorization: Bearer $CRON_SECRET`; `?dryRun=1` lists what is due without
generating. Trigger it locally with
`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3500/api/news/cron`.

The news endpoints authenticate differently from the rest of the API: they
verify the session JWT (`Authorization: Bearer <accessToken>`) instead of
trusting the `user-id` header, so a user only ever reaches their own
preferences, briefings and saved stories.

## The planner

Four sections, listed in a sidebar that is there on every one of them (on a
phone, behind the button above the content):

| Section | What it holds |
| --- | --- |
| Tasks | Board, Project and Timeline views of projects, milestones and tasks |
| Calendar | The week as an hour grid |
| Schedule | The week plan as a list |
| Routines | **Habits** and **Cycles**, the two things that come round again |

Habits and recurring tasks used to be separate tabs. They answer the same
question, so they share the Routines section with a switch at the top of it:
the section is `?tab=routines`, the view `?view=habits|cycles`. A *cycle* is
what used to be called a routine task; the model behind it is still
`RoutineTask`, so nothing about the data changed. An old `?tab=habits` link
still lands on Habits; an old `?tab=routines` link now opens the section on
Habits rather than on cycles, one click away.

## The timer

The timer lives on the **dashboard**. There is no Timer tab: a session keeps
running wherever you go, and the navbar shows it.

- The countdown runs in `TimerProvider`
  (`src/components/timer/TimerProvider.jsx`), mounted once in the root
  layout, so moving to the planner, the notebook or the news does not
  interrupt it. `TimerControls` is only the panel; the dashboard and the
  `/timer` page both render it and both show the same session.
- A run is stored as timestamps (`src/lib/timerMachine.js`), not as a ticking
  number, so a reload picks it up where it was and a throttled background tab
  catches up the moment you come back to it.
- While a session is under way, `TimerBadge` sits in the navbar with the time
  left and leads back to the dashboard. It is the way back now that the tab
  is gone; `/timer` still opens directly and from the dashboard's timer card.
- The provider also owns what used to sit next to the countdown: the alarm,
  the notification when a phase ends, the automatic break, and writing the
  finished session to `/api/sessions`. A session is therefore saved even if
  the break ends while you are on another page.
- Pages say what the session is about with `setSessionContext()` (the project
  and what is being worked on). It is stored with the run, so a session that
  ends elsewhere is still attributed correctly, and work with no project
  saves as *Unassigned* rather than being refused.
- A run belongs to the account that started it and is dropped rather than
  resumed if it is more than twelve hours old, so the app never opens by
  alarming and saving a session from yesterday.

## Roles, plans and the admin page

Three roles, resolved on the server for every request and never taken from
the client: **admin** (the email in `ADMIN_EMAILS`, by default the owner's),
**premium** (an unexpired premium plan on the user record) and **free**
(everyone else). `GET /api/me` tells the browser which one it is.

- **Feature registry.** `src/lib/access/features.js` lists every gateable
  feature (timer, planner, habits, routines, notebook, business, analytics,
  the AI news briefing, ask-about-a-story, AI project planning, the AI quote
  finder) with
  its defaults; the admin's edits live in the `AccessConfig` document. The
  same registry drives the runtime gate, the pricing page and the admin
  table, so a toggle applies everywhere within seconds.
- **Gating happens twice.** In the UI a locked feature is drawn greyed out
  with a small lock that links to `/pricing` (`Locked`, `LockedScreen` in
  `src/components/access/Gate.jsx`); on the server the route answers 403
  with `{ code: "feature_locked" | "feature_disabled", feature }`. Session
  routes get the check from `requireUser()`, planner routes from
  `validateIdentityHeaders()`, both by looking up the feature behind the
  path; a route that needs more names it (`feature: "news_ask"`).
- **Admin only.** A feature that is enabled but ticked for neither plan is
  the admin's alone. Instead of a lock, everyone else simply does not have
  it: no menu entry, no row on the pricing page, the app's 404 page and a
  404 from its API, exactly like `/admin`. Previewing as Premium or Free
  hides it too. It is the way to ship a feature before releasing it.
- **Where they live.** Settings, the admin page and the view-as switcher are
  all under the user's own name in the navbar (`src/components/nav/UserMenu.jsx`),
  not in the main menu, which is for the app's screens. A **Pricing** button
  sits in the navbar for anyone not on Premium yet, signed in or not, and the
  welcome page carries its own link to the same page.
- **Admin page** at `/admin` (404 for anyone else): Connections (the report
  that used to sit under News > Settings; admins still see it there), Usage
  (requests and actions per day, active users, per-feature breakdown,
  OpenAI and MCP calls with an estimated cost, with today / 7 d / 30 d /
  custom ranges), Users (live count of sessions active in the last 15 min,
  search, filters, sort, change plan, revoke sessions) and Subscriptions
  (the feature table plus plan name, price, currency, interval and status).
- **View as.** The account menu switches between Admin, Preview as Premium
  and Preview as Free. The choice is stored on the admin's user record
  (`PUT /api/me/view-as`), applied server side after the real role is known,
  and can only lower privileges. While previewing, a banner with "Back to
  admin" stands above the page and the menu hides its own admin entry, so
  the preview looks like the real thing. `/admin` always checks the real
  role, so it stays reachable by URL during a preview.
- **Pricing** at `/pricing` is public and rendered from the registry: both
  plans, every enabled feature with a tick or a cross, and a disabled
  "Coming soon" button while the premium plan has that status. Give the
  premium plan a checkout link in the admin page once billing exists.
- **Usage tracking.** Every request that carries a user's identity and every
  OpenAI or MCP call is recorded in `UsageEvent` (six-month TTL), after the
  response, so a failed write never breaks a feature. OpenAI cost comes from
  a per-model price table (`OPENAI_PRICE_PER_M` overrides it); MCP calls are
  counted, and `MCP_COST_PER_CALL` prices them. `USAGE_TRACK_REQUESTS=off`
  stops the per-request rows and keeps the external ones.
- Scheduled briefings only run for users whose plan includes the briefing;
  a due cycle waits until it does.

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
