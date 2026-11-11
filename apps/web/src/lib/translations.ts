export const AUDIT_ACTION_TRANSLATIONS: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  // المصادقة
  LOGIN: { label: 'تسجيل دخول', variant: 'success' },
  LOGOUT: { label: 'تسجيل خروج', variant: 'neutral' },
  AUTH_REFRESH: { label: 'تجديد الجلسة', variant: 'neutral' },

  // الطلاب
  CREATE_STUDENT: { label: 'تسجيل طالب جديد', variant: 'success' },
  STUDENT_CREATE: { label: 'تسجيل طالب جديد', variant: 'success' },
  UPDATE_STUDENT: { label: 'تعديل بيانات طالب', variant: 'info' },
  STUDENT_UPDATE: { label: 'تعديل بيانات طالب', variant: 'info' },
  ARCHIVE_STUDENT: { label: 'أرشفة ملف طالب', variant: 'warning' },
  STUDENT_ARCHIVE: { label: 'أرشفة ملف طالب', variant: 'warning' },

  // المدرسين
  CREATE_TEACHER: { label: 'إضافة مدرس جديد', variant: 'success' },
  TEACHER_CREATE: { label: 'إضافة مدرس جديد', variant: 'success' },
  UPDATE_TEACHER: { label: 'تعديل بيانات مدرس', variant: 'info' },
  TEACHER_UPDATE: { label: 'تعديل بيانات مدرس', variant: 'info' },
  UPDATE_TEACHER_AVAILABILITY: { label: 'تعديل جدول إتاحة المدرس', variant: 'info' },
  TEACHER_AVAILABILITY_UPDATE: { label: 'تعديل جدول إتاحة المدرس', variant: 'info' },

  // المساعدين
  CREATE_ASSISTANT: { label: 'إضافة مساعد جديد', variant: 'success' },
  ASSISTANT_CREATE: { label: 'إضافة مساعد جديد', variant: 'success' },
  UPDATE_ASSISTANT: { label: 'تعديل بيانات مساعد', variant: 'info' },
  ASSISTANT_UPDATE: { label: 'تعديل بيانات مساعد', variant: 'info' },

  // المجموعات
  CREATE_GROUP: { label: 'إنشاء مجموعة دراسية', variant: 'success' },
  GROUP_CREATE: { label: 'إنشاء مجموعة دراسية', variant: 'success' },
  UPDATE_GROUP: { label: 'تعديل بيانات المجموعة', variant: 'info' },
  GROUP_UPDATE: { label: 'تعديل بيانات المجموعة', variant: 'info' },

  // الاشتراكات
  CREATE_ENROLLMENT: { label: 'تسجيل اشتراك طالب بالمجموعة', variant: 'success' },
  ENROLLMENT_CREATE: { label: 'تسجيل اشتراك طالب بالمجموعة', variant: 'success' },
  UPDATE_ENROLLMENT: { label: 'تعديل اشتراك طالب', variant: 'info' },
  ENROLLMENT_UPDATE: { label: 'تعديل اشتراك طالب', variant: 'info' },

  // الصفوف والمراحل الدراسية
  CREATE_GRADE_LEVEL: { label: 'إضافة صف دراسي جديد', variant: 'success' },
  GRADE_LEVEL_CREATE: { label: 'إضافة صف دراسي جديد', variant: 'success' },
  UPDATE_GRADE_LEVEL: { label: 'تعديل بيانات الصف الدراسي', variant: 'info' },
  GRADE_LEVEL_UPDATE: { label: 'تعديل بيانات الصف الدراسي', variant: 'info' },
  DELETE_GRADE_LEVEL: { label: 'حذف صف دراسي', variant: 'danger' },
  GRADE_LEVEL_DELETE: { label: 'حذف صف دراسي', variant: 'danger' },

  // الحضور والحصص
  RECORD_ATTENDANCE: { label: 'تسجيل حضور وغياب يومي', variant: 'success' },
  ATTENDANCE_RECORD: { label: 'تسجيل حضور وغياب يومي', variant: 'success' },
  OVERRIDE_ATTENDANCE: { label: 'تعديل استثنائي لسجل حضور', variant: 'warning' },
  ATTENDANCE_OVERRIDE: { label: 'تعديل استثنائي لسجل حضور', variant: 'warning' },
  CREATE_SESSION: { label: 'إنشاء حصة دراسية جديدة', variant: 'success' },
  SESSION_CREATE: { label: 'إنشاء حصة دراسية جديدة', variant: 'success' },
  GENERATE_MONTH_SESSIONS: { label: 'توليد حصص الشهر للمجموعة', variant: 'info' },
  SESSION_GENERATE_MONTH: { label: 'توليد حصص الشهر للمجموعة', variant: 'info' },
  CREATE_MAKEUP_SESSION: { label: 'جدولة حصة تعويضية', variant: 'info' },
  MAKEUP_SESSION_CREATE: { label: 'جدولة حصة تعويضية', variant: 'info' },
  MAKEUP_SCHEDULE: { label: 'جدولة حصة تعويضية', variant: 'info' },
  UPDATE_MAKEUP_SESSION: { label: 'تعديل حصة تعويضية', variant: 'info' },
  MAKEUP_SESSION_UPDATE: { label: 'تعديل حصة تعويضية', variant: 'info' },

  // الحجوزات
  CREATE_BOOKING_REQUEST: { label: 'طلب حجز موعد جديد', variant: 'info' },
  BOOKING_CREATE: { label: 'طلب حجز موعد جديد', variant: 'info' },
  CREATE_BOOKING_SERIES: { label: 'إنشاء سلسلة حجوزات دورية', variant: 'info' },
  BOOKING_SERIES_CREATE: { label: 'إنشاء سلسلة حجوزات دورية', variant: 'info' },
  APPROVE_BOOKING: { label: 'اعتماد طلب حجز وتخصيص قاعة', variant: 'success' },
  BOOKING_APPROVE: { label: 'اعتماد طلب حجز وتخصيص قاعة', variant: 'success' },
  REJECT_BOOKING: { label: 'رفض طلب حجز', variant: 'danger' },
  BOOKING_REJECT: { label: 'رفض طلب حجز', variant: 'danger' },
  CANCEL_BOOKING: { label: 'إلغاء حجز موعد', variant: 'warning' },
  BOOKING_CANCEL: { label: 'إلغاء حجز موعد', variant: 'warning' },

  // القاعات
  CREATE_CLASSROOM: { label: 'إضافة قاعة دراسية جديدة', variant: 'success' },
  CLASSROOM_CREATE: { label: 'إضافة قاعة دراسية جديدة', variant: 'success' },
  ROOM_CREATE: { label: 'إضافة قاعة دراسية جديدة', variant: 'success' },
  UPDATE_CLASSROOM: { label: 'تعديل تجهيزات القاعة', variant: 'info' },
  CLASSROOM_UPDATE: { label: 'تعديل تجهيزات القاعة', variant: 'info' },
  ROOM_UPDATE: { label: 'تعديل تجهيزات القاعة', variant: 'info' },
  DELETE_CLASSROOM: { label: 'حذف قاعة دراسية', variant: 'danger' },
  CLASSROOM_DELETE: { label: 'حذف قاعة دراسية', variant: 'danger' },
  ROOM_DELETE: { label: 'حذف قاعة دراسية', variant: 'danger' },
  ROOM_MAINTENANCE_LOG: { label: 'تسجيل بلاغ صيانة لقاعة', variant: 'warning' },
  CLASSROOM_MAINTENANCE_LOG: { label: 'تسجيل بلاغ صيانة لقاعة', variant: 'warning' },

  // الحسابات والمالية
  PAYMENT_COLLECT: { label: 'تحصيل مدفوعات طالب', variant: 'success' },
  COLLECT_PAYMENT: { label: 'تحصيل مدفوعات طالب', variant: 'success' },
  PAYMENT_CREATE: { label: 'تسجيل دفعة مالية', variant: 'success' },
  PAYOUT_CREATE: { label: 'صرف مستحقات مدرس/مساعد', variant: 'info' },
  CREATE_PAYOUT: { label: 'صرف مستحقات مدرس/مساعد', variant: 'info' },
  EXPENSE_CREATE: { label: 'تسجيل مصروف إداري', variant: 'danger' },
  CREATE_EXPENSE: { label: 'تسجيل مصروف إداري', variant: 'danger' },
  FINANCE_RECALCULATE_MONTH: { label: 'إعادة احتساب مالي شهري', variant: 'info' },
  MONTHLY_SETTLEMENT_RECALCULATE: { label: 'إعادة احتساب مالي شهري', variant: 'info' },
  FINANCE_CLOSE_MONTH: { label: 'إقفال الحسابات الشهرية', variant: 'warning' },
  MONTHLY_SETTLEMENT_CLOSE: { label: 'إقفال الحسابات الشهرية', variant: 'warning' },

  // النسخ الاحتياطي
  BACKUP_CREATE: { label: 'إنشاء نسخة احتياطية', variant: 'success' },
  CREATE_BACKUP: { label: 'إنشاء نسخة احتياطية', variant: 'success' },
  BACKUP_UPLOAD: { label: 'رفع واستيراد نسخة احتياطية', variant: 'info' },
  UPLOAD_BACKUP: { label: 'رفع واستيراد نسخة احتياطية', variant: 'info' },
  BACKUP_RESTORE: { label: 'استعادة قاعدة البيانات', variant: 'danger' },
  RESTORE_BACKUP: { label: 'استعادة قاعدة البيانات', variant: 'danger' },
  BACKUP_SETTINGS_UPDATE: { label: 'تحديث إعدادات النسخ التلقائي', variant: 'info' },
  UPDATE_BACKUP_SETTINGS: { label: 'تحديث إعدادات النسخ التلقائي', variant: 'info' },
  BACKUP_DISCONNECT_GOOGLE: { label: 'فصل الاتصال بجوجل درايف', variant: 'warning' },
  DISCONNECT_GOOGLE_BACKUP: { label: 'فصل الاتصال بجوجل درايف', variant: 'warning' },

  // إعدادات النظام والسنتر
  'system.settings_update': { label: 'تعديل الإعدادات العامة للسنتر', variant: 'info' },
  SYSTEM_SETTINGS_UPDATE: { label: 'تعديل الإعدادات العامة للسنتر', variant: 'info' },
  'system.settings_logo_uploaded': { label: 'رفع وتحديث شعار السنتر', variant: 'info' },
  SYSTEM_SETTINGS_LOGO_UPLOADED: { label: 'رفع وتحديث شعار السنتر', variant: 'info' },
  'system.settings_logo_removed': { label: 'حذف شعار السنتر', variant: 'warning' },
  SYSTEM_SETTINGS_LOGO_REMOVED: { label: 'حذف شعار السنتر', variant: 'warning' },
  'system.annual_reset': { label: 'إجراء التصفير السنوي الشامل', variant: 'danger' },
  SYSTEM_ANNUAL_RESET: { label: 'إجراء التصفير السنوي الشامل', variant: 'danger' },

  // المستخدمون والأدوار
  USER_CREATE: { label: 'إنشاء حساب مستخدم', variant: 'success' },
  CREATE_USER: { label: 'إنشاء حساب مستخدم', variant: 'success' },
  USER_UPDATE: { label: 'تعديل حساب مستخدم', variant: 'info' },
  UPDATE_USER: { label: 'تعديل حساب مستخدم', variant: 'info' },
  USER_STATUS_UPDATE: { label: 'تغيير حالة حساب المستخدم', variant: 'warning' },
  UPDATE_USER_STATUS: { label: 'تغيير حالة حساب المستخدم', variant: 'warning' },
  USER_PASSWORD_CHANGE: { label: 'تغيير كلمة المرور للمستخدم', variant: 'warning' },
  PASSWORD_RESET: { label: 'إعادة تعيين كلمة المرور', variant: 'warning' },
  RESET_PASSWORD: { label: 'إعادة تعيين كلمة المرور', variant: 'warning' },
  ROLE_CREATE: { label: 'إنشاء دور صلاحيات جديد', variant: 'success' },
  CREATE_ROLE: { label: 'إنشاء دور صلاحيات جديد', variant: 'success' },
  ROLE_UPDATE: { label: 'تعديل دور الصلاحيات', variant: 'info' },
  UPDATE_ROLE: { label: 'تعديل دور الصلاحيات', variant: 'info' },
  ROLE_DELETE: { label: 'حذف دور صلاحيات', variant: 'danger' },
  DELETE_ROLE: { label: 'حذف دور صلاحيات', variant: 'danger' },
};

export const AUDIT_ENTITY_TRANSLATIONS: Record<string, string> = {
  AUTH: 'المصادقة وتسجيل الدخول',
  auth: 'المصادقة وتسجيل الدخول',
  IDENTITY: 'المستخدمون والصلاحيات',
  USERS: 'حسابات المستخدمين',
  USER: 'المستخدمون',
  user: 'المستخدمون',
  users: 'حسابات المستخدمين',
  ROLES: 'الأدوار والصلاحيات',
  ROLE: 'الأدوار والصلاحيات',
  role: 'الأدوار والصلاحيات',
  roles: 'الأدوار والصلاحيات',

  STUDENTS: 'الطلاب',
  STUDENT: 'الطلاب',
  student: 'ملفات الطلاب',
  students: 'ملفات الطلاب',

  TEACHERS: 'المدرسين',
  TEACHER: 'المدرسين',
  teacher: 'المدرسين',
  teachers: 'المدرسين',

  ASSISTANTS: 'المساعدين',
  ASSISTANT: 'المساعدين',
  assistant: 'المساعدين',
  assistants: 'المساعدين',

  GROUPS: 'المجموعات الدراسية',
  GROUP: 'المجموعات الدراسية',
  group: 'المجموعات الدراسية',
  groups: 'المجموعات الدراسية',

  GRADE_LEVEL: 'الصفوف الدراسية',
  GRADE_LEVELS: 'الصفوف الدراسية',
  grade_level: 'الصفوف الدراسية',
  grade_levels: 'الصفوف الدراسية',

  ENROLLMENT: 'اشتراكات المجموعات',
  ENROLLMENTS: 'اشتراكات المجموعات',
  enrollment: 'اشتراكات المجموعات',
  enrollments: 'اشتراكات المجموعات',

  ATTENDANCE: 'الحضور والغياب',
  attendance: 'الحضور والغياب',
  attendance_record: 'سجلات الحضور',

  SESSION: 'الحصص الدراسية',
  SESSIONS: 'الحصص الدراسية',
  group_session: 'حصص المجموعات',
  group_sessions: 'حصص المجموعات',

  MAKEUP_SESSION: 'الحصص التعويضية',
  MAKEUP_SESSIONS: 'الحصص التعويضية',
  makeup_session: 'الحصص التعويضية',
  makeup_sessions: 'الحصص التعويضية',

  BOOKING: 'حجوزات المواعيد',
  BOOKINGS: 'حجوزات المواعيد',
  BOOKING_REQUEST: 'حجوزات المواعيد',
  BOOKING_SERIES: 'سلاسل الحجوزات',
  booking: 'حجوزات المواعيد',
  bookings: 'حجوزات المواعيد',
  booking_request: 'طلبات الحجز',
  booking_requests: 'طلبات الحجز',

  CLASSROOM: 'القاعات الدراسية',
  CLASSROOMS: 'القاعات الدراسية',
  classroom: 'القاعات الدراسية',
  classrooms: 'القاعات الدراسية',
  classroom_maintenance: 'صيانة القاعات',
  ROOM: 'القاعات الدراسية',
  room: 'القاعات الدراسية',

  FINANCE: 'الحسابات والمالية',
  PAYMENT: 'مدفوعات الطلاب',
  PAYMENTS: 'مدفوعات الطلاب',
  payment: 'مدفوعات الطلاب',
  payments: 'مدفوعات الطلاب',
  student_payment: 'مدفوعات الطلاب',
  student_payments: 'مدفوعات الطلاب',

  EXPENSE: 'مصروفات السنتر',
  EXPENSES: 'مصروفات السنتر',
  expense: 'مصروفات السنتر',
  expenses: 'مصروفات السنتر',

  STAFF_PAYOUT: 'مستحقات المدرسين والمساعدين',
  STAFF_PAYOUTS: 'مستحقات المدرسين والمساعدين',
  staff_payout: 'مستحقات المدرسين والمساعدين',
  staff_payouts: 'مستحقات المدرسين والمساعدين',

  MONTHLY_SETTLEMENT: 'التسويات الشهرية',
  MONTHLY_SETTLEMENTS: 'التسويات الشهرية',
  monthly_settlement: 'التسويات الشهرية',
  monthly_settlements: 'التسويات الشهرية',

  BACKUP: 'النسخ الاحتياطي',
  BACKUPS: 'النسخ الاحتياطي',
  backup: 'النسخ الاحتياطي',
  backups: 'النسخ الاحتياطي',

  SETTINGS: 'إعدادات النظام',
  SETTING: 'إعدادات النظام',
  settings: 'إعدادات النظام',
  system: 'إعدادات النظام',
  SYSTEM: 'إعدادات النظام',
};

const ACTION_WORD_MAP: Record<string, string> = {
  CREATE: 'إنشاء',
  ADD: 'إضافة',
  NEW: 'جديد',
  UPDATE: 'تعديل',
  EDIT: 'تعديل',
  CHANGE: 'تغيير',
  DELETE: 'حذف',
  REMOVE: 'إزالة',
  ARCHIVE: 'أرشفة',
  RESTORE: 'استعادة',
  UPLOAD: 'رفع',
  DOWNLOAD: 'تحميل',
  VIEW: 'عرض',
  CLOSE: 'إقفال',
  RECALCULATE: 'إعادة احتساب',
  RECORD: 'تسجيل',
  OVERRIDE: 'تعديل استثنائي',
  APPROVE: 'اعتماد',
  REJECT: 'رفض',
  CANCEL: 'إلغاء',
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  REFRESH: 'تجديد',
  RESET: 'إعادة ضبط',
  GENERATE: 'توليد',
  SCHEDULE: 'جدولة',
  DISCONNECT: 'فصل',
  CONNECT: 'ربط',
  STUDENT: 'طالب',
  STUDENTS: 'الطلاب',
  TEACHER: 'مدرس',
  TEACHERS: 'المدرسين',
  ASSISTANT: 'مساعد',
  ASSISTANTS: 'المساعدين',
  GROUP: 'مجموعة',
  GROUPS: 'المجموعات',
  GRADE: 'صف',
  LEVEL: 'دراسي',
  ENROLLMENT: 'اشتراك',
  ENROLLMENTS: 'الاشتراكات',
  SESSION: 'حصة',
  SESSIONS: 'الحصص',
  ATTENDANCE: 'حضور',
  MAKEUP: 'تعويضية',
  BOOKING: 'حجز',
  BOOKINGS: 'الحجوزات',
  SERIES: 'سلسلة',
  REQUEST: 'طلب',
  PAYMENT: 'دفعة',
  PAYMENTS: 'المدفوعات',
  PAYOUT: 'مستحقات',
  PAYOUTS: 'المستحقات',
  EXPENSE: 'مصروف',
  EXPENSES: 'المصروفات',
  FINANCE: 'المالية',
  SETTLEMENT: 'تسوية',
  MONTH: 'شهر',
  MONTHLY: 'شهري',
  BACKUP: 'نسخة احتياطية',
  SETTINGS: 'إعدادات',
  SETTING: 'إعداد',
  SYSTEM: 'النظام',
  USER: 'مستخدم',
  USERS: 'المستخدمين',
  ROLE: 'صلاحية',
  ROLES: 'الصلاحيات',
  ROOM: 'قاعة',
  ROOMS: 'القاعات',
  CLASSROOM: 'قاعة',
  CLASSROOMS: 'القاعات',
  MAINTENANCE: 'صيانة',
  PASSWORD: 'كلمة المرور',
  STATUS: 'الحالة',
  ANNUAL: 'السنوي',
  LOGO: 'الشعار',
  GOOGLE: 'جوجل درايف',
};

export function translateAuditAction(action: string): {
  label: string;
  variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (!action) return { label: '—', variant: 'neutral' };

  if (AUDIT_ACTION_TRANSLATIONS[action]) {
    return AUDIT_ACTION_TRANSLATIONS[action];
  }

  const normalized = action.toUpperCase().replace(/\./g, '_');
  if (AUDIT_ACTION_TRANSLATIONS[normalized]) {
    return AUDIT_ACTION_TRANSLATIONS[normalized];
  }

  // Decompose tokens
  const tokens = normalized.split('_').filter(Boolean);
  const translated = tokens.map((token) => ACTION_WORD_MAP[token] || token);

  const label = translated.join(' ');
  const isDanger = normalized.includes('DELETE') || normalized.includes('RESET') || normalized.includes('RESTORE') || normalized.includes('REJECT');
  const isWarning = normalized.includes('ARCHIVE') || normalized.includes('OVERRIDE') || normalized.includes('CANCEL');
  const isSuccess = normalized.includes('CREATE') || normalized.includes('LOGIN') || normalized.includes('APPROVE') || normalized.includes('COLLECT');

  const variant = isDanger ? 'danger' : isWarning ? 'warning' : isSuccess ? 'success' : 'info';
  return { label, variant };
}

export function translateAuditEntity(entity: string): string {
  if (!entity) return '—';

  if (AUDIT_ENTITY_TRANSLATIONS[entity]) {
    return AUDIT_ENTITY_TRANSLATIONS[entity];
  }

  const upper = entity.toUpperCase().replace(/\./g, '_');
  if (AUDIT_ENTITY_TRANSLATIONS[upper]) {
    return AUDIT_ENTITY_TRANSLATIONS[upper];
  }

  const tokens = upper.split('_').filter(Boolean);
  const translated = tokens.map((t) => ACTION_WORD_MAP[t] || t);
  return translated.join(' ');
}

export const PAYLOAD_KEY_TRANSLATIONS: Record<string, string> = {
  id: 'المعرّف',
  name: 'الاسم',
  fullName: 'الاسم الكامل',
  phone: 'رقم الهاتف',
  email: 'البريد الإلكتروني',
  gender: 'النوع',
  notes: 'ملاحظات',
  guardianPhone: 'هاتف ولي الأمر',
  guardianName: 'اسم ولي الأمر',
  gradeLevelId: 'الصف الدراسي',
  gradeLevel: 'الصف الدراسي',
  gradeLevels: 'الصفوف الدراسية',
  status: 'الحالة',
  price: 'السعر',
  monthlyFee: 'المصروفات الشهرية',
  monthlyPrice: 'المصروفات الشهرية',
  monthlySessionsCount: 'عدد الحصص الشهرية',
  calculatedSessionPrice: 'سعر الحصة المحتسب',
  amount: 'المبلغ',
  paymentMethod: 'طريقة الدفع',
  date: 'التاريخ',
  sessionDate: 'تاريخ الحصة',
  startTime: 'وقت البدء',
  endTime: 'وقت الانتهاء',
  subject: 'المادة الدراسية',
  capacity: 'السعة الاستيعابية',
  maxStudents: 'الحد الأقصى للطلاب',
  room: 'القاعة',
  roomId: 'القاعة',
  teacherId: 'المدرس',
  teacherName: 'اسم المدرس',
  primaryTeacherId: 'المدرس الأساسي',
  defaultClassroomId: 'القاعة الافتراضية',
  assistantId: 'المساعد',
  assistantName: 'اسم المساعد',
  studentId: 'الطالب',
  studentName: 'اسم الطالب',
  groupId: 'المجموعة الدراسية',
  groupName: 'اسم المجموعة',
  actionAr: 'اسم العملية بالعربية',
  entityTypeAr: 'نوع القسم بالعربية',
  centerName: 'اسم السنتر',
  academicYear: 'العام الدراسي',
  totalDue: 'الإجمالي المستحق',
  totalPaid: 'الإجمالي المدفوع',
  discount: 'الخصم',
  reason: 'السبب / التفاصيل',
  type: 'النوع',
  isActive: 'مفعّل',
  isOnline: 'عبر الإنترنت',
  description: 'الوصف',
  filename: 'اسم الملف',
  fileName: 'اسم الملف',
  file_name: 'اسم الملف',
  fileSize: 'حجم الملف',
  sizeBytes: 'الحجم (بايت)',
  fileSizeBytes: 'حجم الملف (بايت)',
  file_size_bytes: 'حجم الملف (بايت)',
  googleDriveEnabled: 'المزامنة مع جوجل درايف',
  autoBackupEnabled: 'النسخ الاحتياطي التلقائي',
  frequency: 'التكرار',
  retentionDays: 'مدة الاحتفاظ (أيام)',
  retentionCount: 'عدد النسخ المحتفظ بها',
  storageLocation: 'مكان التخزين',
  restoredTables: 'الجداول المستعادة',
  restoredAt: 'تاريخ الاستعادة',
  triggerType: 'نوع التشغيل',
  destinations: 'وجهات الحفظ',
  checksum: 'كود التحقق الرقمي (Checksum)',
  archivedAt: 'تاريخ الأرشفة',
  deletedAt: 'تاريخ الحذف',
  createdAt: 'تاريخ الإنشاء',
  updatedAt: 'تاريخ التحديث',
  roleCode: 'كود الدور',
  roleNameAr: 'اسم الدور بالعربية',
  roleId: 'الدور الصلاحي',
  permissions: 'الصلاحيات',
  permissionCodes: 'الصلاحيات الممنوحة',
  code: 'الكود / الرمز',
  nameAr: 'الاسم بالعربية',
  isSystem: 'دور نظام أساسي',
  lastLoginAt: 'آخر تسجيل دخول',
  requestType: 'نوع طلب الحجز',
  purpose: 'الغرض من الحجز',
  requestedDate: 'التاريخ المطلوب',
  durationMinutes: 'المدة (بالدقائق)',
  expectedAttendees: 'العدد المتوقع للحضور',
  requestedClassroomId: 'القاعة المطلوبة',
  assignedClassroomId: 'القاعة المخصصة',
  createdByUserId: 'أنشئ بواسطة المستخدم',
  occurrencesCount: 'عدد المواعيد المنشأة',
  conflictsCount: 'عدد التعارضات',
  seriesId: 'معرّف السلسلة',
  decision: 'قرار المراجعة',
  comment: 'ملاحظات المراجعة',
  insertedCount: 'عدد السجلات المضافة',
  createdCount: 'عدد الحصص المنشأة',
  skippedCount: 'عدد الحصص المتخطاة',
  yearMonth: 'الشهر المالي',
  originalSessionId: 'معرّف الحصة الأصلية',
  absenceDate: 'تاريخ الغياب',
  scheduledAt: 'الموعد المجدول',
  isFree: 'مجاني بدون رسوم',
  extraFee: 'رسوم إضافية',
  approvedByUserId: 'اعتمد بواسطة',
  topic: 'موضوع الحصة',
  roomNumber: 'رقم القاعة',
  maxCapacity: 'السعة القصوى',
  seatsCount: 'عدد المقاعد',
  equipment: 'التجهيزات المتاحة',
  startAt: 'بداية الفترة',
  endAt: 'نهاية الفترة',
  slots: 'المواعيد والجدول',
  scheduleSlots: 'مواعيد الحصص الأسبوعية',
  updateUpcomingSessions: 'تحديث الحصص القادمة',
  enrolledCount: 'عدد الطلاب المشتركين',
  allowOverCapacity: 'السماح بتجاوز السعة',
  category: 'تصنيف المصروف',
  title: 'العنوان / البيان',
  expenseDate: 'تاريخ المصروف',
  paymentDate: 'تاريخ الدفع',
  payoutDate: 'تاريخ الصرف',
  receiptNumber: 'رقم الإيصال',
  referenceNumber: 'رقم المرجع',
  receivedByUserId: 'استلم بواسطة المستخدم',
  paidByUserId: 'صرف بواسطة المستخدم',
  recordedByUserId: 'سجل بواسطة المستخدم',
  allocations: 'توزيع المبالغ',
  updatedStudentRecords: 'سجلات الطلاب المحدثة',
  updatedTeacherRecords: 'سجلات المدرسين المحدثة',
  updatedAssistantRecords: 'سجلات المساعدين المحدثة',
  teacherCode: 'كود المدرس',
  specialization: 'التخصص',
  contractDate: 'تاريخ التعاقد',
  employmentStatus: 'حالة العمل',
  canApproveBookings: 'صلاحية اعتماد الحجوزات',
  dayOfWeek: 'يوم الأسبوع',
  assistantCode: 'كود المساعد',
  calculationMethod: 'طريقة الحساب',
  rateValue: 'قيمة الراتب/النسبة',
  customFormulaNote: 'ملاحظة المعادلة المخصصة',
  overrideCalculationMethod: 'طريقة حساب استثنائية',
  overrideRateValue: 'قيمة استثنائية',
  teacherSharePerStudent: 'حصة المدرس لكل طالب',
  centerSharePerStudent: 'حصة السنتر لكل طالب',
  teacherPercentage: 'نسبة المدرس (%)',
  studentCode: 'كود الطالب',
  registrationDate: 'تاريخ التسجيل',
  agreedMonthlyPrice: 'المصروفات الشهرية المتفق عليها',
  agreedSessionsCount: 'عدد الحصص المتفق عليه',
  agreedSessionPrice: 'سعر الحصة المتفق عليه',
  startDate: 'تاريخ البدء',
  endDate: 'تاريخ الانتهاء',
  financialPolicy: 'السياسة المالية',
  coTeacherIds: 'المدرسون المساعدون بالمجموعة',
  assistants: 'المساعدون المرتبطون',
  group: 'بيانات المجموعة',
  value: 'القيمة',
};

export const PAYLOAD_VALUE_TRANSLATIONS: Record<string, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  ARCHIVED: 'مؤرشف',
  MALE: 'ذكر',
  FEMALE: 'أنثى',
  CASH: 'نقداً',
  VODAFONE_CASH: 'فودافون كاش',
  INSTAPAY: 'إنستاباي',
  BANK_TRANSFER: 'تحويل بنكي',
  CARD: 'بطاقة دفع',
  PENDING: 'قيد الانتظار',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  CONFIRMED: 'مؤكد',
  CANCELLED: 'ملغي',
  COMPLETED: 'مكتمل',
  ATTENDED: 'حاضر',
  PRESENT: 'حاضر',
  ABSENT: 'غائب',
  EXCUSED: 'غياب بعذر',
  LATE: 'متأخر',
  MAKEUP_ATTENDED: 'حضر تعويضي',
  SYSTEM: 'النظام',
  MANUAL: 'يدوي',
  AUTOMATIC: 'تلقائي',
  SCHEDULED: 'مجدول',
  LOCAL: 'محلي',
  GOOGLE_DRIVE: 'جوجل درايف',
  AVAILABLE: 'متاحة',
  MAINTENANCE: 'تحت الصيانة',
  SUCCESS: 'ناجح',
  FAILED: 'فاشل',
  MODIFIED: 'معدّل',
  OWNER: 'مالك النظام',
  ADMIN: 'مدير',
  ACCOUNTANT: 'محاسب',
  SECRETARY: 'سكرتارية',
  TEACHER: 'مدرس',
  ASSISTANT: 'مساعد',
  ONE_TIME: 'حجز لمرة واحدة',
  SERIES: 'سلسلة دورية',
  FIXED_PER_STUDENT: 'مبلغ ثابت لكل طالب',
  PER_ATTENDING_STUDENT: 'مبلغ لكل طالب حاضر',
  FIXED_PER_SESSION: 'مبلغ ثابت لكل حصة',
  HOURLY: 'بالساعة',
  SESSION_COMMISSION_PERCENT: 'نسبة مئوية من الحصة',
  FIXED_MONTHLY: 'راتب شهري ثابت',
  RENT: 'إيجار',
  UTILITIES: 'مرافق وكهرباء',
  HOSPITALITY: 'ضيافة وبوفيه',
  MAINTENANCE_EXPENSE: 'صيانة وتصليحات',
  MARKETING: 'تسويق وإعلانات',
  SALARIES: 'رواتب وإكراميات',
  PRINTING: 'طباعة وتصوير',
  OTHER: 'مصروفات أخرى',
};

export function translatePayloadKey(key: string): string {
  if (PAYLOAD_KEY_TRANSLATIONS[key]) {
    return PAYLOAD_KEY_TRANSLATIONS[key];
  }
  // Try camelCase splitting
  const decamel = key.replace(/([A-Z])/g, '_$1').toLowerCase();
  if (PAYLOAD_KEY_TRANSLATIONS[decamel]) {
    return PAYLOAD_KEY_TRANSLATIONS[decamel];
  }
  return key;
}

export function translatePayloadValue(val: unknown, keyContext?: string): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
  if (typeof val === 'number') {
    if (keyContext === 'dayOfWeek' || keyContext === 'day_of_week') {
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return days[val] ?? String(val);
    }
    return val.toLocaleString('ar-EG');
  }
  if (typeof val === 'string') {
    if (PAYLOAD_VALUE_TRANSLATIONS[val]) {
      return PAYLOAD_VALUE_TRANSLATIONS[val];
    }
    // If it is an ISO date string
    if (/^\d{4}-\d{2}-\d{2}(T|\b)/.test(val) && val.length >= 10) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: val.includes('T') ? '2-digit' : undefined,
            minute: val.includes('T') ? '2-digit' : undefined,
          });
        }
      } catch {
        // fallback
      }
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => translatePayloadValue(item)).join('، ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}
