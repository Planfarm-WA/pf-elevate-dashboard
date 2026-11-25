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

Open `index.html` in a web browser. Nothing needs installing. An internet connection is only needed for the fonts.

**Saving.** Changes save automatically in the browser you're using. They are not shared with anyone else, and don't move to another computer or browser by themselves. Clearing the browser's site data deletes them.

**Backing up and moving data.**
- **Export Data** downloads a `planfarm-elevate-dashboard-YYYY-MM-DD.json` file. Keep it as a backup, or use it to open the dashboard on another computer.
- **Import Data** loads one of those files. It **replaces everything** currently in the dashboard.

**Carrying work forward.** "Push →" on an unfinished priority or task copies it into the next period or round. If that doesn't exist yet, the item is added automatically when you create it.

**Printing.** 🖨 Print in the header prints the whole dashboard. The Print button on a period or round prints just that one.

**Known gap.** Notes typed into the *Session Notes* card are not saved. Use the coaching notes box on each 30-day round, or the Notes field on a session, instead.

### Setting up for a new client

1. Make a copy of `index.html`.
2. Replace `Client Name` in the header with the client's name.
3. Replace the placeholder names in the "Who" suggestions (`Person A`, `Person B`, …) near the end of the file.

The browser stores data under a fixed name (`pf_elevate_blank1`). Copies served from the same website address share that storage, so give each client's copy a different name before hosting several together.

## Supabase database (in progress)

The dashboard is moving from browser storage to Supabase, so data is shared and backed up centrally. `supabase/schema.sql` creates the tables. **The dashboard does not use them yet.**

### Creating the tables

1. In your Supabase project, open **SQL Editor**, paste the contents of `supabase/schema.sql` and click **Run**.
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

### Still to do

- A way to load existing JSON export files into the database.
- Changing the dashboard to read and save through Supabase instead of the browser.

## Repository layout

```
index.html            The dashboard: page, styles and code in one file
supabase/schema.sql   Database tables and access rules for Supabase
CLAUDE.md             Notes for Claude Code when working on this repository
```
