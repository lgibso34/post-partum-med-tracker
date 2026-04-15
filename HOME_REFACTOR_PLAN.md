# Plan: Make the "All medicines history" view the new home

## Goal

Replace the current tracker home (`src/app/index.tsx`, which shows today's doses per medicine with a date bar) with the "All" view currently implemented on `src/app/history.tsx`. Simplify `/history` so only the All view renders — no Single/All tab toggle and no medicine picker dropdown.

## Current state (for reference)

- [src/app/index.tsx](src/app/index.tsx): tracker page. Uses `DateBar`, `MedicineColumn`, `AddMedicineCard`, and a zustand `selectedDate`. Header has a "History" link to `/history`.
- [src/app/history.tsx](src/app/history.tsx): two view modes (`'single' | 'all'`) selected by a toggle near the top. The `All` branch renders a grid of `HistoryColumn` (defined inline in the same file) that displays each medicine's full grouped-by-date history with per-day `+` buttons and tap-to-edit on rows.
- Shared modal state (`editing`, `addingContext`, date + time fields) lives on the `History` component and is reused by both views.

## Target state

- `src/app/index.tsx` is the "all medicines history" grid view (what the user currently calls the All tab). No date bar, no per-day tracker columns.
- `src/app/history.tsx` shows the same grid, no view toggle, no medicine picker. (Kept as a route for now — see Open Questions below.)
- Both pages share one implementation so they can't drift.

## Proposed steps

### 1. Extract `HistoryColumn` into its own component file

Move the `HistoryColumn` function (currently inside [src/app/history.tsx](src/app/history.tsx) above `History`) into [src/components/HistoryColumn.tsx](src/components/HistoryColumn.tsx) along with the styles it owns (`column`, `columnHeader`, `columnTitle`, `columnAddBtn`, `columnAddBtnText`, `columnBody`, `columnEmpty`, `columnDayBlock`, `dayHeaderRow`, `dayHeader`, `addDayBtn`, `addDayBtnText`, `timeList`, `timeRow`, `timeDot`, `timeText`, `pressed`).

Export `HistoryColumn` and also the helpers `GRID_GAP`, `GRID_H_PAD`, `columnCountFor`, and the `AddingContext` type so both pages can import them.

### 2. Extract the dose edit/add modal into a reusable piece

The edit + add modal logic (`editing`, `addingContext`, `addDateValue`, `modalValue`, `modalError`, `openEdit`, `openAdd`, `closeModal`, `handleSave`, `handleDelete`, and the `Modal` JSX) is a ~150-line chunk that will be needed on both `/` and `/history`. Two options:

**Option A (preferred): custom hook + dumb modal component.**
- `src/components/useDoseEditor.ts` — returns `{ openEdit, openAdd, modalProps }`.
- `src/components/DoseEditorModal.tsx` — takes `modalProps` and renders the Modal JSX. Pure presentation.

Both `index.tsx` and `history.tsx` call `useDoseEditor()` and pass `openEdit`/`openAdd` into `HistoryColumn`, then render `<DoseEditorModal {...modalProps} />`.

**Option B: duplicate the modal state in both files.** Simpler diff, but guarantees drift the next time something changes. Rejected.

Go with **Option A**.

### 3. Rewrite `src/app/index.tsx`

Replace the entire tracker body with:

- Keep: auth gate (`if (!isValid) return <Redirect href="/login" />`), top bar with brand + user name + logout button.
- Remove: the "History" nav button (redundant — `/` is now the history view).
- Remove: `DateBar`, `MedicineColumn`, `AddMedicineCard` imports and JSX.
- Remove: `useAppStore` / `selectedDate` usage.
- Remove: `useDosesForDate` call.
- Add: `useMedicines()`, `useDoseEditor()`, the responsive grid calculation (reuse `columnCountFor`, `GRID_GAP`, `GRID_H_PAD` from the extracted module), and a `medicinesQ.data?.map(m => <HistoryColumn ... />)` render.
- Add: an "Add medicine" affordance. The current home has `<AddMedicineCard />`; the current `/history` does not. This is a **regression risk**: the home currently lets the user create a new medicine, but the history view never did. Decide (see Open Questions) whether to keep `AddMedicineCard` as an extra tile in the grid on `index.tsx`, or move medicine creation somewhere else (settings screen, top-bar button). Default recommendation: keep `AddMedicineCard` as the final tile in the grid so users don't lose the ability to add medicines from the home page.
- Add: `<DoseEditorModal />` at the bottom of the screen.

### 4. Simplify `src/app/history.tsx`

- Delete the `view` state and the Single/All toggle JSX + styles (`viewToggleRow`, `toggleBtn`, `toggleBtnActive`, `toggleBtnText`, `toggleBtnTextActive`).
- Delete the medicine picker: `selectedId`, `pickerOpen`, `activeId`, `activeMed`, `dosesQ` (single-view's `useAllDosesForMedicine(activeId)` call), the picker `<Modal>`, the `dropdownRow`/`dropdown`/`dropdownLabel`/`dropdownCaret` styles, and the single-view `grouped` memo + its JSX branch.
- Delete the single-view-only "Add dose for today" bottom button and its styles (`addTodayBtn`, `addTodayBtnText`).
- Keep the back button (`← Back`) and brand header — or remove the back button too, since the page it would go "back" to is now itself. See Open Questions.
- Render the same `HistoryColumn` grid as `index.tsx`. After this, `history.tsx` is essentially a thin wrapper that duplicates `index.tsx`'s body. Easiest implementation: `history.tsx` imports a shared `<MedicineHistoryGrid />` component and renders it.

### 5. Create `src/components/MedicineHistoryGrid.tsx`

To avoid JSX duplication between `index.tsx` and `history.tsx`, extract the grid rendering logic (loading state, empty state, column math, `.map` over medicines, `DoseEditorModal`) into a single component. Both pages then become ~30 lines: auth/layout chrome + `<MedicineHistoryGrid />`.

### 6. Navigation cleanup

- Remove the "History" button in [src/app/index.tsx](src/app/index.tsx#L44-L49) top bar.
- Decide whether to keep `/history` in the route tree at all (see Open Questions).

### 7. Dead code sweep

After the refactor, grep the project to confirm the following are unused, then delete:

- [src/components/DateBar.tsx](src/components/DateBar.tsx) — only used by the old tracker.
- [src/components/MedicineColumn.tsx](src/components/MedicineColumn.tsx) — only used by the old tracker.
- `src/components/AddMedicineCard.tsx` — **only** if we decide not to keep add-medicine on the new home. Keep it otherwise.
- `useDosesForDate` in [src/lib/queries.ts](src/lib/queries.ts) — used only by `MedicineColumn`/tracker.
- `dosesKey` export in the same file — now only referenced internally, if at all. The mutation hooks currently invalidate the broad `['doses']` prefix so `dosesKey` may be fully dead.
- `selectedDate` state in `src/stores/appStore.ts` — and possibly the entire store if nothing else lives there.
- `nowIsoUtc` / `todayInTZ` / `takenAtForDate` in [src/lib/time.ts](src/lib/time.ts) — verify these are still referenced by the new grid/modal before removing. They likely still are.
- The `date` param on `useAddDose`/`useUpdateDose`/`useDeleteDose` is still used only to compute `takenAtForDate(date)` as the default `taken_at` in `useAddDose` and for the optimistic cache entry in `useAddDose`/`useDeleteDose`. Keep as-is for now — the history flows always pass an explicit `takenAt` and operate across multiple dates, so the optimistic updates on the date-keyed cache are harmless no-ops. A follow-up refactor could drop the `date` hook param entirely.

### 8. Manual verification checklist

Start `expo start --web` and confirm:

- `/` renders the grid of medicine columns with all-time history grouped by day, newest day on top, oldest time on top within each day.
- Tapping a dose row opens the edit modal; Save updates the time, Delete removes the dose with no confirmation.
- Tapping the column-level "+ Add dose" opens the add modal prefilled with today's date + now's time.
- Tapping a per-day "+" opens the add modal prefilled with that day.
- Editing the date field in the add modal to a past day with no existing block creates the dose and the grid updates.
- `/history` renders the same grid and behaves identically.
- Add Medicine is still reachable from `/` (assuming we keep the affordance).
- Logout still works; auth redirect still works.
- `npx tsc --noEmit` clean; no unused imports.

## Open questions

1. **Keep or delete `/history`?** After the refactor it's a duplicate of `/`. Options:
   - Delete [src/app/history.tsx](src/app/history.tsx) entirely.
   - Keep it as a second entrypoint for bookmarks / muscle memory.
   - Redirect `/history` to `/` with `<Redirect href="/" />`.
   - **Recommendation:** delete the file. One source of truth.
2. **Add-medicine affordance on the new home.** Keep `AddMedicineCard` in the grid (current recommendation) or move medicine management to a dedicated screen?
3. **Date bar is gone — is that OK?** The original app had a global selected date so both users could log doses for a specific day. The history grid shows all days, so this use case is still covered, but the "quick tap to add today's dose under a selected day" UX is different. Confirm the user is OK with the add-flow being "tap the column's Add button → modal with date field defaulting to today."
4. **Selected date when adding from the home:** today's date is the default. Is that the right default for the "+ Add dose" column-level button? (Per-day `+` buttons already default to that day.)
5. **Scroll performance.** The home now lists every dose ever logged for every medicine. At a few hundred doses this is fine, but if the dataset grows we may want pagination or a month filter per column. Not blocking.

## Risk summary

- Low: data model, queries, and mutation hooks are untouched. This is purely a UI re-wire.
- Medium: dead-code deletion needs a careful grep pass — `useDosesForDate` / `MedicineColumn` / `DateBar` may be referenced from places I haven't traced yet.
- Medium: if `AddMedicineCard` is dropped, users lose the ability to add new medicines from the UI until a replacement screen ships.

## Files touched (summary)

| File | Action |
|---|---|
| `src/components/HistoryColumn.tsx` | **new** — extracted from `history.tsx` |
| `src/components/MedicineHistoryGrid.tsx` | **new** — shared grid wrapper |
| `src/components/DoseEditorModal.tsx` | **new** — extracted modal |
| `src/components/useDoseEditor.ts` | **new** — hook for modal state + mutations |
| `src/app/index.tsx` | **rewritten** — home becomes the grid |
| `src/app/history.tsx` | **simplified** — just renders the grid, or **deleted** |
| `src/components/DateBar.tsx` | **deleted** |
| `src/components/MedicineColumn.tsx` | **deleted** |
| `src/components/AddMedicineCard.tsx` | **kept** (default) or deleted |
| `src/stores/appStore.ts` | `selectedDate` removed; delete file if empty |
| `src/lib/queries.ts` | `useDosesForDate` + `dosesKey` removed if unused |
| `src/lib/time.ts` | no changes expected |
