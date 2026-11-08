import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, SystemSettings } from './settings-api';

interface CenterSettingsContextValue {
  settings: SystemSettings;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

const DEFAULT_SETTINGS: SystemSettings = {
  id: 'default',
  centerName: 'سنتر النخبة التعليمي',
  centerSubtitle: 'نظام الإدارة المتكامل',
  logoUrl: null,
  phone: null,
  address: null,
  academicYear: '2026 / 2027',
  currencySymbol: 'ج.م',
  updatedAt: new Date().toISOString(),
  updatedBy: null,
};

const CenterSettingsContext = React.createContext<CenterSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  refetch: async () => {},
});

export function CenterSettingsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getSettings(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const refetch = React.useCallback(async () => {
    return queryClient.invalidateQueries({ queryKey: ['settings'] });
  }, [queryClient]);

  const value = React.useMemo<CenterSettingsContextValue>(
    () => ({
      settings: data ?? DEFAULT_SETTINGS,
      isLoading,
      refetch,
    }),
    [data, isLoading, refetch],
  );

  return (
    <CenterSettingsContext.Provider value={value}>
      {children}
    </CenterSettingsContext.Provider>
  );
}

export function useCenterSettings(): CenterSettingsContextValue {
  const context = React.useContext(CenterSettingsContext);
  if (!context) {
    throw new Error('useCenterSettings must be used within a CenterSettingsProvider');
  }
  return context;
}
