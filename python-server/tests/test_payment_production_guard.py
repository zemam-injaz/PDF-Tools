import os
import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from services.payment_service import payment_service


def _device() -> str:
    return f"prodguard_{uuid.uuid4()}"


def test_checkout_price_is_derived_from_plan_id():
    price = payment_service.get_plan_price("monthly", "EGP")
    assert price["amount"] == 49
    assert price["currency"] == "EGP"

    price = payment_service.get_plan_price("yearly", "EGP")
    assert price["amount"] == 299

    price = payment_service.get_plan_price("lifetime", "SAR")
    assert price["amount"] == 220


def test_checkout_rejects_unknown_plan_id():
    with pytest.raises(HTTPException) as exc:
        payment_service.get_plan_price("enterprise", "EGP")
    assert exc.value.status_code == 400


def test_checkout_rejects_unsupported_currency():
    with pytest.raises(HTTPException) as exc:
        payment_service.get_plan_price("monthly", "USD")
    assert exc.value.status_code == 400


def test_checkout_ignores_client_supplied_amount():
    """The amount is ALWAYS taken from the server price table, never the client."""
    import server as s
    client = TestClient(s.app)
    os.environ["ENVIRONMENT"] = "development"

    resp = client.post(
        "/api/payment/checkout",
        json={"user_id": _device(), "plan_id": "monthly", "amount": 1, "currency": "EGP"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["amount"] == 49, "client amount must be ignored"


def test_mock_gateway_disabled_in_production():
    """The mock gateway must be unreachable in production — it can never fulfill."""
    import server as s
    client = TestClient(s.app)
    os.environ["ENVIRONMENT"] = "production"

    resp = client.get("/api/payment/mock-gateway", params={"user_id": _device(), "plan_id": "monthly"})
    assert resp.status_code == 404, "mock gateway must not exist in production"

    os.environ["ENVIRONMENT"] = "development"


def test_checkout_fails_closed_in_production_without_gateway():
    """Checkout must fail closed (501) in production until PayMob is configured."""
    import server as s
    client = TestClient(s.app)
    os.environ["ENVIRONMENT"] = "production"
    os.environ.pop("PAYMOB_API_KEY", None)

    resp = client.post(
        "/api/payment/checkout",
        json={"user_id": _device(), "plan_id": "monthly"},
    )
    assert resp.status_code == 501, "production checkout must not return a mock URL"

    os.environ["ENVIRONMENT"] = "development"


def test_dev_mode_ignored_in_production():
    """Server DEV_MODE bypass must never unlock features in production."""
    from services.subscription_service import SubscriptionService

    os.environ["DEV_MODE"] = "1"
    os.environ["ENVIRONMENT"] = "production"
    os.environ["LAUNCH_ACCESS_ENABLED"] = "false"
    svc = SubscriptionService()
    user = svc.get_or_create_user(_device())
    sub = svc.get_subscription(user.user_id)

    assert "beta_access" not in sub.features_enabled, "DEV_MODE must be ignored in production"
    assert "tahweel" in sub.features_enabled, "trial premium features still apply"

    os.environ.pop("DEV_MODE", None)
    os.environ["ENVIRONMENT"] = "development"
    os.environ["LAUNCH_ACCESS_ENABLED"] = "true"