# تصميم وإعدادات النظام وبدء سنة دراسية جديدة (System Settings & Annual Reset Design Spec)

**التاريخ:** 08 نوفمبر 2026  
**الحالة:** معتمد من المستخدم (Approved)  
**المجال:** إدارة إعدادات النظام، هوية السنتر، والأرشفة والتصفير الآمن للعام الدراسي الجديد  

---

## 1. الأهداف ونطاق العمل (Goals & Scope)
1. **تخصيص هوية السنتر (Center Profile & Branding):**
   - تمكين إدارة السنتر (المالك) من تعديل اسم السنتر، الشعار (اللوجو)، الوصف المختصر، رقم الهاتف، العنوان، والعام الدراسي النشط.
   - انعكاس هذه البيانات تلقائياً وفورياً في: شريط القائمة الجانبية (Sidebar)، الهيدر، إيصالات الدفع المطبوعة (Receipts)، ونماذج التقارير المطبوعة.
2. **محرك بدء سنة دراسية جديدة (New Academic Year & Annual Purge Engine):**
   - حل مشكلة تراكم وتضخم البيانات بعد انتهاء العام الدراسي بطريقة مؤمنة ومنظمة.
   - **المرحلة الأولى:** أخذ نسخة احتياطية مضغوطة كاملة (`.sql.gz`) مؤرخة تشمل كافة حركات وبيانات العام المنتهي بالكامل مع التحقق من سلامتها (`Checksum Verification`). وإلغاء العملية فوراً في حال حدوث أي خطأ في النسخ.
   - **المرحلة الثانية:** تصفير الحركات والبيانات التشغيلية داخل Transaction آمنة (الحصص، سجلات الحضور والغياب، المدفوعات والإيصالات، المصروفات، صرفيات المدرسين، والتسويات المالية، والحجوزات)، مع إعطاء خيار تفاعلي للإدارة لتحديد مصير الطلاب والمجموعات (تصفير الاشتراكات والاحتفاظ بملفات الطلاب، أم حذفها بالكامل).
3. **الأمان والحماية القصوى (Security & Access Control):**
   - قصر الوصول على دور المالك (`OWNER`) أو المستخدمين الممنوحين صلاحية `settings.manage`.
   - اشتراط إدخال **رمز PIN سري مكون من 6 أرقام** يتم استرجاعه من المتغيرات البيئية (`ANNUAL_RESET_PIN`).
   - حماية من محاولات التخمين (`Rate Limiting`).
   - توثيق العملية باسم القائم بها وتوقيتها في جدول الرقابة والتدقيق (`Audit Logs`).

---

## 2. التصميم المعماري وقاعدة البيانات (Architecture & Schema)

### 2.1 مخطط جدول الإعدادات (`system_settings`)
إنشاء جدول جديد في قاعدة البيانات عبر Drizzle ORM في `apps/api/src/database/schemas/settings.schema.ts`:

```typescript
export const systemSettings = pgTable('system_settings', {
  id: varchar('id', { length: 32 }).primaryKey().default('default'),
  centerName: varchar('center_name', { length: 200 }).notNull().default('سنتر النخبة التعليمي'),
  centerSubtitle: varchar('center_subtitle', { length: 255 }).default('نظام الإدارة المتكامل'),
  logoUrl: text('logo_url'),
  phone: varchar('phone', { length: 50 }),
  address: varchar('address', { length: 255 }),
  academicYear: varchar('academic_year', { length: 50 }).default('2026 / 2027'),
  currencySymbol: varchar('currency_symbol', { length: 20 }).default('ج.م'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});
```

### 2.2 المتغيرات البيئية (`.env`)
في ملف `apps/api/.env` و `.env.example`:
```env
ANNUAL_RESET_PIN=123456
```

### 2.3 مصفوفة الصلاحيات (`permissions.constants.ts`)
إضافة صلاحية جديدة:
```typescript
SETTINGS_MANAGE: 'settings.manage', // تعديل بيانات السنتر وبدء عام دراسي جديد
```
تُسند تلقائياً لدور `OWNER` في مصفوفة الأدوار الافتراضية.

---

## 3. تفاصيل الـ API والخدمات الخلفية (Backend Endpoints & Services)

### 3.1 وحدة الإعدادات (`SettingsModule`)
- **`GET /api/settings`**:
  - جلب بيانات إعدادات وهوية السنتر الحالية.
  - الحماية: متاح لكافة المستخدمين المصرحين (`JwtAuthGuard`) لعرض الاسم واللوجو في الواجهة.
  
- **`PUT /api/settings`**:
  - تحديث بيانات وهوية السنتر.
  - الحماية: `@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)`.
  - التحقق: `UpdateSettingsDto` عبر `ValidationPipe`.
  - إبطال الكاش الخاص بالإعدادات.

- **`POST /api/settings/reset-academic-year`**:
  - بدء سنة دراسية جديدة وتنفيذ الأرشفة والتصفير.
  - الحماية: `@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)`.
  - المدخلات (`ResetAcademicYearDto`):
    - `pin`: كود الأمان المكون من 6 أرقام (إجباري).
    - `purgeStudents`: قيمة منطقية (Boolean) لتحديد مسح الطلاب والمجموعات بالكامل أم الاكتفاء بتصفير اشتراكاتهم وحركاتهم.
    - `notes`: ملاحظات اختيارية تُرفق مع الأرشيف وسجل التدقيق.

### 3.2 خوارزمية تصفير العام الدراسي (`Reset Pipeline Workflow`)
1. **التحقق من كود الـ PIN:**
   - مقارنة الـ PIN المدخل مع `configService.getOrThrow('ANNUAL_RESET_PIN')`.
   - إذا لم يتطابق: إرجاع استثناء `UnauthorizedException('رمز PIN غير صحيح')` مع تسجيل محاولة فاشلة في الـ Audit Log.
2. **النسخ الاحتياطي الإجباري المسبق (Pre-Purge Full Backup):**
   - استدعاء `BackupsService.createBackup()` مع تسمية الأرشيف بـ `archive-academic-year-[year]`.
   - الانتظار والتأكد من إتمام توليد ملف الـ `.sql.gz` بنجاح واستخراج الـ Checksum والحجم.
   - في حال فشل عملية النسخ لأي سبب تقني: **يتم إلغاء العملية بالكامل والتوقف دون مساس بأي سجل**.
3. **التصفير الذري المنضبط داخل Transaction (`db.transaction`):**
   - حذف الجلسات والحضور والتعويضات: `makeups`, `attendanceRecords`, `sessions`.
   - حذف السجلات والتسويات المالية: `studentMonthlyRecords`, `monthlySettlements`, `teacherMonthlyRecords`, `assistantMonthlyRecords`.
   - حذف المعاملات المالية والمصروفات: `paymentAllocations`, `payments`, `teacherPayouts`, `assistantPayouts`, `expenses`.
   - حذف الحجوزات: `bookings`.
   - تصفير الاشتراكات: `groupEnrollments`.
   - إذا تم تفعيل `purgeStudents = true`: حذف سجلات الطلاب `students` والمجموعات `groups`.
4. **ما لا يتم مسحه أبداً (Preserved System Core):**
   - حسابات المستخدمين والمالك `users`.
   - الأدوار والصلاحيات `roles`, `permissions`, `role_permissions`.
   - القاعات الدراسية `classrooms`.
   - الصفوف والمراحل الدراسية `grade_levels`.
   - سجلات النسخ الاحتياطي `backups`.
   - سجلات الرقابة والتدقيق `audit_logs`.
   - جدول الإعدادات `system_settings`.
5. **تحديث العام الدراسي وسجل التدقيق:**
   - تحديث حقل `academicYear` في `system_settings`.
   - تسجيل عملية تدقيق ناجحة `auditService.logAction(...)` بنوع `system.annual_reset`.
   - تفريغ كافة مفاتيح الكاش المالي والداشبورد وقوائم الطلاب والمجموعات.

---

## 4. واجهة المستخدم وتجربة الاستخدام (Frontend & UI Components)

### 4.1 إدارة الحالة والهوية المركزية (`CenterSettingsContext`)
- إنشاء `CenterSettingsContext` ومزود `CenterSettingsProvider` في جذر التطبيق:
  - يجلب إعدادات وهوية السنتر عبر React Query (`queryKey: ['settings']`).
  - يوفر `centerName`, `centerSubtitle`, `logoUrl`, `academicYear` لكافة مكونات التطبيق.

### 4.2 شاشة الإعدادات (`/settings` - `SettingsPage`)
- **بطاقة هوية السنتر (Center Profile & Branding):**
  - نموذج لتعديل الاسم، الوصف، رابط/مسار الشعار مع إظهار Live Preview فوري، بيانات الاتصال، والعام الدراسي.
  - زر "حفظ التعديلات".
- **بطاقة منطقة العمليات الحساسة (Danger Zone Card):**
  - شريط تنبيهي باللون الأحمر يوضح بدقة آلية الأرشفة التلقائية ثم التصفير.
  - زر مميز باللون الأحمر: `بدء سنة دراسية جديدة والتصفير`.

### 4.3 نافذة تأكيد وتأمين التصفير (`NewAcademicYearModal`)
- **صندوق تحذيري قوي:** يؤكد أن الخطوة لا رجعة فيها وأنه سيتم أخذ نسخة احتياطية أرشيفية أولاً.
- **خيارات التصفير التفاعلية:**
  - خيار تصفير الاشتراكات والماليات (محدد افتراضياً وإجباري).
  - مفتاح تبديل/خيار اختياري: *«حذف ملفات الطلاب والمجموعات بالكامل أيضاً (غير مفعل افتراضياً للاحتفاظ بأسماء الطلاب وهواتفهم للعام الجديد)»*.
- **حقل إدخال رمز الأمان (6-Digit PIN):**
  - حقل إدخال مكون من 6 خانات أو حقل أمان رقمي.
- **مؤشر التقدم المزدوج أثناء التنفيذ:**
  - حالة 1: *"جاري أخذ نسخة احتياطية شاملة لبيانات العام المنتهي..."*
  - حالة 2: *"جاري تصفير الحسابات والعمليات وبدء العام الجديد..."*
- إشعار نجاح فوري وتحديث لبيانات النظام.

### 4.4 انعكاس الهوية عبر شاشات ومطبوعات النظام
1. **القائمة الجانبية (Sidebar):** إحلال النص الصلب للشعار واسم السنتر ببيانات `useCenterSettings()`.
2. **إيصالات السداد المطبوعة (`ReceiptPrintModal`):** طباعة اسم السنتر واللوجو ورقم الهاتف المحدث أعلى الإيصال.
3. **التقارير المطبوعة (`ReportsPage`):** ترويسة التقارير الرسمية تحمل اسم وشعار السنتر المحدث.

---

## 5. خطة الاختبار والتحقق (Testing & Verification Strategy)
1. **اختبارات الوحدة للباك إند (Backend Unit Tests):**
   - اختبار صحة الـ PIN ورفض الرموز غير المتطابقة بـ 403.
   - اختبار توليد النسخة الاحتياطية قبل أي تصفير.
   - اختبار تصفير السجلات التشغيلية داخل المعاملة (Transaction).
   - اختبار خيار الاحتفاظ بالطلاب مقابل خيار مسحهم.
2. **اختبارات الفرونت إند (Frontend Component Tests):**
   - اختبار صفحة الإعدادات وعرض حقول الهوية.
   - اختبار نافذة التأكيد وطلب الـ PIN.
   - اختبار حراسة صلاحية الوصول `settings.manage`.
3. **التحقق الشامل من البناء:**
   - تشغيل `npm test` للتأكد من نجاح كافة الاختبارات.
   - تشغيل `npm run build` للتأكد من خلو المشروع من أي أخطاء ترجمة أو تضارب في الأنواع.

