"""Real HTTP Gumroad simulator for end-to-end tests.

Mirrors Gumroad's POST /v2/licenses/verify behaviour closely enough to exercise
the real Warraq Remote API over an actual HTTP boundary:
  - access_token mismatch → 401
  - unknown license → {"success": false, "message": "The license does not exist"}
  - license belongs to a different product permalink → not found
  - valid → {"success": true, "purchase": {...}}

Only used by tests. Never shipped.
"""
import threading
import uuid

import uvicorn

VALID_VERIFY_URL = "/v2/licenses/verify"


class GumroadSim:
    def __init__(self, token: str = "test-token"):
        self.token = token
        self.licenses: dict[str, dict] = {}
        self.verify_calls: list[dict] = []
        self._server = None
        self._thread = None
        self.url: str | None = None

    def _build_app(self):
        from fastapi import FastAPI, HTTPException, Request

        app = FastAPI()

        @app.post(VALID_VERIFY_URL)
        async def verify(request: Request):
            form = dict(await request.form())
            self.verify_calls.append(form)

            if form.get("access_token") != self.token:
                raise HTTPException(status_code=401, detail="invalid access token")

            license_key = form.get("license_key", "")
            permalink = form.get("product_permalink", "")

            purchase = self.licenses.get(license_key)
            if purchase is None or purchase.get("product_permalink") != permalink:
                return {"success": False, "message": "The license does not exist"}

            return {"success": True, "uses": 0, "purchase": purchase}

        self._app = app
        return app

    def start(self):
        import socket
        import time

        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        sock.close()

        config = uvicorn.Config(self._build_app(), host="127.0.0.1", port=port, log_level="warning")
        self._server = uvicorn.Server(config)
        self._thread = threading.Thread(target=self._server.run, daemon=True)
        self._thread.start()

        self.url = f"http://127.0.0.1:{port}"

        import requests
        for _ in range(100):
            try:
                requests.get(f"{self.url}/docs", timeout=0.5)
                return self.url
            except Exception:
                time.sleep(0.05)
        raise RuntimeError("Gumroad sim failed to start")

    def stop(self):
        if self._server:
            self._server.should_exit = True
        if self._thread:
            self._thread.join(timeout=5)

    def set_license(self, license_key: str, permalink: str, **purchase_overrides):
        purchase = {
            "id": str(uuid.uuid4()),
            "product_id": str(uuid.uuid4()),
            "product_permalink": permalink,
            "product_name": permalink,
            "email": "buyer@example.com",
            "price": 4900,
            "currency": "usd",
            "refunded": False,
            "disputed": False,
            "dispute_won": False,
            "subscription_ended_at": None,
            "subscription_cancelled_at": None,
            "subscription_failed_at": None,
        }
        purchase.update(purchase_overrides)
        self.licenses[license_key] = purchase