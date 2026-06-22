# Agents Guide

## Lint & Format

| Command | Purpose |
|---|---|
| `npm run lint` | ESLint check (errors block CI) |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (blocks CI) |
| `npm run typecheck` | TypeScript type check (blocks CI) |

All three gates (`lint`, `format:check`, `typecheck`) must pass before merge.

## Rules

- `no-explicit-any` is **warn** — surface without blocking. Prefer proper types.
- `no-console` is **off** — `console.error` is used intentionally for error handling.
- `@typescript-eslint/no-unused-vars` is **error** — prefix unused args/vars with `_`.
- `react-hooks/*` rules are **error** — follow Rules of Hooks.

## Config Files

- `eslint.config.js` — ESLint flat config (ESLint v9)
- `.prettierrc` — Prettier options
- `.github/workflows/ci.yml` — CI pipeline (audit + lint + format + typecheck + build + test)

## Security

### Authentication
- Player identity uses **Supabase anonymous auth** (real JWTs), not localStorage UUIDs.
- `getPlayerId()` in `src/services/lobby.ts` is async — it calls `ensureAnonymousSession()` from `src/lib/supabase.ts`.
- `getOrCreatePlayerId()` is a sync fallback for store initialization only (solo mode when Supabase is not configured).
- **Requires:** Anonymous Auth enabled in Supabase dashboard (Auth → Providers → Anonymous → Enable).

### Row Level Security (RLS)
- All Supabase tables have RLS enabled.
- Write operations are scoped to `auth.uid()` — users can only modify their own rows.
- Read access is public for lobby/leaderboard tables (needed for join code lookup).
- Host-only operations (kick, rename, reset scores, etc.) go through **SECURITY DEFINER RPC functions** defined in `supabase/schema.sql`. Each RPC verifies `host_id = auth.uid()` before acting.
- Never use `USING (true)` on INSERT/UPDATE/DELETE policies — this was the original security hole.

### Host-Only Functions
- Client-side `.eq('host_id', playerId)` filters are **defense-in-depth** only. The real enforcement is in RLS policies and RPC functions.
- Any new host-only operation that modifies other players' rows must be implemented as a SECURITY DEFINER RPC in `schema.sql`, not a direct client query.

### Input Validation
- Player names: max 50 characters (enforced in `lobby.ts` + DB column type).
- Roll call entries: max 200 characters (enforced in `rollCall.ts`).
- Always validate input length client-side before sending to Supabase.

### Security Headers
- CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy are set in `vercel.json`.
- The CSP allows `img-src` from NFL/NBA CDNs and `connect-src` to Supabase.
- If adding new external resource domains, update the CSP in `vercel.json`.

### Schema Changes
- `supabase/schema.sql` is the source of truth for the database schema.
- After modifying schema, run the SQL in the Supabase SQL editor.
- The schema includes `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements for backward compatibility with existing installs.
