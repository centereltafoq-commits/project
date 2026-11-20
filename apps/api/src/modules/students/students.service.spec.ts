import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentStatus } from '@edu-center/shared';
import { CreateStudentDto, StudentQueryDto, UpdateStudentDto } from './dto/student.dto';
import { StudentsService } from './students.service';

describe('StudentsService & Student DTOs (optional student phone)', () => {
  let mockRepo: {
    findByCode: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockProfileRepo: Record<string, ReturnType<typeof vi.fn>>;
  let mockAudit: { record: ReturnType<typeof vi.fn> };
  let service: StudentsService;

  const actor: any = {
    id: 'user-1',
    fullName: 'مدير السنتر',
    permissions: [],
  };

  beforeEach(() => {
    mockRepo = {
      findByCode: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue({
        id: 'stu-1',
        studentCode: 'STU-2026-1001',
        fullName: 'سارة علي',
        phone: '01012345678',
        guardianPhone: null,
        gradeLevel: 'الأول الثانوي',
        status: StudentStatus.ACTIVE,
      }),
      create: vi.fn().mockImplementation(async (data) => ({ id: 'stu-new', ...data })),
      update: vi.fn().mockImplementation(async (id, updates) => ({ id, ...updates })),
    };
    mockProfileRepo = {};
    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };

    service = new StudentsService(
      mockRepo as never,
      mockProfileRepo as never,
      mockAudit as never,
    );
  });

  it('validates CreateStudentDto when phone is omitted, blank, or valid, and rejects too-short phone', async () => {
    const omitted = plainToInstance(CreateStudentDto, {
      fullName: 'أحمد حسن',
      gradeLevel: 'الأول الثانوي',
    });
    expect(await validate(omitted)).toHaveLength(0);

    const blank = plainToInstance(CreateStudentDto, {
      fullName: 'أحمد حسن',
      phone: '   ',
      gradeLevel: 'الأول الثانوي',
    });
    expect(blank.phone).toBeNull();
    expect(await validate(blank)).toHaveLength(0);

    const tooShort = plainToInstance(CreateStudentDto, {
      fullName: 'أحمد حسن',
      phone: '123',
      gradeLevel: 'الأول الثانوي',
    });
    const shortErrors = await validate(tooShort);
    expect(shortErrors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('creates student with null phone when omitted or empty string and preserves valid trimmed phone', async () => {
    await service.create(
      { fullName: 'نور محمود', gradeLevel: 'الثاني الثانوي' },
      actor,
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'نور محمود',
        phone: null,
      }),
    );

    await service.create(
      { fullName: 'كريم طارق', phone: '  01099887766  ', gradeLevel: 'الثالث الثانوي' },
      actor,
    );
    expect(mockRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fullName: 'كريم طارق',
        phone: '01099887766',
      }),
    );
  });

  it('allows clearing existing student phone on update via null or empty string', async () => {
    const updateDto = plainToInstance(UpdateStudentDto, { phone: '' });
    expect(updateDto.phone).toBeNull();
    expect(await validate(updateDto)).toHaveLength(0);

    await service.update('stu-1', { phone: null }, actor);
    expect(mockRepo.update).toHaveBeenCalledWith('stu-1', { phone: null });
  });

  it('includes total, active, and inactive student counts in list summary', async () => {
    (mockRepo as any).findPaginated = vi.fn().mockResolvedValue({
      rows: [],
      total: 10,
      page: 1,
      limit: 25,
      summary: { totalCount: 10, activeCount: 8, inactiveCount: 2 },
    });

    const result = await service.list({ page: 1, limit: 25 });
    expect(result.summary).toEqual({
      totalCount: 10,
      activeCount: 8,
      inactiveCount: 2,
    });
  });

  it('validates optional UUID groupId in StudentQueryDto and passes it to repository.findPaginated', async () => {
    const validGroupId = '550e8400-e29b-41d4-a716-446655440000';

    const omittedDto = plainToInstance(StudentQueryDto, {});
    expect(await validate(omittedDto)).toHaveLength(0);

    const validDto = plainToInstance(StudentQueryDto, { groupId: validGroupId });
    expect(await validate(validDto)).toHaveLength(0);

    const invalidDto = plainToInstance(StudentQueryDto, { groupId: 'not-a-uuid' });
    const invalidErrors = await validate(invalidDto);
    expect(invalidErrors.some((e) => e.property === 'groupId')).toBe(true);

    (mockRepo as any).findPaginated = vi.fn().mockResolvedValue({
      rows: [],
      total: 0,
      page: 1,
      limit: 100,
      summary: { totalCount: 0, activeCount: 0, inactiveCount: 0 },
    });

    await service.list({ page: 1, limit: 100, groupId: validGroupId });
    expect((mockRepo as any).findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
      groupId: validGroupId,
    });
  });
});

