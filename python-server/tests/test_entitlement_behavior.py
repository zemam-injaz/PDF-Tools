import os
import uuid
from datetime import datetime, timedelta
import pytest

from services.subscription_service import subscription_service
from services.entitlement_signing import entitlement_signer
from models.subscription import EntitlementType


def _new_device() -> str:
    return f"behavior_{uuid.uuid4()}"


# ----------------------------------------------------------------------
# CRITICAL: last_verified_at must be renewed ONLY by entitlement verification
# ----------------------------------------------------------------------

def test_last_verified_at_not_renewed_by_arbitrary_successful_requests():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "false"
    device = _new_device()
    user = subscription_service.get_or_create_user(device)
    first = subscription_service.get_subscription(user.user_id)
    assert first.last_verified_at is not None
    v1 = first.last_verified_at

    # Simulate many "successful API requests" (login/status reads) — NOT verification
    for _ in range(5):
        subscription_service.get_or_create_user(device)
        subscription_service.get_subscription(user.user_id)

    still = subscription_service.get_subscription(user.user_id)
    assert still.last_verified_at == v1, "arbitrary successful requests must NOT extend verification grace"

    # A real entitlement verification DOES renew it
    verified = subscription_service.verify_access(user.user_id)
    assert verified.last_verified_at is not None
    assert verified.last_verified_at >= v1


# ----------------------------------------------------------------------
# Signed entitlement: tampered cache cannot grant premium offline
# ----------------------------------------------------------------------

def test_signed_entitlement_roundtrip_and_tamper_rejection():
    payload = {
        "user_id": str(uuid.uuid4()),
        "entitlement": "launch_free",
        "plan_type": "trial",
        "status": "active",
        "access_until": "2026-09-10T22:00:00",
        "last_verified_at": "2026-09-02T12:00:00",
        "grace_until": "2026-09-09T12:00:00",
        "features_enabled": ["basic_reading", "pdf_merge"],
    }

    signature = entitlement_signer.sign(payload)
    assert entitlement_signer.verify(payload, signature) is True

    for field, forged in [
        ("entitlement", "lifetime"),
        ("access_until", "2099-01-01T00:00:00"),
        ("last_verified_at", datetime.now().isoformat()),
        ("grace_until", "2099-01-01T00:00:00"),
        ("features_enabled", ["basic_reading", "tahweel", "watermark_edit", "remove_security"]),
    ]:
        tampered = dict(payload)
        tampered[field] = forged
        assert entitlement_signer.verify(tampered, signature) is False, f"tampered field {field} must fail"

    assert entitlement_signer.verify(payload, "AAAA") is False
    assert entitlement_signer.verify({}, signature) is False


# ----------------------------------------------------------------------
# Webhook fail-closed in production without HMAC secret
# ----------------------------------------------------------------------

def test_webhook_fails_closed_in_production_without_secret():
    from fastapi.testclient import TestClient
    import server as s

    client = TestClient(s.app)
    os.environ["ENVIRONMENT"] = "production"
    os.environ.pop("PAYMOB_HMAC_SECRET", None)

    resp = client.post(
        "/api/payment/webhook",
        json={"success": True, "event_id": "e1", "transaction_id": "t1", "user_id": "u", "plan_id": "monthly"},
    )
    assert resp.status_code == 403, "production + missing secret must reject, never process as mock"

    os.environ["ENVIRONMENT"] = "development"


def test_webhook_production_with_bad_hmac_rejected():
    from fastapi.testclient import TestClient
    import server as s

    client = TestClient(s.app)
    os.environ["ENVIRONMENT"] = "production"
    os.environ["PAYMOB_HMAC_SECRET"] = "secret"

    resp = client.post(
        "/api/payment/webhook",
        json={"success": True, "event_id": "e2", "transaction_id": "t2", "user_id": "u", "plan_id": "monthly"},
        headers={"HTTP_HMAC": "forged-hmac"},
    )
    assert resp.status_code == 403

    os.environ["ENVIRONMENT"] = "development"
    os.environ.pop("PAYMOB_HMAC_SECRET", None)


def test_webhook_non_production_without_secret_still_processes_mock():
    from fastapi.testclient import TestClient
    import server as s

    client = TestClient(s.app)
    os.environ["ENVIRONMENT"] = "development"
    os.environ.pop("PAYMOB_HMAC_SECRET", None)

    resp = client.post(
        "/api/payment/webhook",
        json={"success": True, "event_id": "e3", "transaction_id": "t3", "user_id": "u", "plan_id": "monthly"},
    )
    assert resp.status_code == 200, "non-production mock path must still return 200"