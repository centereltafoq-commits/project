import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
  PERMISSIONS,
  SystemRole,
} from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { GroupsService } from './groups.service';

describe('GroupsService - Classroom Unassigned Rule, Conflict Validation & RBAC Masking', () => {
  let service: GroupsService;
  let mockRepo: any;
  let mockMutationRepo: any;
  let mockAudit: any;
  let mockSettlement: any;

  const ownerActor: AuthenticatedUser = {
    id: 'owner-1',
    email: 'owner@center.com',
    fullName: 'Owner',
    roleCode: SystemRole.OWNER,
    permissions: [],
  };

  const samplePolicy = {
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    teacherSharePerStudent: 240,
    centerSharePerStudent: 80,
    teacherPercentage: 75,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    fullAbsenceFixedFee: 0,
    chargeExcusedAbsence: false,
  };

  beforeEach(() => {
    mockRepo = {
      findByCode: vi.fn().mockResolvedValue(null),
      findActiveGroupsByTeacher: vi.fn().mockResolvedValue([]),
      findPaginated: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'grp-1',
            name: 'فيزياء 3ث',
            teacherSharePerStudent: '240.00',
            centerSharePerStudent: '80.00',
            teacherPercentage: '75.00',
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
      }),
      findDetailById: vi.fn().mockResolvedValue({
        id: 'grp-1',
        groupCode: 'GRP-1001',
        name: 'فيزياء 3ث',
        primaryTeacherId: 'tch-1',
        defaultClassroomId: null,
        monthlySessionsCount: 8,
        monthlyPrice: '320.00',
        isActive: true,
        scheduleSlots: [{ dayOfWeek: 6, startTime: '16:00', endTime: '18:00', classroomId: null }],
        financialPolicy: {
          revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
          teacherSharePerStudent: '240.00',
          centerSharePerStudent: '80.00',
          teacherPercentage: '75.00',
        },
        assistants: [
          {
            linkId: 'lnk-1',
            assistantId: 'ast-1',
            fullName: 'أحمد المساعد',
            defaultRate: '15.00',
            overrideRateValue: '20.00',
          },
        ],
      }),
      getLookups: vi.fn().mockResolvedValue({
        teachers: [{ id: 'tch-1', fullName: 'د. طارق' }],
        assistants: [{ id: 'ast-1', fullName: 'أحمد', rateValue: '15.00' }],
        students: [{ id: 'std-1', fullName: 'يوسف', studentCode: 'STD-1' }],
      }),
    };

    mockMutationRepo = {
      createWithRelations: vi.fn().mockResolvedValue({ id: 'grp-1' }),
      updateWithRelations: vi.fn().mockResolvedValue({ id: 'grp-1' }),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockSettlement = {
      recalculateMonth: vi.fn().mockResolvedValue({ updatedCount: 1 }),
    };

    service = new GroupsService(mockRepo, mockMutationRepo, mockAudit, mockSettlement);
  });

  it('never assigns a classroom upon group creation even if classroom IDs are passed in DTO', async () => {
    await service.create(
      {
        name: 'فيزياء 3ث',
        subject: 'فيزياء',
        gradeLevel: 'الثالث الثانوي',
        primaryTeacherId: 'tch-1',
        defaultClassroomId: 'room-should-be-ignored',
        monthlySessionsCount: 8,
        monthlyPrice: 320,
        scheduleSlots: [
          {
            dayOfWeek: 6,
            startTime: '16:00',
            endTime: '18:00',
            classroomId: 'room-should-be-ignored',
          },
        ],
        financialPolicy: samplePolicy,
      },
      ownerActor,
    );

    expect(mockMutationRepo.createWithRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        groupData: expect.objectContaining({
          defaultClassroomId: null,
          scheduleSlots: [
            {
              dayOfWeek: 6,
              startTime: '16:00',
              endTime: '18:00',
              classroomId: null,
            },
          ],
        }),
      }),
    );
  });

  it('rejects invalid slot time range or self-overlapping slots in the same group', async () => {
    await expect(
      service.create(
        {
          name: 'مجموعة وقت خاطئ',
          subject: 'كيمياء',
          gradeLevel: 'الثالث الثانوي',
          primaryTeacherId: 'tch-1',
          monthlySessionsCount: 8,
          monthlyPrice: 320,
          scheduleSlots: [{ dayOfWeek: 0, startTime: '18:00', endTime: '16:00' }],
          financialPolicy: samplePolicy,
        },
        ownerActor,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create(
        {
          name: 'مجموعة متداخلة ذاتياً',
          subject: 'كيمياء',
          gradeLevel: 'الثالث الثانوي',
          primaryTeacherId: 'tch-1',
          monthlySessionsCount: 8,
          monthlyPrice: 320,
          scheduleSlots: [
            { dayOfWeek: 0, startTime: '15:00', endTime: '17:00' },
            { dayOfWeek: 0, startTime: '16:30', endTime: '18:30' },
          ],
          financialPolicy: samplePolicy,
        },
        ownerActor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects group creation when primary teacher already has an overlapping active group', async () => {
    mockRepo.findActiveGroupsByTeacher.mockResolvedValueOnce([
      {
        id: 'grp-existing',
        name: 'مجموعة الفيزياء أ',
        scheduleSlots: [{ dayOfWeek: 6, startTime: '15:00', endTime: '17:00' }],
      },
    ]);

    await expect(
      service.create(
        {
          name: 'مجموعة الفيزياء ب',
          subject: 'فيزياء',
          gradeLevel: 'الثالث الثانوي',
          primaryTeacherId: 'tch-1',
          monthlySessionsCount: 8,
          monthlyPrice: 320,
          scheduleSlots: [{ dayOfWeek: 6, startTime: '16:00', endTime: '18:00' }],
          financialPolicy: samplePolicy,
        },
        ownerActor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('masks revenue split fields and assistant rates for users without FINANCE_VIEW or GROUPS_MANAGE', async () => {
    const viewOnlyActor: AuthenticatedUser = {
      id: 'emp-1',
      email: 'emp@center.com',
      fullName: 'Attendance Employee',
      roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
      permissions: [PERMISSIONS.GROUPS_VIEW],
    };

    const listResult = await service.list({}, viewOnlyActor);
    expect(listResult.data[0]?.teacherSharePerStudent).toBeNull();
    expect(listResult.data[0]?.centerSharePerStudent).toBeNull();
    expect(listResult.data[0]?.teacherPercentage).toBeNull();

    const detailResult = await service.getById('grp-1', viewOnlyActor);
    expect(detailResult.financialPolicy?.teacherSharePerStudent).toBe('0.00');
    expect(detailResult.assistants[0]?.defaultRate).toBe('0.00');
    expect(detailResult.assistants[0]?.overrideRateValue).toBeNull();

    const lookups = await service.getLookups(viewOnlyActor);
    expect(lookups.teachers).toHaveLength(0);
    expect(lookups.assistants).toHaveLength(0);
    expect(lookups.students).toHaveLength(0);

    const managerActor: AuthenticatedUser = {
      id: 'mgr-1',
      email: 'mgr@center.com',
      fullName: 'Manager',
      roleCode: SystemRole.MANAGER,
      permissions: [PERMISSIONS.GROUPS_VIEW, PERMISSIONS.GROUPS_MANAGE],
    };
    const managerLookups = await service.getLookups(managerActor);
    expect(managerLookups.teachers).toHaveLength(1);
    expect(managerLookups.assistants).toHaveLength(1);
  });
});
