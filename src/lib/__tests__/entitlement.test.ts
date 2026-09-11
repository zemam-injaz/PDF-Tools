import { describe, it, expect } from 'vitest';
import { canonicalize, verifyEntitlementSignature } from '../entitlement';

// Matches the real dev keypair embedded in entitlement.ts
const SEED_B64 = 'LsfbnBCWbQcz+j65kZGKx/q9et9fjncXTJnpWk7UYXs=';
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

// Fixed PKCS8 wrapper for an Ed25519 private key (16 bytes) + 32-byte seed.
const PKCS8_HEADER = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

async function signWithDevKey(message: Uint8Array): Promise<ArrayBuffer> {
  const pkcs8 = new Uint8Array(48);
  pkcs8.set(PKCS8_HEADER);
  pkcs8.set(b64ToBytes(SEED_B64), 16);
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
  return crypto.subtle.sign('Ed25519', key, message);
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'u1',
    entitlement: 'launch_free',
    plan_type: 'trial',
    status: 'active',
    access_until: '2026-09-10T22:00:00',
    last_verified_at: '2026-09-02T12:00:00',
    grace_until: '2026-09-09T12:00:00',
    features_enabled: ['basic_reading', 'pdf_merge'],
    ...overrides,
  };
}

async function signed(overrides: Record<string, unknown> = {}) {
  const payload = makePayload(overrides);
  const sig = await signWithDevKey(new TextEncoder().encode(canonicalize(payload)));
  return { ...payload, signature: bytesToB64(new Uint8Array(sig)) };
}

// Simulates a real attacker: sign a GENUINE payload, then modify a field while
// keeping the original signature.
async function tampered(field: string, value: unknown) {
  const genuine = makePayload();
  const sig = await signWithDevKey(new TextEncoder().encode(canonicalize(genuine)));
  return { ...genuine, [field]: value, signature: bytesToB64(new Uint8Array(sig)) };
}

describe('verifyEntitlementSignature', () => {
  it('accepts a genuine server-signed entitlement', async () => {
    expect(await verifyEntitlementSignature(await signed())).toBe(true);
  });

  it('rejects when entitlement is tampered to lifetime', async () => {
    expect(await verifyEntitlementSignature(await tampered('entitlement', 'lifetime'))).toBe(false);
  });

  it('rejects when access_until is forged to the future', async () => {
    expect(await verifyEntitlementSignature(await tampered('access_until', '2099-01-01T00:00:00'))).toBe(false);
  });

  it('rejects when features_enabled is forged to premium', async () => {
    expect(
      await verifyEntitlementSignature(
        await tampered('features_enabled', ['basic_reading', 'tahweel', 'watermark_edit', 'remove_security']),
      ),
    ).toBe(false);
  });

  it('rejects when last_verified_at is forged to be recent', async () => {
    const now = new Date().toISOString();
    expect(await verifyEntitlementSignature(await tampered('last_verified_at', now))).toBe(false);
  });

  it('rejects a payload with no signature', async () => {
    const { signature: _sig, ...noSig } = await signed();
    expect(await verifyEntitlementSignature(noSig)).toBe(false);
  });
});