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
- `.github/workflows/ci.yml` — CI pipeline (lint + format + typecheck + build)
