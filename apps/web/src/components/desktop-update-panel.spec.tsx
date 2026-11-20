import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/design-system';
import * as useDesktopModule from '@/hooks/use-desktop';
import {
  DesktopUpdateModal,
  DesktopUpdatePanel,
  parseGithubRepoInput,
} from './desktop-update-panel';

vi.mock('@/hooks/use-desktop', () => ({
  useDesktop: vi.fn(),
}));

describe('DesktopUpdatePanel & DesktopUpdateModal', () => {
  const useDesktopMock = vi.mocked(useDesktopModule.useDesktop);
  const saveConfig = vi.fn().mockResolvedValue({});
  const checkForUpdates = vi.fn().mockResolvedValue({ state: 'UP_TO_DATE' });
  const installUpdate = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses full GitHub URL and owner/repo shorthand accurately', () => {
    expect(parseGithubRepoInput('https://github.com/client-org/educenter-erp', '')).toEqual({
      githubOwner: 'client-org',
      githubRepo: 'educenter-erp',
    });
    expect(parseGithubRepoInput('client-org/my-center-app.git', 'ignored')).toEqual({
      githubOwner: 'client-org',
      githubRepo: 'my-center-app',
    });
    expect(parseGithubRepoInput('client-org', 'educenter-erp')).toEqual({
      githubOwner: 'client-org',
      githubRepo: 'educenter-erp',
    });
  });

  it('renders UNCONFIGURED placeholder cleanly and saves parsed GitHub URL + startup toggle', async () => {
    useDesktopMock.mockReturnValue({
      isDesktop: true,
      config: {
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        directPrintEnabled: true,
        keepRunningInTray: true,
        launchOnStartup: false,
        updateSettings: {
          autoCheck: true,
          githubOwner: '',
          githubRepo: 'educenter-erp',
        },
        isFirstLaunch: false,
      },
      updateStatus: {
        state: 'UNCONFIGURED',
        currentVersion: '1.0.0',
        isConfigured: false,
        githubOwner: '',
        githubRepo: 'educenter-erp',
      },
      saveConfig,
      checkForUpdates,
      installUpdate,
    } as any);

    render(
      <ToastProvider>
        <DesktopUpdatePanel />
      </ToastProvider>,
    );

    expect(screen.getByText('بانتظار ربط GitHub')).toBeInTheDocument();

    const ownerInput = screen.getByLabelText('حساب GitHub أو رابط المستودع');
    fireEvent.change(ownerInput, { target: { value: 'https://github.com/nazzem/center-erp' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ ربط GitHub' }));

    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalledWith({
        updateSettings: {
          autoCheck: true,
          githubOwner: 'nazzem',
          githubRepo: 'center-erp',
        },
      });
    });

    const startupCheckbox = screen.getByLabelText('تشغيل البرنامج تلقائياً مع فتح الويندوز');
    fireEvent.click(startupCheckbox);

    await waitFor(() => {
      expect(saveConfig).toHaveBeenCalledWith({ launchOnStartup: true });
    });
  });

  it('renders download progress bar while DOWNLOADING and triggers quitAndInstall when DOWNLOADED', () => {
    useDesktopMock.mockReturnValue({
      isDesktop: true,
      config: {
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        directPrintEnabled: true,
        keepRunningInTray: true,
        launchOnStartup: false,
        updateSettings: {
          autoCheck: true,
          githubOwner: 'client-org',
          githubRepo: 'educenter-erp',
        },
        isFirstLaunch: false,
      },
      updateStatus: {
        state: 'DOWNLOADING',
        currentVersion: '1.0.0',
        availableVersion: '1.0.1',
        downloadPercent: 62,
        isConfigured: true,
        githubOwner: 'client-org',
        githubRepo: 'educenter-erp',
      },
      saveConfig,
      checkForUpdates,
      installUpdate,
    } as any);

    const { rerender } = render(
      <ToastProvider>
        <DesktopUpdatePanel />
      </ToastProvider>,
    );

    expect(screen.getByText('62%')).toBeInTheDocument();

    useDesktopMock.mockReturnValue({
      isDesktop: true,
      config: {
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        directPrintEnabled: true,
        keepRunningInTray: true,
        launchOnStartup: false,
        updateSettings: {
          autoCheck: true,
          githubOwner: 'client-org',
          githubRepo: 'educenter-erp',
        },
        isFirstLaunch: false,
      },
      updateStatus: {
        state: 'DOWNLOADED',
        currentVersion: '1.0.0',
        availableVersion: '1.0.1',
        isConfigured: true,
        githubOwner: 'client-org',
        githubRepo: 'educenter-erp',
      },
      saveConfig,
      checkForUpdates,
      installUpdate,
    } as any);

    rerender(
      <ToastProvider>
        <DesktopUpdatePanel />
      </ToastProvider>,
    );

    const installBtn = screen.getByRole('button', { name: 'تثبيت وإعادة التشغيل الآن' });
    fireEvent.click(installBtn);
    expect(installUpdate).toHaveBeenCalledTimes(1);
  });

  it('auto-triggers checkForUpdates when DesktopUpdateModal opens and repo is configured', async () => {
    useDesktopMock.mockReturnValue({
      isDesktop: true,
      config: {
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        directPrintEnabled: true,
        updateSettings: {
          autoCheck: true,
          githubOwner: 'client-org',
          githubRepo: 'educenter-erp',
        },
        isFirstLaunch: false,
      },
      updateStatus: {
        state: 'IDLE',
        currentVersion: '1.0.0',
        isConfigured: true,
        githubOwner: 'client-org',
        githubRepo: 'educenter-erp',
      },
      saveConfig,
      checkForUpdates,
      installUpdate,
    } as any);

    render(
      <ToastProvider>
        <DesktopUpdateModal open onOpenChange={vi.fn()} />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(checkForUpdates).toHaveBeenCalledTimes(1);
    });
  });
});
