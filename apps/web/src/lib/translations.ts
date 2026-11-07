export const AUDIT_ACTION_TRANSLATIONS: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  LOGIN: { label: 'تسجيل دخول', variant: 'success' },
  LOGOUT: { label: 'تسجيل خروج', variant: 'neutral' },
  AUTH_REFRESH: { label: 'تجديد الجلسة', variant: 'neutral' },

  // Finance Actions
  FINANCE_RECALCULATE_MONTH: { label: 'إعادة احتساب مالي شهري', variant: 'info' },
  FINANCE_CLOSE_MONTH: { label: 'إقفال الحسابات الشهرية', variant: 'warning' },
  PAYMENT_COLLECT: { label: 'تحصيل مدفوعات طالب', variant: 'success' },
  PAYOUT_CREATE: { label: 'صرف مستحقات مدرس/مساعد', variant: 'info' },
  EXPENSE_CREATE: { label: 'تسجيل مصروف إداري', variant: 'danger' },

  // Students Actions
  STUDENT_CREATE: { label: 'تسجيل طالب جديد', variant: 'success' },
  STUDENT_UPDATE: { label: 'تعديل بيانات طالب', variant: 'info' },
  STUDENT_ARCHIVE: { label: 'أرشفة ملف طالب', variant: 'warning' },

  // Groups Actions
  GROUP_CREATE: { label: 'إنشاء مجموعة دراسية', variant: 'success' },
  GROUP_UPDATE: { label: 'تعديل بيانات المجموعة', variant: 'info' },
  ENROLLMENT_CREATE: { label: 'تسجيل اشتراك طالب بالمجموعة', variant: 'success' },
  ENROLLMENT_UPDATE: { label: 'تعديل اشتراك طالب', variant: 'info' },

  // Teachers & Assistants
  TEACHER_CREATE: { label: 'إضافة مدرس جديد', variant: 'success' },
  TEACHER_UPDATE: { label: 'تعديل بيانات المدرس', variant: 'info' },
  ASSISTANT_CREATE: { label: 'إضافة مساعد جديد', variant: 'success' },
  ASSISTANT_UPDATE: { label: 'تعديل بيانات المساعد', variant: 'info' },

  // Attendance
  ATTENDANCE_RECORD: { label: 'تسجيل حضور وغياب يومي', variant: 'success' },
  ATTENDANCE_OVERRIDE: { label: 'تعديل سجل حضور سابق', variant: 'warning' },
  MAKEUP_SCHEDULE: { label: 'جدولة حصة تعويضية', variant: 'info' },

  // Bookings & Classrooms
  BOOKING_CREATE: { label: 'طلب حجز موعد جديد', variant: 'info' },
  BOOKING_APPROVE: { label: 'اعتماد طلب حجز وتخصيص قاعة', variant: 'success' },
  CLASSROOM_CREATE: { label: 'إضافة قاعة دراسية جديدة', variant: 'success' },
  CLASSROOM_UPDATE: { label: 'تعديل تجهيزات القاعة', variant: 'info' },

  // Backups
  BACKUP_CREATE: { label: 'إنشاء نسخة احتياطية', variant: 'success' },
  BACKUP_RESTORE: { label: 'استعادة قاعدة البيانات', variant: 'danger' },

  // Users & Roles
  USER_CREATE: { label: 'إنشاء حساب مستخدم', variant: 'success' },
  USER_UPDATE: { label: 'تعديل حساب مستخدم', variant: 'info' },
  PASSWORD_RESET: { label: 'إعادة تعيين كلمة المرور', variant: 'warning' },
};

export const AUDIT_ENTITY_TRANSLATIONS: Record<string, string> = {
  AUTH: 'المصادقة وتسجيل الدخول',
  IDENTITY: 'المستخدمون والصلاحيات',
  STUDENTS: 'الطلاب',
  TEACHERS: 'المدرسين',
  ASSISTANTS: 'المساعدين',
  GROUPS: 'المجموعات الدراسية',
  ATTENDANCE: 'الحضور والغياب',
  FINANCE: 'الحسابات والمالية',
  BOOKINGS: 'حجز المواعيد',
  CLASSROOMS: 'القاعات الدراسية',
  BACKUP: 'النسخ الاحتياطي',
  USERS: 'حسابات المستخدمين',

  // Raw Database Entity Names
  monthly_settlement: 'التسويات الشهرية',
  monthly_settlements: 'التسويات الشهرية',
  student_payment: 'مدفوعات الطلاب',
  student_payments: 'مدفوعات الطلاب',
  staff_payout: 'مستحقات المدرسين والمساعدين',
  staff_payouts: 'مستحقات المدرسين والمساعدين',
  expense: 'مصروفات السنتر',
  expenses: 'مصروفات السنتر',
  group_session: 'حصص المجموعات',
  group_sessions: 'حصص المجموعات',
  booking: 'حجوزات المواعيد',
  bookings: 'حجوزات المواعيد',
  classroom: 'القاعات',
  classrooms: 'القاعات',
  classroom_maintenance: 'صيانة القاعات',
  grade_level: 'الصفوف الدراسية',
  grade_levels: 'الصفوف الدراسية',
  student: 'ملف الطالب',
  students: 'ملفات الطلاب',
  group: 'المجموعة الدراسية',
  groups: 'المجموعات الدراسية',
  enrollment: 'اشتراك المجموعة',
  enrollments: 'اشتراكات المجموعات',
};

export function translateAuditAction(action: string): { label: string; variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral' } {
  if (!action) return { label: '—', variant: 'neutral' };
  if (AUDIT_ACTION_TRANSLATIONS[action]) {
    return AUDIT_ACTION_TRANSLATIONS[action];
  }

  // Format generic UPPERCASE_UNDERSCORE actions cleanly
  const words = action.split('_').map((w) => {
    switch (w) {
      case 'CREATE': return 'إنشاء';
      case 'UPDATE': return 'تعديل';
      case 'DELETE': return 'حذف';
      case 'ARCHIVE': return 'أرشفة';
      case 'VIEW': return 'عرض';
      case 'CLOSE': return 'إقفال';
      case 'RECALCULATE': return 'إعادة احتساب';
      case 'RECORD': return 'تسجيل';
      case 'OVERRIDE': return 'تعديل استثنائي';
      case 'APPROVE': return 'اعتماد';
      case 'LOGIN': return 'دخول';
      case 'LOGOUT': return 'خروج';
      default: return w;
    }
  });

  return { label: words.join(' '), variant: 'info' };
}

export function translateAuditEntity(entity: string): string {
  if (!entity) return '—';
  if (AUDIT_ENTITY_TRANSLATIONS[entity]) {
    return AUDIT_ENTITY_TRANSLATIONS[entity];
  }

  // Fallback for snake_case or PascalCase
  return entity.replace(/_/g, ' ');
}

