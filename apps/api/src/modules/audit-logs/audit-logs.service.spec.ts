import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository, CreateAuditLogInput } from './audit-logs.repository';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  getActionArabicLabel,
  getEntityArabicLabel,
  getSearchTermEquivalents,
} from './audit-translations.util';

describe('Audit Translations & Utilities', () => {
  it('translates all known actions accurately without raw English words', () => {
    expect(getActionArabicLabel('LOGIN')).toBe('تسجيل دخول');
    expect(getActionArabicLabel('LOGOUT')).toBe('تسجيل خروج');
    expect(getActionArabicLabel('CREATE_STUDENT')).toBe('تسجيل طالب جديد');
    expect(getActionArabicLabel('UPDATE_STUDENT')).toBe('تعديل بيانات طالب');
    expect(getActionArabicLabel('ARCHIVE_STUDENT')).toBe('أرشفة ملف طالب');
    expect(getActionArabicLabel('CREATE_ASSISTANT')).toBe('إضافة مساعد جديد');
    expect(getActionArabicLabel('UPDATE_ASSISTANT')).toBe('تعديل بيانات مساعد');
    expect(getActionArabicLabel('CREATE_GROUP')).toBe('إنشاء مجموعة دراسية');
    expect(getActionArabicLabel('UPDATE_GROUP')).toBe('تعديل بيانات المجموعة');
    expect(getActionArabicLabel('CREATE_CLASSROOM')).toBe('إضافة قاعة دراسية جديدة');
    expect(getActionArabicLabel('BACKUP_CREATE')).toBe('إنشاء نسخة احتياطية');
    expect(getActionArabicLabel('BACKUP_RESTORE')).toBe('استعادة قاعدة البيانات من نسخة احتياطية');
    expect(getActionArabicLabel('system.settings_update')).toBe('تحديث إعدادات النظام والهوية');
    expect(getActionArabicLabel('CREATE_GRADE_LEVEL')).toBe('إضافة صف دراسي جديد');
    expect(getActionArabicLabel('FINANCE_COLLECT_PAYMENT')).toBe('تحصيل مدفوعات طالب');
    expect(getActionArabicLabel('CREATE_CLASSROOM_MAINTENANCE')).toBe('تسجيل جدول صيانة قاعة');
    expect(getActionArabicLabel('FINANCE_TEACHER_PAYOUT')).toBe('صرف مستحقات مدرس');
    expect(getActionArabicLabel('FINANCE_ASSISTANT_PAYOUT')).toBe('صرف مستحقات مساعد');
  });

  it('translates unknown/compound actions gracefully using decomposed words', () => {
    const label = getActionArabicLabel('CREATE_CUSTOM_UNKNOWN');
    expect(label).toContain('إنشاء');
    expect(label).not.toBe('');

    const decompSingle = getActionArabicLabel('UPDATE_SINGLE_SCHEDULE');
    expect(decompSingle).toContain('تعديل');
    expect(decompSingle).toContain('فردي');
    expect(decompSingle).toContain('جدولة');
  });

  it('translates entities accurately in Arabic', () => {
    expect(getEntityArabicLabel('STUDENT')).toBe('ملفات الطلاب');
    expect(getEntityArabicLabel('TEACHER')).toBe('المدرسين');
    expect(getEntityArabicLabel('ASSISTANT')).toBe('المساعدين');
    expect(getEntityArabicLabel('SESSION')).toBe('حصص المجموعات');
    expect(getEntityArabicLabel('GRADE_LEVEL')).toBe('الصفوف الدراسية');
    expect(getEntityArabicLabel('BACKUP')).toBe('النسخ الاحتياطي');
    expect(getEntityArabicLabel('SETTINGS')).toBe('إعدادات النظام');
  });

  it('provides matching equivalents for Arabic search terms', () => {
    expect(getSearchTermEquivalents('طالب')).toContain('STUDENT');
    expect(getSearchTermEquivalents('حضور')).toContain('SESSION');
    expect(getSearchTermEquivalents('حضور')).toContain('ATTENDANCE');
    expect(getSearchTermEquivalents('مصروف')).toContain('EXPENSE');
    expect(getSearchTermEquivalents('نسخ')).toContain('BACKUP');
  });
});

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let mockRepository: { insert: ReturnType<typeof vi.fn>; findPaginated: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRepository = {
      insert: vi.fn().mockResolvedValue(undefined),
      findPaginated: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, limit: 10 }),
    };
    mockLogger = {
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    };

    service = new AuditLogsService(
      mockRepository as unknown as AuditLogsRepository,
      mockLogger as unknown as AppLoggerService,
    );
  });

  it('automatically enriches metadata with actionAr and entityTypeAr', async () => {
    const input: CreateAuditLogInput = {
      actorUserId: '00000000-0000-0000-0000-000000000001',
      actorName: 'أحمد محمود',
      action: 'CREATE_STUDENT',
      entityType: 'STUDENT',
      entityId: 'stu-123',
    };

    await service.record(input);

    expect(mockRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_STUDENT',
        entityType: 'STUDENT',
        actorName: 'أحمد محمود',
        metadata: expect.objectContaining({
          actionAr: 'تسجيل طالب جديد',
          entityTypeAr: 'ملفات الطلاب',
        }),
      }),
    );
  });

  it('defaults actorName to "النظام" when neither actorUserId nor actorName is provided', async () => {
    const input: CreateAuditLogInput = {
      action: 'BACKUP_CREATE',
      entityType: 'BACKUP',
    };

    await service.record(input);

    expect(mockRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorName: 'النظام',
        metadata: expect.objectContaining({
          actionAr: 'إنشاء نسخة احتياطية',
          entityTypeAr: 'النسخ الاحتياطي',
        }),
      }),
    );
  });

  it('delegates list query to repository with paginated wrapper and enriches rows with Arabic labels', async () => {
    mockRepository.findPaginated.mockResolvedValueOnce({
      rows: [
        {
          id: 'log-1',
          action: 'CREATE_STUDENT',
          entityType: 'STUDENT',
          actorName: null,
          metadata: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });

    const result = await service.list({ page: 1, limit: 10 });
    expect(mockRepository.findPaginated).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].actionAr).toBe('تسجيل طالب جديد');
    expect(result.data[0].entityTypeAr).toBe('ملفات الطلاب');
    expect(result.data[0].actorName).toBe('النظام');
  });
});

