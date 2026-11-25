# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Planfarm Elevate coaching dashboard: a single static page, `index.html`, holding the CSS (`<style>`), the markup and all the JavaScript (one `<script>` at the end). It is a blank per-client template: the header `<h1>Client Name</h1>` and the "Who" suggestions (`<datalist id="who-suggestions">`) are placeholders edited for each client.

There is no build step, package manager, linter or test suite. To run it, open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open it there. The only external resource is Google Fonts (DM Sans, Fraunces).

`supabase/schema.sql` is the planned database schema. **The app does not use Supabase yet.** It still reads and writes `localStorage` only.

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

## Supabase schema (`supabase/schema.sql`)

One script, run in the Supabase SQL Editor, wrapped in a single transaction.

- **Naming:** a farm business is a row in `businesses`; a "client" is a login that belongs to a business (a row in `clients`, linking `business_id` to `auth.users`). In `index.html` and the README's per-copy setup, "client" still means the farm itself.
- **Structure:** everything belongs to `businesses` via `business_id`. Each JSON list becomes a table with a `sort_order` column.
- **Differences from the JSON export:**
  - `when` → `by_when` (`WHEN` is reserved in SQL).
  - `threeyear` + `threeyearDone` → `three_year_items` rows.
  - The `OPPORTUNITY:` prefix → `issues.kind` (`issue_kind` enum).
  - `status` → `item_status` enum.
  - Free-text dates (`by_when`, `period`, `session_date`) stay `text`, because the app accepts "TBC".
  - A partial unique index on `is_current` allows one current period/round per business.
- **Access (RLS).** `staff` rows can access every business. `clients` rows can access their own business(es). `anon` gets nothing. The checks are the `security definer` helpers `is_staff()` and `can_access_business(business_id)`. `priorities_120` and `tasks_30` have no `business_id` and resolve it through their parent period/round.
- **Adding a table:** enable RLS, add a `can_access_business` policy, grant to `authenticated`, revoke from `anon`, and add the `set_updated_at` trigger if the table has `updated_at`.

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

Then run `psql -v ON_ERROR_STOP=1 -f supabase/schema.sql`. To test RLS as a user, use `set role authenticated; set request.jwt.claim.sub = '<user uuid>';`.

## To-do

Roughly in order. The schema has been reviewed but not yet run on the real Supabase project.

1. **Run the schema on Supabase** and add the first staff user (snippet at the bottom of `schema.sql`). Adjust the tables after reviewing them in the table editor.
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
4. **Escape user text** before it goes into `innerHTML` and `value="..."` attributes.
5. **Session Notes card** (`addNote()`): either save the notes (which needs a table) or remove the card.
6. **`periods120[].oneyear`:** either show it on the period panel or stop collecting it.
7. **Decide whether clients can edit or only view.** The current RLS lets them edit. Making them view-only means splitting the `"Business access"` policies into separate select and write policies.
