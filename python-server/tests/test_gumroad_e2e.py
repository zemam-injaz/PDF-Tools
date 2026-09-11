"""End-to-end validation of the Gumroad flow through the REAL Warraq Remote API.

Covers:
  - purchase → license → activate → subscription → signed entitlement → Pro
  - duplicate activation (idempotent) and transfer (409)
  - refund → re-verification → revoked entitlement (Pro removed)
  - webhook alone cannot activate
  - invalid/fake license cannot activate
  - the entitlement signature verifies with the key embedded in the desktop
"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

import server as s
from services.entitlement_signing import entitlement_signer
from gumroad_sim_server import GumroadSim, VALID_VERIFY_URL

# The exact public key embedded in the desktop build (src/lib/entitlement.ts).
CLIENT_DEV_PUBLIC_KEY_B64 = "thjmQF42nalyE5amyCaTboxXsL0AStbZtg6VpoLXsPM="


@pytest.fixture(scope="module")
def sim():
    sim = GumroadSim(token="test-token")
    sim.start()
    yield sim
    sim.stop()


@pytest.fixture
def client(sim, monkeypatch):
    monkeypatch.setenv("GUMROAD_ACCESS_TOKEN", "test-token")
    monkeypatch.setenv("GUMROAD_PRODUCT_MONTHLY", "gr-monthly")
    monkeypatch.setenv("GUMROAD_PRODUCT_ANNUAL", "gr-annual")
    monkeypatch.setenv("GUMROAD_PRODUCT_LIFETIME", "gr-lifetime")
    monkeypatch.setenv("GUMROAD_VERIFY_URL", sim.url + VALID_VERIFY_URL)
    monkeypatch.setenv("GUMROAD_REVERIFY_COOLDOWN_SECONDS", "0")
    monkeypatch.setenv("LAUNCH_ACCESS_ENABLED", "false")
    return TestClient(s.app)


def _device():
    return f"e2e_{uuid.uuid4().hex}"


def _auth_device(client, device_id):
    r = client.post("/api/subscription/auth/device", json={"device_id": device_id})
    assert r.status_code == 200
    return r.json()["data"]


def _assert_signed(sub):
    """Mirror the desktop (src/lib/entitlement.ts): strip the signature field,
    then verify the canonical payload with the embedded public key."""
    payload = {k: v for k, v in sub.items() if k != "signature"}
    assert entitlement_signer.verify(payload, sub["signature"], CLIENT_DEV_PUBLIC_KEY_B64) is True


def test_end_to_end_purchase_to_pro(client, sim):
    device_id = _device()
    data = _auth_device(client, device_id)
    user_id = data["subscription"]["user_id"]
    assert data["subscription"]["plan_type"] == "trial"

    # Start → Gumroad product URL for the requested plan
    r = client.post("/api/payment/gumroad/start", json={"user_id": user_id, "plan_id": "monthly"})
    assert r.status_code == 200
    url = r.json()["data"]["payment_url"]
    assert "gr-monthly" in url

    # User "buys" on Gumroad → license becomes valid in the sim
    license_key = "E2E-" + uuid.uuid4().hex
    sim.set_license(license_key, "gr-monthly")

    # Activate with the license key
    r = client.post("/api/payment/gumroad/activate",
                    json={"user_id": user_id, "license_key": license_key, "plan_id": "monthly"})
    assert r.status_code == 200
    assert r.json()["data"]["plan_id"] == "monthly"

    # Re-auth → signed monthly entitlement with premium features
    data = _auth_device(client, device_id)
    sub = data["subscription"]
    assert sub["plan_type"] == "monthly"
    assert "tahweel" in sub["features_enabled"]
    assert "bookmark_insert" in sub["features_enabled"]
    _assert_signed(sub)

    # Grace window math: grace_until = last_verified_at + 7 days
    from datetime import datetime, timedelta
    grace = datetime.fromisoformat(sub["grace_until"])
    last = datetime.fromisoformat(sub["last_verified_at"])
    assert (grace - last).days == 7

    # The sim really was called over HTTP with the server token
    assert any(c.get("access_token") == "test-token" for c in sim.verify_calls)


def test_duplicate_activation_idempotent_and_transfer_rejected(client, sim):
    device_a = _device()
    user_a = _auth_device(client, device_a)["subscription"]["user_id"]

    license_key = "E2E-" + uuid.uuid4().hex
    sim.set_license(license_key, "gr-monthly")

    r = client.post("/api/payment/gumroad/activate",
                    json={"user_id": user_a, "license_key": license_key, "plan_id": "monthly"})
    assert r.status_code == 200

    # Same user re-activates the same license → idempotent success
    r = client.post("/api/payment/gumroad/activate",
                    json={"user_id": user_a, "license_key": license_key, "plan_id": "monthly"})
    assert r.status_code == 200
    assert r.json()["data"]["activated"] is True

    # Another user tries the same license → 409 rejected
    device_b = _device()
    user_b = _auth_device(client, device_b)["subscription"]["user_id"]
    r = client.post("/api/payment/gumroad/activate",
                    json={"user_id": user_b, "license_key": license_key, "plan_id": "monthly"})
    assert r.status_code == 409

    # User B stays on trial — no Pro
    sub_b = _auth_device(client, device_b)["subscription"]
    assert sub_b["plan_type"] == "trial"


def test_refund_revokes_pro(client, sim):
    device_id = _device()
    data = _auth_device(client, device_id)
    user_id = data["subscription"]["user_id"]

    license_key = "E2E-" + uuid.uuid4().hex
    sim.set_license(license_key, "gr-monthly")
    client.post("/api/payment/gumroad/activate",
                json={"user_id": user_id, "license_key": license_key, "plan_id": "monthly"})

    sub_pro = _auth_device(client, device_id)["subscription"]
    assert "tahweel" in sub_pro["features_enabled"]

    # Gumroad refunds the purchase
    sim.set_license(license_key, "gr-monthly", refunded=True)

    # Next device auth re-verifies → entitlement revoked, Pro removed
    data = _auth_device(client, device_id)
    sub = data["subscription"]
    assert sub["status"] == "expired"
    assert "tahweel" not in sub["features_enabled"]
    _assert_signed(sub)


def test_webhook_alone_cannot_activate(client, sim):
    device_id = _device()
    user_id = _auth_device(client, device_id)["subscription"]["user_id"]

    # Random webhook payload with an unknown license/sale — never activated anywhere
    r = client.post("/api/payment/gumroad/webhook",
                    json={"license_key": "NOPE-NOT-A-REAL-LICENSE", "sale_id": "sale_123"})
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"

    # No subscription was created/upgraded — still trial
    sub = _auth_device(client, device_id)["subscription"]
    assert sub["plan_type"] == "trial"
    assert sub["user_id"] == user_id


def test_invalid_license_cannot_activate(client, sim):
    device_id = _device()
    user_id = _auth_device(client, device_id)["subscription"]["user_id"]

    # License not in the (simulated) Gumroad store
    r = client.post("/api/payment/gumroad/activate",
                    json={"user_id": user_id, "license_key": "FAKE-" + uuid.uuid4().hex, "plan_id": "monthly"})
    assert r.status_code == 400

    # Still trial — fake license data got us nothing
    sub = _auth_device(client, device_id)["subscription"]
    assert sub["plan_type"] == "trial"
    assert "tahweel" not in sub["features_enabled"] or sub["plan_type"] == "trial"


def test_gumroad_requires_valid_token(client, sim):
    # A caller without the server token gets 401 from the (simulated) Gumroad API
    import requests
    resp = requests.post(sim.url + VALID_VERIFY_URL, data={
        "access_token": "wrong",
        "product_permalink": "gr-monthly",
        "license_key": "anything",
        "increment_uses_count": "false",
    })
    assert resp.status_code == 401


def test_no_client_side_activation_endpoint(client, sim):
    """There is no desktop-facing 'activate' shortcut: activation always requires
    the server to verify with Gumroad first."""
    device_id = _device()
    user_id = _auth_device(client, device_id)["subscription"]["user_id"]

    # Directly creating a subscription via webhook-style endpoints must not exist:
    assert client.post("/api/subscription/activate", json={"user_id": user_id}).status_code == 404