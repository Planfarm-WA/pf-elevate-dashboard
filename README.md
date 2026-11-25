# Planfarm Elevate – Coaching Dashboard

A one-page dashboard used in Planfarm Elevate coaching to keep a farm client's plan in one place and review progress at each coaching session.

| Tab | What it holds |
|---|---|
| 🗺 Farm Blueprint | 10-Year Direction, 3-Year Picture, Core Values, 1-Year Targets, Purpose |
| ⚡ 120-Day Priorities | One tab per 120-day period, each with its priority actions |
| ✅ 30-Day To-Do's | One tab per monthly round, each with its tasks and coaching notes |
| ⚠️ Issues & Opportunities | What's on the radar right now |
| 📋 Coaching Sessions | Upcoming and completed sessions |

Priorities and tasks have a status (On Track / Off Track / Complete), an owner and a due date. Rows can be dragged to reorder them.

## Using it

The dashboard runs through [Vite](https://vite.dev), so it needs [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io). From the repository folder:

```sh
pnpm install   # first time only
pnpm dev       # then open http://localhost:5173
```

`pnpm build` creates a `dist/` folder for hosting. Vercel is planned. Opening `index.html` straight from disk no longer works.

Checks for developers: `pnpm test` runs the smoke tests, `pnpm lint` runs ESLint, and `pnpm typecheck` runs TypeScript.

**Saving.** Changes save automatically in the browser you're using. They are not shared with anyone else, and don't move to another computer or browser by themselves. Clearing the browser's site data deletes them. The browser also keeps data separately for each web address. Data from an older copy you opened as a file, or from a different address, won't appear here until you move it with Export and Import.

**Backing up and moving data.**
- **Export Data** downloads a `planfarm-elevate-dashboard-YYYY-MM-DD.json` file. Keep it as a backup, or use it to open the dashboard on another computer.
- **Import Data** loads one of those files. It **replaces everything** currently in the dashboard.

**Carrying work forward.** "Push →" on an unfinished priority or task copies it into the next period or round. If that doesn't exist yet, the item is added automatically when you create it.

**Printing.** 🖨 Print in the header prints the whole dashboard. The Print button on a period or round prints just that one.

**Known gap.** Notes typed into the *Session Notes* card are not saved. Use the coaching notes box on each 30-day round, or the Notes field on a session, instead.

### Setting up for a new client

The plan is one hosted dashboard for every client business, with logins and data in Supabase (see below), so there won't be a copy per client.

Until that's live, a copy that opens straight from disk can be made from commit `4e83369`, the last file-based version:

```sh
mkdir ../client-copy && git archive 4e83369 index.html css js | tar -x -C ../client-copy
```

In the copy, replace `Client Name` in the header of `index.html` with the client's name, and the placeholder names in the "Who" suggestions (`Person A`, `Person B`, …) near the end of the file. The browser stores data under a fixed name (`pf_elevate_blank1`, set in `js/app.js`), so copies opened from the same place share it. Give each client's copy its own storage name if one browser is used for several clients.

## Supabase database (in progress)

The dashboard is moving from browser storage to Supabase, so data is shared and backed up centrally. The files in `supabase/migrations/` create the tables. **The dashboard does not use them yet.**

### Creating the tables

1. Apply the migrations with the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), which is installed as a project dependency (needs [pnpm](https://pnpm.io)). From the repository folder, the first time only:
   ```sh
   pnpm install                                    # installs the Supabase CLI
   pnpm supabase link --project-ref <project-ref>  # the ID in your project's URL
   ```
   Then, whenever there are new migrations:
   ```sh
   pnpm supabase db push
   ```
   You can also paste a migration into the **SQL Editor** and click **Run**, but the CLI won't record it as applied.
2. Create your own login under **Authentication → Users**.
3. Make yourself staff by running this in the SQL Editor, with your email:
   ```sql
   insert into public.staff (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
4. To give a client login access to their farm business, create the login, then run:
   ```sql
   insert into public.clients (business_id, user_id)
   select b.id, u.id
   from public.businesses b, auth.users u
   where b.name = 'Business Name' and u.email = 'client@example.com';
   ```

### Who can see what

- **Staff** (listed in `staff`) can see and edit every business.
- **Clients** (logins listed in `clients`) can see and edit only their own farm business. They can't add businesses or change who has access.
- **People not logged in** can't see anything.

### Tables

| Dashboard area | Tables |
|---|---|
| Businesses and access | `businesses`, `staff`, `clients` |
| Farm Blueprint | `blueprints`, `core_values`, `three_year_items`, `one_year_targets`, `issues` |
| 120-Day Priorities | `periods_120`, `priorities_120`, `pending_priorities_120` |
| 30-Day To-Do's | `rounds_30`, `tasks_30`, `pending_tasks_30` |
| Coaching Sessions | `coaching_sessions` |

Dates such as "By When" are stored as text, because the dashboard accepts entries like "TBC" or "Jun 2026". The export's `when` field is called `by_when` in the database.

### Importing a client's export file

A client's `planfarm-elevate-dashboard-YYYY-MM-DD.json` file can be loaded into their business in the database. First create the business, and add the client's login if they need one (see "Creating the tables" above). Then, from the repository folder:

```sh
export VITE_SUPABASE_URL=https://<project-ref>.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>   # Supabase: Project Settings → API Keys
export PF_STAFF_EMAIL=you@example.com                    # your staff login
read -s PF_STAFF_PASSWORD && export PF_STAFF_PASSWORD    # type your password; it isn't shown

pnpm import-dashboard "ABC Holdings" ~/Downloads/planfarm-elevate-dashboard-2026-05-01.json
```

- **Choosing the business.** Use its exact name, or its id if two businesses share a name.
- **What the import does:**
  - It **replaces** that business's dashboard with the file's contents, just like Import Data in the dashboard.
  - It checks the whole file first. If something in the file is wrong, nothing is changed and the message says which field to fix.
- **If it stops halfway** (for example the connection drops), the message says where. Run the same command again: it replaces everything, so a second run finishes the job.
- **Who can import where.** Staff can import into any business. A client login can only import into its own business.

### Still to do

- Changing the dashboard to read and save through Supabase instead of the browser.

## Repository layout

```
index.html            The dashboard page (markup); Vite's entry point
src/styles.css        Styles for the page
src/main.ts           The code's entry point: loads the data and draws every tab
src/sections/         One module per tab (blueprint, issues, 120-day, 30-day, sessions)
src/*.ts              Shared modules: data types and state, saving, dialogs, export/import, printing,
                      and the export → database import (adapters.ts, importer.ts)
scripts/              Command-line tools run with Node (`pnpm import-dashboard`)
tests/                Tests (`pnpm test`): smoke tests in a simulated browser, and the import mapping
tsconfig.json         TypeScript settings (`pnpm typecheck`)
eslint.config.js      Lint rules (`pnpm lint`)
supabase/migrations/  Database tables and access rules for Supabase (CLI migrations)
CLAUDE.md             Notes for Claude Code when working on this repository
```
