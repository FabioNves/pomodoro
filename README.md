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

The **Notebook** tab is a lightweight document editor for your notes:

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
