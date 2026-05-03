import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const STALE_TIME_MS = 60 * 60 * 1000;
const DISMISS_KEY = 'bugpin.updateBanner.dismissedVersion';

interface VersionResponse {
  success: boolean;
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  lastCheckedAt: string | null;
  checkEnabled: boolean;
}

function readDismissedVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissedVersion(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISS_KEY, value);
  } catch {
    // localStorage may be unavailable (private mode, quota); the banner stays dismissed for the session via state.
  }
}

export function useUpdateCheck() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const query = useQuery({
    queryKey: ['version'],
    queryFn: async () => {
      const response = await api.get('/version');
      return response.data as VersionResponse;
    },
    enabled: isAdmin,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const latest = query.data?.latest ?? null;
  const releaseUrl = query.data?.releaseUrl ?? null;
  const updateAvailable = query.data?.updateAvailable ?? false;
  const checkEnabled = query.data?.checkEnabled ?? false;

  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() =>
    readDismissedVersion()
  );

  useEffect(() => {
    setDismissedVersion(readDismissedVersion());
  }, [latest]);

  const isDismissed = latest !== null && dismissedVersion === latest;

  const dismiss = () => {
    if (!latest) return;
    writeDismissedVersion(latest);
    setDismissedVersion(latest);
  };

  return {
    isAdmin,
    checkEnabled,
    updateAvailable,
    latest,
    releaseUrl,
    isDismissed,
    dismiss,
  };
}
