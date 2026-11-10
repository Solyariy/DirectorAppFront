# src — Director Admin SPA

## Purpose

- React 18 + TypeScript + react-router-dom 6 single-page admin UI for the DirectorApp API (apps, policies, rules, jobs, energy snapshots)
- Entry: `main.tsx` (BrowserRouter + StrictMode) → `App.tsx` (shows `pages/Login.tsx` when no session, otherwise sidebar layout + routes)

## Ownership

- `api.ts` — the only HTTP layer: `request()` wrapper, `api.*` endpoint map, `fetchAll()` paging walker, `ApiError`, `errorMessage()` (flattens DRF error trees), `statusOf()`
- `auth.ts` — token session store in `localStorage` key `director.auth`; `useSession()` via `useSyncExternalStore`, cross-tab sync, `logout()`
- `types.ts` — API shapes mirroring backend contract `postman/specs/director-api.yaml` (v0.3.0) in `../../PycharmProjects/DirectorApp`; `JOB_STATUSES`
- `hooks.ts` — `useAsync(fn, deps)` (load + `reload()`, keeps stale data while reloading) and `useAction()` (busy/error wrapper for mutations)
- `components.tsx` — shared UI: `PageHeader`, `ErrorBox`, `Loading`, `Empty`, `Badge`/`ActiveBadge`, `Modal`, `Field`, `Pagination`, `EnergyCard`, `EvaluateModal`, `EvaluationView`
- `format.ts` — date/power/number formatters, `localInputToIso`, `describeCombination()` (rule tree → readable text)
- `styles.css` — all styling; CSS variables on `:root` with a `prefers-color-scheme: dark` override; plain class names (`btn`, `card`, `table`, `input`, …)
- `pages/` — one default-exported component per route: `Dashboard` (`/`), `Apps`, `Policies`, `Rules`, `Jobs`, `Energy`, plus `Login`

## Local Contracts

- All requests go through `api.ts` to same-origin `/api` (nginx in Docker, Vite proxy in dev); never call `fetch` elsewhere or hardcode a backend host
- Auth: `Authorization: Token <key>`; any 401 on an authed call clears the session (login form reappears); `credentials: 'omit'`
- New endpoints: add the type to `types.ts` and the method to the `api` object; keep shapes aligned with the backend spec
- `api.apps.evaluate` and `api.energy.current` read the inverter live and store a snapshot — call them only on explicit user action, never on load or polling
- Adding a page: create `pages/<Name>.tsx`, then register it in both `NAV` and `<Routes>` in `App.tsx`
- `Dashboard.tsx` imports `STATUS_TONE` from `pages/Jobs.tsx`; keep that export when editing Jobs

## Work Guidance

- Page pattern: `useAsync` for lists (server pagination with `PAGE_SIZE`, `search` resets page to 1), `useAction` for mutations then `list.reload()`, `ErrorBox` for `list.error ?? action.error`, `Modal` + `Field` for create/edit forms, `confirm()` before deletes
- Use `api.<resource>.all()` only for small lookup lists (selects/name maps)
- Show user-facing errors via `errorMessage()` / `ErrorBox`; handle conflict statuses (e.g. 409 on delete) via `statusOf()`
- tsconfig is strict with `noUnusedLocals`/`noUnusedParameters`; no ESLint or formatter configured
- No extra dependencies so far: UI is hand-rolled components + `styles.css`

## Verification

- `npm run typecheck` (or `make typecheck`) — `tsc -b`, must pass
- `npm run build` (or `make dist`) for a production build check
- No test suite exists

## Child DOX Index

- None; `pages/` follows this doc
