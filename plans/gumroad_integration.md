# Warraq وراق — Gumroad Payment Integration (V1)

> Flow: Warraq Desktop → Warraq Remote API → Gumroad verify → Subscription →
> Signed Ed25519 Entitlement → Warraq Desktop.
> No PayMob. No Supabase Auth. Gumroad is the V1 payment provider.

---

## 1. How a Gumroad purchase is linked to the Warraq user

1. Pricing page → `POST /api/payment/gumroad/start` with `user_id` + `plan_id`.
   The server returns the Gumroad product URL for that plan (plan is chosen by
   the client, but never trusted — see below).
2. The app opens the Gumroad page; the user buys and receives the **License Key**
   by email from Gumroad.
3. The user pastes the License Key (and optionally their Gumroad purchase email)
   into the app → `POST /api/payment/gumroad/activate` with `user_id` + `license_key`.
4. The server verifies the license **with Gumroad** using the server-side access
   token, then stores the binding in `gumroad_licenses`:
   `license_key (UNIQUE) → user_id`. First activation binds; the same license on
   a different Warraq user is rejected (409).
5. The subscription is activated and the next entitlement payload (Ed25519
   signed) carries the premium plan. Desktop shows Pro.

## 2. Verification flow

- Activation: server calls Gumroad `POST /v2/licenses/verify`
  (`increment_uses_count=false`), iterating over the configured product
  permalinks until one matches. It checks `refunded`, `disputed` (unless
  `dispute_won`), and `subscription_ended/cancelled/failed_at`. If any → reject.
  Optional email is cross-checked against the purchase email.
- Periodic: on every `/api/subscription/{auth/device,status,verify}`, the server
  re-checks Gumroad for users with an active Gumroad license, throttled by
  `GUMROAD_REVERIFY_COOLDOWN_SECONDS` (default 12h). Refund/cancellation
  revokes the subscription (server-side), so the next signed entitlement drops
  premium.
- Webhook: `POST /api/payment/gumroad/webhook` is a **signal only** — it never
  fulfills. It just triggers an immediate re-verify against Gumroad, so a spoofed
  webhook cannot grant anything.

## 3. Refund / cancellation

- Detected on re-verification (cooldown ≤ 12h) and on webhook signal.
- `gumroad_service._revoke()` marks the license `revoked` and sets the
  subscription to `expired` with `access_until = now`. The client keeps access
  only for the remaining signed offline-grace window (7 days) — same as any
  normal expiry.

## 4. Duplicate activation prevention

- `gumroad_licenses.license_key` is `UNIQUE`.
- Same user + same license → idempotent (returns success, no double-fulfillment).
- Different user + same license → HTTP 409.
- A post-insert re-check guards the concurrent-activation race.
- `increment_uses_count=false` avoids burning Gumroad license uses on checks.

## 5. Where Gumroad secrets live

Server environment only (never in git, never in the desktop app, never logged):
- `GUMROAD_ACCESS_TOKEN`
- `GUMROAD_PRODUCT_MONTHLY` / `_ANNUAL` / `_LIFETIME` (permalinks)
- `GUMROAD_REVERIFY_COOLDOWN_SECONDS` (optional)

The desktop never contacts Gumroad directly — it only talks to the Warraq remote
API.

## 6. API endpoints (new/changed)

| Endpoint | Purpose |
|---|---|
| `POST /api/payment/gumroad/start` | Returns the Gumroad product URL for a plan |
| `POST /api/payment/gumroad/activate` | Verifies + binds license, activates plan |
| `POST /api/payment/gumroad/webhook` | Signal-only; triggers re-verify |
| `POST /api/subscription/auth/device` / `status` / `verify` | Now include Gumroad re-verification before signing the entitlement |

`/api/payment/checkout` (PayMob-era) is no longer called by the app; the PayMob
webhook machinery remains dormant and fail-closed.

## 7. Files changed

| File | Change |
|---|---|
| `python-server/services/gumroad_service.py` | New — Gumroad verify, activation, binding, re-verify, revocation, webhook handling |
| `python-server/api/gumroad_routes.py` | New — `/start`, `/activate`, `/webhook` |
| `python-server/server.py` | Registered gumroad router |
| `python-server/api/subscription_routes.py` | Re-verify Gumroad before signing entitlements |
| `python-server/services/payment_service.py` | `annual` canonical id (+ `yearly` alias) |
| `src/lib/api.ts` | `payment.gumroad.start/activate` (remote) replace `payment.checkout` |
| `src/components/pricing/PricingPage.tsx` | Gumroad buy → license-key entry UX; `annual` plan id |
| `.env.example` | `GUMROAD_*` server vars |
| `python-server/tests/test_gumroad_service.py` | New — 13 tests |
| `APP_CURRENT_STATE.md` | Payment provider updated |

## 8. Test results

- Python: **81 passed** (68 previous + 13 Gumroad)
  — activation, plan-from-product, idempotency, duplicate-license 409, refund
  rejection, email mismatch, invalid license, refund/cancel re-verify revoke,
  cooldown skip, webhook trigger.
- Frontend vitest: **92 passed**
- `tsc -b`: **0 errors**

## 9. Gumroad limitations to know before launch

1. **License keys are transferable.** Whoever enters a valid key first binds it
   to their Warraq account. The optional email field reduces, but does not
   eliminate, key sharing. (Anti-abuse is out of scope for V1.)
2. **Re-verification is throttled (12h).** A refund is effective within ≤12h +
   the 7-day offline grace window. A refunded user keeps premium for up to
   ~12h+7 days of offline use.
3. **Webhooks are unsigned.** We treat them as signals only (always re-verify
   with the server token), so they cannot grant access — but set the webhook URL
   to the Gumroad product settings to receive sale/refund/cancellation events.
4. **Gumroad fees + currency.** Gumroad charges ~10% (flat $0.30 + 10%) and
   handles taxes/invoices. EGP prices should include that margin. Gumroad is
   USD-based for payouts.
5. **No native local currencies/subscription billing edge cases.** Monthly/annual
   renewals are managed by Gumroad's subscription products; our cooldown-based
   re-verify catches cancellations. There is no "dunning" UI.
6. **Availability of the verify API** requires the product to have "Enable
   license keys" on, and the permalinks must match the `GUMROAD_PRODUCT_*` env.
7. **Single activation per license** is the V1 model — no multi-device accounts.