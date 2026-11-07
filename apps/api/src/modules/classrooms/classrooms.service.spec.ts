import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ClassroomsAvailabilityRepository } from './classrooms-availability.repository';
import { ClassroomsRepository } from './classrooms.repository';
import { ClassroomsService } from './classrooms.service';

describe('ClassroomsService - Flexible Allocation & Conflict Prevention', () => {
  let service: ClassroomsService;
  let mockRepo: any;
  let mockAvailRepo: any;
  let mockAudit: any;

  const mockActor: AuthenticatedUser = {
    id: 'user-admin-1',
    role: 'OWNER' as any,
    fullName: 'مدير السنتر',
    branchId: null,
  };

  const sampleClassroom = {
    id: 'room-1',
    roomNumber: '101',
    name: 'قاعة الفردوس',
    maxCapacity: 30,
    seatsCount: 30,
    equipment: ['شاشة ذكية'],
    status: ClassroomStatus.AVAILABLE,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleGroup = {
    id: 'group-1',
    groupCode: 'GRP-101',
    name: 'مجموعة الأحياء 3ث',
    subject: 'أحياء',
    gradeLevel: 'الثالث الثانوي',
    primaryTeacherId: 'teacher-1',
    defaultClassroomId: null,
    scheduleSlots: [
      { dayOfWeek: 0, startTime: '16:00', endTime: '18:00', classroomId: null },
    ],
    maxStudents: 35,
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(sampleClassroom),
      findGroupById: vi.fn().mockResolvedValue(sampleGroup),
      getGroupActiveEnrollmentCount: vi.fn().mockResolvedValue(20),
      findAllocatedGroups: vi.fn().mockResolvedValue([]),
      findUnallocatedGroups: vi.fn().mockResolvedValue([sampleGroup]),
      findAllActiveGroups: vi.fn().mockResolvedValue([sampleGroup]),
      allocateGroup: vi.fn().mockImplementation((roomId, grpId, slots) => ({
        ...sampleGroup,
        defaultClassroomId: roomId,
        scheduleSlots: slots ?? [{ dayOfWeek: 0, startTime: '16:00', endTime: '18:00', classroomId: roomId }],
      })),
      releaseGroup: vi.fn().mockResolvedValue({
        ...sampleGroup,
        defaultClassroomId: null,
      }),
      create: vi.fn(),
      update: vi.fn(),
      findPaginated: vi.fn(),
      listMaintenances: vi.fn(),
      createMaintenance: vi.fn(),
      deleteMaintenance: vi.fn(),
    };

    mockAvailRepo = {
      findAvailable: vi.fn(),
      fetchSchedule: vi.fn(),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new ClassroomsService(
      mockRepo as unknown as ClassroomsRepository,
      mockAvailRepo as unknown as ClassroomsAvailabilityRepository,
      mockAudit as unknown as AuditLogsService,
    );
  });

  describe('allocateGroup', () => {
    it('successfully allocates an unassigned group to an available classroom', async () => {
      const result = await service.allocateGroup(
        'room-1',
        { groupId: 'group-1', updateUpcomingSessions: true },
        mockActor,
      );

      expect(result.success).toBe(true);
      expect(mockRepo.allocateGroup).toHaveBeenCalledWith(
        'room-1',
        'group-1',
        undefined,
        true,
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ALLOCATE_GROUP_TO_CLASSROOM',
          entityId: 'room-1',
        }),
      );
    });

    it('rejects allocation when classroom is under MAINTENANCE', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleClassroom,
        status: ClassroomStatus.MAINTENANCE,
      });

      await expect(
        service.allocateGroup('room-1', { groupId: 'group-1' }, mockActor),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects allocation when classroom is INACTIVE', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleClassroom,
        status: ClassroomStatus.INACTIVE,
      });

      await expect(
        service.allocateGroup('room-1', { groupId: 'group-1' }, mockActor),
      ).rejects.toThrow(ConflictException);
    });

    it('detects recurring weekly timetable conflict on the same dayOfWeek and overlapping time', async () => {
      // Another group is already allocated on Sunday (day 0) from 15:00 to 17:00
      // Target group is Sunday from 16:00 to 18:00 (overlaps by 1 hour)
      mockRepo.findAllocatedGroups.mockResolvedValueOnce([
        {
          id: 'group-2',
          name: 'مجموعة الكيمياء',
          slotsForThisRoom: [
            { dayOfWeek: 0, startTime: '15:00', endTime: '17:00', classroomId: 'room-1' },
          ],
        },
      ]);

      await expect(
        service.allocateGroup(
          'room-1',
          {
            groupId: 'group-1',
            slots: [{ dayOfWeek: 0, startTime: '16:00', endTime: '18:00', classroomId: 'room-1' }],
          },
          mockActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows back-to-back non-overlapping slots on the same dayOfWeek', async () => {
      // Another group ends at 16:00, target group starts at 16:00
      mockRepo.findAllocatedGroups.mockResolvedValueOnce([
        {
          id: 'group-2',
          name: 'مجموعة الكيمياء',
          slotsForThisRoom: [
            { dayOfWeek: 0, startTime: '14:00', endTime: '16:00', classroomId: 'room-1' },
          ],
        },
      ]);

      const result = await service.allocateGroup(
        'room-1',
        {
          groupId: 'group-1',
          slots: [{ dayOfWeek: 0, startTime: '16:00', endTime: '18:00', classroomId: 'room-1' }],
        },
        mockActor,
      );

      expect(result.success).toBe(true);
    });

    it('does not throw conflict when an overlapping slot belongs to a different classroom', async () => {
      // Another group occupies room-1 on Sunday from 15:00 to 17:00
      mockRepo.findAllocatedGroups.mockResolvedValueOnce([
        {
          id: 'group-2',
          name: 'مجموعة الكيمياء',
          slotsForThisRoom: [
            { dayOfWeek: 0, startTime: '15:00', endTime: '17:00', classroomId: 'room-1' },
          ],
        },
      ]);

      // Target group has Sunday in room-99 (different room) and Tuesday in room-1
      const result = await service.allocateGroup(
        'room-1',
        {
          groupId: 'group-1',
          slots: [
            { dayOfWeek: 0, startTime: '15:00', endTime: '17:00', classroomId: 'room-99' },
            { dayOfWeek: 2, startTime: '16:00', endTime: '18:00', classroomId: 'room-1' },
          ],
        },
        mockActor,
      );

      expect(result.success).toBe(true);
    });

    it('blocks allocation if active enrolled students exceed classroom max capacity without override', async () => {
      // Room maxCapacity is 30, but group active enrolled students is 38
      mockRepo.getGroupActiveEnrollmentCount.mockResolvedValueOnce(38);

      await expect(
        service.allocateGroup(
          'room-1',
          { groupId: 'group-1', allowOverCapacity: false },
          mockActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows allocation if active enrolled students exceed capacity when allowOverCapacity is true', async () => {
      mockRepo.getGroupActiveEnrollmentCount.mockResolvedValueOnce(38);

      const result = await service.allocateGroup(
        'room-1',
        { groupId: 'group-1', allowOverCapacity: true },
        mockActor,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('releaseGroup', () => {
    it('successfully releases group from classroom and records audit', async () => {
      const result = await service.releaseGroup('room-1', 'group-1', mockActor);

      expect(result.success).toBe(true);
      expect(mockRepo.releaseGroup).toHaveBeenCalledWith('room-1', 'group-1', true);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RELEASE_GROUP_FROM_CLASSROOM',
          entityId: 'room-1',
        }),
      );
    });

    it('throws NotFoundException if group does not exist', async () => {
      mockRepo.findGroupById.mockResolvedValueOnce(null);

      await expect(
        service.releaseGroup('room-1', 'non-existent', mockActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unallocated & allocated groups retrieval', () => {
    it('returns unallocated groups list', async () => {
      const unallocated = await service.getUnallocatedGroups();
      expect(unallocated).toHaveLength(1);
      expect(unallocated[0].groupCode).toBe('GRP-101');
      expect(mockRepo.findUnallocatedGroups).toHaveBeenCalled();
    });

    it('returns all active groups when includeAll is true', async () => {
      const all = await service.getUnallocatedGroups(true);
      expect(all).toHaveLength(1);
      expect(mockRepo.findAllActiveGroups).toHaveBeenCalled();
    });

    it('calculates isOverCapacity flag for allocated groups', async () => {
      mockRepo.findAllocatedGroups.mockResolvedValueOnce([
        { ...sampleGroup, enrolledCount: 35, maxStudents: 40 }, // maxCapacity is 30 -> over capacity
      ]);

      const result = await service.getAllocatedGroups('room-1');
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].isOverCapacity).toBe(true);
    });
  });
});
