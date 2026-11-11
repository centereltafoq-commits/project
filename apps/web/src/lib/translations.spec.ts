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
      expect(translateAuditAction('REVIEW_BOOKING_CONFIRMED').label).toBe('تأكيد طلب الحجز وتخصيص قاعة');
      expect(translateAuditAction('CANCEL_SINGLE_BOOKING').label).toBe('إلغاء موعد حجز');
      expect(translateAuditAction('COMPLETE_BOOKING').label).toBe('إتمام وتنفيذ الحجز');
      expect(translateAuditAction('FINANCE_COLLECT_PAYMENT').label).toBe('تحصيل مدفوعات طالب');
      expect(translateAuditAction('FINANCE_TEACHER_PAYOUT').label).toBe('صرف مستحقات مدرس');
      expect(translateAuditAction('FINANCE_ASSISTANT_PAYOUT').label).toBe('صرف مستحقات مساعد');
      expect(translateAuditAction('UPDATE_ROLE_PERMISSIONS').label).toBe('تعديل صلاحيات الدور الوظيفي');
      expect(translateAuditAction('system.annual_reset_failed_pin').label).toBe('محاولة فاشلة لتصفير العام (رمز PIN غير صحيح)');
    });

    it('decomposes unknown underscore tokens into Arabic without leaking English', () => {
      const res = translateAuditAction('CREATE_GRADE_LEVEL');
      expect(res.label).toBe('إضافة صف دراسي جديد');

      const res2 = translateAuditAction('UPDATE_STUDENT_STATUS');
      expect(res2.label).toBe('تعديل طالب الحالة');

      const res3 = translateAuditAction('CANCEL_SINGLE_UNKNOWN');
      expect(res3.label).not.toContain('SINGLE');
      expect(res3.label).toContain('فردي');
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
      expect(translateAuditEntity('CLASSROOM_MAINTENANCE')).toBe('صيانة القاعات');
      expect(translateAuditEntity('teacher_payout')).toBe('مستحقات المدرسين');
      expect(translateAuditEntity('assistant_payout')).toBe('مستحقات المساعدين');
      expect(translateAuditEntity('PAYOUT')).toBe('مستحقات المدرسين والمساعدين');
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
      expect(translatePayloadKey('logoUrl')).toBe('رابط الشعار');
      expect(translatePayloadKey('newAcademicYear')).toBe('العام الدراسي الجديد');
      expect(translatePayloadKey('purgeStudents')).toBe('تصفير وحذف بيانات الطلاب');
      expect(translatePayloadKey('backupFileName')).toBe('اسم ملف النسخة الاحتياطية');
      expect(translatePayloadKey('attemptedAt')).toBe('وقت المحاولة');

      expect(translatePayloadValue('ACTIVE')).toBe('نشط');
      expect(translatePayloadValue('ARCHIVED')).toBe('مؤرشف');
      expect(translatePayloadValue('CONFIRMED')).toBe('مؤكد');
      expect(translatePayloadValue('FIXED_PER_STUDENT')).toBe('مبلغ ثابت لكل طالب');
      expect(translatePayloadValue('ONE_TIME')).toBe('حجز لمرة واحدة');
      expect(translatePayloadValue('FULL_TIME')).toBe('دوام كامل');
      expect(translatePayloadValue('PER_SESSION')).toBe('حسب الحصة');
      expect(translatePayloadValue('UPLOADED')).toBe('مرفوع يدوياً');
      expect(translatePayloadValue('SERVER_STORAGE')).toBe('وحدة تخزين الخادم');
      expect(translatePayloadValue(true)).toBe('نعم');
      expect(translatePayloadValue(false)).toBe('لا');
      expect(translatePayloadValue(0, 'dayOfWeek')).toBe('الأحد');
    });
  });
});

