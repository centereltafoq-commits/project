import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
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

const DEFAULT_VALUE: CenterSettingsContextValue = {
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  refetch: async () => {},
};

const CenterSettingsContext = React.createContext<CenterSettingsContextValue>(DEFAULT_VALUE);

export function CenterSettingsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getSettings(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

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
  return React.useContext(CenterSettingsContext) || DEFAULT_VALUE;
}
