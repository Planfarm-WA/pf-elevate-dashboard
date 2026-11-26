# Planfarm Elevate – Coaching Dashboard

A one-page dashboard used in Planfarm Elevate coaching to keep a farm client's plan in one place and review progress at each coaching session.

| Tab | What it holds |
|---|---|
| 🗺 Farm Blueprint | 10-Year Direction, 3-Year Picture, Core Values, 1-Year Targets, Purpose |
| ⚡ 120-Day Priorities | One tab per 120-day period, each with its Period Targets and priority actions |
| ✅ 30-Day To-Do's | One tab per monthly round, each with its tasks and coaching notes |
| ⚠️ Issues & Opportunities | What's on the radar right now |
| 📋 Coaching Sessions | Upcoming and completed sessions |

Priorities and tasks have a status (On Track / Off Track / Complete), an owner and a due date. Rows can be dragged to reorder them. Double-click a period's or round's tab to edit it; for a period that includes its Period Targets.

## Using it

**Logging in.** Open the dashboard's web address and log in with the email and password Planfarm gave you.
- **Clients** go straight into their farm's dashboard.
- **Staff** see a list of businesses and pick one, or go to **Manage businesses** (see "Adding a client" below). **Switch business** in the header goes back to the list. A link with `?business=…` at the end opens that business directly.
- **Sign out** is in the header.

**Saving.** Every change saves itself to the database, so there's no Save button. Everyone who opens the business sees the same data, on any computer or phone. The header shows the save status:
- **Saving…** while a change is on its way.
- **Saved 14:32** once it's in the database.
- **Not saved — retrying** if the connection dropped. Keep the page open and it tries again by itself. Closing the tab, **Switch business** or **Sign out** while something isn't saved yet asks first. If you leave anyway, that change is lost.

Changes made on another device show up as soon as you come back to the tab, or within a minute. The page waits while you're in a dialog, typing in a box, dragging, or while a change of yours is still saving. If the business you have open is deleted, or your access to it is removed, you're taken back to the list. If two people edit the *same* item at the same moment, the last change wins.

**Backing up and moving data.**
- **Export Data** downloads a `planfarm-elevate-dashboard-YYYY-MM-DD.json` file of the open business. Keep it as a backup.
- **Import Data** loads one of those files into the open business. It **replaces** that business's dashboard.

**Carrying work forward.** "Push →" on an unfinished priority or task copies it into the next period or round. If that doesn't exist yet, the item is added automatically when you create it.

**Printing.** 🖨 Print in the header prints the whole dashboard. The Print button on a period or round prints just that one.

**Notes** go in the coaching notes box on each 30-day round, or in a session's Notes field (✏️ Edit on the session).

### Adding a client (staff)

1. **Create their login** in Supabase under **Authentication → Users → Add user**. Enter their email and a password, and tick **Auto Confirm User**. Send them the password safely, for example by phone or text, not in the same email as the address.
2. **Add their business and link the login** in the dashboard: on the business list, click **Manage businesses**.
   - Type the business name under **Add business**.
   - Under the new business, type the client's email and click **Link login**. Letter case doesn't matter. If no login has that email yet, it says so: go back to step 1.
3. **Load their old dashboard file**, if they have one. Open the business in the dashboard and use **Import Data**, or see "Importing a client's export file" below.

**Manage businesses** also:
- **renames** a business;
- **removes** a login from a business. It asks first, and the login itself stays. To stop someone logging in at all, delete their user in Supabase under Authentication → Users;
- **deletes** a business (under "Delete business…", type its name to confirm). This deletes its whole dashboard and can't be undone, so export its data first if it might be needed.

Two businesses can't have the same name, so `pnpm import-dashboard "<name>"` always knows which one you mean.

Sign-up links per business, so clients can set their own password, are planned. So is a "forgot password" email.

## Running it on your computer (developers)

The dashboard is built with [Vite](https://vite.dev), so it needs [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io). From the repository folder:

```sh
pnpm install   # first time only
pnpm dev       # then open http://localhost:5173
```

**Which data it uses** depends on two environment variables:
- **Without them,** `pnpm dev` runs in **local mode**: no login, and the data stays in that browser only, like the old file-based dashboard.
- **With them,** it logs in to Supabase. To work against the **local** Supabase (in Docker, with throwaway data):
  ```sh
  pnpm supabase start
  pnpm supabase status                 # shows the local API URL and publishable key
  export VITE_SUPABASE_URL=http://127.0.0.1:54321
  export VITE_SUPABASE_PUBLISHABLE_KEY=<the local publishable key>
  pnpm dev
  ```
  The hosted project's values work too, but then you're editing real client data.
- **`pnpm dev` also reads `VITE_SUPABASE_*` from `.env`.** If it holds the hosted project's values, `pnpm dev` works on real client data. Export the local values in the terminal to override them.

`pnpm build` creates the `dist/` folder that Vercel serves. Opening `index.html` straight from disk doesn't work.

Checks for developers: `pnpm test` runs the tests, `pnpm lint` runs ESLint, and `pnpm typecheck` runs TypeScript.

## Supabase database

The dashboard keeps its data in Supabase, so it's shared and backed up centrally. The files in `supabase/migrations/` create the tables.

### Creating the tables

1. Apply the migrations with the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), which is installed as a project dependency (needs [pnpm](https://pnpm.io)). From the repository folder, the first time only:
   ```sh
   pnpm install                                    # installs the Supabase CLI
   pnpm supabase link --project-ref <project-ref>  # the ID in your project's URL
   ```
   Then, whenever there are new migrations:
   ```sh
   pnpm supabase migration list --remote          # what the project already has
   pnpm supabase db push --remote --dry-run       # what would be applied
   pnpm supabase db push --remote
   ```
   **Don't leave out `--remote`.** Without it, the CLI (version 3) applies the migrations to the local Supabase on your computer instead.

   You can also paste a migration into the **SQL Editor** and click **Run**, but the CLI won't record it as applied. If you did that, record it before the next push: `pnpm supabase migration repair <version> --status applied --remote`, where the version is the number at the start of the file name, e.g. `000`.
2. Create your own login under **Authentication → Users**.
3. Make yourself staff by running this in the SQL Editor, with your email:
   ```sql
   insert into public.staff (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
4. Add businesses and client logins from the dashboard, as in "Adding a client (staff)" above.

### Who can see what

- **Staff** (listed in `staff`) can see and edit every business. They can also add, rename and delete businesses, and link logins to them or remove them (Manage businesses). Logins themselves are created only in Supabase.
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

A client's `planfarm-elevate-dashboard-YYYY-MM-DD.json` file can be loaded into their business in the database. First add the business, and link the client's login if they need one (see "Adding a client (staff)" above).

The script reads its settings from a `.env` file in the repository folder. Git ignores that file,
so the password never reaches the repository. Create it once:

```sh
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>   # Supabase: Project Settings → API Keys
PF_STAFF_EMAIL=you@example.com                    # your staff login
PF_STAFF_PASSWORD=<your password>
```

Then, from the repository folder:

```sh
pnpm import-dashboard "ABC Holdings" ~/Downloads/planfarm-elevate-dashboard-2026-05-01.json
```

The script won't start without the file. Variables exported in the terminal override its values.

- **Choosing the business.** Use its exact name, or its id if two businesses share a name.
- **What the import does:**
  - It **replaces** that business's dashboard with the file's contents, just like Import Data in the dashboard.
  - It checks the whole file first. If something in the file is wrong, nothing is changed and the message says which field to fix.
- **If it stops halfway** (for example the connection drops), the message says where. Run the same command again: it replaces everything, so a second run finishes the job.
- **Who can import where.** Staff can import into any business. A client login can only import into its own business.

### Deploying (Vercel)

The site is deployed on Vercel from the `main` branch. Every other pushed branch gets its own preview address.
- **Vercel → Settings → Environment Variables** needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for both Production and Preview. Without them, the page shows "Not connected" instead of quietly using browser storage. With a value Supabase rejects (for example a URL without `https://`), it shows "Not connected" with the error. Vite builds these values into the page, so redeploy after changing them.
- **Supabase → Authentication → Sign In / Providers:** keep **Email** on, and turn **"Allow new users to sign up"** off, because logins are created by staff.

### Still to do

- Sign-up links per business, plus email sending (SMTP) and "forgot password". Creating logins from the dashboard needs these too.
- Possibly instant updates (Supabase Realtime), so another device's change shows up within a second rather than a minute.

## Repository layout

```
index.html            The dashboard page (markup); Vite's entry point
src/styles.css        Styles for the page
src/main.ts           The code's entry point: picks the mode (local or Supabase) and starts the app
src/sections/         One module per tab (blueprint, issues, 120-day, 30-day, sessions)
src/*.ts              Shared modules: data types and state, login and businesses, saving (local or
                      Supabase sync), dialogs, export/import, printing, and the export → database import
scripts/              Command-line tools run with Node (`pnpm import-dashboard`)
tests/                Tests (`pnpm test`): the page in a simulated browser (local and Supabase mode,
                      against an in-memory backend), the import mapping, and the sync
tsconfig.json         TypeScript settings (`pnpm typecheck`)
eslint.config.js      Lint rules (`pnpm lint`)
supabase/migrations/  Database tables and access rules for Supabase (CLI migrations, numbered 000, 001, …)
supabase/checks/      SQL checks of the access rules, run against the local Supabase
archive/              Removed features kept for reference, with how to bring them back (not built)
CLAUDE.md             Notes for Claude Code when working on this repository
```
