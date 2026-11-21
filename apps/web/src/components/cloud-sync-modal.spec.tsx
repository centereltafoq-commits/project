import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemRole } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { cloudSyncApi, CloudSyncStatusResponse } from '@/features/backups/cloud-sync-api';
import { HeaderCloudSyncButton } from './header-cloud-sync-button';
import { CloudSyncModal } from './cloud-sync-modal';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/backups/cloud-sync-api', () => ({
  cloudSyncApi: {
    getStatus: vi.fn(),
    testConnection: vi.fn(),
    saveConfig: vi.fn(),
    push: vi.fn(),
    pull: vi.fn(),
  },
}));

describe('CloudSyncModal & HeaderCloudSyncButton', () => {
  const baseStatus: CloudSyncStatusResponse = {
    configured: true,
    enabled: true,
    state: 'REMOTE_NEWER',
    stateMessageAr: 'توجد نسخة أحدث على السحابة (v2) منشورة من جهاز السنتر.',
    deviceId: 'manager-pc',
    deviceName: 'جهاز المدير (المتابعة والإدارة)',
    supabaseUrl: 'https://demo-center.supabase.co',
    supabaseKeyMasked: 'sb_key••••••1234',
    hasSupabaseKey: true,
    bucketName: 'educenter-sync',
    lastSyncedVersion: 1,
    lastSyncedAt: '2026-11-21T10:00:00.000Z',
    lastPushedAt: null,
    lastPulledAt: '2026-11-21T10:00:00.000Z',
    hasLocalUnsyncedChanges: true,
    localStats: {
      studentsCount: 40,
      teachersCount: 6,
      groupsCount: 8,
      sessionsCount: 20,
      attendanceCount: 150,
      paymentsCount: 30,
      expensesCount: 4,
      auditCount: 55,
      lastMutationAt: '2026-11-21T11:00:00.000Z',
      fingerprint: 'local-fp',
    },
    remoteLatest: {
      version: 2,
      snapshotPath: 'snapshots/v2.sql.gz',
      fileName: 'sync-v2.sql.gz',
      checksum: 'abcdef1234567890',
      fileSizeBytes: 51200,
      pushedAt: '2026-11-21T13:00:00.000Z',
      pushedByName: 'أسستنت الاستقبال',
      pushedByRole: SystemRole.ATTENDANCE_EMPLOYEE,
      deviceName: 'جهاز السنتر الرئيسي',
      deviceId: 'center-pc',
      centerName: 'سنتر التفوق',
      note: 'تم تقفيل حصص المساء',
      stats: {
        studentsCount: 45,
        teachersCount: 6,
        groupsCount: 8,
        sessionsCount: 24,
        attendanceCount: 180,
        paymentsCount: 35,
        expensesCount: 4,
        auditCount: 70,
        lastMutationAt: '2026-11-21T13:00:00.000Z',
        fingerprint: 'remote-fp',
      },
    },
    remoteHistory: [],
    connectionError: null,
    checkedAt: '2026-11-21T13:05:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cloudSyncApi.getStatus).mockResolvedValue(baseStatus);
    vi.mocked(authContextModule.useAuth).mockReturnValue({
      user: {
        id: 'assistant-1',
        fullName: 'أسستنت الاستقبال',
        email: 'assistant@center.com',
        roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
        roleNameAr: 'موظف الحضور والاستقبال',
        permissions: [],
      },
      isLoading: false,
      logout: vi.fn(),
      hasPermission: () => false,
    } as any);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('shows prominent header button for assistant and displays remote update badge', async () => {
    renderWithProviders(<HeaderCloudSyncButton />);

    const btn = await screen.findByTestId('header-cloud-sync-btn');
    expect(btn).toBeInTheDocument();
    expect(await screen.findByText(/سحب تعديلات جديدة \(v2\)/)).toBeInTheDocument();
  });

  it('hides header sync button for TEACHER role', () => {
    vi.mocked(authContextModule.useAuth).mockReturnValue({
      user: {
        id: 'teacher-1',
        fullName: 'أحمد المدرس',
        email: 'teacher@center.com',
        roleCode: SystemRole.TEACHER,
        roleNameAr: 'مدرس',
        permissions: [],
      },
      isLoading: false,
      logout: vi.fn(),
      hasPermission: () => false,
    } as any);

    renderWithProviders(<HeaderCloudSyncButton />);
    expect(screen.queryByTestId('header-cloud-sync-btn')).not.toBeInTheDocument();
  });

  it('requires safety confirmation before pulling when local has unsynced changes', async () => {
    const inSyncStatus: CloudSyncStatusResponse = {
      ...baseStatus,
      state: 'IN_SYNC',
      lastSyncedVersion: 2,
      hasLocalUnsyncedChanges: false,
    };
    vi.mocked(cloudSyncApi.pull).mockResolvedValue({
      success: true,
      message: 'تم سحب وتحديث البيانات بنجاح',
      pulledVersion: baseStatus.remoteLatest!,
      safetyBackupFileName: 'backup-safety.sql.gz',
      status: inSyncStatus,
    });

    renderWithProviders(
      <CloudSyncModal open={true} onOpenChange={() => undefined} defaultTab="sync" />,
    );

    const pullBtn = await screen.findByTestId('cloud-sync-pull-btn');
    fireEvent.click(pullBtn);

    // Must NOT call pull immediately when local has unsynced changes; must show confirmation warning first
    expect(cloudSyncApi.pull).not.toHaveBeenCalled();
    const confirmBtn = await screen.findByTestId('cloud-sync-confirm-pull-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cloudSyncApi.pull).toHaveBeenCalledWith({
        targetVersion: undefined,
        confirmOverwriteLocalChanges: true,
      });
    });
  });
});
