# Post-Partum Med Tracker — Build Plan

A web-only React Native (Expo Router) app for logging medications and the times they were taken. Deployed as a static site (Vercel/Cloudflare Pages/GH Pages — TBD), backed by Supabase, gated behind Discord OAuth for two specific users.

## Goals

- One screen. Log in with Discord, see all medicines as columns, tap to log a dose.
- Mobile-web first (primary usage is a phone browser), but scales up to desktop.
- Zero backend code to write and host — Supabase is the only backend.
- Free/cheap deployment — static hosting on a free tier.

## Non-goals

- No iOS/Android native builds. `expo start --web` / `expo export -p web` only.
- No reminders, notifications, dosage scheduling, or refill tracking.
- No multi-household/tenant support. Two users, one shared dataset.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 54 + Expo Router (already in starter) |
| UI | React Native primitives + StyleSheet (already in starter) |
| State — server | `@tanstack/react-query` (already) against Supabase JS SDK |
| State — client | `zustand` (already) for selected date, auth state |
| Forms | `react-hook-form` + `zod` (already) |
| Auth | Supabase Auth with Discord OAuth provider |
| DB | Supabase (hosted Postgres, free tier) |
| Timezone | **America/New_York** pinned app-wide (EST/EDT, DST-aware) via `date-fns-tz` |
| Deploy | `expo export -p web` → Vercel / Cloudflare Pages / GH Pages (TBD) |

**Drop from starter** (unused for this app): `@trpc/client`, `@trpc/server`, `@tanstack/intent`, `react-native-mmkv`. Keep `react-native-safe-area-context` and `react-native-screens` since expo-router needs them.

**Add**: `@supabase/supabase-js`, `date-fns`, `date-fns-tz`.

**Pivot note**: Originally planned PocketBase on pockethost.io, but pockethost moved admin access behind a paywall. Swapped to Supabase before any data-layer code was written; cost of the swap was minimal.

---

## Rename pass

The starter is still branded `BaseExpoRouter`. Files to update:

- [package.json](package.json) — `"name": "post-partum-med-tracker"`
- [app.json](app.json) — `expo.name`, `expo.slug`, `expo.scheme` → `post-partum-med-tracker`
- [app.json](app.json) — add `expo.web.bundler: "metro"`, `expo.web.output: "static"`, and `expo.experiments.baseUrl` once the GitHub Pages repo name is known

No other references exist in `src/` — current `index.tsx` / `about.tsx` will be replaced.

---

## Data model (Supabase / Postgres)

### `auth.users` (built-in)
Supabase's built-in auth table with Discord OAuth enabled. Email/password disabled in the dashboard. Allowlist enforced via RLS policies that check the Discord `provider_id` stored on the `auth.identities` row against an `allowed_users` table.

Both app tables are **shared** — no per-user filtering. Mother and Father see and edit the same data.

### `allowed_users`
| field | type | notes |
|---|---|---|
| `discord_id` | text, primary key | Discord user ID, 17–19 digit string |
| `label` | text | human-readable, e.g. "Mother", "Father" |

Seeded by hand with the two allowed Discord IDs. Referenced by RLS helper function `public.is_allowed()`.

### `medicines`
| field | type | notes |
|---|---|---|
| `id` | uuid, primary key, default `gen_random_uuid()` | |
| `name` | text, required, `length <= 80` | |
| `color` | text, nullable | hex, for column header tint |
| `notes` | text, nullable | free-form notes per medicine |
| `archived` | boolean, default false | soft delete so dose history stays intact |
| `sort_order` | int, default 0 | manual ordering |
| `created_at` | timestamptz, default `now()` | |
| `updated_at` | timestamptz, default `now()`, trigger-updated | |

**RLS**: enabled. All four policies (select/insert/update/delete) require `public.is_allowed()`.

### `doses`
| field | type | notes |
|---|---|---|
| `id` | uuid, primary key, default `gen_random_uuid()` | |
| `medicine_id` | uuid, FK → medicines(id), on delete cascade | |
| `taken_at` | timestamptz, required | stored UTC, interpreted as America/New_York in UI |
| `logged_by` | uuid, FK → auth.users(id) | who tapped the button |
| `note` | text, nullable, `length <= 200` | rarely used |
| `created_at` | timestamptz, default `now()` | |

**Indexes**: `(medicine_id, taken_at DESC)` for per-day fetches.

**RLS**: enabled. Same four policies gated on `public.is_allowed()`.

See [supabase/schema.sql](supabase/schema.sql) for the exact DDL, RLS policies, and allowlist helper.

---

## Auth flow

1. App loads → Supabase JS client reads session from localStorage. If valid, go to tracker screen.
2. Login screen has one button: "Continue with Discord."
3. Button calls `supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.origin } })`. Browser redirects to Discord → back to Supabase callback → back to the app. The Supabase JS SDK's `detectSessionInUrl` hydrates the session from the URL hash on return.
4. Auth gate checks the logged-in user's Discord `provider_id` on the client against the allowlist. Unauthorized users get signed out immediately and shown a "not allowed" screen.
5. **Real enforcement** is RLS. Every query to `medicines`/`doses` passes through `public.is_allowed()`, which looks up the current user's Discord `provider_id` (pulled from their `auth.identities` row) in the `allowed_users` table. Even if the client check is bypassed, the DB returns zero rows and rejects writes.
6. Session persists in localStorage and auto-refreshes.
7. Logout calls `supabase.auth.signOut()` and sends user back to login.

**Two-layer allowlist (client + RLS)**: the client check exists purely for UX — to show a "not allowed" screen instead of an empty tracker. The security boundary is RLS.

---

## Screens & routing

Two routes under [src/app/](src/app/):

- `_layout.tsx` — SafeAreaProvider, QueryClientProvider, PocketBase context, auth gate. If not authed, render `<Redirect href="/login" />`; otherwise `<Slot />`.
- `login.tsx` — centered card, app title, "Continue with Discord" button, error toast on rejection.
- `index.tsx` — the tracker screen (the one screen the user asked for).

Delete `about.tsx`.

---

## Tracker screen layout

```
┌───────────────────────────────────────────┐
│  Post-Partum Med Tracker         [logout] │
├───────────────────────────────────────────┤
│  ◀  Mon, Apr 14 2026  ▶     [Today]       │  ← global date picker
├───────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Tylenol  │ │ Ibuprofen│ │ Iron     │    │
│ │          │ │          │ │          │    │
│ │ 08:14 AM │ │ 09:02 AM │ │ 07:30 AM │    │
│ │ 12:45 PM │ │ 02:10 PM │ │          │    │
│ │          │ │          │ │          │    │
│ │ [+ dose] │ │ [+ dose] │ │ [+ dose] │    │
│ └──────────┘ └──────────┘ └──────────┘    │
│ ┌──────────┐                               │
│ │ + add    │                               │
│ │ medicine │                               │
│ └──────────┘                               │
└───────────────────────────────────────────┘
```

### Date selector (top bar)

A single global date state lives in zustand (`useAppStore.selectedDate`), initialized to **today in America/New_York**. All columns render doses for that date. Prev/next day arrows, a "Today" shortcut, and tap-to-open native-web `<input type="date">` for jumping. This is the UX win the user called out — one date selection, not per-medicine.

"Day boundaries" are America/New_York midnights: e.g. `selectedDate = 2026-04-14` filters doses with `taken_at ∈ [2026-04-14 00:00 EDT, 2026-04-15 00:00 EDT)`, converted to UTC ISO strings for the PocketBase filter. `date-fns-tz` handles the conversion (and DST correctly).

### Medicine column

Rendered as a card, ~150px wide. Contents:

1. **Header** — medicine name, long-press (or kebab menu on web) to rename/archive.
2. **Dose list** — each row shows `HH:MM AM/PM`, sorted ascending. Tap a row → edit/delete. Empty state: `"No doses yet"`.
3. **Add dose button** — primary action, full width. On tap: optimistically insert a dose at **now** (current America/New_York time), regardless of which date is selected. If the user is viewing a non-today date and taps add, the dose is still stamped `now` — they should jump to Today first. Tap an existing dose row to open an editor (change time, delete).
4. **Total count** — small caption `"3 doses today"`.

### Add-medicine card

A dashed-border card that matches column dimensions. Tap → inline form (name, optional color). Submits via react-hook-form + zod.

### Responsive columns — how many?

Mobile is primary. Column target width **150px** with **12px gap**. Break on screen width via `useWindowDimensions`:

| width | columns |
|---|---|
| < 380 | 2 |
| 380 – 600 | 2 |
| 600 – 900 | 3 |
| 900 – 1200 | 4 |
| ≥ 1200 | 5 (cap) |

**Max 5 columns** — beyond that, columns get too far apart to scan on desktop and the screen becomes spreadsheet-y. Rows wrap naturally so unlimited medicines is fine; users just scroll vertically.

Use `FlatList` with `numColumns` *or* a simple flex-wrap `View` — go with flex-wrap since the list is short and `numColumns` complicates variable-width add card.

---

## Data access layer

[src/lib/pb.ts](src/lib/pb.ts) — single PocketBase client instance, base URL from `process.env.EXPO_PUBLIC_PB_URL`.

[src/lib/queries.ts](src/lib/queries.ts) — React Query hooks:

- `useMedicines()` — `pb.collection('medicines').getFullList({ filter: 'archived = false', sort: 'sort_order,created' })`
- `useDosesForDate(date)` — filters `taken_at >= startOfDay && taken_at < endOfDay` (user-local, converted to UTC for the filter). Returns grouped by `medicine` id.
- `useAddMedicine()`, `useArchiveMedicine()`
- `useAddDose()`, `useUpdateDose()`, `useDeleteDose()` — all with optimistic updates since latency on PocketBase over mobile data can be 300ms+.

**Realtime**: PocketBase supports subscriptions. If both users are logging simultaneously, subscribing to `medicines` and `doses` for the current day keeps both phones in sync with no refresh. Add this after the happy path works.

---

## Deployment

### Supabase

Configure in the Supabase dashboard:
- **Authentication → Providers → Discord**: enabled, with Discord Client ID + Secret from the Discord Developer Portal.
- **Authentication → URL Configuration**: Site URL + Redirect URLs must include `http://localhost:8081` (local dev) and the production origin (once chosen).
- **SQL Editor**: run [supabase/schema.sql](supabase/schema.sql) once to create the tables, RLS policies, and allowlist helper.
- Insert the two allowed Discord user IDs into `public.allowed_users`.

### Discord Developer Portal

- OAuth2 Redirects must include Supabase's callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Client Secret lives only in Supabase's provider config, never in the frontend.

### Static hosting (TBD)

Candidates:
- **Vercel** — fastest, connects to a GitHub repo, free tier.
- **Cloudflare Pages** — same idea, global CDN, free tier.
- **GitHub Pages** — free but needs a `baseUrl` prefix and a custom Actions workflow.

All three serve the output of `npx expo export -p web` (a `dist/` folder). Pick one and set the production URL in Supabase's allowed Redirect URLs.

### Secrets

- `EXPO_PUBLIC_SUPABASE_URL` — public, baked into the bundle.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — public. Safe because RLS policies gate all access. Never expose the `service_role` key.
- Discord Client Secret lives only in Supabase's Discord provider config.

---

## Build order (concrete steps)

1. **Rename + cleanup** — update package.json, app.json, delete `about.tsx`, strip unused deps.
2. **Install** — add `pocketbase`, `date-fns`.
3. **PB client + auth gate** — `src/lib/pb.ts`, `_layout.tsx` provider, `login.tsx`.
4. **Stand up PocketBase** — create collections, enable Discord OAuth2, add allowlist hook, test login locally.
5. **Tracker shell** — header, date selector, zustand store for selected date.
6. **Medicines list** — query, render columns, add-medicine form.
7. **Doses** — query per date, render list per column, add-dose button with optimistic update.
8. **Edit/delete affordances** — long-press/kebab for medicine; tap-row for dose.
9. **Responsive column math** — wire to `useWindowDimensions`.
10. **Realtime subscriptions** — optional polish pass.
11. **GitHub Actions + Pages deploy** — verify production URL end-to-end.
12. **Smoke test on a real phone** — iOS Safari + Android Chrome.

---

## Decisions (locked in)

1. **PocketBase host** — pockethost.io free tier. Cold-start is ~5s after idle; acceptable for this use case.
2. **Discord user IDs** — *pending from user.* Non-blocking for frontend work. Allowlist hook will ship with placeholder IDs and be updated before production deploy.
3. **Repo / deploy target** — this repo (`post-partum-med-tracker`). Note: the project directory is currently nested inside `/Users/logan/clawd` and is **not** its own git repo yet. Before the GitHub Pages step we need to: `git init` in `post-partum-med-tracker/`, create the GitHub repo, push, then the Actions workflow takes over.
4. **Dose time** — defaults to `now` (America/New_York), editable after the fact by tapping the row.
5. **Edit/delete** — full CRUD on both medicines (archive) and doses (hard delete), via row tap / kebab menu.
6. **Timezone** — pinned to **America/New_York**, app-wide. Stored UTC in PB, interpreted EST/EDT in UI. `date-fns-tz` handles DST.
7. **Shared data** — single dataset for Mother and Father; no per-user filters anywhere.

## Still pending (non-blocking)

- Two Discord user IDs for the allowlist hook — needed before the app goes live, but not before development starts.
