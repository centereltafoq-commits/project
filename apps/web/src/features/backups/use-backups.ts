import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backupsApi } from './backups-api';
import { UpdateBackupSettingsPayload } from './backups.types';

export function useBackups(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['backups', params],
    queryFn: () => backupsApi.list(params),
  });
}

export function useBackupSettings() {
  return useQuery({
    queryKey: ['backup-settings'],
    queryFn: () => backupsApi.getSettings(),
  });
}

export function useBackupMutations() {
  const queryClient = useQueryClient();

  const triggerMutation = useMutation({
    mutationFn: () => backupsApi.triggerManual(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => backupsApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (payload: UpdateBackupSettingsPayload) =>
      backupsApi.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      backupsApi.restore(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: () => backupsApi.disconnectGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
    },
  });

  return {
    triggerMutation,
    uploadMutation,
    updateSettingsMutation,
    restoreMutation,
    disconnectGoogleMutation,
  };
}

