import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export type PlanType = 'free' | 'trial' | 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

interface SubscriptionData {
  subscription_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  features_enabled: string[];
}

interface SubscriptionContextType {
  status: SubscriptionStatus;
  plan: PlanType;
  features: string[];
  userId: string | null;
  isLoading: boolean;
  daysRemaining: number | null;
  checkAccess: (feature: string) => boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const DEVICE_ID_KEY = 'pdf_tools_device_id';

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getDeviceId = () => {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  };

  const refreshSubscription = async () => {
    const deviceId = getDeviceId();
    try {
      // First try to authenticate/register
      const authRes = await api.subscription.authDevice(deviceId);
      if (authRes.success && authRes.data && authRes.data.data) {
        setData(authRes.data.data.subscription);
        if (authRes.data.data.user) {
            setUserId(authRes.data.data.user.user_id);
        }
      } else {
        console.error("Failed to auth device:", authRes.error);
      }
    } catch (e) {
      console.error("Subscription error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, []);

  const daysRemaining = React.useMemo(() => {
    if (!data?.trial_ends_at) return null;
    const end = new Date(data.trial_ends_at);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [data]);

  const value = {
    status: data?.status || 'active', // Default to active if loading? No, be careful.
    plan: data?.plan_type || 'free',
    features: data?.features_enabled || [],
    userId,
    isLoading,
    daysRemaining,
    checkAccess: (feature: string) => {
        if (!data) return false;
        // If data is present, check features
        return data.features_enabled.includes(feature);
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
