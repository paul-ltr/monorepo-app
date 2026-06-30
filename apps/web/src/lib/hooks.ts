import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './api';

/** Session + permissions for the current user. */
export function useSession() {
  const api = useApi();
  return useQuery({ queryKey: ['session'], queryFn: () => api.getSession() });
}

/** White-label branding; applies the tenant primary color to --primary. */
export function useBranding() {
  const api = useApi();
  const query = useQuery({ queryKey: ['branding'], queryFn: () => api.getBranding() });
  const primary = query.data?.primaryColor;
  useEffect(() => {
    if (!primary) return;
    const root = document.documentElement;
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-strong', primary);
  }, [primary]);
  return query;
}
