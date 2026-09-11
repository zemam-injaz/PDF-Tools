import os
import uuid

import pytest
from fastapi import HTTPException

from services.gumroad_service import gumroad_service
from services.subscription_service import subscription_service
from models.subscription import PlanType, SubscriptionStatus


def _device() -> str:
    return f"gum_{uuid.uuid4()}"


def _license() -> str:
    return f"LIC-{uuid.uuid4().hex[:10]}"


def _enable_gumroad(monkeypatch):
    monkeypatch.setenv("GUMROAD_ACCESS_TOKEN", "test-token")
    monkeypatch.setenv("GUMROAD_PRODUCT_MONTHLY", "gr-monthly")
    monkeypatch.setenv("GUMROAD_PRODUCT_ANNUAL", "gr-annual")
    monkeypatch.setenv("GUMROAD_PRODUCT_LIFETIME", "gr-lifetime")
    monkeypatch.setenv("LAUNCH_ACCESS_ENABLED", "false")


def _purchase(permalink="gr-monthly", refunded=False, disputed=False, dispute_won=False,
              email="buyer@example.com", price=4900, currency="usd", **over):
    purchase = {
        "id": str(uuid.uuid4()),
        "product_permalink": permalink,
        "email": email,
        "price": price,
        "currency": currency,
        "refunded": refunded,
        "disputed": disputed,
        "dispute_won": dispute_won,
    }
    purchase.update(over)
    return {
        "success": True,
        "purchase": purchase,
    }


def _fake_verify(monkeypatch, responses, calls=None):
    """responses: dict permalink -> verify response dict. Unknown → failure."""
    def fake(permalink, license_key):
        if calls is not None:
            calls.append(permalink)
        return responses.get(permalink, {"success": False, "message": "The license does not exist"})
    monkeypatch.setattr(gumroad_service, "_verify_license", fake)


# ── Product URLs ─────────────────────────────────────────────────────────────

def test_product_urls_per_plan(monkeypatch):
    _enable_gumroad(monkeypatch)
    assert gumroad_service.get_product_url("monthly")["payment_url"] == "https://gumroad.com/l/gr-monthly"
    assert gumroad_service.get_product_url("annual")["payment_url"] == "https://gumroad.com/l/gr-annual"
    assert gumroad_service.get_product_url("lifetime")["payment_url"] == "https://gumroad.com/l/gr-lifetime"
    assert gumroad_service.get_product_url("yearly")["plan_id"] == "annual"
    with pytest.raises(HTTPException) as exc:
        gumroad_service.get_product_url("enterprise")
    assert exc.value.status_code == 400


def test_not_configured_blocks_activation(monkeypatch):
    monkeypatch.delenv("GUMROAD_ACCESS_TOKEN", raising=False)
    assert gumroad_service.is_configured() is False
    with pytest.raises(HTTPException) as exc:
        gumroad_service.activate(str(uuid.uuid4()), _license())
    assert exc.value.status_code == 503


# ── Activation ───────────────────────────────────────────────────────────────

def test_activate_success_sets_plan_and_premium(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly")})

    user = subscription_service.get_or_create_user(_device())
    result = gumroad_service.activate(user.user_id, _license(), "monthly")

    assert result["activated"] is True
    assert result["plan_id"] == "monthly"

    sub = subscription_service.get_subscription(user.user_id)
    assert sub.plan_type == PlanType.MONTHLY
    assert sub.status == SubscriptionStatus.ACTIVE
    assert "tahweel" in sub.features_enabled
    assert "bookmark_insert" in sub.features_enabled


def test_activate_determines_plan_from_product(monkeypatch):
    """Plan comes from the verified Gumroad product, not the client request."""
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-annual": _purchase("gr-annual")})

    user = subscription_service.get_or_create_user(_device())
    result = gumroad_service.activate(user.user_id, _license(), "monthly")  # client asks monthly
    assert result["plan_id"] == "annual"


def test_activate_is_idempotent_for_same_user(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly")})

    user = subscription_service.get_or_create_user(_device())
    lk = _license()
    gumroad_service.activate(user.user_id, lk, "monthly")
    again = gumroad_service.activate(user.user_id, lk, "monthly")

    assert again["activated"] is True
    sub = subscription_service.get_subscription(user.user_id)
    assert sub.status == SubscriptionStatus.ACTIVE


def test_activate_rejects_duplicate_license_on_other_user(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly")})

    user1 = subscription_service.get_or_create_user(_device())
    lk = _license()
    gumroad_service.activate(user1.user_id, lk, "monthly")

    user2 = subscription_service.get_or_create_user(_device())
    with pytest.raises(HTTPException) as exc:
        gumroad_service.activate(user2.user_id, lk, "monthly")
    assert exc.value.status_code == 409


def test_activate_rejects_refunded_purchase(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly", refunded=True)})

    user = subscription_service.get_or_create_user(_device())
    with pytest.raises(HTTPException) as exc:
        gumroad_service.activate(user.user_id, _license(), "monthly")
    assert exc.value.status_code == 402


def test_activate_rejects_email_mismatch(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly", email="real@example.com")})

    user = subscription_service.get_or_create_user(_device())
    with pytest.raises(HTTPException) as exc:
        gumroad_service.activate(user.user_id, _license(), "monthly", email="wrong@example.com")
    assert exc.value.status_code == 403


def test_activate_rejects_invalid_license(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {})

    user = subscription_service.get_or_create_user(_device())
    with pytest.raises(HTTPException) as exc:
        gumroad_service.activate(user.user_id, _license(), "monthly")
    assert exc.value.status_code == 400


# ── Re-verification / refund / cancellation ──────────────────────────────────

def test_reverify_revokes_entitlement_on_refund(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly")})

    user = subscription_service.get_or_create_user(_device())
    gumroad_service.activate(user.user_id, _license(), "monthly")
    assert subscription_service.get_subscription(user.user_id).status == SubscriptionStatus.ACTIVE

    # Gumroad now reports the purchase refunded
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly", refunded=True)})
    gumroad_service.maybe_reverify(user.user_id, force=True)

    sub = subscription_service.get_subscription(user.user_id)
    assert sub.status == SubscriptionStatus.EXPIRED
    assert "tahweel" not in sub.features_enabled


def test_reverify_revokes_on_cancelled_subscription(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-annual": _purchase("gr-annual")})

    user = subscription_service.get_or_create_user(_device())
    gumroad_service.activate(user.user_id, _license(), "annual")

    _fake_verify(monkeypatch, {
        "gr-annual": _purchase("gr-annual", subscription_cancelled_at="2026-09-01T00:00:00")
    })
    gumroad_service.maybe_reverify(user.user_id, force=True)

    sub = subscription_service.get_subscription(user.user_id)
    assert sub.status == SubscriptionStatus.EXPIRED


def test_reverify_skips_within_cooldown(monkeypatch):
    _enable_gumroad(monkeypatch)
    monkeypatch.setenv("GUMROAD_REVERIFY_COOLDOWN_SECONDS", "999999")
    calls = []
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly")}, calls=calls)

    user = subscription_service.get_or_create_user(_device())
    gumroad_service.activate(user.user_id, _license(), "monthly")
    calls.clear()

    gumroad_service.maybe_reverify(user.user_id)  # no force → inside cooldown
    assert calls == []


def test_webhook_triggers_reverify(monkeypatch):
    _enable_gumroad(monkeypatch)
    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly")})

    user = subscription_service.get_or_create_user(_device())
    lk = _license()
    gumroad_service.activate(user.user_id, lk, "monthly")

    _fake_verify(monkeypatch, {"gr-monthly": _purchase("gr-monthly", refunded=True)})
    result = gumroad_service.handle_webhook({"license_key": lk})

    assert result["status"] == "ok"
    sub = subscription_service.get_subscription(user.user_id)
    assert sub.status == SubscriptionStatus.EXPIRED