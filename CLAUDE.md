# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Planfarm Elevate coaching dashboard: a static page in three files:
- `index.html` has the markup.
- `css/styles.css` has all the styles. Many elements also carry inline `style="..."` attributes, in the markup and in JS template strings.
- `js/app.js` has all the JavaScript. It's loaded with a plain `<script src>` near the end of `<body>` and runs immediately.

It is a blank per-client template: the header `<h1>Client Name</h1>` and the "Who" suggestions (`<datalist id="who-suggestions">`) in `index.html` are placeholders edited for each client.

**`js/app.js` is a classic script, not an ES module.** The inline `onclick`/`onchange`/... handlers, in `index.html` and in template strings in `app.js`, call its top-level functions by name, so those must stay global. Don't add `type="module"`, and don't wrap the file in a function, until the handlers are replaced with `addEventListener`. A classic script also keeps opening `index.html` straight from disk (`file://`) working.

The page has no build step or test suite. `pnpm lint` runs ESLint on `js/` (config in `eslint.config.js`). To run it, open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open it there. The only external resource is Google Fonts (DM Sans, Fraunces).

`package.json` (pnpm) holds dev tooling only: the Supabase CLI and ESLint. Run the Supabase CLI as `pnpm supabase <command>`, not bare `supabase`. The page itself uses no npm packages.

`supabase/migrations/` holds the planned database schema. **The app does not use Supabase yet.** It still reads and writes `localStorage` only.

## How the page works

- **Single global `state` object** (`periods120`, `rounds`, `sessions`, `blueprint`, `pendingPushes`, `pendingPushes120`, `lastUpdated`). Every change follows the same pattern: mutate `state`, call `save()` (which writes the whole object to `localStorage` key `pf_elevate_blank1` and stamps `lastUpdated`), then call the render function for that section.
- **Render functions rebuild `innerHTML` from `state`:** `renderBlueprint`, `renderOneYearTargets`, `renderThreeYearTargets`, `render120Periods` / `renderPeriodPriorities`, `render30` / `renderRoundTasks`, `renderSessions`, `renderIssues`. `showSection()` re-renders a tab when it is opened.
- **Event handling is inline `onclick="fn(${id})"` in template strings.** IDs are interpolated **unquoted**, so they must stay numeric. Periods and rounds use `Date.now()`; priorities and tasks use `Math.max(...ids)+1` within their parent. Moving to Supabase UUIDs means quoting these arguments everywhere.
- **User text goes into `innerHTML` and `value="..."` attributes without escaping.** A quote or `<` in user input can break the edit forms.
- **Shared modals.** `#edit-overlay` serves many item types: `editCtx.type` (`'120'`, `'120-new'`, `'30'`, `'30-new'`, `'rename-round'`, `'rename-period120'`, `'oneyear-new'`, `'oneyear-edit'`) picks the branch in `saveEdit()`. Blueprint text sections use `#bp-edit-overlay` with `currentBpSection`. Sessions have their own modal.
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
  - `WHO_OPTIONS` is unused.

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
- **Access (RLS).** `staff` rows can access every business. `clients` rows can access their own business(es). `anon` gets nothing. The checks are the `security definer` helpers `is_staff()` and `can_access_business(business_id)`. `priorities_120` and `tasks_30` have no `business_id` and resolve it through their parent period/round.
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

## To-do

Roughly in order. The schema has been reviewed but not yet run on the real Supabase project.

1. **Run the schema on Supabase** with `pnpm supabase db push` and add the first staff user (snippet at the bottom of the initial migration). Adjust the tables after reviewing them in the table editor.
2. **Import existing JSON exports** into the tables, e.g. a SQL function `import_dashboard(business_id uuid, data jsonb)`. The import has to map:
   - `threeyear`: split on blank lines, with `done` taken from `threeyearDone[index]`.
   - `issues`: an `OPPORTUNITY: ` prefix becomes `kind = 'opportunity'`.
   - `oneyear`: items can be plain strings or `{text, done}`.
   - `when` → `by_when`; `current` → `is_current`; `date` → `session_date`.
   - `carriedFrom` → `carried_from`; `fromRound` / `fromPeriod` → `from_round` / `from_period`.
   - Array position → `sort_order`.
3. **Switch the app to Supabase.**
   - Add supabase-js and a login screen (staff or client).
   - Load one business's data.
   - Replace the whole-state `save()` with row-level inserts, updates and deletes.
   - Quote the IDs in every inline `onclick="fn(${id})"`, because UUIDs aren't numbers.
   - Keep Export/Import working as a backup.
   - Consider moving `js/app.js` to ES modules at the same time, maybe with Vite. That means replacing the inline handlers with `addEventListener`, which this step rewrites anyway. Login also means serving over HTTP, so losing `file://` no longer matters.
4. **Escape user text** before it goes into `innerHTML` and `value="..."` attributes.
5. **Session Notes card** (`addNote()`): either save the notes (which needs a table) or remove the card.
6. **`periods120[].oneyear`:** either show it on the period panel or stop collecting it.
7. **Decide whether clients can edit or only view.** The current RLS lets them edit. Making them view-only means splitting the `"Business access"` policies into separate select and write policies.
