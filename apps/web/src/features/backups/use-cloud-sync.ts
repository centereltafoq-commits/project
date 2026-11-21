import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cloudSyncApi,
  TestCloudSyncPayload,
  UpdateCloudSyncConfigPayload,
} from './cloud-sync-api';

export const CLOUD_SYNC_QUERY_KEY = ['cloud-sync-status'] as const;

export function useCloudSyncStatus(enabled = true) {
  return useQuery({
    queryKey: CLOUD_SYNC_QUERY_KEY,
    queryFn: () => cloudSyncApi.getStatus(),
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useCloudSyncMutations() {
  const queryClient = useQueryClient();

  const testMutation = useMutation({
    mutationFn: (payload: TestCloudSyncPayload) => cloudSyncApi.testConnection(payload),
  });

  const saveConfigMutation = useMutation({
    mutationFn: (payload: UpdateCloudSyncConfigPayload) => cloudSyncApi.saveConfig(payload),
    onSuccess: (res) => {
      queryClient.setQueryData(CLOUD_SYNC_QUERY_KEY, res.status);
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const pushMutation = useMutation({
    mutationFn: (payload: { note?: string; force?: boolean }) => cloudSyncApi.push(payload),
    onSuccess: (res) => {
      queryClient.setQueryData(CLOUD_SYNC_QUERY_KEY, res.status);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const pullMutation = useMutation({
    mutationFn: (payload: {
      targetVersion?: number;
      confirmOverwriteLocalChanges?: boolean;
    }) => cloudSyncApi.pull(payload),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries();
      queryClient.setQueryData(CLOUD_SYNC_QUERY_KEY, res.status);
    },
  });

  return {
    testMutation,
    saveConfigMutation,
    pushMutation,
    pullMutation,
  };
}
