import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackupsScheduler } from './backups.scheduler';

describe('BackupsScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('catches up after the configured backup time when the application was stopped', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 2, 5, 0));
    const backups = {
      getSettings: vi.fn().mockResolvedValue({
        autoBackupEnabled: true,
        scheduleTime: '02:00',
      }),
      hasSuccessfulScheduledBackupSince: vi.fn().mockResolvedValue(false),
      createBackup: vi.fn().mockResolvedValue({ id: 'backup-1' }),
    };
    const scheduler = new BackupsScheduler(backups as any);

    await scheduler.checkSchedule();

    expect(backups.hasSuccessfulScheduledBackupSince).toHaveBeenCalledWith(
      new Date(2026, 10, 19, 0, 0, 0),
    );
    expect(backups.createBackup).toHaveBeenCalledTimes(1);
    expect(backups.createBackup).toHaveBeenCalledWith('SCHEDULED');
  });

  it('does not create a second successful backup for the same day after restart', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 2, 5, 0));
    const backups = {
      getSettings: vi.fn().mockResolvedValue({
        autoBackupEnabled: true,
        scheduleTime: '02:00',
      }),
      hasSuccessfulScheduledBackupSince: vi.fn().mockResolvedValue(true),
      createBackup: vi.fn(),
    };
    const scheduler = new BackupsScheduler(backups as any);

    await scheduler.checkSchedule();

    expect(backups.createBackup).not.toHaveBeenCalled();
  });

  it('retries on the next schedule check after backup creation fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 2, 5, 0));
    const backups = {
      getSettings: vi.fn().mockResolvedValue({
        autoBackupEnabled: true,
        scheduleTime: '02:00',
      }),
      hasSuccessfulScheduledBackupSince: vi.fn().mockResolvedValue(false),
      createBackup: vi
        .fn()
        .mockRejectedValueOnce(new Error('disk unavailable'))
        .mockResolvedValueOnce({ id: 'backup-2' }),
    };
    const scheduler = new BackupsScheduler(backups as any);

    await scheduler.checkSchedule();
    await scheduler.checkSchedule();

    expect(backups.createBackup).toHaveBeenCalledTimes(2);
  });

  it('prevents overlapping schedule checks from starting duplicate backups', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 2, 5, 0));
    let resolveBackup: (value: unknown) => void = () => undefined;
    const backups = {
      getSettings: vi.fn().mockResolvedValue({
        autoBackupEnabled: true,
        scheduleTime: '02:00',
      }),
      hasSuccessfulScheduledBackupSince: vi.fn().mockResolvedValue(false),
      createBackup: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveBackup = resolve;
          }),
      ),
    };
    const scheduler = new BackupsScheduler(backups as any);

    const firstCheck = scheduler.checkSchedule();
    const overlappingCheck = scheduler.checkSchedule();
    await Promise.resolve();
    await Promise.resolve();
    resolveBackup({ id: 'backup-3' });
    await Promise.all([firstCheck, overlappingCheck]);

    expect(backups.createBackup).toHaveBeenCalledTimes(1);
    expect(backups.createBackup).toHaveBeenCalledWith('SCHEDULED');
  });
});
