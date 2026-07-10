'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, ApiError, type StatusResponse } from '@/lib/api';

export const STATUS_POLL_INTERVAL_MS = 5_000;
export const STATUS_WS_PATH = '/api/v1/ws';

type StatusContextValue = {
  status: StatusResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const StatusContext = createContext<StatusContextValue | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await api.status();
      setStatus(next);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load appliance status');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const intervalId = setInterval(() => {
      void refresh();
    }, STATUS_POLL_INTERVAL_MS);

    const es = new EventSource(STATUS_WS_PATH);
    es.onmessage = () => {
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(intervalId);
      es.close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ status, error, loading, refresh }),
    [status, error, loading, refresh],
  );

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useApplianceStatus(): StatusContextValue {
  const ctx = useContext(StatusContext);
  if (!ctx) {
    throw new Error('useApplianceStatus must be used within StatusProvider');
  }
  return ctx;
}