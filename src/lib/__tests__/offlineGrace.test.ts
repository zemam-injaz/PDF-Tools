import { describe, it, expect } from 'vitest';
import { evaluateOfflineAccess, type OfflineEntitlement } from '../../contexts/SubscriptionContext';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-02T12:00:00Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();

// A signed entitlement the server verified `verifiedDaysAgo` days ago.
// grace_until = last_verified_at + 7 days; access_until far in the future.
function entitlementVerifiedAgo(verifiedDaysAgo: number): OfflineEntitlement {
  const lastVerified = now - verifiedDaysAgo * DAY;
  return {
    access_until: iso(now + 30 * DAY),
    last_verified_at: iso(lastVerified),
    grace_until: iso(lastVerified + 7 * DAY),
    features_enabled: ['basic_reading', 'tahweel', 'watermark_edit'],
  };
}

describe('evaluateOfflineAccess (offline grace behavior)', () => {
  it('works right after verification (T+0)', () => {
    expect(evaluateOfflineAccess(entitlementVerifiedAgo(0), 'tahweel', now)).toBe(true);
  });

  it('still works at T+6 days (within 7-day grace)', () => {
    expect(evaluateOfflineAccess(entitlementVerifiedAgo(6), 'tahweel', now)).toBe(true);
  });

  it('is restricted at T+7 days + 1 minute even though access_until is in the future', () => {
    const d = entitlementVerifiedAgo(7);
    const afterGrace = new Date(d.grace_until!).getTime() + 60 * 1000;
    expect(evaluateOfflineAccess(d, 'tahweel', afterGrace)).toBe(false);
  });

  it('is restricted when access_until has passed even if grace is still valid (min wins)', () => {
    const d = { ...entitlementVerifiedAgo(0), access_until: iso(now - 1000) };
    expect(evaluateOfflineAccess(d, 'tahweel', now)).toBe(false);
  });

  it('denies features not in the trusted entitlement', () => {
    expect(evaluateOfflineAccess(entitlementVerifiedAgo(1), 'priority_support', now)).toBe(false);
  });

  it('denies everything with no cache at all', () => {
    expect(evaluateOfflineAccess(null, 'tahweel', now)).toBe(false);
  });
});