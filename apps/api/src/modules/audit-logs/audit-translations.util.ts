export const ACTION_TRANSLATIONS: Record<string, string> = {
  // Auth
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  AUTH_REFRESH: 'تجديد الجلسة',

  // Students
  CREATE_STUDENT: 'تسجيل طالب جديد',
  STUDENT_CREATE: 'تسجيل طالب جديد',
  UPDATE_STUDENT: 'تعديل بيانات طالب',
  STUDENT_UPDATE: 'تعديل بيانات طالب',
  ARCHIVE_STUDENT: 'أرشفة ملف طالب',
  STUDENT_ARCHIVE: 'أرشفة ملف طالب',

  // Teachers
  CREATE_TEACHER: 'إضافة مدرس جديد',
  TEACHER_CREATE: 'إضافة مدرس جديد',
  UPDATE_TEACHER: 'تعديل بيانات مدرس',
  TEACHER_UPDATE: 'تعديل بيانات مدرس',
  UPDATE_TEACHER_AVAILABILITY: 'تعديل جدول إتاحة المدرس',
  TEACHER_AVAILABILITY_UPDATE: 'تعديل جدول إتاحة المدرس',

  // Assistants
  CREATE_ASSISTANT: 'إضافة مساعد جديد',
  ASSISTANT_CREATE: 'إضافة مساعد جديد',
  UPDATE_ASSISTANT: 'تعديل بيانات مساعد',
  ASSISTANT_UPDATE: 'تعديل بيانات مساعد',

  // Groups
  CREATE_GROUP: 'إنشاء مجموعة دراسية',
  GROUP_CREATE: 'إنشاء مجموعة دراسية',
  UPDATE_GROUP: 'تعديل بيانات المجموعة',
  GROUP_UPDATE: 'تعديل بيانات المجموعة',

  // Enrollments
  CREATE_ENROLLMENT: 'تسجيل اشتراك طالب بالمجموعة',
  ENROLLMENT_CREATE: 'تسجيل اشتراك طالب بالمجموعة',
  UPDATE_ENROLLMENT: 'تعديل اشتراك طالب',
  ENROLLMENT_UPDATE: 'تعديل اشتراك طالب',

  // Attendance & Sessions
  RECORD_ATTENDANCE: 'تسجيل حضور وغياب يومي',
  ATTENDANCE_RECORD: 'تسجيل حضور وغياب يومي',
  OVERRIDE_ATTENDANCE: 'تعديل استثنائي لسجل حضور',
  ATTENDANCE_OVERRIDE: 'تعديل استثنائي لسجل حضور',
  CREATE_SESSION: 'إنشاء حصة دراسية جديدة',
  SESSION_CREATE: 'إنشاء حصة دراسية جديدة',
  GENERATE_MONTH_SESSIONS: 'توليد حصص الشهر للمجموعة تلقائياً',
  SESSION_GENERATE_MONTH: 'توليد حصص الشهر للمجموعة تلقائياً',
  CREATE_MAKEUP_SESSION: 'جدولة حصة تعويضية',
  MAKEUP_SESSION_CREATE: 'جدولة حصة تعويضية',
  MAKEUP_SCHEDULE: 'جدولة حصة تعويضية',
  UPDATE_MAKEUP_SESSION: 'تعديل حصة تعويضية',
  MAKEUP_SESSION_UPDATE: 'تعديل حصة تعويضية',

  // Bookings
  CREATE_BOOKING_REQUEST: 'طلب حجز موعد جديد',
  BOOKING_CREATE: 'طلب حجز موعد جديد',
  CREATE_BOOKING_SERIES: 'إنشاء سلسلة حجوزات دورية',
  BOOKING_SERIES_CREATE: 'إنشاء سلسلة حجوزات دورية',
  REVIEW_BOOKING_APPROVED: 'اعتماد وتأكيد طلب الحجز',
  REVIEW_BOOKING_CONFIRMED: 'تأكيد طلب الحجز وتخصيص قاعة',
  REVIEW_BOOKING_REJECTED: 'رفض طلب الحجز',
  REVIEW_BOOKING_MODIFIED: 'تعديل تفاصيل طلب الحجز',
  BOOKING_APPROVE: 'اعتماد طلب حجز وتخصيص قاعة',
  CANCEL_SINGLE_BOOKING: 'إلغاء موعد حجز',
  BOOKING_CANCEL: 'إلغاء موعد حجز',
  COMPLETE_BOOKING: 'إتمام وتنفيذ الحجز',
  BOOKING_COMPLETE: 'إتمام وتنفيذ الحجز',

  // Classrooms
  CREATE_CLASSROOM: 'إضافة قاعة دراسية جديدة',
  CLASSROOM_CREATE: 'إضافة قاعة دراسية جديدة',
  UPDATE_CLASSROOM: 'تعديل تجهيزات القاعة',
  CLASSROOM_UPDATE: 'تعديل تجهيزات القاعة',
  CREATE_CLASSROOM_MAINTENANCE: 'تسجيل جدول صيانة قاعة',
  CLASSROOM_MAINTENANCE_CREATE: 'تسجيل جدول صيانة قاعة',
  DELETE_CLASSROOM_MAINTENANCE: 'إلغاء صيانة قاعة',
  CLASSROOM_MAINTENANCE_DELETE: 'إلغاء صيانة قاعة',
  ALLOCATE_GROUP_TO_CLASSROOM: 'تخصيص قاعة لمجموعة دراسية',
  CLASSROOM_ALLOCATE_GROUP: 'تخصيص قاعة لمجموعة دراسية',
  RELEASE_GROUP_FROM_CLASSROOM: 'إلغاء تخصيص قاعة للمجموعة',
  CLASSROOM_RELEASE_GROUP: 'إلغاء تخصيص قاعة للمجموعة',

  // Grade Levels
  CREATE_GRADE_LEVEL: 'إضافة صف دراسي جديد',
  GRADE_LEVEL_CREATE: 'إضافة صف دراسي جديد',
  UPDATE_GRADE_LEVEL: 'تعديل بيانات الصف الدراسي',
  GRADE_LEVEL_UPDATE: 'تعديل بيانات الصف الدراسي',
  DELETE_GRADE_LEVEL: 'حذف صف دراسي',
  GRADE_LEVEL_DELETE: 'حذف صف دراسي',

  // Finance
  FINANCE_EXPENSE_CREATE: 'تسجيل مصروف إداري',
  EXPENSE_CREATE: 'تسجيل مصروف إداري',
  FINANCE_EXPENSE_UPDATE: 'تعديل مصروف إداري',
  EXPENSE_UPDATE: 'تعديل مصروف إداري',
  FINANCE_EXPENSE_DELETE: 'حذف سجل مصروف',
  EXPENSE_DELETE: 'حذف سجل مصروف',
  FINANCE_COLLECT_PAYMENT: 'تحصيل مدفوعات طالب',
  PAYMENT_COLLECT: 'تحصيل مدفوعات طالب',
  FINANCE_TEACHER_PAYOUT: 'صرف مستحقات مدرس',
  TEACHER_PAYOUT: 'صرف مستحقات مدرس',
  PAYOUT_CREATE: 'صرف مستحقات مدرس/مساعد',
  FINANCE_ASSISTANT_PAYOUT: 'صرف مستحقات مساعد',
  ASSISTANT_PAYOUT: 'صرف مستحقات مساعد',
  FINANCE_RECALCULATE_MONTH: 'إعادة احتساب مالي شهري',
  FINANCE_CLOSE_MONTH: 'إقفال الحسابات الشهرية',

  // Users & Roles
  CREATE_USER: 'إنشاء حساب مستخدم',
  USER_CREATE: 'إنشاء حساب مستخدم',
  UPDATE_USER: 'تعديل حساب مستخدم',
  USER_UPDATE: 'تعديل حساب مستخدم',
  UPDATE_USER_PERMISSIONS: 'تعديل صلاحيات المستخدم المباشرة',
  USER_PERMISSIONS_UPDATE: 'تعديل صلاحيات المستخدم المباشرة',
  PASSWORD_RESET: 'إعادة تعيين كلمة المرور',
  CREATE_ROLE: 'إنشاء دور وظيفي جديد',
  ROLE_CREATE: 'إنشاء دور وظيفي جديد',
  UPDATE_ROLE_PERMISSIONS: 'تعديل صلاحيات الدور الوظيفي',
  ROLE_PERMISSIONS_UPDATE: 'تعديل صلاحيات الدور الوظيفي',

  // Backups
  BACKUP_CREATE: 'إنشاء نسخة احتياطية',
  CREATE_BACKUP: 'إنشاء نسخة احتياطية',
  BACKUP_UPLOAD: 'رفع نسخة احتياطية يدوياً',
  UPLOAD_BACKUP: 'رفع نسخة احتياطية يدوياً',
  BACKUP_RESTORE: 'استعادة قاعدة البيانات من نسخة احتياطية',
  RESTORE_BACKUP: 'استعادة قاعدة البيانات من نسخة احتياطية',
  BACKUP_DELETE: 'حذف نسخة احتياطية',
  DELETE_BACKUP: 'حذف نسخة احتياطية',
  BACKUP_SETTINGS_UPDATE: 'تعديل إعدادات النسخ الاحتياطي',
  UPDATE_BACKUP_SETTINGS: 'تعديل إعدادات النسخ الاحتياطي',
  BACKUP_DISCONNECT_GOOGLE: 'فصل المزامنة السحابية مع Google Drive',

  // System & Settings
  'system.settings_update': 'تحديث إعدادات النظام والهوية',
  SETTINGS_UPDATE: 'تحديث إعدادات النظام والهوية',
  'system.settings_logo_uploaded': 'رفع وتعيين شعار السنتر',
  SETTINGS_LOGO_UPLOAD: 'رفع وتعيين شعار السنتر',
  'system.settings_logo_removed': 'حذف شعار السنتر',
  SETTINGS_LOGO_REMOVE: 'حذف شعار السنتر',
  'system.annual_reset_failed_pin': 'محاولة فاشلة لتصفير العام الدراسي (رمز PIN غير صحيح)',
  ANNUAL_RESET_FAILED_PIN: 'محاولة فاشلة لتصفير العام الدراسي (رمز PIN غير صحيح)',
  'system.annual_reset': 'تصفير العام الدراسي وبدء عام دراسي جديد',
  ANNUAL_RESET: 'تصفير العام الدراسي وبدء عام دراسي جديد',
};

export const ENTITY_TRANSLATIONS: Record<string, string> = {
  AUTH: 'المصادقة وتسجيل الدخول',
  auth: 'المصادقة وتسجيل الدخول',
  IDENTITY: 'المستخدمون والصلاحيات',
  identity: 'المستخدمون والصلاحيات',
  USER: 'حسابات المستخدمين',
  USERS: 'حسابات المستخدمين',
  user: 'حسابات المستخدمين',
  users: 'حسابات المستخدمين',
  ROLE: 'الأدوار والصلاحيات',
  ROLES: 'الأدوار والصلاحيات',
  role: 'الأدوار والصلاحيات',
  roles: 'الأدوار والصلاحيات',
  STUDENT: 'ملفات الطلاب',
  STUDENTS: 'ملفات الطلاب',
  student: 'ملفات الطلاب',
  students: 'ملفات الطلاب',
  TEACHER: 'المدرسين',
  TEACHERS: 'المدرسين',
  teacher: 'المدرسين',
  teachers: 'المدرسين',
  ASSISTANT: 'المساعدين',
  ASSISTANTS: 'المساعدين',
  assistant: 'المساعدين',
  assistants: 'المساعدين',
  GROUP: 'المجموعات الدراسية',
  GROUPS: 'المجموعات الدراسية',
  group: 'المجموعات الدراسية',
  groups: 'المجموعات الدراسية',
  SESSION: 'حصص المجموعات',
  SESSIONS: 'حصص المجموعات',
  session: 'حصص المجموعات',
  sessions: 'حصص المجموعات',
  group_session: 'حصص المجموعات',
  group_sessions: 'حصص المجموعات',
  MAKEUP_SESSION: 'الحصص التعويضية',
  MAKEUP_SESSIONS: 'الحصص التعويضية',
  makeup_session: 'الحصص التعويضية',
  makeup_sessions: 'الحصص التعويضية',
  ENROLLMENT: 'اشتراكات الطلاب بالمجموعات',
  ENROLLMENTS: 'اشتراكات الطلاب بالمجموعات',
  enrollment: 'اشتراكات الطلاب بالمجموعات',
  enrollments: 'اشتراكات الطلاب بالمجموعات',
  ATTENDANCE: 'الحضور والغياب',
  attendance: 'الحضور والغياب',
  FINANCE: 'الحسابات والمالية',
  finance: 'الحسابات والمالية',
  EXPENSE: 'مصروفات السنتر',
  EXPENSES: 'مصروفات السنتر',
  expense: 'مصروفات السنتر',
  expenses: 'مصروفات السنتر',
  PAYMENT: 'مدفوعات الطلاب',
  PAYMENTS: 'مدفوعات الطلاب',
  payment: 'مدفوعات الطلاب',
  payments: 'مدفوعات الطلاب',
  student_payment: 'مدفوعات الطلاب',
  student_payments: 'مدفوعات الطلاب',
  PAYOUT: 'مستحقات المدرسين والمساعدين',
  PAYOUTS: 'مستحقات المدرسين والمساعدين',
  payout: 'مستحقات المدرسين والمساعدين',
  payouts: 'مستحقات المدرسين والمساعدين',
  staff_payout: 'مستحقات المدرسين والمساعدين',
  staff_payouts: 'مستحقات المدرسين والمساعدين',
  teacher_payout: 'مستحقات المدرسين',
  assistant_payout: 'مستحقات المساعدين',
  monthly_settlement: 'التسويات الشهرية',
  monthly_settlements: 'التسويات الشهرية',
  MONTHLY_SETTLEMENT: 'التسويات الشهرية',
  BOOKING: 'حجوزات المواعيد',
  BOOKINGS: 'حجوزات المواعيد',
  booking: 'حجوزات المواعيد',
  bookings: 'حجوزات المواعيد',
  BOOKING_REQUEST: 'طلبات الحجز',
  booking_request: 'طلبات الحجز',
  BOOKING_SERIES: 'سلاسل الحجوزات الدورية',
  booking_series: 'سلاسل الحجوزات الدورية',
  CLASSROOM: 'القاعات الدراسية',
  CLASSROOMS: 'القاعات الدراسية',
  classroom: 'القاعات الدراسية',
  classrooms: 'القاعات الدراسية',
  CLASSROOM_MAINTENANCE: 'صيانة القاعات',
  classroom_maintenance: 'صيانة القاعات',
  GRADE_LEVEL: 'الصفوف الدراسية',
  GRADE_LEVELS: 'الصفوف الدراسية',
  grade_level: 'الصفوف الدراسية',
  grade_levels: 'الصفوف الدراسية',
  BACKUP: 'النسخ الاحتياطي',
  BACKUPS: 'النسخ الاحتياطي',
  backup: 'النسخ الاحتياطي',
  backups: 'النسخ الاحتياطي',
  SETTINGS: 'إعدادات النظام',
  settings: 'إعدادات النظام',
  SYSTEM: 'النظام',
  system: 'النظام',
};

const ACTION_WORDS_MAP: Record<string, string> = {
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
  ARCHIVE: 'أرشفة',
  RECORD: 'تسجيل',
  OVERRIDE: 'تعديل استثنائي',
  APPROVE: 'اعتماد',
  CONFIRM: 'تأكيد',
  REJECT: 'رفض',
  CANCEL: 'إلغاء',
  COMPLETE: 'إتمام',
  GENERATE: 'توليد',
  ALLOCATE: 'تخصيص',
  RELEASE: 'إلغاء تخصيص',
  RESTORE: 'استعادة',
  UPLOAD: 'رفع',
  RESET: 'تصفير',
  DISCONNECT: 'فصل',
  LOGIN: 'دخول',
  LOGOUT: 'خروج',
  REVIEW: 'مراجعة',
  VIEW: 'عرض',
  CLOSE: 'إقفال',
  RECALCULATE: 'إعادة احتساب',
  STUDENT: 'طالب',
  STUDENTS: 'الطلاب',
  TEACHER: 'مدرس',
  TEACHERS: 'المدرسين',
  ASSISTANT: 'مساعد',
  ASSISTANTS: 'المساعدين',
  GROUP: 'مجموعة',
  GROUPS: 'المجموعات',
  SESSION: 'حصة',
  SESSIONS: 'الحصص',
  ENROLLMENT: 'اشتراك',
  ENROLLMENTS: 'الاشتراكات',
  ATTENDANCE: 'حضور',
  CLASSROOM: 'قاعة',
  CLASSROOMS: 'القاعات',
  MAINTENANCE: 'صيانة',
  BOOKING: 'حجز',
  BOOKINGS: 'الحجوزات',
  SERIES: 'سلسلة دورية',
  REQUEST: 'طلب',
  EXPENSE: 'مصروف',
  EXPENSES: 'المصروفات',
  PAYMENT: 'دفع',
  PAYMENTS: 'المدفوعات',
  PAYOUT: 'صرف مستحقات',
  PAYOUTS: 'المستحقات',
  USER: 'مستخدم',
  USERS: 'المستخدمين',
  ROLE: 'دور',
  ROLES: 'الأدوار',
  BACKUP: 'نسخة احتياطية',
  BACKUPS: 'النسخ الاحتياطي',
  GRADE: 'مرحلة',
  LEVEL: 'صف',
  SETTINGS: 'إعدادات',
  SYSTEM: 'النظام',
  AVAILABILITY: 'إتاحة',
  PERMISSIONS: 'صلاحيات',
  LOGO: 'شعار',
  PIN: 'رمز الأمان',
  FAILED: 'فاشل',
  MODIFIED: 'معدّل',
  FEE: 'رسوم',
  EXTRA: 'إضافي',
  FREE: 'مجاني',
  SCHEDULE: 'جدولة',
  ALLOCATION: 'تخصيص',
  STATUS: 'حالة',
  SETTLEMENT: 'تسوية',
  SETTLEMENTS: 'التسويات',
  SINGLE: 'فردي',
  ONE: 'واحد',
  TIME: 'مرة',
  CONFIRMED: 'مؤكد',
  REJECTED: 'مرفوض',
  APPROVED: 'معتمد',
  PURGE: 'تصفير',
  ACADEMIC: 'أكاديمي',
  YEAR: 'عام',
  MONTH: 'شهر',
  MONTHLY: 'شهري',
};

export function getActionArabicLabel(action: string): string {
  if (!action) return 'عملية غير محددة';
  if (ACTION_TRANSLATIONS[action]) {
    return ACTION_TRANSLATIONS[action];
  }

  // Decompose dot/underscore separated string
  const cleanTokens = action.replace(/\./g, '_').split('_').filter(Boolean);
  const arabicWords = cleanTokens.map((w) => ACTION_WORDS_MAP[w.toUpperCase()] || w);
  return arabicWords.join(' ');
}

export function getEntityArabicLabel(entityType: string): string {
  if (!entityType) return 'غير محدد';
  if (ENTITY_TRANSLATIONS[entityType]) {
    return ENTITY_TRANSLATIONS[entityType];
  }

  const clean = entityType.replace(/[._]/g, ' ').trim();
  const mapped = ACTION_WORDS_MAP[clean.toUpperCase()];
  if (mapped) return mapped;

  return clean;
}

export function getSearchTermEquivalents(searchTerm: string): string[] {
  const term = searchTerm.trim().toLowerCase();
  const equivalents = new Set<string>();

  if (term.includes('طالب') || term.includes('طلاب')) {
    equivalents.add('STUDENT');
  }
  if (term.includes('مدرس') || term.includes('معلم') || term.includes('أساتذة')) {
    equivalents.add('TEACHER');
  }
  if (term.includes('مساعد') || term.includes('مساعدين')) {
    equivalents.add('ASSISTANT');
  }
  if (term.includes('مجموع') || term.includes('جروب')) {
    equivalents.add('GROUP');
  }
  if (term.includes('حضور') || term.includes('غياب') || term.includes('حصة') || term.includes('حصص')) {
    equivalents.add('SESSION');
    equivalents.add('ATTENDANCE');
  }
  if (term.includes('تعويض') || term.includes('تعويضية')) {
    equivalents.add('MAKEUP');
  }
  if (term.includes('اشتراك') || term.includes('تسجيل')) {
    equivalents.add('ENROLLMENT');
    equivalents.add('CREATE');
  }
  if (term.includes('حجز') || term.includes('ميعاد') || term.includes('موعد')) {
    equivalents.add('BOOKING');
  }
  if (term.includes('قاع') || term.includes('غرف') || term.includes('فصل')) {
    equivalents.add('CLASSROOM');
  }
  if (term.includes('صيان')) {
    equivalents.add('MAINTENANCE');
  }
  if (term.includes('مصروف') || term.includes('نفق')) {
    equivalents.add('EXPENSE');
  }
  if (term.includes('دفع') || term.includes('سداد') || term.includes('تحصيل') || term.includes('إيصال')) {
    equivalents.add('PAYMENT');
  }
  if (term.includes('صرف') || term.includes('مستحق')) {
    equivalents.add('PAYOUT');
  }
  if (term.includes('إقفال') || term.includes('تسوي') || term.includes('شهري')) {
    equivalents.add('SETTLEMENT');
    equivalents.add('CLOSE');
    equivalents.add('RECALCULATE');
  }
  if (term.includes('نسخ') || term.includes('احتياط') || term.includes('استعاد')) {
    equivalents.add('BACKUP');
  }
  if (term.includes('مستخدم') || term.includes('حساب')) {
    equivalents.add('USER');
  }
  if (term.includes('دور') || term.includes('صلاحي')) {
    equivalents.add('ROLE');
    equivalents.add('PERMISSION');
  }
  if (term.includes('صف') || term.includes('مرحل') || term.includes('دراسي')) {
    equivalents.add('GRADE');
  }
  if (term.includes('إعداد') || term.includes('نظام') || term.includes('شعار')) {
    equivalents.add('SETTINGS');
    equivalents.add('SYSTEM');
  }
  if (term.includes('دخول')) {
    equivalents.add('LOGIN');
  }
  if (term.includes('خروج')) {
    equivalents.add('LOGOUT');
  }
  if (term.includes('تعديل')) {
    equivalents.add('UPDATE');
  }
  if (term.includes('حذف')) {
    equivalents.add('DELETE');
  }
  if (term.includes('إنشاء') || term.includes('إضاف')) {
    equivalents.add('CREATE');
  }

  return Array.from(equivalents);
}

