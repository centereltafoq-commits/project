# قاموس البيانات ومخطط قاعدة البيانات الشامل (Database Schema & Data Dictionary)
> **EduCenter ERP** — نظام إدارة السنتر التعليمي المتكامل  
> **محرك قاعدة البيانات:** PostgreSQL 15+ مع ملحقات `pg_trgm` و `uuid-ossp`  
> **مكتبة النمذجة (ORM):** Drizzle ORM | **إجمالي الجداول:** 39 جدولاً متخصصاً

---

## 1. فهرس الجداول حسب المجموعات الوظيفية

1. **الهوية والأمان والتدقيق (Identity, Security & Audit):**  
   `roles`, `permissions`, `role_permissions`, `users`, `user_permissions`, `refresh_tokens`, `audit_logs`
2. **البروفايلات الدائمة والمراحل (Profiles & Academic Catalog):**  
   `students`, `teachers`, `assistants`, `grade_levels`
3. **القاعات والصيانة التشغيلية (Classrooms & Maintenance):**  
   `classrooms`, `classroom_maintenances`
4. **المجموعات والاشتراكات والسياسات المالية (Academic Groups & Policies):**  
   `groups`, `financial_policies`, `group_teachers`, `group_assistants`, `enrollments`
5. **الحصص والحضور والتعويضات (Sessions, Attendance & Makeups):**  
   `sessions`, `attendance`, `makeup_sessions`
6. **الحجوزات والتقويم والموافقات (Bookings & Calendar):**  
   `teacher_availability`, `booking_series`, `booking_requests`, `booking_approvals`, `classroom_bookings`
7. **المحرك المالي والسجلات الشهرية (Finance Engine & Transactions):**  
   `student_monthly_records`, `teacher_monthly_records`, `assistant_monthly_records`, `teacher_dues`, `assistant_dues`, `payments`, `payment_allocations`, `teacher_payouts`, `assistant_payouts`, `expenses`
8. **النسخ الاحتياطي وإعدادات النظام (Backups & System Configuration):**  
   `backup_settings`, `backup_records`, `system_settings`

---

## 2. الهوية والأمان وتدقيق العمليات (Identity & Audit)

### 2.1. جدول الأدوار (`roles`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الفريد للدور |
| `code` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | كود الدور الإنجليزي (مثل `OWNER`, `MANAGER`) |
| `name_ar` | `VARCHAR(120)` | `NOT NULL` | الاسم العربي للدور |
| `description` | `VARCHAR(255)` | `NULLABLE` | وصف مختصر لصلاحيات الدور ومسؤولياته |
| `is_system` | `BOOLEAN` | `DEFAULT false`, `NOT NULL` | هل هو دور نظامي أساسي محمي من الحذف |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ ووقت إنشاء الدور |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ ووقت آخر تعديل |

### 2.2. جدول الصلاحيات (`permissions`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الفريد للصلاحية |
| `code` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | كود الصلاحية (مثل `finance.collect_payment`) |
| `module` | `VARCHAR(64)` | `NOT NULL`, Index | الموديول التابع له (مثل `finance`, `students`) |
| `name_ar` | `VARCHAR(150)` | `NOT NULL` | الاسم العربي الواضح للصلاحية |

### 2.3. جدول صلاحيات الأدوار (`role_permissions`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف الربط |
| `role_id` | `UUID` | `NOT NULL`, FK -> `roles.id` (CASCADE) | معرف الدور |
| `permission_id` | `UUID` | `NOT NULL`, FK -> `permissions.id` (CASCADE) | معرف الصلاحية |
*القيد الفريد:* `UNIQUE(role_id, permission_id)` لمنع تكرار الصلاحية للدور.

### 2.4. جدول المستخدمين (`users`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف المستخدم |
| `full_name` | `VARCHAR(150)` | `NOT NULL` | الاسم الكامل للمستخدم |
| `email` | `VARCHAR(160)` | `NOT NULL`, `UNIQUE` | البريد الإلكتروني لتسجيل الدخول |
| `phone` | `VARCHAR(30)` | `NULLABLE` | رقم الهاتف المحمول |
| `password_hash`| `VARCHAR(255)` | `NOT NULL` | هاش كلمة المرور المشفر بخوارزمية `Argon2id` |
| `role_id` | `UUID` | `NOT NULL`, FK -> `roles.id` (RESTRICT) | معرف الدور الوظيفي |
| `is_active` | `BOOLEAN` | `DEFAULT true`, `NOT NULL` | حالة تنشيط الحساب |
| `last_login_at`| `TIMESTAMPTZ` | `NULLABLE` | تاريخ وتوقيت آخر تسجيل دخول ناجح |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ إنشاء الحساب |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تحديث للبيانات |

### 2.5. جدول استثناءات صلاحيات المستخدمين (`user_permissions`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف الاستثناء |
| `user_id` | `UUID` | `NOT NULL`, FK -> `users.id` (CASCADE) | معرف المستخدم |
| `permission_id` | `UUID` | `NOT NULL`, FK -> `permissions.id` (CASCADE) | معرف الصلاحية المستثناة |
| `is_granted` | `BOOLEAN` | `DEFAULT true`, `NOT NULL` | هل تم منحها استثنائياً (`true`) أم حجبها (`false`) |
*القيد الفريد:* `UNIQUE(user_id, permission_id)`.

### 2.6. جدول رموز التجديد المشفرة (`refresh_tokens`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف الرمز |
| `user_id` | `UUID` | `NOT NULL`, FK -> `users.id` (CASCADE) | معرف صاحب الجلسة |
| `token_hash` | `VARCHAR(255)` | `NOT NULL`, Index | هاش الرمز لمنع تسريب الرموز المفتوحة |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL`, Index | موعد انتهاء صلاحية الجلسة |
| `revoked_at` | `TIMESTAMPTZ` | `NULLABLE` | تاريخ الإلغاء اليدوي أو تسجيل الخروج |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ إنشاء التوكن |

### 2.7. جدول سجل التدقيق الأمني المؤسسي (`audit_logs`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف سجل التدقيق |
| `actor_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | معرف المستخدم الفاعل (أو `NULL` للنظام) |
| `actor_name` | `VARCHAR(150)` | `NULLABLE` | اسم الفاعل المحفوظ لحظياً |
| `action` | `VARCHAR(100)` | `NOT NULL`, Index | كود الحدث (مثل `FINANCE_COLLECT_PAYMENT`) |
| `entity_type` | `VARCHAR(80)` | `NOT NULL`, Index | نوع الكيان المتأثر (مثل `student`, `payment`) |
| `entity_id` | `VARCHAR(100)` | `NULLABLE`, Index | المعرف الفريد للكيان المتأثر |
| `before_data` | `JSONB` | `NULLABLE` | لقطة كاملة لبيانات الكيان قبل العملية |
| `after_data` | `JSONB` | `NULLABLE` | لقطة كاملة لبيانات الكيان بعد العملية |
| `metadata` | `JSONB` | `NULLABLE` | بيانات إضافية والترجمة العربية الفورية |
| `ip_address` | `VARCHAR(64)` | `NULLABLE` | عنوان الـ IP لمصدر الطلب |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL`, Index | التوقيت الدقيق لوقوع الحدث |

---

## 3. البروفايلات الدائمة والمراحل الدراسية (Profiles)

### 3.1. جدول الطلاب (`students`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الداخلي للطالب |
| `student_code` | `VARCHAR(40)` | `NOT NULL`, `UNIQUE` | كود الطالب الموحد (مثل `STU-1001`) |
| `full_name` | `VARCHAR(160)` | `NOT NULL`, Index (`pg_trgm`) | الاسم الرباعي للطالب |
| `phone` | `VARCHAR(30)` | `NOT NULL`, Index | رقم هاتف الطالب |
| `guardian_phone`| `VARCHAR(30)` | `NOT NULL`, Index | رقم هاتف ولي الأمر للطوارئ والمتابعة |
| `grade_level` | `VARCHAR(80)` | `NOT NULL`, Index | المرحلة الدراسية المقيد بها |
| `registration_date`| `DATE` | `NOT NULL` | تاريخ التسجيل المعتمد |
| `status` | `VARCHAR(24)` | `DEFAULT 'ACTIVE'`, `NOT NULL` | حالة القيد (`ACTIVE`, `SUSPENDED`, `ARCHIVED`) |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات أكاديمية أو صحية خاصة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ الإضافة |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تحديث |

### 3.2. جدول المدرسين (`teachers`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الداخلي للمدرس |
| `teacher_code` | `VARCHAR(40)` | `NOT NULL`, `UNIQUE` | كود المدرس (مثل `TCH-101`) |
| `user_id` | `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | ربط اختياري بحساب مستخدم لتسجيل الدخول |
| `full_name` | `VARCHAR(160)` | `NOT NULL`, Index (`pg_trgm`) | الاسم الكامل للمدرس |
| `phone` | `VARCHAR(30)` | `NOT NULL` | رقم هاتف التواصل |
| `specialization`| `VARCHAR(100)` | `NOT NULL`, Index | المادة أو التخصص التدريسي |
| `contract_date`| `DATE` | `NOT NULL` | تاريخ التعاقد وبدء العمل |
| `employment_status`| `VARCHAR(24)`| `DEFAULT 'ACTIVE'`, `NOT NULL` | الحالة الوظيفية (`ACTIVE`, `ON_LEAVE`, `INACTIVE`) |
| `can_approve_bookings`| `VARCHAR(10)`| `DEFAULT 'true'`, `NOT NULL` | صلاحية اعتماد طلبات الحجز الموجهة له |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات التعاقد |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التسجيل |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تعديل |

### 3.3. جدول المساعدين (`assistants`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الداخلي للمساعد |
| `assistant_code`| `VARCHAR(40)` | `NOT NULL`, `UNIQUE` | كود المساعد (مثل `AST-101`) |
| `full_name` | `VARCHAR(160)` | `NOT NULL`, Index (`pg_trgm`) | الاسم الكامل |
| `phone` | `VARCHAR(30)` | `NOT NULL` | رقم الهاتف الشخصي |
| `calculation_method`| `VARCHAR(48)`| `DEFAULT 'SESSION_COMMISSION_PERCENT'`, `NOT NULL` | طريقة الحساب الافتراضية لأتعابه |
| `rate_value` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | القيمة الافتراضية (مبلغ، نسبة، أجر ساعة) |
| `custom_formula_note`| `TEXT` | `NULLABLE` | نص الاتفاق في حال اختيار اتفاق مخصص |
| `status` | `VARCHAR(24)` | `DEFAULT 'ACTIVE'`, `NOT NULL` | الحالة الوظيفية (`ACTIVE`, `INACTIVE`) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ الإنشاء |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التحديث |

### 3.4. جدول المراحل والصفوف الدراسية (`grade_levels`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف الصف الدراسي |
| `name` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | اسم المرحلة أو الصف (مثل "الصف الثالث الثانوي") |
| `sort_order` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | ترتيب العرض في القوائم المنسدلة |
| `is_active` | `BOOLEAN` | `DEFAULT true`, `NOT NULL` | حالة التفعيل |

---

## 4. القاعات والصيانة (Classrooms & Maintenance)

### 4.1. جدول القاعات الدراسية (`classrooms`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الداخلي للقاعة |
| `room_number` | `VARCHAR(32)` | `NOT NULL`, `UNIQUE` | رقم القاعة أو الكود التعريفي (مثل `R-101`) |
| `name` | `VARCHAR(120)` | `NOT NULL` | اسم القاعة (مثل "قاعة الخوارزمي") |
| `max_capacity` | `INTEGER` | `NOT NULL` | السعة الاستيعابية القصوى المسموح بها |
| `seats_count` | `INTEGER` | `NOT NULL` | عدد المقاعد الفعلية الموجودة |
| `equipment` | `JSONB` | `DEFAULT '[]'`, `NOT NULL` | قائمة التجهيزات (مثل شاشة ذكية، بروجيكتور، تكييف) |
| `status` | `VARCHAR(24)` | `DEFAULT 'AVAILABLE'`, Index | حالة القاعة (`AVAILABLE`, `MAINTENANCE`, `INACTIVE`) |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات التشغيل |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ الإضافة |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التعديل |

### 4.2. جدول فترات صيانة القاعات (`classroom_maintenances`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف فترة الصيانة |
| `classroom_id` | `UUID` | `NOT NULL`, FK -> `classrooms.id` (CASCADE) | معرف القاعة تحت الصيانة |
| `start_at` | `TIMESTAMPTZ` | `NOT NULL`, Index | توقيت بدء فترة الصيانة |
| `end_at` | `TIMESTAMPTZ` | `NOT NULL`, Index | توقيت انتهاء فترة الصيانة |
| `reason` | `VARCHAR(255)` | `NOT NULL` | سبب الصيانة وطبيعة الأعمال |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ جدولة الصيانة |

---

## 5. المجموعات والاشتراكات والسياسات المالية (Academic Groups)

### 5.1. جدول المجموعات الدراسية (`groups`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الفريد للمجموعة |
| `group_code` | `VARCHAR(40)` | `NOT NULL`, `UNIQUE` | كود المجموعة (مثل `GRP-BIO-301`) |
| `name` | `VARCHAR(160)` | `NOT NULL` | اسم المجموعة |
| `subject` | `VARCHAR(100)` | `NOT NULL` | المادة الدراسية |
| `grade_level` | `VARCHAR(80)` | `NOT NULL`, Index | المرحلة الدراسية |
| `primary_teacher_id`| `UUID` | `NOT NULL`, FK -> `teachers.id` (RESTRICT) | معرف المدرس الأساسي للمجموعة |
| `default_classroom_id`| `UUID`| `NULLABLE`, FK -> `classrooms.id` (SET NULL) | القاعة الافتراضية لانعقاد الحصص |
| `monthly_sessions_count`| `INTEGER`| `NOT NULL` | عدد الحصص الشهرية المجدولة |
| `monthly_price`| `NUMERIC(12,2)`| `NOT NULL` | قيمة الاشتراك الشهري للمجموعة |
| `calculated_session_price`| `NUMERIC(12,2)`| `NOT NULL` | سعر الحصة الفردي المحسوب للمجموعة |
| `schedule_slots`| `JSONB` | `DEFAULT '[]'`, `NOT NULL` | المواعيد الأسبوعية `[{dayOfWeek, startTime, endTime, classroomId}]` |
| `max_students` | `INTEGER` | `DEFAULT 50`, `NOT NULL` | السعة القصوى لعدد طلاب المجموعة |
| `is_active` | `BOOLEAN` | `DEFAULT true`, Index | هل المجموعة نشطة ومستمرة |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات عامة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ الإنشاء |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التعديل |

### 5.2. جدول السياسات المالية للمجموعات (`financial_policies`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف السياسة المالية |
| `group_id` | `UUID` | `NOT NULL`, `UNIQUE`, FK -> `groups.id` (CASCADE) | معرف المجموعة الدراسية التابعة لها |
| `revenue_split_method`| `VARCHAR(48)`| `DEFAULT 'ACTUAL_ATTENDANCE_RATIO'`, `NOT NULL` | طريقة تقاسم الإيراد بين المدرس والسنتر |
| `teacher_share_per_student`| `NUMERIC(12,2)`| `NOT NULL` | نصيب المدرس لكل طالب (أو لكل حصة) |
| `center_share_per_student`| `NUMERIC(12,2)`| `NOT NULL` | نصيب السنتر لكل طالب |
| `teacher_percentage`| `NUMERIC(5,2)`| `DEFAULT 0.00`, `NOT NULL` | نسبة المدرس المئوية (في حال الطريقة المئوية) |
| `full_month_absence_policy`| `VARCHAR(48)`| `DEFAULT 'EXEMPT_FULL_ABSENCE'`, `NOT NULL` | سياسة غياب الشهر كاملاً |
| `full_absence_fixed_fee`| `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | رسم حجز المقعد في حال الغياب الكامل |
| `charge_excused_absence`| `BOOLEAN` | `DEFAULT false`, `NOT NULL` | هل يتم احتساب الغياب بعذر مالياً |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تحديث للسياسة |

### 5.3. جدول اشتراكات الطلاب بالمجموعات (`enrollments`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف الاشتراك |
| `student_id` | `UUID` | `NOT NULL`, FK -> `students.id` (RESTRICT) | معرف الطالب |
| `group_id` | `UUID` | `NOT NULL`, FK -> `groups.id` (RESTRICT) | معرف المجموعة |
| `start_date` | `DATE` | `NOT NULL` | تاريخ بدء اشتراك الطالب |
| `end_date` | `DATE` | `NULLABLE` | تاريخ إنهاء أو تجميد الاشتراك |
| `agreed_monthly_price`| `NUMERIC(12,2)`| `NOT NULL` | السعر الشهري المتفق عليه لهذا الطالب |
| `agreed_sessions_count`| `INTEGER` | `NOT NULL` | عدد الحصص المتفق عليها شهرياً |
| `agreed_session_price`| `NUMERIC(12,2)`| `NOT NULL` | سعر الحصة الفردي المتفق عليه |
| `status` | `VARCHAR(24)` | `DEFAULT 'ACTIVE'`, `NOT NULL` | حالة الاشتراك (`ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`) |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات الخصومات أو التفاهمات الخاصة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ إنشاء السجل |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التحديث |

### 5.4. جدول مدرسي المجموعات (`group_teachers`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف الفريد لسجل الربط |
| `group_id` | `UUID` | `NOT NULL`, FK -> `groups.id` (CASCADE) | معرف المجموعة الدراسية |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (CASCADE) | معرف المدرس المعين للمجموعة |
| `is_primary` | `BOOLEAN` | `DEFAULT true`, `NOT NULL` | هل هو المدرس الأساسي للمجموعة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ ووقت التعيين |
*القيد الفريد:* `UNIQUE(group_id, teacher_id)` — يمنع تكرار تعيين نفس المدرس لذات المجموعة.
*الفهرس:* `idx_group_teachers_teacher` على `teacher_id`.

### 5.5. جدول مساعدي المجموعات وتخصيص الأتعاب (`group_assistants`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف الربط |
| `group_id` | `UUID` | `NOT NULL`, FK -> `groups.id` (CASCADE) | معرف المجموعة |
| `assistant_id` | `UUID` | `NOT NULL`, FK -> `assistants.id` (CASCADE) | معرف المساعد المكلف |
| `override_calculation_method`| `VARCHAR(48)`| `NULLABLE` | طريقة حساب مخصصة لهذه المجموعة بالذات |
| `override_rate_value`| `NUMERIC(12,2)`| `NULLABLE` | قيمة أتعاب مخصصة لهذه المجموعة بالذات |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التكليف |
*القيد الفريد:* `UNIQUE(group_id, assistant_id)`.

---

## 6. الحصص والحضور والتعويضات (Attendance)

### 6.1. جدول الحصص الدراسية (`sessions`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف الحصة |
| `group_id` | `UUID` | `NOT NULL`, FK -> `groups.id` (CASCADE) | معرف المجموعة التابعة لها الحصة |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (RESTRICT) | معرف المدرس المنفذ للحصة |
| `classroom_id` | `UUID` | `NULLABLE`, FK -> `classrooms.id` (SET NULL) | القاعة التي عُقدت بها الحصة |
| `session_date` | `DATE` | `NOT NULL`, Index | تاريخ انعقاد الحصة |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي (`YYYY-MM`) |
| `start_time` | `VARCHAR(8)` | `NOT NULL` | وقت البدء (`HH:mm`) |
| `end_time` | `VARCHAR(8)` | `NOT NULL` | وقت الانتهاء (`HH:mm`) |
| `status` | `VARCHAR(24)` | `DEFAULT 'SCHEDULED'`, `NOT NULL` | حالة الحصة (`SCHEDULED`, `COMPLETED`, `CANCELLED`) |
| `topic` | `VARCHAR(200)` | `NULLABLE` | عنوان أو موضوع الدرس |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات الحصة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ الإضافة |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التعديل |

### 6.2. جدول الحضور والغياب (`attendance`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف سجل الحضور |
| `session_id` | `UUID` | `NOT NULL`, FK -> `sessions.id` (CASCADE) | معرف الحصة الدراسية |
| `student_id` | `UUID` | `NOT NULL`, FK -> `students.id` (RESTRICT) | معرف الطالب |
| `status` | `VARCHAR(24)` | `NOT NULL`, Index | حالة الحضور (`PRESENT`, `ABSENT`, `EXCUSED`, `MAKEUP_ATTENDED`) |
| `recorded_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | الموظف الذي قام برصد الحضور أول مرة |
| `updated_by_user_id` | `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | الموظف الذي قام بآخر تعديل لحالة الحضور |
| `notes` | `TEXT` | `NULLABLE` | أسباب العذر أو تفاصيل الغياب |
| `recorded_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | التوقيت الدقيق للرصد |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | التوقيت الدقيق للتعديل |
*القيد الفريد الصارم:* `UNIQUE(session_id, student_id)` — يمنع تماماً رصد الطالب مرتين لنفس الحصة.

### 6.3. جدول حصص التعويض (`makeup_sessions`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف حصة التعويض |
| `student_id` | `UUID` | `NOT NULL`, FK -> `students.id` (RESTRICT) | معرف الطالب المستفيد من التعويض |
| `original_session_id`| `UUID` | `NOT NULL`, FK -> `sessions.id` (CASCADE) | معرف الحصة الأصلية التي غاب عنها |
| `absence_date` | `DATE` | `NOT NULL` | تاريخ الغياب الأصلي |
| `scheduled_at` | `TIMESTAMPTZ` | `NULLABLE` | الموعد المحدد لتنفيذ التعويض |
| `classroom_id` | `UUID` | `NULLABLE`, FK -> `classrooms.id` (SET NULL) | قاعة التعويض |
| `status` | `VARCHAR(24)` | `DEFAULT 'PENDING'`, `NOT NULL`, Index | حالة التعويض (`PENDING`, `SCHEDULED`, `COMPLETED`, `CANCELLED`) |
| `is_free` | `BOOLEAN` | `DEFAULT true`, `NOT NULL` | هل التعويض مجاني أم برسوم إضافية |
| `extra_fee` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | قيمة الرسوم الإضافية في حال كان مدفوعاً |
| `approved_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | الموظف أو الإداري المعتمد للتعويض |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات التعويض |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ إنشاء الطلب |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تحديث |

---

## 7. الحجوزات والتقويم والموافقات (Bookings)

### 7.1. جدول إتاحة المدرسين (`teacher_availability`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف فترة الإتاحة |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (CASCADE) | معرف المدرس |
| `day_of_week` | `INTEGER` | `NOT NULL` (0=الأحد ... 6=السبت) | يوم الأسبوع |
| `start_time` | `VARCHAR(8)` | `NOT NULL` (`HH:mm`) | بداية فترة التفرغ |
| `end_time` | `VARCHAR(8)` | `NOT NULL` (`HH:mm`) | نهاية فترة التفرغ |
| `is_active` | `BOOLEAN` | `DEFAULT true`, `NOT NULL` | هل الفترة نشطة |

### 7.2. جدول سلاسل الحجوزات المتكررة (`booking_series`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف سلسلة الحجز |
| `request_type` | `VARCHAR(40)` | `NOT NULL` | نوع الحجز (`STUDENT_WITH_TEACHER`, `TEACHER_WITH_CENTER`) |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (CASCADE) | المدرس المعني |
| `student_id` | `UUID` | `NULLABLE`, FK -> `students.id` (SET NULL) | الطالب المعني (إن وجد) |
| `day_of_week` | `INTEGER` | `NOT NULL` | يوم التكرار الأسبوعي |
| `start_date` | `DATE` | `NOT NULL` | تاريخ أول موعد بالسلسلة |
| `end_date` | `DATE` | `NOT NULL` | تاريخ آخر موعد بالسلسلة |
| `start_time` | `VARCHAR(8)` | `NOT NULL` | وقت البدء |
| `end_time` | `VARCHAR(8)` | `NOT NULL` | وقت الانتهاء |
| `purpose` | `VARCHAR(200)` | `NOT NULL` | الغرض من الحجز (مثل حصة خاصة، مراجعة نهائية) |
| `requested_classroom_id`| `UUID` | `NULLABLE`, FK -> `classrooms.id` (SET NULL) | القاعة المطلوبة |
| `created_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | منشئ الطلب |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات السلسلة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ الإنشاء |

### 7.3. جدول طلبات الحجز الفردية (`booking_requests`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف طلب الحجز |
| `series_id` | `UUID` | `NULLABLE`, FK -> `booking_series.id` (SET NULL) | السلسلة التابع لها (إن وُجدت) |
| `request_type` | `VARCHAR(40)` | `NOT NULL` | نوع الحجز |
| `student_id` | `UUID` | `NULLABLE`, FK -> `students.id` (SET NULL) | الطالب |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (CASCADE) | المدرس |
| `purpose` | `VARCHAR(200)` | `NOT NULL` | الغرض من الحجز |
| `requested_date`| `DATE` | `NOT NULL`, Index | تاريخ الحجز المطلوب |
| `start_time` | `VARCHAR(8)` | `NOT NULL` | وقت البدء |
| `end_time` | `VARCHAR(8)` | `NOT NULL` | وقت النهاية |
| `duration_minutes`| `INTEGER` | `NOT NULL` | مدة الحجز بالدقائق |
| `requested_classroom_id`| `UUID`| `NULLABLE`, FK -> `classrooms.id` (SET NULL) | القاعة المقترحة من الطالب/المدرس |
| `assigned_classroom_id` | `UUID`| `NULLABLE`, FK -> `classrooms.id` (SET NULL) | القاعة المعتمدة والمخصصة من الإدارة |
| `expected_attendees` | `INTEGER` | `DEFAULT 1`, `NOT NULL` | عدد الحضور المتوقع للتحقق من سعة القاعة |
| `status` | `VARCHAR(24)` | `DEFAULT 'PENDING'`, Index | الحالة (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`) |
| `created_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | منشئ الحجز |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات الحجز |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ الإنشاء |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التعديل |

### 7.4. جدول اعتمادات وتعديلات الحجوزات (`booking_approvals`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف قرار الاعتماد |
| `booking_request_id`| `UUID` | `NOT NULL`, FK -> `booking_requests.id` (CASCADE) | طلب الحجز المرتبط |
| `actor_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | متخذ القرار (الإداري أو المدرس) |
| `decision` | `VARCHAR(32)` | `NOT NULL` | القرار (`APPROVED`, `REJECTED`, `MODIFIED`, `CANCELLED`) |
| `assigned_classroom_id`| `UUID`| `NULLABLE`, FK -> `classrooms.id` (SET NULL) | القاعة المخصصة بقرار الاعتماد |
| `comment` | `TEXT` | `NULLABLE` | تعليق أو سبب الرفض أو التعديل |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | توقيت اتخاذ القرار |

### 7.5. جدول حجوزات القاعات الإدارية المباشرة (`classroom_bookings`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف حجز القاعة |
| `classroom_id` | `UUID` | `NOT NULL`, FK -> `classrooms.id` (CASCADE) | القاعة المحجوزة |
| `booking_request_id`| `UUID` | `NULLABLE`, FK -> `booking_requests.id` (CASCADE) | طلب الحجز المعتمد المرتبط (إن وجد) |
| `booking_date` | `DATE` | `NOT NULL`, Index | تاريخ الحجز |
| `start_time` | `VARCHAR(8)` | `NOT NULL` | وقت البدء |
| `end_time` | `VARCHAR(8)` | `NOT NULL` | وقت الانتهاء |
| `title` | `VARCHAR(200)` | `NOT NULL` | عنوان الحجز الإداري أو الفعالية |
| `status` | `VARCHAR(24)` | `DEFAULT 'CONFIRMED'`, `NOT NULL` | حالة الحجز |
| `allocated_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | الإداري الذي خصص القاعة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التخصيص |

---

## 8. المحرك المالي والمعاملات والتسوية (Finance)

### 8.1. جدول سجلات الطلاب الشهرية المجمدة (`student_monthly_records`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف السجل الشهري للطالب |
| `student_id` | `UUID` | `NOT NULL`, FK -> `students.id` (RESTRICT) | معرف الطالب |
| `group_id` | `UUID` | `NOT NULL`, FK -> `groups.id` (RESTRICT) | معرف المجموعة |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي (`YYYY-MM`) |
| `total_group_sessions`| `INTEGER` | `DEFAULT 0`, `NOT NULL` | إجمالي حصص المجموعة النشطة بالشهر |
| `eligible_sessions` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | حصص الطالب المؤهلة وفق تاريخ اشتراكه |
| `present_count` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | عدد الحصص المحضورة |
| `absent_count` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | عدد مرات الغياب بدون عذر |
| `excused_count`| `INTEGER` | `DEFAULT 0`, `NOT NULL` | عدد مرات الغياب بعذر |
| `makeup_attended_count`| `INTEGER` | `DEFAULT 0`, `NOT NULL` | عدد حصص التعويض المحضورة |
| `session_price_snapshot`| `NUMERIC(12,2)`| `NOT NULL` | لقطة سعر الحصة المجمدة لهذا الشهر |
| `extra_makeup_fees`| `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | رسوم التعويضات الإضافية المدفوعة |
| `total_due` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | إجمالي المبلغ المستحق على الطالب |
| `total_paid` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | إجمالي المدفوع حتى تاريخه |
| `remaining_balance`| `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | الرصيد المتبقي مستحق الدفع |
| `is_closed` | `BOOLEAN` | `DEFAULT false`, `NOT NULL` | هل السجل مغلق مالياً ومجمد تاريخياً |
| `closed_at` | `TIMESTAMPTZ` | `NULLABLE` | توقيت الإغلاق المالي |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تحديث للحساب |
*القيد الفريد الصارم:* `UNIQUE(student_id, group_id, year_month)`.

### 8.2. جدول مستحقات المدرسين التفصيلية بالمجموعات (`teacher_dues`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف مستحق المدرس للمجموعة |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (RESTRICT) | معرف المدرس |
| `group_id` | `UUID` | `NOT NULL`, FK -> `groups.id` (RESTRICT) | معرف المجموعة |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي (`YYYY-MM`) |
| `executed_sessions_count`| `INTEGER` | `DEFAULT 0`, `NOT NULL` | عدد الحصص المنفذة فعلياً |
| `students_count` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | عدد الطلاب المفوترين |
| `gross_group_revenue`| `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | إجمالي إيراد المجموعة المستحق |
| `teacher_amount` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | صافي نصيب المدرس من المجموعة |
| `center_amount` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | صافي نصيب السنتر من المجموعة |
| `calculation_breakdown`| `TEXT` | `NULLABLE` | تفصيل توضيحي لخطوات المعادلة الحسابية |
| `is_locked` | `BOOLEAN` | `DEFAULT false`, `NOT NULL` | هل المستحق مقفل ومجمد تاريخياً |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر احتساب |
*القيد الفريد:* `UNIQUE(teacher_id, group_id, year_month)`.

### 8.3. جدول السجلات الشهرية المجمعة للمدرسين (`teacher_monthly_records`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف السجل الشهري للمدرس |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (RESTRICT) | معرف المدرس |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي (`YYYY-MM`) |
| `groups_count` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | عدد المجموعات التي درس بها بالشهر |
| `executed_sessions_count`| `INTEGER` | `DEFAULT 0`, `NOT NULL` | إجمالي حصصه المنفذة بكافة المجموعات |
| `total_dues` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | إجمالي مستحقاته عن جميع المجموعات |
| `total_paid_out` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | إجمالي المبالغ المصروفة له فعلياً |
| `remaining_balance`| `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | الرصيد المتبقي له في ذمة السنتر |
| `is_closed` | `BOOLEAN` | `DEFAULT false`, `NOT NULL` | حالة الإغلاق المالي |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التحديث |
*القيد الفريد:* `UNIQUE(teacher_id, year_month)`.

### 8.4. جدول مستحقات المساعدين التفصيلية (`assistant_dues`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف المستحق |
| `assistant_id` | `UUID` | `NOT NULL`, FK -> `assistants.id` (RESTRICT) | معرف المساعد |
| `group_id` | `UUID` | `NULLABLE`, FK -> `groups.id` (SET NULL) | المجموعة التابع لها المستحق (أو عام) |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي |
| `calculation_method`| `VARCHAR(48)`| `NOT NULL` | طريقة الحساب المطبقة على هذا البند |
| `sessions_count` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | الحصص المنفذة المحسوبة |
| `students_count` | `INTEGER` | `DEFAULT 0`, `NOT NULL` | الطلاب المحسوبين |
| `amount` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | مبلغ المستحق المحسوب |
| `calculation_breakdown`| `TEXT` | `NULLABLE` | نص تفصيل وشرح الحساب |
| `is_locked` | `BOOLEAN` | `DEFAULT false`, `NOT NULL` | هل البند مجمد ومقفل |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التحديث |

### 8.5. جدول السجلات الشهرية المجمعة للمساعدين (`assistant_monthly_records`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف السجل الشهري |
| `assistant_id` | `UUID` | `NOT NULL`, FK -> `assistants.id` (RESTRICT) | معرف المساعد |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي |
| `calculation_method_snapshot`| `VARCHAR(48)`| `NOT NULL` | لقطة طريقة الحساب الأصلية المجمدة |
| `total_dues` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | إجمالي أتعاب المساعد عن الشهر |
| `total_paid_out` | `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | إجمالي المبالغ المنصرفة له |
| `remaining_balance`| `NUMERIC(12,2)`| `DEFAULT 0.00`, `NOT NULL` | الرصيد المتبقي له في ذمة السنتر |
| `details_note` | `TEXT` | `NULLABLE` | ملاحظات تجميع الحسابات |
| `is_closed` | `BOOLEAN` | `DEFAULT false`, `NOT NULL` | حالة الإغلاق المالي |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التحديث |
*القيد الفريد:* `UNIQUE(assistant_id, year_month)`.

### 8.6. جدول مقبوضات وتحصيلات الطلاب (`payments`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف المقبوض |
| `receipt_number` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | رقم الإيصال المرجعي الموحد |
| `student_id` | `UUID` | `NOT NULL`, FK -> `students.id` (RESTRICT) | معرف الطالب الذي سدد |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي للدفعة |
| `amount` | `NUMERIC(12,2)`| `NOT NULL` | المبلغ المحصل |
| `payment_date` | `DATE` | `NOT NULL`, Index | تاريخ التحصيل الفعلي |
| `payment_method` | `VARCHAR(32)` | `DEFAULT 'CASH'`, `NOT NULL` | طريقة الدفع (`CASH`, `VODAFONE_CASH`, `INSTAPAY`, etc.) |
| `received_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | المستخدم المحصل (الخزينة/الكاشير) |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات الإيصال |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | توقيت السداد |

### 8.7. جدول توزيع الدفعات على المجموعات (`payment_allocations`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف التوزيع |
| `payment_id` | `UUID` | `NOT NULL`, FK -> `payments.id` (CASCADE) | الإيصال الأصلي المرتبط |
| `student_monthly_record_id`| `UUID` | `NULLABLE`, FK -> `student_monthly_records.id` (SET NULL) | السجل الشهري المفوتر |
| `group_id` | `UUID` | `NOT NULL`, FK -> `groups.id` (RESTRICT) | المجموعة المخصص لها هذا الجزء |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي |
| `allocated_amount`| `NUMERIC(12,2)`| `NOT NULL` | المبلغ الموزع على هذه المجموعة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التوزيع |

### 8.8. جدول صرفيات مستحقات المدرسين (`teacher_payouts`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف إذن الصرف |
| `reference_number`| `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | رقم إذن الصرف المرجعي (`TPY-...`) |
| `teacher_id` | `UUID` | `NOT NULL`, FK -> `teachers.id` (RESTRICT) | معرف المدرس المستلم |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي المسوى |
| `amount` | `NUMERIC(12,2)`| `NOT NULL` | المبلغ المنصرف |
| `payout_date` | `DATE` | `NOT NULL` | تاريخ الصرف |
| `payment_method` | `VARCHAR(32)` | `DEFAULT 'CASH'`, `NOT NULL` | وسيلة الدفع |
| `paid_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | الصراف أو المحاسب الذي قام بالصرف |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات الصرف |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | توقيت تسجيل الصرف |

### 8.9. جدول صرفيات مستحقات المساعدين (`assistant_payouts`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف إذن الصرف |
| `reference_number`| `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | رقم إذن الصرف المرجعي (`APY-...`) |
| `assistant_id` | `UUID` | `NOT NULL`, FK -> `assistants.id` (RESTRICT) | معرف المساعد المستلم |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المحاسبي |
| `amount` | `NUMERIC(12,2)`| `NOT NULL` | المبلغ المنصرف |
| `payout_date` | `DATE` | `NOT NULL` | تاريخ الصرف |
| `payment_method` | `VARCHAR(32)` | `DEFAULT 'CASH'`, `NOT NULL` | وسيلة الدفع |
| `paid_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | القائم بالصرف |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | توقيت الصرف |

### 8.10. جدول مصروفات تشغيل السنتر (`expenses`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف المصروف |
| `category` | `VARCHAR(48)` | `NOT NULL`, Index | تصنيف المصروف (`RENT`, `MAINTENANCE`, etc.) |
| `title` | `VARCHAR(180)` | `NOT NULL` | بيان المصروف وتفاصيله |
| `amount` | `NUMERIC(12,2)`| `NOT NULL` | المبلغ المدفوع |
| `expense_date` | `DATE` | `NOT NULL`, Index | تاريخ الإنفاق |
| `year_month` | `VARCHAR(7)` | `NOT NULL`, Index | الشهر المالي التابع له المصروف |
| `payment_method` | `VARCHAR(32)` | `DEFAULT 'CASH'`, `NOT NULL` | طريقة السداد |
| `recorded_by_user_id`| `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | المستخدم المسجل للمصروف |
| `notes` | `TEXT` | `NULLABLE` | ملاحظات ورقم الفاتورة المرفقة |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ التسجيل |

---

## 9. النسخ الاحتياطي وإعدادات النظام (Backups & Settings)

### 9.1. جدول إعدادات النسخ الاحتياطي (`backup_settings`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | المعرف |
| `auto_backup_enabled`| `BOOLEAN` | `DEFAULT true`, `NOT NULL` | تفعيل النسخ اليومي التلقائي |
| `schedule_time` | `VARCHAR(8)` | `DEFAULT '02:00'`, `NOT NULL` | توقيت أخذ النسخة اليومية |
| `retention_count`| `INTEGER` | `DEFAULT 30`, `NOT NULL` | عدد النسخ المحتفظ بها محلياً قبل التدوير |
| `local_path` | `VARCHAR(500)`| `NULLABLE` | المسار المخصص للتخزين المحلي |
| `google_drive_enabled`| `BOOLEAN` | `DEFAULT false`, `NOT NULL` | تفعيل الرفع التلقائي لـ Google Drive |
| `google_drive_tokens` | `JSONB` | `NULLABLE` | رموز التوثيق المشفرة ومجلد الرفع |
| `dropbox_enabled` | `BOOLEAN` | `DEFAULT false`, `NOT NULL` | تفعيل الرفع التلقائي لـ Dropbox |
| `dropbox_tokens` | `JSONB` | `NULLABLE` | رموز توثيق Dropbox المشفرة |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تحديث |

### 9.2. جدول سجلات النسخ الاحتياطية (`backup_records`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `defaultRandom()` | معرف النسخة |
| `file_name` | `VARCHAR(255)` | `NOT NULL` | اسم الملف المنشأ (`.sql.gz`) |
| `file_path` | `VARCHAR(500)` | `NOT NULL` | المسار الكامل للملف على القرص |
| `file_size_bytes`| `BIGINT` | `NOT NULL` | حجم النسخة بالبايت |
| `trigger_type` | `VARCHAR(32)` | `NOT NULL` | مصدر النسخة (`MANUAL` أو `SCHEDULED`) |
| `destinations` | `JSONB` | `DEFAULT '[]'`, `NOT NULL` | وجهات التخزين الناجحة (`LOCAL`, `GOOGLE_DRIVE`, `DROPBOX`) |
| `checksum` | `VARCHAR(64)` | `NULLABLE` | بصمة التجزئة `SHA-256` للتحقق من سلامة الملف |
| `status` | `VARCHAR(24)` | `NOT NULL`, Index | حالة النسخة (`SUCCESS`, `FAILED`) |
| `error_message` | `TEXT` | `NULLABLE` | تفاصيل الخطأ في حال الفشل |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL`, Index | تاريخ ووقت إنشاء النسخة |

### 9.3. جدول إعدادات وهوية السنتر (`system_settings`)
| الحقل | النوع | القيود والخصائص | الوصف العربي |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | Primary Key, `DEFAULT 'default'` | معرف الإعدادات (سجل أحادي Singleton) |
| `center_name` | `VARCHAR(200)`| `DEFAULT 'سنتر النخبة التعليمي'`, `NOT NULL` | الاسم الرسمي للسنتر |
| `center_subtitle`| `VARCHAR(255)`| `DEFAULT 'نظام الإدارة المتكامل'` | الشعار النصي الفرعي للسنتر |
| `logo_url` | `TEXT` | `NULLABLE` | مسار ملف الشعار المرفوع |
| `phone` | `VARCHAR(50)` | `NULLABLE` | هاتف السنتر الرسمي المطبوع بالإيصالات |
| `address` | `VARCHAR(255)`| `NULLABLE` | العنوان الفعلي للسنتر |
| `academic_year`| `VARCHAR(50)` | `DEFAULT '2026 / 2027'` | العام الدراسي الحالي النشط |
| `currency_symbol`| `VARCHAR(20)`| `DEFAULT 'ج.م'` | رمز العملة المعتمد للنظام |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()`, `NOT NULL` | تاريخ آخر تحديث |
| `updated_by` | `UUID` | `NULLABLE`, FK -> `users.id` (SET NULL) | المشرف الذي أجرى التعديل |
