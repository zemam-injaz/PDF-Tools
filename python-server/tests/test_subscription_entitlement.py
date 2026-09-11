import os
import uuid
from datetime import datetime, timedelta
import pytest

from services.subscription_service import subscription_service
from services.payment_service import payment_service
from models.subscription import SubscriptionStatus, EntitlementType, PlanType


def _new_device() -> str:
    return f"ent_test_{uuid.uuid4()}"


def test_new_user_gets_launch_free_during_launch_period():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "true"
    os.environ["LAUNCH_ACCESS_UNTIL"] = (datetime.now() + timedelta(days=30)).isoformat()

    user = subscription_service.get_or_create_user(_new_device())
    sub = subscription_service.get_subscription(user.user_id)

    assert sub.entitlement == EntitlementType.LAUNCH_FREE
    assert sub.status == SubscriptionStatus.ACTIVE
    assert sub.access_until is not None
    assert sub.grace_until is not None
    assert sub.last_verified_at is not None
    # Launch free unlocks everything
    assert "tahweel" in sub.features_enabled
    assert "beta_access" in sub.features_enabled


def test_after_launch_period_new_user_is_not_launch_free():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "true"
    os.environ["LAUNCH_ACCESS_UNTIL"] = (datetime.now() - timedelta(days=1)).isoformat()

    user = subscription_service.get_or_create_user(_new_device())
    sub = subscription_service.get_subscription(user.user_id)

    assert sub.entitlement != EntitlementType.LAUNCH_FREE
    assert "beta_access" not in sub.features_enabled


def test_launch_free_can_be_disabled_via_env():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "false"
    os.environ["LAUNCH_ACCESS_UNTIL"] = (datetime.now() + timedelta(days=30)).isoformat()

    user = subscription_service.get_or_create_user(_new_device())
    sub = subscription_service.get_subscription(user.user_id)

    assert sub.entitlement == EntitlementType.SUBSCRIPTION  # falls back to trial
    assert "tahweel" in sub.features_enabled
    assert "beta_access" not in sub.features_enabled


def test_expired_user_gets_base_features_only_during_launch():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "true"
    os.environ["LAUNCH_ACCESS_UNTIL"] = (datetime.now() + timedelta(days=30)).isoformat()

    user = subscription_service.get_or_create_user(_new_device())
    subscription_service._update_status(user.user_id, SubscriptionStatus.EXPIRED)
    sub = subscription_service.get_subscription(user.user_id)

    assert sub.entitlement == EntitlementType.EXPIRED
    assert "tahweel" not in sub.features_enabled
    assert "pdf_merge" in sub.features_enabled


def test_verify_access_renews_last_verified_at_and_grace():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "true"
    os.environ["LAUNCH_ACCESS_UNTIL"] = (datetime.now() + timedelta(days=30)).isoformat()

    user = subscription_service.get_or_create_user(_new_device())
    before = subscription_service.get_subscription(user.user_id).last_verified_at

    sub = subscription_service.verify_access(user.user_id)
    assert sub.last_verified_at is not None
    assert sub.last_verified_at >= before
    assert sub.grace_until is not None
    assert sub.grace_until >= sub.last_verified_at


def test_payment_webhook_duplicate_event_id_is_ignored():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "false"
    user = subscription_service.get_or_create_user(_new_device())

    payload = {
        "success": True,
        "event_id": f"evt_{uuid.uuid4()}",
        "transaction_id": f"txn_{uuid.uuid4()}",
        "user_id": user.user_id,
        "plan_id": "yearly",
    }

    first = payment_service.process_webhook(dict(payload))
    assert first.get("fulfilled") is True

    sub_after_first = subscription_service.get_subscription(user.user_id)
    assert sub_after_first.plan_type == PlanType.YEARLY

    duplicate = payment_service.process_webhook(dict(payload))
    assert duplicate.get("duplicate") is True

    sub_after_dup = subscription_service.get_subscription(user.user_id)
    # Same access_until — the duplicate did NOT extend the subscription
    assert sub_after_dup.access_until == sub_after_first.access_until


def test_payment_webhook_same_transaction_different_shape_is_ignored():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "false"
    user = subscription_service.get_or_create_user(_new_device())
    txn_id = f"txn_{uuid.uuid4()}"

    # Shape 1: PayMob-style nested obj
    payload1 = {
        "obj": {"id": txn_id, "success": True},
        "user_id": user.user_id,
        "plan_id": "monthly",
    }
    first = payment_service.process_webhook(payload1)
    assert first.get("fulfilled") is True

    # Shape 2: same transaction, different webhook structure
    payload2 = {
        "success": True,
        "transaction_id": txn_id,
        "event_id": f"evt_{uuid.uuid4()}",
        "user_id": user.user_id,
        "plan_id": "yearly",
    }
    second = payment_service.process_webhook(payload2)
    assert second.get("duplicate") is True

    sub = subscription_service.get_subscription(user.user_id)
    assert sub.plan_type == PlanType.MONTHLY  # not overwritten by the yearly attempt


def test_payment_failed_records_event_but_does_not_activate():
    os.environ["LAUNCH_ACCESS_ENABLED"] = "false"
    user = subscription_service.get_or_create_user(_new_device())

    result = payment_service.process_webhook({
        "success": False,
        "event_id": f"evt_{uuid.uuid4()}",
        "transaction_id": f"txn_{uuid.uuid4()}",
        "user_id": user.user_id,
        "plan_id": "monthly",
    })

    assert result.get("handled") is True
    sub = subscription_service.get_subscription(user.user_id)
    assert sub.plan_type == PlanType.TRIAL  # unchanged
    assert sub.entitlement == EntitlementType.SUBSCRIPTION  # trial, not monthly