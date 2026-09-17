# Imagemap Broadcast — Integration Review & Verification (T8)

**Date:** 2026-09-18  
**Scope:** T1 through T7 implementation of Imagemap Broadcast feature  
**Target:** `feat/imagemap-broadcast`  

---

## 1. Test & TypeCheck Summary

### A. Vitest Suite
```
 RUN  v4.0.18 C:/Users/Administrator/inboxreya

 ✓ tests/broadcasts/broadcast-link.test.ts (9 tests)
 ✓ tests/promo/promo-sort.test.ts (12 tests)
 ✓ tests/broadcasts/imagemap-images.test.ts (6 tests)
 ✓ tests/broadcasts/imagemap-build.test.ts (11 tests)
 ✓ tests/broadcasts/click-redirect.test.ts (10 tests)

 Test Files  5 passed (5)
      Tests  48 passed (48)
```
* **Result:** 48/48 tests passed (100% pass rate).
* **Pre-existing test failures outside feature:** 4 errors in `payment-chase.test.ts` and `bdo-notify.test.ts` originating from Prisma query engine targeting Linux in Docker while running tests on native Windows host without Windows binaries generated. Feature tests mock prisma cleanly and have zero failures.

### B. TypeScript Compilation (`npx tsc --noEmit`)
* **Result:** Exit code 0 (clean, 0 type errors across the entire codebase).

---

## 2. End-to-End Contract Verification

| Contract Boundary | Producer / Caller | Consumer / Handler | Verification Status |
|---|---|---|---|
| **Image Set & Upload** | `POST /api/inbox/broadcasts/imagemap-upload` | `ImagemapRegionEditor.tsx` / `CreateBroadcastDialog.tsx` | **MATCH**: Returns `{ baseKey, baseUrl, width: 1040, height, previewUrl }` |
| **Imagemap Input Schema** | `CreateBroadcastDialog.tsx` | `POST /api/inbox/broadcasts`, `/schedule`, `/test-send` | **MATCH**: Validated by `imagemapInputSchema` (zod) with max 12 regions, bounded coordinates, and https URLs |
| **Storage Envelope** | `buildBroadcastEnvelope` | `BroadcastMessageV2.content` | **MATCH**: JSON envelope includes `imagemapMeta: { baseKey, regions }` |
| **Link Personalization** | `sendBroadcastRecord` in `broadcast-runtime.ts` | LINE Push / Multicast API | **MATCH**: Rewrites only imagemap action URIs to `${origin}/r/${token}` where `token = signLink({ b, r, u })` |
| **Click Redirect & Tagging** | Customer clicking region in LINE | `GET /r/[token]` | **MATCH**: Verifies HMAC token, logs to `broadcastEngagement`, verifies cross-account tagging, 302s to DB-stored region URL |
| **Fallback on Error** | `GET /r/[token]` | `GET /promo` | **MATCH**: Uses `getPublicOrigin()` to redirect to public promo catalog without error leakage |
| **Engagement Summary** | `GET /api/inbox/broadcasts/[id]/engagement` | `BroadcastCtrBadge` / `BroadcastClickStats` | **MATCH**: Returns `clicksByRegion`, `uniqueClickers`, `anonymousClicks` |
| **Stats UI & Lazy Loading** | `BroadcastList.tsx` | `BroadcastClickStats.tsx` | **MATCH**: Lazy fetch on component mount / row expand, zero-division guards handled |

---

## 3. Security Review of Public Endpoints

### 1. `GET /r/[token]`
* **Open Redirect:** **PASS**. The redirect target URL is read strictly from `JSON.parse(broadcast.content).imagemapMeta.regions[payload.r].url`. It is never supplied by the request query or body. Additionally, defense-in-depth ensures `url.startsWith('https://')`.
* **Token Forgery:** **PASS**. Signed with HMAC-SHA256 using `BROADCAST_LINK_SECRET` and verified with `crypto.timingSafeEqual`.
* **Cross-Account Tagging:** **PASS**. Explicitly verifies `user.lineAccountId === broadcastLineAccountId` and `tag.lineAccountId === null || tag.lineAccountId === broadcastLineAccountId`.
* **Error Leakage:** **PASS**. Any invalid token, corrupted envelope, or database exception falls back to a 302 redirect to `${getPublicOrigin()}/promo` with no internal stack trace or DB error returned.

### 2. `GET /api/imagemap/[key]/[size]`
* **SSRF / Open Proxy:** **PASS**. The `baseKey` is an HMAC-signed JSON array of upstream URLs. Even if forged, the handler verifies that the URL host matches `getPhpUploadHost()`.
* **Unbounded Memory / Cache Denial of Service:** **PASS**. In-process `imageCache` is capped at 50 entries with FIFO eviction (`// ponytail: in-process cache`).
* **Content-Type & Cache Headers:** **PASS**. Serves `Cache-Control: public, max-age=31536000, immutable` for high performance and reduced server load.

### 3. `GET /promo`
* **Data Privacy:** **PASS**. Public promotions feed only exposes active public items; expired promotions are filtered out by `offerEnd`.
* **SEO Protection:** **PASS**. Includes `robots: { index: false, follow: false }` metadata.

---

## 4. Integrity of Working Tree & Non-Feature Files

* **Production Hotfixes Intact:** Uncommitted production hotfixes in the working tree (slip verification, payment chase, odoo partner sync, etc.) were **completely untouched and preserved**.
* **Zero Git Destructive Commands:** No `git reset`, `git clean`, `git checkout .`, or `git stash` commands were executed.
* **Backward Compatibility:** All existing broadcast types (`text`, `image`, `video`, `flex`, `multi`) in `broadcast-runtime.ts` and `CreateBroadcastDialog.tsx` remain fully functional with zero breaking changes.

---

## 5. Findings & Recommendations

| Severity | Item | Location | Recommendation |
|---|---|---|---|
| **LOW** | Key Separation | `src/lib/broadcast-link.ts` | `signLink` and `signValue` share `BROADCAST_LINK_SECRET`. For future hardening, prepend domain tags (e.g. `link:` vs `val:`) to payloads before hashing. |
| **INFO** | LINE Rendering Verification | LINE App Clients | Extensionless `/1040` through `/240` resolution has been unit-tested and verified with mocks. Real LINE mobile rendering should be verified via "ส่งทดสอบหาตัวเอง" button in the UI once deployed. |
| **ENV** | Required Environment Variables | Production `.env` | Ensure `BROADCAST_LINK_SECRET` (32+ chars random string) and `LINE_OA_BASIC_ID` (e.g. `@clinicya`) are configured in production environment before release. |

---

## 6. Final Verdict

### **VERDICT: GO**
The Imagemap Broadcast feature (T1 through T7) is fully implemented, all contracts align cleanly, all 48 tests pass, TypeScript compilation is clean (0 errors), and security guardrails are in place. The feature is ready for staging test-send and production rollout.
