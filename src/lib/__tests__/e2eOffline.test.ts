import { describe, it, expect } from 'vitest';
import fixture from './fixtures/e2e_entitlement.json';
import { verifyEntitlementSignature } from '../entitlement';
import { evaluateOfflineAccess } from '../../contexts/SubscriptionContext';

const GRACE_END_MS = new Date('2026-09-09T12:00:00').getTime();
const WITHIN_GRACE_MS = new Date('2026-09-05T00:00:00').getTime();
const AFTER_GRACE_MS = GRACE_END_MS + 60 * 1000;

describe('E2E offline behavior (real server-signed entitlement fixture)', () => {
  it('verifies the signed entitlement with the embedded desktop public key', async () => {
    expect(await verifyEntitlementSignature(fixture)).toBe(true);
  });

  it('grants premium features within the 7-day offline grace window', () => {
    expect(evaluateOfflineAccess(fixture, 'fast_reading', WITHIN_GRACE_MS)).toBe(true);
    expect(evaluateOfflineAccess(fixture, 'bookmark_insert', WITHIN_GRACE_MS)).toBe(true);
  });

  it('stops granting Pro after the grace window expires', () => {
    expect(evaluateOfflineAccess(fixture, 'fast_reading', AFTER_GRACE_MS)).toBe(false);
  });

  it('never grants a feature that is not in the entitlement', () => {
    expect(evaluateOfflineAccess(fixture, 'priority_support', WITHIN_GRACE_MS)).toBe(false);
  });

  it('rejects a tampered cache (forged premium features)', async () => {
    const tampered = {
      ...fixture,
      features_enabled: [...fixture.features_enabled, 'priority_support'],
    };
    expect(await verifyEntitlementSignature(tampered)).toBe(false);
  });
});