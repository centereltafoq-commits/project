import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceStatus, MakeupStatus, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { MakeupsService } from './makeups.service';

describe('Attendance & Makeups Closed-Month Lock Enforcement', () => {
  const actor: AuthenticatedUser = {
    id: 'usr-admin',
    email: 'admin@center.com',
    fullName: 'المدير',
    roleCode: SystemRole.OWNER,
    permissions: [],
  };

  let repository: any;
  let sheetRepository: any;
  let makeupsRepository: any;
  let audit: any;
  let cache: any;
  let settlementService: any;
  let attendanceService: AttendanceService;
  let makeupsService: MakeupsService;

  beforeEach(() => {
    repository = {
      findGroupById: vi.fn().mockResolvedValue({
        id: 'grp-1',
        primaryTeacherId: 'tch-1',
        defaultClassroomId: 'cls-1',
        scheduleSlots: [],
      }),
      findSessionById: vi.fn().mockResolvedValue({
        id: 'ses-1',
        groupId: 'grp-1',
        yearMonth: '2026-11',
        sessionDate: '2026-11-12',
      }),
      checkSessionConflicts: vi.fn(),
      createSession: vi.fn(),
      findExistingGroupSessionsInMonth: vi.fn(),
      insertSessionsBatch: vi.fn(),
    };

    sheetRepository = {
      findExistingAttendanceMap: vi.fn(),
      upsertSessionAttendance: vi.fn(),
    };

    makeupsRepository = {
      findById: vi.fn().mockResolvedValue({
        id: 'mk-1',
        studentId: 'stu-1',
        originalSessionId: 'ses-1',
        isFree: true,
        extraFee: '0.00',
        status: MakeupStatus.PENDING,
        scheduledAt: null,
      }),
      findStudentAttendance: vi.fn(),
      create: vi.fn(),
      updateAndSyncOriginalAttendance: vi.fn(),
    };

    audit = { record: vi.fn().mockResolvedValue(undefined) };
    cache = { invalidatePrefix: vi.fn().mockResolvedValue(undefined) };
    settlementService = {
      assertMonthOpen: vi.fn().mockImplementation(async (yearMonth: string) => {
        if (yearMonth === '2026-11') {
          throw new ConflictException(`الشهر المالي (${yearMonth}) مغلق`);
        }
      }),
      recalculateMonth: vi.fn(),
    };

    attendanceService = new AttendanceService(
      repository,
      sheetRepository,
      audit,
      cache,
      settlementService,
    );

    makeupsService = new MakeupsService(
      repository,
      makeupsRepository,
      audit,
      settlementService,
      cache,
    );
  });

  it('rejects creating a session in a closed month', async () => {
    await expect(
      attendanceService.createSession(
        {
          groupId: 'grp-1',
          sessionDate: '2026-11-12',
          startTime: '14:00',
          endTime: '16:00',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(repository.checkSessionConflicts).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('rejects generating month sessions for a closed month', async () => {
    await expect(
      attendanceService.generateMonthSessions(
        {
          groupId: 'grp-1',
          yearMonth: '2026-11',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(repository.insertSessionsBatch).not.toHaveBeenCalled();
  });

  it('rejects recording or modifying attendance for a session in a closed month', async () => {
    await expect(
      attendanceService.recordSessionAttendance(
        'ses-1',
        {
          records: [{ studentId: 'stu-1', status: AttendanceStatus.PRESENT }],
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(sheetRepository.upsertSessionAttendance).not.toHaveBeenCalled();
  });

  it('rejects creating or updating a makeup session tied to a closed month', async () => {
    await expect(
      makeupsService.createMakeup(
        {
          studentId: 'stu-1',
          originalSessionId: 'ses-1',
          isFree: true,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(makeupsRepository.create).not.toHaveBeenCalled();

    await expect(
      makeupsService.updateMakeup(
        'mk-1',
        {
          status: MakeupStatus.COMPLETED,
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(makeupsRepository.updateAndSyncOriginalAttendance).not.toHaveBeenCalled();
  });
});

