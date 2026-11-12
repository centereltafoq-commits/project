# الدليل المرجعي لواجهات البرمجة (REST API Reference & Integration)
> **EduCenter ERP** — نظام إدارة السنتر التعليمي المتكامل  
> **الإصدار البرمجي:** 1.0.0 | **تاريخ التوثيق:** نوفمبر 2026

---

## 1. المعايير العامة للواجهات البرمجية (API Standards)

- **المسار الأساسي للطلبات:** `/api`
- **صيغة تبادل البيانات:** JSON المشفر بـ UTF-8 لجميع الطلبات والاستجابات.
- **التوثيق وإرسال الرموز:** ترويسة الطلب القياسية:  
  `Authorization: Bearer <access_token>`
- **معيار ترقيم الصفحات الموحد (`Default Server-Side Pagination`):**  
  جميع استعلامات القوائم والجداول تعرض **25 سجلاً في الصفحة افتراضياً** (`DEFAULT_PAGE_SIZE = 25`) وفق الهيكل الموحد:
  ```json
  {
    "data": [ /* مصفوفة السجلات */ ],
    "total": 142,
    "page": 1,
    "limit": 25,
    "totalPages": 6,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
  ```

---

## 2. الدليل الكامل لنقاط النهاية عبر وحدات التحكم الـ 19 (Endpoints Catalog)

### 2.1. التوثيق وإدارة الجلسات (`/api/auth` — AuthController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | عام (Public) | تسجيل دخول المستخدم بالبريد وكلمة المرور وتوليد Access Token وكوكي Refresh Token |
| `POST` | `/api/auth/refresh` | كوكي التجديد | تجديد رمز الوصول (Access Token) وتدوير رمز التجديد في قاعدة البيانات |
| `POST` | `/api/auth/logout` | مستخدم مسجل | تسجيل الخروج وإبطال رمز التجديد فورياً |
| `GET` | `/api/auth/me` | مستخدم مسجل | استرجاع بيانات المستخدم الحالي مع مصفوفة الصلاحيات المعتمدة |

---

### 2.2. المستخدمين وإدارة الأدوار وسجل التدقيق (`/api/users`, `/api/roles`, `/api/audit-logs`)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | `users.view` | استعراض قائمة المستخدمين مع الترقيم والبحث وحالة الحساب |
| `GET` | `/api/users/:id` | `users.view` | استرجاع بيانات مستخدم محدد بالمعرف الفريد UUID |
| `POST` | `/api/users` | `users.manage` | إنشاء حساب مستخدم جديد وتشفير كلمة المرور بـ Argon2id |
| `PATCH` | `/api/users/:id` | `users.manage` | تحديث بيانات المستخدم (الاسم، الهاتف، الدور، كلمة المرور، التنشيط) |
| `PUT` | `/api/users/:id/permissions`| `roles.manage` | **تخصيص استثناءات الصلاحيات الفردية للمستخدم (منح أو حجب)** |
| `GET` | `/api/roles` | `roles.manage` | استعراض كافة الأدوار القياسية والمخصصة مع عدد الصلاحيات |
| `GET` | `/api/roles/permissions`| `roles.manage` | استعراض مصفوفة **الـ 41 صلاحية النظامية** باللغة العربية والإنجليزية |
| `POST` | `/api/roles` | `roles.manage` | إنشاء دور وظيفي جديد وتحديد صلاحياته الأولية |
| `PUT` | `/api/roles/:id/permissions`| `roles.manage` | تحديث كامل مصفوفة الصلاحيات المرتبطة بدور محدد |
| `GET` | `/api/audit-logs` | `audit.view` | استعراض سجل التدقيق الأمني مع فلترة الكيان والحدث والمستخدم والتاريخ |

---

### 2.3. لوحة المؤشرات والإحصائيات المركزية (`/api/dashboard` — DashboardController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | `dashboard.view` | جلب المؤشرات الإحصائية العامة للشهر المحدد (إجمالي الطلاب، الإيرادات، الحضور، الإشغال) وفق صلاحيات المستخدم |

---

### 2.4. شؤون الطلاب والمراحل الدراسية (`/api/students`, `/api/grade-levels`)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/students` | `students.view` | استعراض قائمة الطلاب مع الترقيم (25 سجلاً) والبحث الثلاثي `pg_trgm` والفلترة |
| `GET` | `/api/students/:id` | `students.view` | استرجاع البيانات الأساسية للطالب بالمعرف الفريد |
| `GET` | `/api/students/:id/profile` | `students.view` | **الحزمة المتكاملة لبروفايل الطالب (الاشتراكات، الحضور، الحسابات المالية، الإيصالات)** |
| `POST` | `/api/students` | `students.create` | تسجيل طالب جديد وتوليد كوده الفريد بصيغة `STU-XXXX` |
| `PATCH` | `/api/students/:id` | `students.update` | تعديل بيانات الطالب والاتصال وأرقام الطوارئ والمرحلة |
| `PATCH` | `/api/students/:id/archive` | `students.archive` | أرشفة وتجميد ملف الطالب وتحويل حالته إلى `ARCHIVED` |
| `GET` | `/api/grade-levels` | مسجل للنظام | استعراض المراحل والصفوف الدراسية النشطة مرتبة حسب `sortOrder` |
| `GET` | `/api/grade-levels/:id` | مسجل للنظام | جلب تفاصيل مرحلة دراسية محددة |
| `POST` | `/api/grade-levels` | `settings.manage` | إضافة مرحلة أو صف دراسي جديد |
| `PATCH` | `/api/grade-levels/:id`| `settings.manage` | تعديل اسم أو ترتيب عرض الصف الدراسي أو حالته |
| `DELETE` | `/api/grade-levels/:id`| `settings.manage` | حذف أو تعطيل مرحلة دراسية غير مستخدمة |

---

### 2.5. الكوادر التدريسية والمساعدين (`/api/teachers`, `/api/assistants`)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/teachers` | `teachers.view` | استعراض قائمة المدرسين وتخصصاتهم وحالاتهم الوظيفية |
| `GET` | `/api/teachers/me/profile` | `teachers.view_own`| **استعراض الملف الشخصي للمدرس المسجل حالياً ومجموعاته وحصصه فقط** |
| `GET` | `/api/teachers/:id` | `teachers.view` | استرجاع البيانات الأساسية للمدرس |
| `GET` | `/api/teachers/:id/profile` | `teachers.view` | الملف المتكامل للمدرس (المجموعات، الحصص المنفذة، المستحقات، الصرفيات) |
| `POST` | `/api/teachers` | `teachers.manage` | إضافة مدرس جديد، تسجيل عقده، وربطه بحساب مستخدم إن وجد |
| `PUT` | `/api/teachers/:id/availability`| `teachers.manage` | **ضبط وتحديث جدول فترات التفرغ الأسبوعي للمدرس (`teacher_availability`)** |
| `PATCH` | `/api/teachers/:id` | `teachers.manage` | تعديل بيانات المدرس أو حالته الوظيفية (`ACTIVE`, `ON_LEAVE`, `INACTIVE`) |
| `GET` | `/api/assistants` | `assistants.view` | قائمة المساعدين وطرق احتساب أتعابهم وقيم التعاقد |
| `GET` | `/api/assistants/:id` | `assistants.view` | استرجاع البيانات الأساسية للمساعد |
| `GET` | `/api/assistants/:id/profile`| `assistants.view` | الملف الشامل للمساعد والمجموعات المكلف بها وسجل مستحقاته |
| `POST` | `/api/assistants` | `assistants.manage` | إضافة مساعد جديد وضبط طريقة الحساب وقيمتها |
| `PATCH` | `/api/assistants/:id` | `assistants.manage` | تحديث بيانات المساعد أو طريقة وقيمة أتعابه وحالته |

---

### 2.6. القاعات الدراسية والصيانة التشغيلية (`/api/classrooms` — ClassroomsController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/classrooms` | `classrooms.view` | استعراض كافة القاعات وسعاتها وتجهيزاتها وحالاتها |
| `GET` | `/api/classrooms/available` | `classrooms.view` | **البحث اللحظي عن القاعات الشاغرة ليوم وساعات محددة مع فحص الصيانة** |
| `GET` | `/api/classrooms/unallocated-groups`| `classrooms.view` | حصر المجموعات الدراسية التي لم تُخصص لها قاعة افتراضية بعد |
| `GET` | `/api/classrooms/:id` | `classrooms.view` | جلب تفاصيل قاعة محددة وسجل تجهيزاتها |
| `GET` | `/api/classrooms/:id/schedule`| `classrooms.view` | جدول إشغال القاعة الأسبوعي المجمع (حصص وحجوزات) |
| `GET` | `/api/classrooms/:id/allocated-groups`| `classrooms.view` | قائمة المجموعات المقيدة على هذه القاعة |
| `POST` | `/api/classrooms` | `classrooms.manage` | إنشاء قاعة دراسية جديدة وتحديد سعتها القصوى وتجهيزاتها |
| `PATCH` | `/api/classrooms/:id` | `classrooms.manage` | تعديل سعة القاعة، مقاعدها، تجهيزاتها، أو حالتها التشغيلية |
| `POST` | `/api/classrooms/:id/allocate-group` | `classrooms.manage` | تخصيص القاعة كمقر انعقاد افتراضي لمجموعة دراسية |
| `DELETE` | `/api/classrooms/:id/allocate-group/:groupId`| `classrooms.manage` | إلغاء ربط القاعة بالمجموعة الدراسية |
| `POST` | `/api/classrooms/:id/maintenances` | `classrooms.manage` | **جدولة فترة صيانة تمنع الحجوزات والحصص بالقاعة** |
| `DELETE` | `/api/classrooms/maintenances/:maintId` | `classrooms.manage` | إنهاء أو إلغاء فترة صيانة مجدولة للقاعة |

---

### 2.7. المجموعات الدراسية والاشتراكات (`/api/groups` — GroupsController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/groups` | `groups.view` | استعراض المجموعات مع أسعارها ومدرسيها والجدول ومعدل الامتلاء |
| `GET` | `/api/groups/lookups` | `groups.view` | جلب القوائم المرجعية المساعدة لتأسيس وتعديل المجموعات |
| `GET` | `/api/groups/:id` | `groups.view` | جلب تفاصيل المجموعة وسياستها المالية ومدرسيها ومساعديها |
| `POST` | `/api/groups` | `groups.manage` | **إنشاء مجموعة دراسية جديدة وضبط الجدول وسياسة تقاسم الإيراد آلياً** |
| `PATCH` | `/api/groups/:id` | `groups.manage` | تعديل بيانات المجموعة أو سياستها المالية أو جدول مواعيدها |
| `GET` | `/api/groups/:groupId/enrollments`| `enrollments.view` | استعراض قائمة الطلاب المقيدين بالمجموعة وتواريخ بدئهم وأسعارهم |
| `POST` | `/api/groups/:groupId/enrollments`| `enrollments.manage`| **تسجيل اشتراك طالب جديد بالمجموعة وتحديد السعر المتفق عليه** |
| `PATCH` | `/api/groups/enrollments/:enrollmentId`| `enrollments.manage`| تعديل سعر أو حالة اشتراك طالب أو تجميد القيد |

---

### 2.8. الحصص والحضور والتعويضات (`/api/attendance` — AttendanceController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/attendance/lookups` | `attendance.view` | جلب القوائم المرجعية اللازمة لشاشات التحضير والحصص |
| `GET` | `/api/attendance/sessions` | `sessions.view` | استعراض الحصص المجدولة والمنفذة لشهر أو نطاق زمني محدد |
| `POST` | `/api/attendance/sessions` | `sessions.manage` | جدولة حصة دراسية فردية استثنائية لمجموعة |
| `POST` | `/api/attendance/sessions/generate-month`| `sessions.manage` | **توليد حصص الشهر كاملاً آلياً بناءً على الجداول الأسبوعية للمجموعات** |
| `GET` | `/api/attendance/sessions/:sessionId/sheet`| `attendance.view` | استرجاع كشف حضور الحصة بأسماء الطلاب المقيدين وحالاتهم الحالية |
| `POST` | `/api/attendance/sessions/:sessionId/record`| `attendance.record` | **رصد كشف حضور وغياب الطلاب للحصة دفعة واحدة مع منع التكرار** |
| `GET` | `/api/attendance/makeups` | `makeup.manage` | استعراض حصص التعويض المعلقة والمجدولة والمنفذة مع فلترة الطلاب |
| `POST` | `/api/attendance/makeups` | `makeup.manage` | جدولة حصة تعويض لطالب غائب وتحديد القاعة وتاريخها ورسومها |
| `PATCH` | `/api/attendance/makeups/:id` | `makeup.manage` | تحديث حالة حصة التعويض (`SCHEDULED`, `COMPLETED`, `CANCELLED`) |

---

### 2.9. الحجوزات والتقويم العام (`/api/bookings`, `/api/calendar`)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/bookings/lookups` | `bookings.view` | جلب القوائم المساعدة لشاشات الحجز (المدرسين، الطلاب، القاعات) |
| `GET` | `/api/bookings` | `bookings.view` | استعراض طلبات الحجوزات مع الترقيم والفلترة بنوع الحجز وحالته |
| `POST` | `/api/bookings` | `bookings.create` | تقديم طلب حجز فردي مع **فحص التعارضات الخماسي الفوري** |
| `POST` | `/api/bookings/series` | `bookings.create` | **إنشاء سلسلة حجوزات أسبوعية متكررة لنطاق زمني محدد** |
| `GET` | `/api/bookings/:id/available-classrooms`| `bookings.view` | عرض القاعات البديلة الشاغرة والمناسبة لسعة طلب الحجز |
| `POST` | `/api/bookings/:id/review` | `bookings.approve_admin` أو `bookings.approve_teacher` | **اعتماد أو تعديل قاعة أو رفض طلب الحجز مع تدوين السبب** |
| `POST` | `/api/bookings/:id/cancel` | `bookings.create` أو `bookings.approve_admin` | إلغاء طلب الحجز وإخلاء القاعة فورياً |
| `POST` | `/api/bookings/:id/complete`| `bookings.approve_admin` | تأكيد إتمام وانعقاد الحجز بنجاح |
| `GET` | `/api/calendar/events` | `calendar.view` | **جلب كافة الفعاليات والحصص والحجوزات والصيانة للتقويم المجمع** |

---

### 2.10. التسوية الشهرية والمعاملات المالية (`/api/finance`)
تتوزع عبر وحدتي تحكم: `FinanceSettlementController` و `FinanceTransactionsController`:
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/finance/lookups` | `finance.view` | جلب الشهور المتاحة وبيانات المجموعات والمدرسين للمالية |
| `GET` | `/api/finance/month-summary`| `finance.view` | **الملخص التنفيذي للشهر (الإيراد، الصرفيات، المصروفات، الصافي، وحالة القفل)** |
| `POST` | `/api/finance/recalculate-month`| صلاحيات مالية | **تشغيل محرك إعادة احتساب فواتير ومستحقات الشهر دفعة واحدة (للأشهر المفتوحة)** |
| `POST` | `/api/finance/close-month` | `finance.close_month` | **الإغلاق والقفل المالي التاريخي الصارم للشهر (Historical Period Lock)** |
| `GET` | `/api/finance/student-records`| `finance.view` | استعراض سجلات فواتير الطلاب الشهرية والحصص والمستحق والمسدد |
| `GET` | `/api/finance/teacher-records`| `finance.view` | استعراض كشف مستحقات المدرسين المجمعة للشهر المالي |
| `GET` | `/api/finance/assistant-records`| `finance.view` | استعراض كشف أتعاب المساعدين للشهر وطريقة احتسابها |
| `GET` | `/api/finance/payments` | `finance.view` | استعراض سجل المقبوضات والإيصالات المحصلة من الطلاب |
| `POST` | `/api/finance/payments` | `finance.collect_payment`| **تحصيل دفعة، توزيعها على المجموعات، وإصدار إيصال `RCP-...`** |
| `GET` | `/api/finance/teacher-payouts`| `finance.view` | استعراض أذونات صرف مستحقات المدرسين |
| `POST` | `/api/finance/teacher-payouts`| `finance.payouts` | تسجيل صرف مالي لمدرس وتوليد رقم مرجعي مشفر `TPY-...` |
| `GET` | `/api/finance/assistant-payouts`| `finance.view` | استعراض أذونات صرف مستحقات المساعدين |
| `POST` | `/api/finance/assistant-payouts`| `finance.payouts` | تسجيل صرف مالي لمساعد وتوليد رقم مرجعي مشفر `APY-...` |
| `GET` | `/api/finance/expenses` | `finance.view` | استعراض مصروفات السنتر التشغيلية وتصنيفاتها السبعة |
| `POST` | `/api/finance/expenses` | `finance.expenses` | إضافة مصروف تشغيلي جديد للشهر المالي المفتوح |
| `PATCH` | `/api/finance/expenses/:id`| `finance.expenses` | تعديل مصروف تشغيلي (للأشهر المفتوحة فقط) |
| `DELETE` | `/api/finance/expenses/:id`| `finance.expenses` | حذف مصروف تشغيلي (للأشهر المفتوحة فقط) |

---

### 2.11. التقارير الإحصائية والمالية والتصدير (`/api/reports` — ReportsController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/filter-options`| `reports.view` | استرجاع خيارات ومحددات الفلترة المتاحة للتقارير |
| `GET` | `/api/reports/:reportType`| `reports.view` | توليد التقرير المباشر في المتصفح (مبيعات، حضور، طلاب، مالي) |
| `GET` | `/api/reports/:reportType/export-csv`| `reports.export` | **تصدير التقرير الكامل كملف CSV بترميز UTF-8 BOM الداعم للعربية** |

---

### 2.12. منظومة النسخ الاحتياطي السحابي والمحلي (`/api/backups` — BackupsController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/backups/settings` | `backups.view` | استعراض إعدادات الجدولة الزمنية، حد الإبقاء، والربط مع Google Drive و Dropbox |
| `PATCH` | `/api/backups/settings` | `backups.manage` | تحديث إعدادات النسخ الاحتياطي ومسار التخزين والجدولة |
| `GET` | `/api/backups` | `backups.view` | **استعراض سجل ملفات النسخ الاحتياطية وتواريخها وبصمة SHA-256** |
| `POST` | `/api/backups/trigger` | `backups.manage` | **إنشاء نسخة احتياطية فورية كاملة مضغوطة (`.sql.gz`)** |
| `POST` | `/api/backups/upload` | `backups.manage` | رفع ملف نسخة احتياطية خارجي والتحقق من سلامته وبصمته |
| `GET` | `/api/backups/:id/download` | `backups.manage` | **تحميل ملف النسخة الاحتياطية مباشرة إلى جهاز المشرف** |
| `POST` | `/api/backups/:id/restore` | `backups.manage` | **استعادة النسخة الاحتياطية (تتطلب التحقق من كلمة مرور المشرف الحالية بـ Argon2)** |
| `DELETE` | `/api/backups/google/disconnect`| `backups.manage` | إلغاء الربط مع حساب Google Drive وإبطال التوكن السحابي |

---

### 2.13. هوية السنتر وتصفير العام الدراسي (`/api/settings` — SettingsController)
| الدالة | المسار | الصلاحية المطلوبة | الوصف والوظيفة |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/settings` | مسجل للنظام | جلب إعدادات هوية السنتر، الشعار، الاسم، الهاتف، والعام الدراسي النشط |
| `GET` | `/api/settings/logo/:filename` | عام (Public) | **استعراض وتحميل صورة شعار السنتر للطباعة والعرض** |
| `PUT` | `/api/settings` | `settings.manage` | **تحديث بيانات وهوية السنتر (الاسم، الهاتف، العنوان، العام الدراسي)** |
| `POST` | `/api/settings/logo` | `settings.manage` | رفع صورة شعار السنتر مع التحقق الأمني من النوع والامتداد |
| `DELETE` | `/api/settings/logo` | `settings.manage` | إزالة شعار السنتر واستعادة الشعار الافتراضي للنظام |
| `POST` | `/api/settings/reset-academic-year`| `settings.manage` + `OWNER` | **بروتوكول تصفير وبدء العام الدراسي الجديد (يتطلب رمز PIN ومقارنة آمنة زمنياً مع نسخة إجبارية مسبقة)** |
