-- Warraq Monetization — Supabase schema (source of truth)
-- Apply in the Supabase SQL editor. FastAPI remains the Business Logic / API layer;
-- subscriptions + payment_events live here instead of SQLite once connected.

-- ============================================================
-- subscriptions
-- ============================================================
create table if not exists public.subscriptions (
    id                      uuid primary key default gen_random_uuid(),
    user_id                 uuid not null references auth.users(id) on delete cascade,
    plan_id                 text not null,                       -- monthly | yearly | lifetime
    status                  text not null default 'active',     -- active | expired | cancelled
    started_at              timestamptz not null default now(),
    access_until            timestamptz,                         -- access entitlement expiry
    last_verified_at        timestamptz,                         -- last successful server verification
    provider                text not null default 'paymob',
    provider_customer_id    text,
    provider_subscription_id text,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

-- ============================================================
-- payment_events (idempotency + archive)
-- ============================================================
create table if not exists public.payment_events (
    id                  uuid primary key default gen_random_uuid(),
    provider            text not null default 'paymob',
    provider_event_id   text not null,                           -- PayMob webhook event id
    event_type          text not null,                           -- payment_success | payment_failed | checkout_started
    user_id             uuid references auth.users(id),
    transaction_id      text,                                    -- provider_transaction_id
    payload_hash        text,
    created_at          timestamptz not null default now(),
    processed_at        timestamptz
);

-- A webhook may be redelivered; the same transaction may arrive via different
-- webhook shapes — both dimensions are guarded:
create unique index if not exists payment_events_provider_event_uidx
    on public.payment_events (provider, provider_event_id);
create unique index if not exists payment_events_provider_txn_uidx
    on public.payment_events (provider, transaction_id);

-- ============================================================
-- Launch period (server-controlled, no app release needed)
-- ============================================================
-- Set these once via RLS-protected settings; the FastAPI service reads them from
-- environment (LAUNCH_ACCESS_ENABLED / LAUNCH_ACCESS_UNTIL / OFFLINE_GRACE_DAYS)
-- so flipping the entitlement of every user never requires a new app version.
create table if not exists public.app_settings (
    key   text primary key,
    value text not null
);

insert into public.app_settings (key, value)
values
    ('launch_access_enabled', 'true'),
    ('launch_access_until',   '2027-03-01T00:00:00:00+00:00'),
    ('offline_grace_days',    '7')
on conflict (key) do nothing;