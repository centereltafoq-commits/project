import { describe, it, expect } from 'vitest';
import {
  translateAuditAction,
  translateAuditEntity,
  translatePayloadKey,
  translatePayloadValue,
} from './translations';

describe('translations utility', () => {
  describe('translateAuditAction', () => {
    it('translates explicit action codes to Arabic', () => {
      expect(translateAuditAction('CREATE_STUDENT').label).toBe('تسجيل طالب جديد');
      expect(translateAuditAction('BACKUP_RESTORE').label).toBe('استعادة قاعدة البيانات');
      expect(translateAuditAction('system.settings_update').label).toBe('تعديل الإعدادات العامة للسنتر');
      expect(translateAuditAction('LOGOUT').label).toBe('تسجيل خروج');
    });

    it('decomposes unknown underscore tokens into Arabic without leaking English', () => {
      const res = translateAuditAction('CREATE_GRADE_LEVEL');
      expect(res.label).toBe('إضافة صف دراسي جديد');

      const res2 = translateAuditAction('UPDATE_STUDENT_STATUS');
      expect(res2.label).toBe('تعديل طالب الحالة');
    });
  });

  describe('translateAuditEntity', () => {
    it('translates entity types accurately', () => {
      expect(translateAuditEntity('STUDENTS')).toBe('الطلاب');
      expect(translateAuditEntity('GRADE_LEVEL')).toBe('الصفوف الدراسية');
      expect(translateAuditEntity('grade_level')).toBe('الصفوف الدراسية');
      expect(translateAuditEntity('BACKUP')).toBe('النسخ الاحتياطي');
      expect(translateAuditEntity('SETTINGS')).toBe('إعدادات النظام');
      expect(translateAuditEntity('student_payment')).toBe('مدفوعات الطلاب');
    });
  });

  describe('translatePayloadKey & translatePayloadValue', () => {
    it('translates common keys and values into Arabic', () => {
      expect(translatePayloadKey('phone')).toBe('رقم الهاتف');
      expect(translatePayloadKey('fullName')).toBe('الاسم الكامل');
      expect(translatePayloadKey('status')).toBe('الحالة');
      expect(translatePayloadKey('fileName')).toBe('اسم الملف');
      expect(translatePayloadKey('roomNumber')).toBe('رقم القاعة');
      expect(translatePayloadKey('receiptNumber')).toBe('رقم الإيصال');
      expect(translatePayloadKey('teacherCode')).toBe('كود المدرس');
      expect(translatePayloadKey('category')).toBe('تصنيف المصروف');

      expect(translatePayloadValue('ACTIVE')).toBe('نشط');
      expect(translatePayloadValue('ARCHIVED')).toBe('مؤرشف');
      expect(translatePayloadValue('CONFIRMED')).toBe('مؤكد');
      expect(translatePayloadValue('FIXED_PER_STUDENT')).toBe('مبلغ ثابت لكل طالب');
      expect(translatePayloadValue('ONE_TIME')).toBe('حجز لمرة واحدة');
      expect(translatePayloadValue(true)).toBe('نعم');
      expect(translatePayloadValue(false)).toBe('لا');
      expect(translatePayloadValue(0, 'dayOfWeek')).toBe('الأحد');
    });
  });
});

