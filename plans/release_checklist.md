# Warraq وراق — Release Checklist (Gumroad V1)

Validation passed (see `gumroad_integration.md` + `test_gumroad_e2e.py` +
`e2eOffline.test.ts`). This checklist is the remaining PRODUCTION deployment
work — nothing here can be committed to Git as a secret.

---

## 1. Remote API on the real production domain

1. Provision a VPS (e.g. Hostinger) with a public IP + a domain, e.g. `api.warraq.app`.
2. Point `A`/`CNAME` records at the VPS.
3. Install Python 3.11+ and the `python-server` dependencies:
   `pip install -r requirements.txt`.
4. Run behind a reverse proxy (nginx) → uvicorn:

   ```
   uvicorn server:app --host 127.0.0.1 --port 8002 --workers 2
   ```

5. HTTPS: certbot/Let's Encrypt for `api.warraq.app`; force TLS.
   (The desktop talks HTTPS; Gumroad webhook needs a public HTTPS URL.)

## 2. CORS restricted

- `CORS_ALLOW_ORIGINS=https://warraq.app,https://www.warraq.app`
  (never `*` in production).

## 3. Production environment variables (server env, NOT in Git)

```
ENVIRONMENT=production
PORT=8002
CORS_ALLOW_ORIGINS=https://warraq.app,https://www.warraq.app
LAUNCH_ACCESS_ENABLED=true            # set false when you start charging
LAUNCH_ACCESS_UNTIL=<your date>
OFFLINE_GRACE_DAYS=7

# Gumroad
GUMROAD_ACCESS_TOKEN=<real>
GUMROAD_PRODUCT_MONTHLY=<real permalink>
GUMROAD_PRODUCT_ANNUAL=<real permalink>
GUMROAD_PRODUCT_LIFETIME=<real permalink>
GUMROAD_REVERIFY_COOLDOWN_SECONDS=43200

# Entitlement signing
ENTITLEMENT_PRIVATE_KEY=<base64 private key>
```

## 4. Production Ed25519 key

- Generate: `python -m scripts.generate_entitlement_keys --out ~/.warraq/entitlement_prod.key`
  from `python-server/`.
- Private key → `ENTITLEMENT_PRIVATE_KEY` env on the server only.
- Public key → build the desktop with `VITE_ENTITLEMENT_PUBLIC_KEY=<public b64>`.
- Server refuses to boot with `ENVIRONMENT=production` if no private key is set.

## 5. Gumroad setup

- Create 3 products: monthly / annual / lifetime, each with **Enable license keys** ON.
- Set permalinks matching `GUMROAD_PRODUCT_*`.
- Product access token (or account token) → `GUMROAD_ACCESS_TOKEN`.
- Set the webhook URL in each product:
  `https://api.warraq.app/api/payment/gumroad/webhook`
  (signal-only; never grants anything by itself).

## 6. Desktop release build

- `.env` for the build:
  ```
  VITE_DEV_MODE=false
  VITE_REMOTE_API_BASE_URL=https://api.warraq.app
  VITE_ENTITLEMENT_PUBLIC_KEY=<public b64>
  ```
- Rebuild `pdf_server.exe` → `src-tauri/resources/`, then `npm run tauri build`.

## 7. Smoke test on production

- `POST /api/subscription/auth/device` returns a signed entitlement.
- Real purchase → enter license → `/api/payment/gumroad/activate` → Pro.
- Refund a test sale → next verify drops Pro.
- Confirm `/api/payment/mock-gateway` returns 404 on production.

---

## Blocker before public release (exact)

1. Real Gumroad account: products created, license keys enabled, access token,
   permalinks, and webhook URL configured.
2. Production server deployed on a real domain with HTTPS + env vars.
3. Production Ed25519 keypair generated and injected (server env + build).
4. `VITE_REMOTE_API_BASE_URL` pointed at the real domain in the release build.
5. A 1-sale real test purchase end-to-end on the live domain (cannot be done
   from this repo without your Gumroad credentials).