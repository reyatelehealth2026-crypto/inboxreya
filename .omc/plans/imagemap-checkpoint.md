# Imagemap Broadcast — CHECKPOINT (2026-09-18 ~05:25 GMT+7)

Resume prompt for next session: "อ่าน .omc/plans/imagemap-checkpoint.md แล้วทำต่อ"

- Plan (locked decisions Q1–Q24): `.omc/plans/imagemap-broadcast.md`
- Task specs (COMMON + T1..T8): `.omc/plans/imagemap-specs.txt`
- Branch: `feat/imagemap-broadcast` (from `fix/webhook-savedmediaurl-quotetoken` HEAD 3600772)
- NOTHING committed. Working tree also holds uncommitted PRODUCTION hotfixes — never `git stash/reset/checkout/clean`; commit only feature files, by explicit path.

## DAG status

| Task | Work | Deps | Status at checkpoint |
|---|---|---|---|
| T1 | `src/lib/broadcast-link.ts`, `src/lib/imagemap-types.ts`, middleware publicRoutes (`/r/`, `/promo`, `/api/imagemap/`), `.env.example` | – | DONE + VERIFIED (vitest 9/9, code read) |
| T2 | `src/lib/wholesale-promos.ts`, `src/app/promo/page.tsx`, `tests/promo/promo-sort.test.ts`, edit `src/app/api/inbox/catalog/wholesale-promos/route.ts` | – | DONE + VERIFIED (vitest 12/12) |
| T3 | `src/lib/broadcast-runtime.ts`, broadcasts `route.ts` + `schedule/route.ts`, `test-send/route.ts`, `tests/broadcasts/imagemap-build.test.ts` | T1 | DONE + VERIFIED (vitest 11/11, getPublicOrigin exported) |
| T4 | `src/lib/imagemap-images.ts`, `src/app/api/imagemap/[key]/[size]/route.ts`, `imagemap-upload/route.ts`, `tests/broadcasts/imagemap-images.test.ts` | T1 | DONE + VERIFIED (vitest 6/6) |
| T5 | `src/app/r/[token]/route.ts`, engagement route (+click, clicksByRegion, uniqueClickers, anonymousClicks), `tests/broadcasts/click-redirect.test.ts` | T1 | DONE + VERIFIED (vitest 10/10; 2 findings resolved: getPublicOrigin redirect & update: {}) |
| T6 | `ImagemapRegionEditor.tsx` + `ImagemapTestSendModal.tsx` + `CreateBroadcastDialog.tsx` | T3, T4 | DONE + VERIFIED (tsc clean, client-side validation, presets & custom layouts) |
| T7 | CTR on cards + per-region clicks (`BroadcastList.tsx` + `BroadcastClickStats.tsx`) | T5 | DONE + VERIFIED (tsc clean, lazy load on expand, CTR badges) |
| T8 | read-only review → `.omc/research/imagemap-review.md` | T2, T6, T7 | DONE + VERIFIED (VERDICT: GO, 48/48 tests passed, tsc exit 0) |

UPDATE 05:45 — All tasks T1–T8 are COMPLETE and VERIFIED:
- T5 findings fixed: `redirectToPromo` uses `getPublicOrigin()` and `userTagAssignment.upsert` uses `update: {}`.
- T6 completed: Imagemap mode integrated in `CreateBroadcastDialog.tsx`, `ImagemapRegionEditor.tsx` created with layout presets and localStorage save/load, `ImagemapTestSendModal.tsx` created.
- T7 completed: `BroadcastClickStats.tsx` created with CTR calculation and region breakdown, `BroadcastList.tsx` updated with CTR badge and expandable click stats row.
- T8 completed: Integration review written at `.omc/research/imagemap-review.md` with verdict GO.
- Vitest: 48/48 tests passed.
- TypeScript: `npx tsc --noEmit` exited code 0 (zero errors).

## How to resume

1. Verify T2–T5 yourself (agents' final messages are unreliable — a hook makes them end with filler like "Idle."):
   `npx vitest run tests/broadcasts tests/promo` then `npx tsc --noEmit` (only errors in feature files matter; repo has pre-existing tsc errors).
   Agents T3–T5 were told to write reports to the session scratchpad (`report-T3.md` etc.) — that temp dir may be gone; rely on files + tests.
2. Check T3 did not change behaviour of text/image/video/flex/multi in `sendBroadcastRecord` (`git diff src/lib/broadcast-runtime.ts`).
3. Check contract alignment: upload response `{ baseKey, baseUrl, width, height, previewUrl }` (T4) ↔ imagemap request body accepted by create/schedule/test-send (T3) ↔ `JSON.parse(content).imagemapMeta` read by `/r` (T5); both T3 and T4 must use the SAME env var for the public origin.
4. Launch T6 (model opus) + T7 (model sonnet) in parallel via the native Agent tool, `subagent_type: oh-my-claudecode:executor` WITH explicit `model` override (the OMC 4.9.3 definition pins claude-sonnet-4-6). Prompt pattern: point the agent at `.omc/plans/imagemap-specs.txt` sections COMMON + T<n>, tell it to write its report to a file, warn about the Fact-Forcing Gate hook (first Write/Edit per file is rejected; state 4 facts, retry).
5. Then T8 (opus). Fixes from T8 are dispatched to a new executor, not done by the reviewer.

## Known issues / notes

- Orca orchestration was tried first and abandoned: WSL `claude` fails with "native binary not installed"; bash executed the preamble's template `worker_done`, falsely marking T1/T2 succeeded. Orca Run `run_31fa4d073fc2`: T1/T2 set to `failed`, workers released, coordinator terminal closed. Orca also launches `claude --dangerously-skip-permissions` (conflicts with user's hooks.md rule).
- Before prod: set env `BROADCAST_LINK_SECRET` (all sign/verify functions throw without it); maybe `LINE_OA_BASIC_ID` (check T2's page for where basic id comes from).
- Open non-code checks owned by user: อย. drug-advertising rules for a public price page; PDPA coverage of click tracking.
- Minor hardening for T8 to consider: `signLink` and `signValue` share one HMAC key with no domain-separation prefix.
- Real LINE rendering of imagemap (extensionless `/1040` etc.) is UNVERIFIED until a test send from the T6 UI.
- Deployment: prod has no git checkout and runs from the uncommitted worktree (see memory `prod-deployed-from-uncommitted-worktree`, `reyastack-prod-vps`).
