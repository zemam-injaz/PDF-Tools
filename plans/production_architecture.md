# Warraq وراق — Production-Ready Architecture (Pre-PayMob)

> Status: monetization core preserved, production hardening complete. Next step:
> real PayMob integration. No Supabase Auth / multi-device / anti-abuse in this phase.

---

## 1. Final API architecture

```
Warraq Desktop (Tauri + React)
        │
        ├── LOCAL  (PDF processing)      → http://127.0.0.1:{port}
        │      merge/split/compress/bookmarks/pages/watermark/...
        │      markdown-to-pdf, tahweel, tasks, ...
        │
        └── REMOTE (subscription + payment)  → VITE_REMOTE_API_BASE_URL
               /api/subscription/auth/device   (entitlement, signed Ed25519)
               /api/subscription/status
               /api/subscription/verify
               /api/payment/checkout           (server-side pricing)
               /api/payment/webhook            (PayMob HMAC-SHA512)
```

- PDF operations stay local (they need local file paths).
- Every subscription / entitlement / checkout / payment / webhook call is routed
  through the REMOTE base only — `src/lib/api.ts` `remoteRequest()` refuses to
  run when `VITE_REMOTE_API_BASE_URL` is missing and never falls back to localhost.
- The local python backend still serves the subscription routes for development
  (when `VITE_REMOTE_API_BASE_URL=http://127.0.0.1:8002`), but a production build
  points them at `https://api.warraq.app`.

### How the app decides local vs remote
- `getApiBaseUrl()` → local backend port discovered from the Tauri process.
- `getRemoteApiBaseUrl()` / `remoteRequest()` → compile-time
  `VITE_REMOTE_API_BASE_URL` (no runtime discovery, cannot silently point at localhost).
- `api.subscription.*` and `api.payment.*` call `remoteRequest` only.

---

## 2. Files changed

| File | What changed |
|------|--------------|
| `src/lib/api.ts` | Added `REMOTE_BASE_URL` (from `VITE_REMOTE_API_BASE_URL`), `getRemoteApiBaseUrl()`, and a `remoteRequest()` helper. `subscription.*` and `payment.*` now go remote. `payment.checkout` no longer accepts `amount`. |
| `src/contexts/SubscriptionContext.tsx` | Removed the `import.meta.env.VITE_DEV_MODE → return true` bypass. `checkAccess()` now only trusts the signature-verified entitlement (with the first-launch anti-flash allowance). |
| `src/components/pricing/PricingPage.tsx` | `handleSubscribe(planId)` — the client no longer parses or sends an amount. |
| `src/lib/entitlement.ts` | Public key is injected at build time via `VITE_ENTITLEMENT_PUBLIC_KEY`, with the dev key as fallback (dev only). |
| `src/vite-env.d.ts` | Typed `VITE_REMOTE_API_BASE_URL` and `VITE_ENTITLEMENT_PUBLIC_KEY`. |
| `python-server/services/payment_service.py` | Added server-side `PLAN_PRICING` (`plan_id → plan/days/price-by-currency`); `get_plan_price()`; `create_checkout_session(user_id, plan_id, currency)` derives the amount; production checkout fails closed (501) until PayMob is configured; `_paymob_configured()` reads env at call time. |
| `python-server/api/payment_routes.py` | `CheckoutRequest` = `user_id + plan_id + currency` (no client amount); `/mock-gateway` returns 404 in production. |
| `python-server/services/subscription_service.py` | `DEV_MODE` unlock is ignored when `ENVIRONMENT=production`. |
| `python-server/services/entitlement_signing.py` | Fails fast at startup in production if no `ENTITLEMENT_PRIVATE_KEY`/`_FILE` is set (never falls back to the dev key). |
| `python-server/scripts/generate_entitlement_keys.py` | New: generates an Ed25519 keypair and prints the base64 private + public keys. |
| `.env` | Removed `VITE_DEV_MODE=true`; added dev `VITE_REMOTE_API_BASE_URL`. |
| `.env.example` | Added with LOCAL DEV / STAGING / PRODUCTION sections. No real secrets. |
| `src/lib/reader/*` + tests | Fixed 16 TypeScript errors and aligned the 13 stale reader tests with the current engine semantics. |
| `python-server/tests/test_payment_production_guard.py` | New: pricing derivation, unknown plan/currency, client amount ignored, mock-gateway disabled in production, checkout fail-closed, DEV_MODE ignored in production. |

---

## 3. Mock payment disabled

- `/api/payment/mock-gateway` returns **404** whenever `ENVIRONMENT=production`.
  Verified by `test_mock_gateway_disabled_in_production`.
- Production `/api/payment/checkout` returns **501** until `PAYMOB_API_KEY` is a
  real value (fail closed). Verified by `test_checkout_fails_closed_in_production_without_gateway`.
- Production `/api/payment/webhook` already rejects without/with-wrong
  `PAYMOB_HMAC_SECRET` (existing tests).

## 4. VITE_DEV_MODE removed

- The `checkAccess()` bypass is gone from `SubscriptionContext.tsx`.
- `.env` no longer sets it; `.env.example` documents that it must not be re-added.
- Server `DEV_MODE` is ignored in production.

## 5. Production signing keys

- Generate: `python -m scripts.generate_entitlement_keys` (from `python-server/`).
- Private key → server env `ENTITLEMENT_PRIVATE_KEY` only (or `_FILE`). Refused at
  startup in production if absent. Never committed, never embedded, never logged.
- Public key → set `VITE_ENTITLEMENT_PUBLIC_KEY` at desktop build time.
- Rotation: generate new pair → deploy new private key → ship new build with the
  new public key; old cached signatures stop verifying, users re-verify online.

---

## 6. Test results

| Suite | Result |
|-------|--------|
| Python (all `python-server/tests/`) | **68 passed** |
| — incl. entitlement, signature, offline grace, webhook HMAC, idempotency, duplicate txn, failed payment, launch_free | pass |
| — new payment production guards (6 tests) | pass |
| Frontend vitest (all) | **92 passed** (12 entitlement/offline-grace + 80 reader) |
| `tsc -b` | **0 errors** |

## 7. Remaining issues before PayMob integration

1. **Real checkout not implemented** — `create_checkout_session` still returns a
   mock URL in dev and 501 in production. Needs PayMob auth token → order →
   payment_key → iframe flow + real `PAYMOB_API_KEY`/integration IDs.
2. **Webhook metadata mapping** — must confirm PayMob sends `user_id`/`plan_id`
   (via `extra_step_company_id` or order metadata); otherwise map by
   `order.id → transaction`.
3. **Single-price table** — `PLAN_PRICING` has EGP + SAR placeholders; confirm
   final prices and fees margin before launch.
4. **Client keys** — a production keypair must be generated and injected via
   `VITE_ENTITLEMENT_PUBLIC_KEY`; nothing ships with the dev key.
5. **Remote server deploy** — `server.py` must run with `ENVIRONMENT=production`,
   the entitlement key, PayMob secrets, and CORS tightened (currently `*`).
6. **Docs** — `FAST_READING_SPECIFICATION.md` / `plans/payment_lessons_application_plan.md`
   still reference the removed `VITE_DEV_MODE` bypass; update before launch.
7. **Install-persistence test** — Windows installer uninstall/reinstall behaviour
   for the persisted `device_id`/entitlement cache is still unverified.