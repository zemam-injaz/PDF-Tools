import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { readAppFile, writeAppFile } from '../lib/appStorage';
import { verifyEntitlementSignature } from '../lib/entitlement';

export type PlanType = 'free' | 'trial' | 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type EntitlementType = 'launch_free' | 'trial' | 'subscription' | 'lifetime' | 'expired';

interface SubscriptionData {
  user_id: string;
  entitlement: EntitlementType;
  plan_type: PlanType;
  status: SubscriptionStatus;
  access_until: string | null;
  last_verified_at: string | null;
  grace_until: string | null;
  features_enabled: string[];
  signature: string;
}

// The fields the offline decision actually needs. Signature is validated
// separately (see loadCache) before any of this is trusted.
export interface OfflineEntitlement {
  access_until: string | null;
  last_verified_at: string | null;
  grace_until: string | null;
  features_enabled: string[];
}

interface SubscriptionContextType {
  status: SubscriptionStatus;
  plan: PlanType;
  entitlement: EntitlementType;
  features: string[];
  userId: string | null;
  isLoading: boolean;
  daysRemaining: number | null;
  checkAccess: (feature: string) => boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const CACHE_KEY = 'entitlement_cache.json';
const DEVICE_ID_KEY = 'device_id';
const FALLBACK_GRACE_DAYS = 7;
const GRACE_DAYS_MS = FALLBACK_GRACE_DAYS * 24 * 60 * 60 * 1000;

const computeEffectiveUntil = (d: OfflineEntitlement | null): number => {
  if (!d) return 0;
  const accessUntil = d.access_until ? new Date(d.access_until).getTime() : Number.POSITIVE_INFINITY;
  const graceUntil = d.grace_until
    ? new Date(d.grace_until).getTime()
    : d.last_verified_at
      ? new Date(d.last_verified_at).getTime() + GRACE_DAYS_MS
      : 0;
  return Math.min(accessUntil, graceUntil);
};

// Pure offline decision: the client cache never grants access by itself — it only
// allows using the last trusted (signature-verified) entitlement within its grace
// window. If the grace window expired OR access_until passed → no offline access.
export const evaluateOfflineAccess = (d: OfflineEntitlement | null, feature: string, nowMs: number): boolean => {
  if (!d) return false;
  if (nowMs >= computeEffectiveUntil(d)) return false;
  return d.features_enabled.includes(feature);
};

const loadCache = async (): Promise<SubscriptionData | null> => {
  try {
    const raw = await readAppFile(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as SubscriptionData;
    // Only trust a cache whose server signature verifies. Tampered fields
    // (entitlement/features/access_until/last_verified_at) fail verification
    // and are discarded → no offline access is granted.
    if (!(await verifyEntitlementSignature(cached))) {
      console.warn('[Subscription] Cached entitlement failed signature verification — discarding.');
      return null;
    }
    return cached;
  } catch (e) {
    console.warn('[Subscription] Failed to read entitlement cache:', e);
    return null;
  }
};

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getDeviceId = async (): Promise<string> => {
    let id = await readAppFile(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      await writeAppFile(DEVICE_ID_KEY, id);
    }
    return id;
  };

  const persistCache = async (sub: SubscriptionData) => {
    try {
      await writeAppFile(CACHE_KEY, JSON.stringify(sub));
    } catch (e) {
      console.warn('[Subscription] Failed to write entitlement cache:', e);
    }
  };

  const refreshSubscription = async () => {
    const deviceId = await getDeviceId();
    try {
      const authRes = await api.subscription.authDevice(deviceId);
      if (authRes.success && authRes.data && authRes.data.data) {
        const payload = authRes.data.data.subscription;
        if (payload && payload.features_enabled) {
          setData(payload);
          if (payload.user_id) {
            setUserId(payload.user_id);
          }
          void persistCache(payload);
        }
      } else {
        console.error('Failed to auth device:', authRes.error);
      }
    } catch (e) {
      console.error('Subscription error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Read the persistent cache immediately — no lock screen while verifying
      const cached = await loadCache();
      if (!cancelled) {
        if (cached) {
          setData(cached);
          if (cached.user_id) {
            setUserId(cached.user_id);
          }
        }
        // Then re-verify in the background (renews offline grace window)
        await refreshSubscription();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const daysRemaining = React.useMemo(() => {
    if (!data?.access_until) return null;
    const end = new Date(data.access_until).getTime();
    const now = Date.now();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [data]);

  const value = {
    status: data?.status || 'active',
    plan: data?.plan_type || 'free',
    entitlement: data?.entitlement || 'expired',
    features: data?.features_enabled || [],
    userId,
    isLoading,
    daysRemaining,
    checkAccess: (feature: string) => {
      // Development builds unlock premium controls for the app owner while features are being built.
      if (import.meta.env.DEV) return true;
      // First launch: prevent a lock-screen flash before the server responds
      if (isLoading && !data) return true;
      // The client cache never grants access by itself; it only allows using the
      // last trusted (signature-verified) entitlement within its grace window.
      return evaluateOfflineAccess(data, feature, Date.now());
    },
    refreshSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
