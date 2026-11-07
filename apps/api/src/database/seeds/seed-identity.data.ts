import { ALL_PERMISSIONS, PERMISSIONS, PermissionCode, SystemRole } from '@edu-center/shared';

export function seedUuid(prefixHex2: string, index: number): string {
  const safePrefix = prefixHex2.padStart(2, '0').slice(0, 2);
  const tail = String(index).padStart(12, '0');
  return `00000000-${safePrefix}00-4000-8000-${tail}`;
}

const PERMISSION_META_MAP: Record<PermissionCode, { module: string; nameAr: string }> = {
  [PERMISSIONS.DASHBOARD_VIEW]: { module: 'DASHBOARD', nameAr: 'عرض لوحة التحكم التنفيذية' },

  [PERMISSIONS.USERS_VIEW]: { module: 'IDENTITY', nameAr: 'عرض حسابات المستخدمين' },
  [PERMISSIONS.USERS_MANAGE]: { module: 'IDENTITY', nameAr: 'إنشاء وتعديل حسابات المستخدمين' },
  [PERMISSIONS.ROLES_MANAGE]: { module: 'IDENTITY', nameAr: 'إدارة الأدوار واستثناءات الصلاحيات' },
  [PERMISSIONS.AUDIT_VIEW]: { module: 'AUDIT', nameAr: 'الاطلاع على سجل العمليات والمراجعة' },

  [PERMISSIONS.STUDENTS_VIEW]: { module: 'STUDENTS', nameAr: 'عرض بيانات الطلاب وملفاتهم' },
  [PERMISSIONS.STUDENTS_CREATE]: { module: 'STUDENTS', nameAr: 'تسجيل طلاب جدد' },
  [PERMISSIONS.STUDENTS_UPDATE]: { module: 'STUDENTS', nameAr: 'تعديل بيانات الطلاب' },
  [PERMISSIONS.STUDENTS_ARCHIVE]: { module: 'STUDENTS', nameAr: 'إيقاف وأرشفة ملفات الطلاب' },

  [PERMISSIONS.TEACHERS_VIEW]: { module: 'TEACHERS', nameAr: 'عرض جميع المدرسين' },
  [PERMISSIONS.TEACHERS_MANAGE]: { module: 'TEACHERS', nameAr: 'إضافة وتعديل بيانات المدرسين' },
  [PERMISSIONS.TEACHERS_VIEW_OWN]: { module: 'TEACHERS', nameAr: 'عرض الملف والمجموعات الخاصة بالمدرس' },

  [PERMISSIONS.ASSISTANTS_VIEW]: { module: 'ASSISTANTS', nameAr: 'عرض المساعدين وطرق حسابهم' },
  [PERMISSIONS.ASSISTANTS_MANAGE]: { module: 'ASSISTANTS', nameAr: 'إضافة وتعديل بيانات المساعدين' },

  [PERMISSIONS.GROUPS_VIEW]: { module: 'GROUPS', nameAr: 'عرض المجموعات الدراسية ومواعيدها' },
  [PERMISSIONS.GROUPS_MANAGE]: { module: 'GROUPS', nameAr: 'إنشاء وتعديل المجموعات وسياساتها المالية' },

  [PERMISSIONS.ENROLLMENTS_VIEW]: { module: 'ENROLLMENTS', nameAr: 'عرض اشتراكات الطلاب بالمجموعات' },
  [PERMISSIONS.ENROLLMENTS_MANAGE]: { module: 'ENROLLMENTS', nameAr: 'إدارة اشتراكات وتحويلات الطلاب' },

  [PERMISSIONS.SESSIONS_VIEW]: { module: 'SESSIONS', nameAr: 'عرض جدول الحصص الدراسية' },
  [PERMISSIONS.SESSIONS_MANAGE]: { module: 'SESSIONS', nameAr: 'جدولة وتعديل وإلغاء الحصص' },

  [PERMISSIONS.ATTENDANCE_VIEW]: { module: 'ATTENDANCE', nameAr: 'عرض سجلات الحضور والغياب' },
  [PERMISSIONS.ATTENDANCE_RECORD]: { module: 'ATTENDANCE', nameAr: 'تسجيل الحضور والغياب اليومي' },
  [PERMISSIONS.ATTENDANCE_OVERRIDE]: { module: 'ATTENDANCE', nameAr: 'تعديل سجلات الحضور السابقة' },
  [PERMISSIONS.MAKEUP_MANAGE]: { module: 'ATTENDANCE', nameAr: 'إدارة الحصص التعويضية للغياب' },

  [PERMISSIONS.FINANCE_VIEW]: { module: 'FINANCE', nameAr: 'الاطلاع على الحسابات وكشوف المستحقات' },
  [PERMISSIONS.FINANCE_COLLECT_PAYMENT]: { module: 'FINANCE', nameAr: 'تحصيل مدفوعات الطلاب وإصدار الإيصالات' },
  [PERMISSIONS.FINANCE_PAYOUTS]: { module: 'FINANCE', nameAr: 'صرف مستحقات المدرسين والمساعدين' },
  [PERMISSIONS.FINANCE_EXPENSES]: { module: 'FINANCE', nameAr: 'تسجيل وإدارة مصروفات السنتر' },
  [PERMISSIONS.FINANCE_CLOSE_MONTH]: { module: 'FINANCE', nameAr: 'إقفال الحسابات الشهرية واعتمادها' },

  [PERMISSIONS.BOOKINGS_VIEW]: { module: 'BOOKINGS', nameAr: 'عرض طلبات حجز المواعيد والقاعات' },
  [PERMISSIONS.BOOKINGS_CREATE]: { module: 'BOOKINGS', nameAr: 'إنشاء طلبات حجز مواعيد جديدة' },
  [PERMISSIONS.BOOKINGS_APPROVE_ADMIN]: { module: 'BOOKINGS', nameAr: 'اعتماد وتخصيص القاعات إدارياً' },
  [PERMISSIONS.BOOKINGS_APPROVE_TEACHER]: { module: 'BOOKINGS', nameAr: 'موافقة المدرس على مواعيد الطلاب' },

  [PERMISSIONS.CLASSROOMS_VIEW]: { module: 'CLASSROOMS', nameAr: 'عرض القاعات وتجهيزاتها وإشغالها' },
  [PERMISSIONS.CLASSROOMS_MANAGE]: { module: 'CLASSROOMS', nameAr: 'إضافة وتعديل القاعات وجدولة الصيانة' },

  [PERMISSIONS.CALENDAR_VIEW]: { module: 'CALENDAR', nameAr: 'عرض التقويم الموحد للسنتر' },
  [PERMISSIONS.REPORTS_VIEW]: { module: 'REPORTS', nameAr: 'عرض التقارير التشغيلية والمالية' },
  [PERMISSIONS.REPORTS_EXPORT]: { module: 'REPORTS', nameAr: 'تصدير وطباعة التقارير بصيغة CSV/Excel' },

  [PERMISSIONS.BACKUPS_VIEW]: { module: 'BACKUPS', nameAr: 'عرض سجلات النسخ الاحتياطي والأمان' },
  [PERMISSIONS.BACKUPS_MANAGE]: { module: 'BACKUPS', nameAr: 'إجراء واستعادة وتنزيل النسخ الاحتياطية' },
};

export function buildSeedPermissionsList() {
  return ALL_PERMISSIONS.map((code) => {
    const meta = PERMISSION_META_MAP[code] || {
      module: code.split('.')[0].toUpperCase(),
      nameAr: `صلاحية ${code}`,
    };
    return {
      code,
      module: meta.module,
      nameAr: meta.nameAr,
    };
  });
}

export const SEED_ROLES_DATA: Array<{
  code: SystemRole;
  nameAr: string;
  description: string;
}> = [
  {
    code: SystemRole.OWNER,
    nameAr: 'المالك',
    description: 'صلاحيات كاملة ومطلقة على جميع أقسام وإعدادات وحسابات السنتر',
  },
  {
    code: SystemRole.MANAGER,
    nameAr: 'مدير السنتر',
    description: 'إدارة التشغيل اليومي والطلاب والمدرسين والمجموعات والقاعات والتقارير',
  },
  {
    code: SystemRole.ACCOUNTANT,
    nameAr: 'المحاسب',
    description: 'إدارة التحصيل والمصروفات وصرف المستحقات والتقارير المالية وإقفال الشهر',
  },
  {
    code: SystemRole.ATTENDANCE_EMPLOYEE,
    nameAr: 'موظف الحضور',
    description: 'تسجيل الحضور والغياب وإدارة الحصص التعويضية ومتابعة الجداول اليومية',
  },
  {
    code: SystemRole.TEACHER,
    nameAr: 'مدرس',
    description: 'متابعة المجموعات والحصص الخاصة به واعتماد مواعيد الطلاب المسندة إليه',
  },
];
