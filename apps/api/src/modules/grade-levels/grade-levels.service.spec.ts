import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GradeLevelsService } from './grade-levels.service';
import { GradeLevelsRepository } from './grade-levels.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('GradeLevelsService', () => {
  let service: GradeLevelsService;
  let mockRepo: any;
  let mockAudit: any;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByName: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countUsage: vi.fn(),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new GradeLevelsService(
      mockRepo as unknown as GradeLevelsRepository,
      mockAudit as unknown as AuditLogsService,
    );
  });

  it('records audit log when a new grade level is created', async () => {
    mockRepo.findByName.mockResolvedValue(null);
    const created = { id: 'gl-1', name: 'الصف الأول الثانوي', active: true };
    mockRepo.create.mockResolvedValue(created);

    const actor = { id: 'user-1', fullName: 'مدير النظام' } as any;
    const res = await service.create({ name: 'الصف الأول الثانوي', active: true }, actor);

    expect(res).toEqual(created);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_GRADE_LEVEL',
        entityType: 'GRADE_LEVEL',
        entityId: 'gl-1',
        actorUserId: 'user-1',
        actorName: 'مدير النظام',
        afterData: created,
      }),
    );
  });

  it('records audit log when a grade level is updated', async () => {
    const existing = { id: 'gl-1', name: 'الصف الأول الثانوي', active: true };
    const updated = { id: 'gl-1', name: 'الصف الأول الثانوي - لغات', active: true };
    mockRepo.findById.mockResolvedValue(existing);
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue(updated);

    const actor = { id: 'user-1', fullName: 'مدير النظام' } as any;
    const res = await service.update('gl-1', { name: 'الصف الأول الثانوي - لغات' }, actor);

    expect(res).toEqual(updated);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_GRADE_LEVEL',
        entityType: 'GRADE_LEVEL',
        entityId: 'gl-1',
        beforeData: existing,
        afterData: updated,
      }),
    );
  });

  it('records audit log when a grade level is removed', async () => {
    const existing = { id: 'gl-1', name: 'الصف الأول الثانوي', active: true };
    mockRepo.findById.mockResolvedValue(existing);
    mockRepo.countUsage.mockResolvedValue({ studentsCount: 0, groupsCount: 0 });
    mockRepo.delete.mockResolvedValue({ success: true });

    const actor = { id: 'user-1', fullName: 'مدير النظام' } as any;
    await service.remove('gl-1', actor);

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_GRADE_LEVEL',
        entityType: 'GRADE_LEVEL',
        entityId: 'gl-1',
        beforeData: existing,
      }),
    );
  });

  it('throws BadRequestException and prevents removal if grade level has active usage', async () => {
    const existing = { id: 'gl-1', name: 'الصف الأول الثانوي', active: true };
    mockRepo.findById.mockResolvedValue(existing);
    mockRepo.countUsage.mockResolvedValue({ studentsCount: 5, groupsCount: 2 });

    await expect(service.remove('gl-1')).rejects.toThrow(BadRequestException);
    expect(mockAudit.record).not.toHaveBeenCalled();
  });
});

