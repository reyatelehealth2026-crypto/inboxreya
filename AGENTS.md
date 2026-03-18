# AGENTS.md

## Project overview

- The active app in this repository is the root Next.js 15 + React 19 + TypeScript project.
- This repo is still hybrid: the Next.js inbox shares a MySQL database with a legacy PHP system, and some features still depend on the PHP bridge.
- Default to working from the repository root with `npm`, not `yarn` or `pnpm`.

## Primary areas

- `src/app`: App Router pages and API routes.
- `src/components`: UI components.
- `src/lib`: shared utilities, auth, PHP bridge, and business logic.
- `src/hooks`, `src/stores`, `src/types`: client-side logic and shared types.
- `prisma`: schema, migrations, and seed data.
- `tests` plus colocated `*.test.ts` / `*.test.tsx`: Vitest coverage.
- `docs` and `design-system`: reference material; useful for product context, not runtime entrypoints.
- Legacy PHP files still exist at the repo root and in PHP-oriented directories. Do not remove or rename them unless the task explicitly requires it.

## Setup

Run from the repo root:

1. `npm install`
2. `cp .env.example .env`
3. Fill in required values in `.env`
4. `npm run db:generate`
5. `npm run db:push`
6. `npm run db:seed`
7. `npm run dev`

Open `http://localhost:3000` after the dev server starts.

## Environment requirements and caveats

- `NEXTAUTH_SECRET` is required for auth to work.
- `DATABASE_URL` and `DIRECT_DATABASE_URL` are required for Prisma workflows.
- `PHP_API_URL` and `NEXT_PUBLIC_PHP_API_URL` are required for features that still call into the legacy PHP backend.
- Pusher env vars are optional, but real-time features degrade when they are missing.
- Treat schema changes as cross-system changes because the Next.js app and PHP system share the same database.
- Do not commit `.env` or secret values.

## Common commands

- `npm run dev`: start the Next.js dev server.
- `npm run build`: production build check.
- `npm run start`: run the production build locally.
- `npm run lint`: run ESLint.
- `npm run check-types`: run TypeScript without emitting files.
- `npm test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run db:generate`: generate Prisma client.
- `npm run db:push`: push schema changes to the database.
- `npm run db:migrate`: deploy Prisma migrations.
- `npm run db:seed`: seed the database.
- `npm run db:studio`: open Prisma Studio.

## Testing guidance

- Prefer targeted tests for the files you changed instead of running the entire suite.
- Run `npm run lint` separately when changing app code; `next.config.js` allows builds to pass even if lint issues remain.
- Run `npm run check-types` for TypeScript changes, but note that `tsconfig.json` excludes `tests` and `*.test.*`.
- Run Vitest for test files or behavior changes that already have automated coverage.
- For UI changes, start the app with `npm run dev` and manually verify the affected flow in the browser.
- If you change Prisma schema or DB-facing logic, validate the relevant Prisma command path you touched.

## Git and change-scope guidance

- This repo may contain unrelated local changes. Do not revert user work unless explicitly asked.
- Keep edits focused on the requested task.
- Prefer small, reviewable changes.
- If a task touches legacy PHP integration, review both the Next.js side and any shared database assumptions before changing behavior.

## Cursor Cloud specific instructions

- Before starting a long-running process, check whether an existing terminal is already running the needed server and reuse it when possible.
- For web UI work, use the running dev server at `http://localhost:3000` unless the task explicitly requires another port.
- For UI changes, capture a screenshot and a short demo video after manual verification.
- Leave dev servers running when you finish unless cleanup is required to continue testing.

## Pre-commit behavior

- The Husky pre-commit hook runs `npx lint-staged`.
- Changed `*.ts` and `*.tsx` files trigger `tsc --noEmit` and `vitest related --run`.
