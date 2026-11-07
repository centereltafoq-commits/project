import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceStatus, PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AttendanceRepository } from '../attendance.repository';
import { AttendanceService } from '../attendance.service';
import { SessionSheetRepository } from '../session-sheet.repository';
import { buildMonthSessionDates } from './session-schedule.validator';

describe('Attendance Module — Schedule Generation & Override Rules', () => {
  it('generates exact session dates matching weekly scheduleSlots for a given YYYY-MM', () => {
    const generated = buildMonthSessionDates('2026-11', [
      { dayOfWeek: 1, startTime: '16:00', endTime: '18:00' },
    ]);

    expect(generated).toHaveLength(5);
    expect(generated.map((g) => g.sessionDate)).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
  });

  it('blocks modifying already-recorded attendance without ATTENDANCE_OVERRIDE permission', async () => {
    const repo = {
      findSessionById: vi.fn().mockResolvedValue({ id: 'sess-1', groupId: 'grp-1' }),
    } as unknown as AttendanceRepository;

    const sheetRepo = {
      findExistingAttendanceMap: vi.fn().mockResolvedValue(
        new Map([
          [
            'student-1',
            { studentId: 'student-1', status: AttendanceStatus.PRESENT, notes: null },
          ],
        ]),
      ),
      upsertSessionAttendance: vi.fn(),
    } as unknown as SessionSheetRepository;

    const service = new AttendanceService(
      repo,
      sheetRepo,
      { record: vi.fn() } as unknown as AuditLogsService,
    );

    await expect(
      service.recordSessionAttendance(
        'sess-1',
        { studentId: 'student-1', status: AttendanceStatus.ABSENT },
        {
          id: 'emp-1',
          email: 'emp@center.com',
          fullName: 'موظف حضور',
          roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
          permissions: [PERMISSIONS.ATTENDANCE_RECORD],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows overriding recorded attendance and writes audit log when ATTENDANCE_OVERRIDE is granted', async () => {
    const upsertMock = vi.fn().mockResolvedValue(undefined);
    const auditMock = vi.fn().mockResolvedValue(undefined);

    const repo = {
      findSessionById: vi
        .fn()
        .mockResolvedValue({ id: 'sess-1', groupId: 'grp-1', sessionDate: '2026-11-02' }),
    } as unknown as AttendanceRepository;

    const sheetRepo = {
      findExistingAttendanceMap: vi.fn().mockResolvedValue(
        new Map([
          [
            'student-1',
            { studentId: 'student-1', status: AttendanceStatus.ABSENT, notes: null },
          ],
        ]),
      ),
      upsertSessionAttendance: upsertMock,
      getSessionSheetStudents: vi.fn().mockResolvedValue([]),
    } as unknown as SessionSheetRepository;

    const service = new AttendanceService(
      repo,
      sheetRepo,
      { record: auditMock } as unknown as AuditLogsService,
    );

    await service.recordSessionAttendance(
      'sess-1',
      { studentId: 'student-1', status: AttendanceStatus.PRESENT },
      {
        id: 'mgr-1',
        email: 'mgr@center.com',
        fullName: 'مدير السنتر',
        roleCode: SystemRole.MANAGER,
        permissions: [PERMISSIONS.ATTENDANCE_RECORD, PERMISSIONS.ATTENDANCE_OVERRIDE],
      },
    );

    expect(upsertMock).toHaveBeenCalledOnce();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'OVERRIDE_ATTENDANCE', entityId: 'sess-1' }),
    );
  });
});
