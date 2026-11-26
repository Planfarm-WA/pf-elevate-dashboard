# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Planfarm Elevate coaching dashboard, built and served by Vite:
- `index.html` has the markup. It's Vite's entry point and loads `src/styles.css` and `src/main.ts`.
- `src/styles.css` has all the styles. Many elements also carry inline `style="..."` attributes, in the markup and in JS template strings.
- `src/` holds the code as typed TypeScript ES modules. `src/main.ts` is the entry (`<script type="module">`) and runs once the page has been parsed. Lower layers never import higher ones, so there are no import cycles. Only `main.ts` does anything when it loads.

```
src/
  main.ts           entry: startApp(appModeFromEnv()); exports `ready` (the tests await it) and `actions`
  config.ts         appModeFromEnv(): local / Supabase / missing-config, from VITE_SUPABASE_* (see "Modes")
  app.ts            startApp(mode): backdrop listeners, installActions(), then the mode's startup; the merged `actions`
  session.ts        Supabase mode: login form, business list, open/switch/sign out, header save status, Who suggestions
  render.ts         renderAll(): every tab from `state`
  persistence.ts    the Persistence interface (load / changed / importData), usePersistence(), and save()
  storage.ts        localPersistence: the whole state as JSON in localStorage key pf_elevate_blank1
  supabase-persistence.ts  createSupabasePersistence(): load one business, sync changes (sync.ts), close() when it's left
  sync.ts           diff(lastSaved, next) → ops, and createSyncer(): debounce, apply, retry, save status, stop()
  rows.ts           stateToRows() / rowsToState(): `state` ⇄ one business's rows (Snapshot)
  backend.ts        Backend interface + supabaseBackend(db): auth, list/load businesses, apply ops, import
  supabase.ts       createDb(): the typed browser client (keeps the session in localStorage)
  env.d.ts          types for VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
  ids.ts            newId() (crypto.randomUUID), stringifyIds() for older numeric data
  actions.ts        event delegation: installActions(), mergeActions(), num(), str(), oneOf()
  types.ts          the saved data: State, Period120, Round30, Item, Session, Blueprint, ExportFile, …, plus STATUSES
  state.ts          `state`, the single shared object, and emptyState()
  dom.ts            byId<T>(): typed getElementById that throws "Missing element #id"
  html.ts           esc(): escapes text for the HTML template strings (see "How the page works")
  ui.ts             showToast(), playBing(), badgeFor()
  stats.ts          updateStats() (the hidden #stat-* divs)
  drag.ts           initDragTable(), initDragList(), isDragging(); a drop only counts when the drag started in the same table or list
  edit-modal.ts     the shared #edit-overlay: openEditModal(), saveEdit(), closeEditModal()
  navigation.ts     showSection() (nav tabs)
  io.ts             exportData(), importData()
  print.ts          printPeriod120(), printRound30(), printAll()
  sections/         one module per tab: blueprint.ts, issues.ts, periods120.ts, rounds30.ts, sessions.ts
  database.types.ts generated from the schema (`pnpm gen:types`); never edit by hand
  adapters.ts       parseExportFile() + exportToRows(): export JSON → table rows (pure, no DOM/network)
  importer.ts       importDashboard(): writes those rows to Supabase through supabase-js
scripts/
  import-dashboard.ts  `pnpm import-dashboard`: loads an export file into one business (runs in Node)
```

In Supabase mode the header's `<h1>` shows the open business's name, and the "Who" suggestions (`<datalist id="who-suggestions">`) are filled from the names used in that business. The `Client Name` and `Person A…` placeholders in `index.html` only show in local mode.

Commands:
- `pnpm dev`: dev server at `http://localhost:5173`, reloads on save.
- `pnpm build`: type-checks, then bundles into `dist/` (gitignored).
- `pnpm preview`: serves `dist/`.
- `pnpm typecheck`: `tsc` with `tsconfig.json` (`src/`, `tests/`, browser types), then `tsc -p scripts` (`scripts/` with Node types). It checks types and writes no files.
- `pnpm lint`: ESLint with typescript-eslint on `src/`, `tests/` and `scripts/`. The config is in `eslint.config.js`.
- `pnpm gen:types`: regenerates `src/database.types.ts` from the local Supabase schema. Run it after every migration, with the local stack up.
- `pnpm import-dashboard "<business name or id>" <file.json>`: see "Importing export files" below.
- `pnpm test`: Vitest.
  - `tests/adapters.test.ts`: the export → rows mapping, against `tests/fixtures/export-v3.json`.
  - `tests/rows.test.ts` and `tests/sync.test.ts`: the state ⇄ rows conversion, `diff()` and the syncer.
  - `tests/supabase-mode.test.ts`: login, the business list, saving, retrying, import and sign-out, against the in-memory `tests/fake-backend.ts`.
  - `tests/dashboard.test.ts`: the smoke tests in local mode (shared page helpers in `tests/helpers.ts`).

  The page tests They run in jsdom, a browser imitation in Node.js. Each test loads the `index.html` body, runs `src/main.ts` the way the browser does, then drives the page like a user. `act()` finds an element by its `data-click`/`data-input`/`data-change`/`data-submit` attribute and dispatches a real DOM event, which goes through the same delegated listener as in the browser. The tests check the page and the JSON saved in `localStorage`. They don't render anything: layout, real drag-and-drop, the print dialog and sound still need a browser.

There's no `vite.config.js`, because the defaults fit. Opening `index.html` straight from disk (`file://`) no longer works, because module scripts need a server. The only external resource is Google Fonts (DM Sans, Fraunces).

**TypeScript.** Vite strips types when it serves and bundles, but never checks them. Only `pnpm typecheck` and `pnpm build` do. `tsconfig.json` is `strict` and covers `src/` and `tests/`. Everything is fully typed: there's no `any` and no `@ts-nocheck`, and typescript-eslint's recommended rules reject both. Element lookups use `byId<T>()` where the element must exist, and plain `document.getElementById` plus a null check where it may be missing. Data parsed from JSON (`loadSaved`, `importData`) is cast to its type without validation, as before.

**TypeScript is pinned to `~6.0`.** typescript-eslint 8 only supports TypeScript `<6.1`. TypeScript 7, the native Go compiler, has no stable JavaScript API yet, and typescript-eslint issue #10940 tracks support for TS ≥ 7.1. Don't let `pnpm add`/`pnpm update` move `typescript` to 7 until that lands, or `pnpm lint` fails to start ("typescript-eslint does not support TS 7.0"). Upgrade the two together.

**Event handling (delegation).** No element has inline JavaScript. Elements name an action in an attribute, and pass the action's arguments in other `data-*` attributes:

```html
<button data-click="setStatus120" data-period-id="${periodId}" data-item-id="${p.id}" data-status="on-track">
```

- `data-click`, `data-input` or `data-change` says which event triggers the action. A click on the notes box never runs its input action.
- `installActions()` (`src/actions.ts`) adds **one listener per event type on `document`**. It finds `event.target.closest('[data-click]')` (and so on) and runs the named action with `(el, event)`.
- Each module exports an actions object next to the markup that uses it, for example `periods120Actions`. `main.ts` merges them with `mergeActions()`, which throws on a duplicate name.
- Installing twice only swaps the actions, so the tests (which re-run startup) and Vite reloads never run an action twice.

**To add a button:**
1. Give the element `data-click="myAction"`, plus `data-*` attributes for its arguments.
2. Add `myAction: (el) => myAction(num(el, 'periodId'))` to that module's actions. `num()` and `oneOf()` check the attribute and throw if it's wrong.

The "event delegation" tests fail if an attribute names an unregistered action, if an action is never used, or if an inline `on*="…"` attribute comes back.

The period and round tabs (`tab.onclick`/`tab.ondblclick`), drag-and-drop and the dialog backdrops attach their listeners in JS, which is fine because nothing is global.

**Modes** (`src/config.ts`, `src/app.ts`):

| Mode | When | What happens |
|---|---|---|
| **Supabase** | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set (not in tests) | Login form, then the business list (one business, or `?business=<id>`, opens directly), then the dashboard. Changes sync to Supabase |
| **Local** | Vitest (`MODE === 'test'`), or `pnpm dev` without the variables | No login. The whole state lives in `localStorage` (`storage.ts`), which is separate for each web address |
| **Missing config** | A production build without the variables, or (in any build) values supabase-js rejects, such as a URL without `https://` | A "Not connected" page, showing supabase-js's error when a value was rejected. It never quietly falls back to `localStorage` |

**Saving in Supabase mode** (`supabase-persistence.ts`, `sync.ts`, `rows.ts`). The sections still just change `state` and call `save()`.
- **Persistence.** `save()` hands the change to the active persistence. The Supabase one keeps `lastSaved`, the rows as last saved successfully. About 400 ms after the latest change, it compares `stateToRows(state)` with `lastSaved` in memory and writes only the differences through the `Backend`.
- **How the comparison works.** Tables with ids (periods, priorities, rounds, tasks, sessions) are matched by id: new ids are inserts, rows whose fields changed are updates, and ids that are gone are deletes. The lists without ids (values, 3-year items, 1-year targets, issues, both queues) are replaced as a whole when they differ.
- **Op order:** the blueprint, the lists, deletes (children first), periods and rounds turning `is_current` off, then those turning it on (the "one current per business" index), then priorities and tasks, then sessions.
- **Failures.** A failure keeps `lastSaved` and retries with a growing wait. Every op can be repeated safely, so a partial write still converges.
- **What the user sees.** The header shows "Saving…" / "Saved hh:mm" / "Not saved — retrying", and `beforeunload` warns while anything is pending.
- **Leaving a business.**
  - Switch business and Sign out ask "Leave anyway?" while anything is pending. `pending()` also counts an import that's still running.
  - They then call `closeOpenBusiness()` (`session.ts`). The persistence's `close()` stops its syncer for good with `stop()`, and unsaved changes are dropped.
  - Without that, a retry would later compare `state` (by then another business, or nothing) with the old business's saved rows, and write the difference into the old business.
  - A closed persistence's `load()` leaves `state` alone, for example when an import finishes after the user left.
- **What's out of scope.** Two people editing the same row: the last write wins. There are no live updates (Realtime).
- **Ids.** Ids are UUID strings from `newId()`, the same in the app and the database. Older saves and export files with numeric ids are converted by `stringifyIds()`.

`package.json` (pnpm) has one runtime dependency, `@supabase/supabase-js`, which is bundled into the page (about 280 kB, 72 kB gzipped). The rest is dev tooling: Vite, TypeScript, ESLint (with typescript-eslint), Vitest with jsdom, tsx (this Ubuntu Node build can't run `.ts` files itself), `@types/node`, and the Supabase CLI. Run the Supabase CLI as `pnpm supabase <command>`, not bare `supabase`. pnpm blocks dependencies' install scripts unless `pnpm-workspace.yaml` (`allowBuilds`) allows them. esbuild's is set to `false`, because tsx works without it. A new dependency with an install script makes `pnpm add` fail with `ERR_PNPM_IGNORED_BUILDS` until it's listed there.

`supabase/migrations/` holds the database schema. It's applied on the hosted project, and the deployed app reads and writes it.

## How the page works

- **One shared `state` object** (`src/state.ts`: `periods120`, `rounds`, `sessions`, `blueprint`, `pendingPushes`, `pendingPushes120`, `lastUpdated`). Modules import it and change its properties. An imported binding can't be reassigned, but its properties can. Every change follows the same pattern: change `state`, call `save()` (`src/persistence.ts`, which hands the change to the active persistence: see "Saving in Supabase mode"), then call the render function for that section.
- **Render functions rebuild `innerHTML` from `state`:** `renderBlueprint`, `renderOneYearTargets`, `renderThreeYearTargets`, `render120Periods` / `renderPeriodPriorities`, `render30` / `renderRoundTasks`, `renderSessions`, `renderIssues`. `showSection()` re-renders a tab when it is opened.
- **Variables used by only one area stay private to its module**, for example `currentSessionId` in `sessions.ts`, `currentBpSection` in `blueprint.ts`, and `dragSrc` in `drag.ts`.
- **IDs are UUID strings** (`newId()`). They travel as `data-*` attributes (see "Event handling" above) and are read back with `str()`. `num()` is for numbers such as list positions (`data-idx`) and dialog row numbers.
- **Text in template strings goes through `esc()`** (`src/html.ts`). This covers every value from `state`, the database or a form input that goes into an HTML string set with `innerHTML`: element text, quoted attributes (`value`, `id`, `data-*`) and textarea content.
  - Without it, a `<` or `"` becomes part of the page. It cuts a field short in an edit dialog, or adds elements and event handlers that run code for everyone who opens the business.
  - Escape after splitting text, never before. `badgeFor()` splits the raw "Who" on `/ , &`, then escapes each name.
  - Text set through DOM properties (`textContent`, `.value`, `dataset`, as in `session.ts`) needs nothing.
  - The "user text" tests in `tests/dashboard.test.ts` put HTML characters into every field and check that each shows and saves back unchanged. A new field shown on the page belongs in that fixture.
- **Shared modals.** `#edit-overlay` serves many item types: adding, editing and renaming priorities, tasks, periods, rounds and 1-year targets.
  - Each opener calls `openEditModal(title, fieldsHtml, onSave)` (`src/edit-modal.ts`) and passes its own save logic.
  - `saveEdit()` reads `#ef-what` (always present) and `#ef-who`/`#ef-when` (`''` when absent). It does nothing while "what" is empty, otherwise runs `onSave` and closes the dialog.
  - Blueprint text sections use `#bp-edit-overlay` with `currentBpSection`, and sessions have their own modal.
- **The latest period/round is the active one** (last array element). `current` is set when a period or round is created.
- **Status buttons toggle:** clicking the active status sets it back to `'none'`. Values are `none | on-track | off-track | complete`. Completing an item plays `playBing()`.
- **Carry-over ("Push →"):** `pushTask` / `pushPriority120` set `pushed: true` and copy the item into the next round/period with `carriedFrom: <label>`. If there is no next one yet, the item is queued in `pendingPushes` / `pendingPushes120`, and `createRound` / `createPeriod120` empty that queue into the new round or period.
- **Odd blueprint storage:**
  - `threeyear` is one string split on blank lines. Completion is tracked by index in `threeyearDone`, which is reset whenever the text is edited.
  - `issues` are strings. An `OPPORTUNITY: ` prefix marks an opportunity.
  - `oneyear` used to be strings and is now `{text, done}`. `migrateOneYear()` converts old data and must run before `oneyear` is used.
- **`updateStats()` writes to hidden `#stat-*` divs.** The stats row was removed but these elements must stay, or the function throws.
- **Printing.** `printPeriod120` / `printRound30` add `print-target` and `body.printing-single` for the `@media print` rules, and inject temporary status labels with `addPrintStatusSpans()`.
- **Not persisted or unused:**
  - The "Session Notes" card (`addNote()`) only writes to the page and is never saved.
  - `periods120[].oneyear` (targets entered in the New Period modal) is saved but never displayed.

## Export / import format

`exportData()` downloads `planfarm-elevate-dashboard-YYYY-MM-DD.json` with `version: 3` and the state keys above. `importData()` accepts any file that has `version` and `blueprint`, and replaces the whole state. Clients already have these files, so changes to the state shape must still import older exports.

## Supabase schema (`supabase/migrations/`)

Supabase CLI migrations. `000_initial_schema.sql` creates everything, wrapped in a single transaction. Apply with `pnpm supabase db push`, which records each migration as applied. `supabase/config.toml` (from `supabase init`) is the CLI's project config; a new checkout only needs `pnpm install` and `pnpm supabase link --project-ref <ref>`.

- **Migrations:** until the initial migration has been run on the real project, edit it in place. After that, never edit an applied migration. Put each change in a new file (`pnpm supabase migration new <name>`).

- **Naming:** a farm business is a row in `businesses`; a "client" is a login that belongs to a business (a row in `clients`, linking `business_id` to `auth.users`). In `index.html` and the README's per-copy setup, "client" still means the farm itself.
- **Structure:** everything belongs to a business via `business_id`. Most tables reference `businesses (id)`. The Blueprint lists (`core_values`, `three_year_items`, `one_year_targets`) reference `blueprints (business_id)` instead, so deleting a blueprint clears them. `issues` stays under `businesses`, because it has its own tab. The `create_blueprint` trigger inserts an empty `blueprints` row for each new business, so list inserts never lack a parent: update the blueprint, never insert one. Each JSON list becomes a table with a `sort_order` column.
- **Differences from the JSON export:**
  - `when` → `by_when` (`WHEN` is reserved in SQL).
  - `threeyear` + `threeyearDone` → `three_year_items` rows.
  - The `OPPORTUNITY:` prefix → `issues.kind` (`issue_kind` enum).
  - `status` → `item_status` enum.
  - Free-text dates (`by_when`, `period`, `session_date`) stay `text`, because the app accepts "TBC".
  - A partial unique index on `is_current` allows one current period/round per business.
- **Access (RLS).** `staff` rows can access every business. `clients` rows can read **and edit** their own business(es). Edit access was confirmed on 2026-11-25. View-only would mean splitting the `"Business access"` policies into separate select and write policies. `anon` gets nothing. The checks are the `security definer` helpers `is_staff()` and `can_access_business(business_id)`. `priorities_120` and `tasks_30` have no `business_id` and resolve it through their parent period/round.
- **Adding a table:** enable RLS, add a `can_access_business` policy, add it to the `revoke all ... from anon, authenticated` list (Supabase's defaults grant both roles everything, including `TRUNCATE`, which bypasses RLS) and to the `grant select, insert, update, delete ... to authenticated` list, and add the `set_updated_at` trigger if the table has `updated_at`.

To check schema changes without a Supabase project, run the script against a throwaway local Postgres. First create a stub of what Supabase provides:

```sql
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
```

Then run each migration in order, e.g. `psql -v ON_ERROR_STOP=1 -f supabase/migrations/000_initial_schema.sql`. To test RLS as a user, use `set role authenticated; set request.jwt.claim.sub = '<user uuid>';`.

### Importing export files (`pnpm import-dashboard`)

`scripts/import-dashboard.ts` loads one export file into one business. The README has the commands for users.

- **Sign-in and access.** It signs in with a staff login (`PF_STAFF_EMAIL` / `PF_STAFF_PASSWORD`) through supabase-js (`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, the same names the app will use). RLS applies: staff can import into any business, a client only into their own.
- **Finding the business.** By exact name (it must match exactly one) or by id.
- **Order of work.** `parseExportFile()` checks the whole file first, so a bad file changes nothing. `importDashboard()` then writes table by table.
- **No transaction.** supabase-js sends each insert and delete as its own request, so a failure midway leaves a partial import. The script then says which table it stopped at. Re-running fixes it, because an import replaces data.
- **What's replaced** matches the app's `importData()`: the blueprint and its lists always; `periods120`, `rounds` and `sessions` only if the file has them (otherwise kept); both queues always.
- **Mapping rules** (`exportToRows()` in `src/adapters.ts`):
  - The 3-year text is split on blank lines, trimmed, and empty items dropped *before* `threeyearDone` is indexed, matching `renderThreeYearTargets()`.
  - The `OPPORTUNITY:` prefix becomes `issues.kind` and is removed from the text.
  - `is_current` goes only on the *last* period or round marked current, because the unique index allows one per business.
  - The queues get `created_at` 1 ms apart to keep their order.
  - The JSON's numeric ids are dropped, and array position becomes `sort_order`.

## To-do

**Done:**
- The schema (`000_initial_schema.sql`) is applied on the hosted Supabase project, with a staff user, and client export files load with `pnpm import-dashboard`.
- The app logs in and syncs to Supabase (the "Saving in Supabase mode" section above).
- The Supabase switch was checked on 2026-11-26 on branch `supabase-schema` (pushed): first locally against the local Supabase, then on the branch's Vercel preview against the hosted project.
- Settings:
  - Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production and Preview.
  - The Vercel project builds with Vite: install `pnpm install`, build `vite build`, output `dist`.
  - Supabase Auth has "Allow new users to sign up" turned off, because staff create the logins.
- Leaving a business stops its saving, so a retry can't write another business's data into it (the "Leaving a business" bullet above).
- User text is escaped before it goes into HTML (`esc()`, see "How the page works").

**Still to do,** roughly in order. Production (`main`) still serves the old single-file site until the merge, the last item.

1. **Per-business sign-up links**, so clients set their own password. This needs:
   - an `invites` table plus a `security definer` function that links the new login to the business;
   - a join page, and public sign-up turned back on;
   - email sending (SMTP, e.g. Resend or Postmark) set up in Supabase Auth, together with a "forgot password" flow.
2. **An admin screen for staff:** create businesses and see or remove client links. Creating logins needs the service-role key, so it must happen server-side (an Edge Function), never in the browser.
3. **Session Notes card** (`addNote()`): either save the notes (which needs a table) or remove the card.
4. **`periods120[].oneyear`:** either show it on the period panel or stop collecting it.
5. **Maybe live updates** (Supabase Realtime), so a change on one device shows up on another without reloading. Today the last write wins per row.
6. **Merge `supabase-schema` into `main` (production).** Clients' current data is in their own browsers on the old site, so first:
   - give every client a login (README "Adding a client (staff)");
   - import each client's export file with `pnpm import-dashboard`.

   Then merge. After the merge, the old site's browser data is no longer used.

   **Don't redeploy `main` before the merge.** The Vercel project now builds with Vite, and `main` has only the old `index.html`, so the build would fail.
