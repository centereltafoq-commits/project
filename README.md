# نظام إدارة السنتر التعليمي المتكامل (EduCenter ERP)

منصة إلكترونية مؤسسية متكاملة لإدارة السنتر التعليمي مبنية وفق معمارية **Modular Clean Architecture** (بدون أي ملفات ضخمة – **Zero God Files**)، مصممة لتحمل تضخم البيانات لسنوات طويلة بكفاءة وأمان عالٍ.

---

## التقنيات المستخدمة (Tech Stack)
- **Backend:** `NestJS` + `TypeScript` + `Drizzle ORM` + `PostgreSQL` (`pg` pool + فهارس `B-Tree` و`GIN pg_trgm` للبحث الفائق) + طبقة كاش تدعم `Redis` والذاكرة تلقائيًا.
- **الأمان والحماية:** تشفير كلمات المرور بـ `Argon2id`، نظام `JWT` مزدوج (`Access Token` + `Refresh Token` مشفر في `HttpOnly Cookie` مع تدوير وإلغاء الجلسات)، صلاحيات `RBAC` قابلة للتخصيص لكل دور أو مستخدم، `Helmet`, `CORS`, `Throttler` (Rate Limiting)، وتنقية المدخلات ضد `XSS` مع فلتر أخطاء مركزي وسجل تدقيق شامل (`Audit_Logs`).
- **Frontend & Design System:** `React 18` + `Vite` + `Tailwind CSS` + `Radix UI Primitives` + `Lucide Icons` + `TanStack Query` بواجهة عربية احترافية (`RTL`) ودعم الوضع الفاتح والداكن (`Light / Dark Mode`).
- **معيار الجداول الموحد:** جميع صفحات النظام تعرض **25 نتيجة في الصفحة افتراضيًا** (`ServerDataTable`) مع بحث فوري (`Debounced Search`) وفلترة متقدمة وترقيم صفحات على مستوى السيرفر.

---

## هيكلة المشروع (Monorepo Structure)
```text
├── packages/shared/          # الثوابت المشتركة، صلاحيات RBAC، تعدادات النظام، وعقود Pagination (25/page)
├── apps/api/                 # خادم NestJS المقسم إلى موديولات وطبقات معزولة
│   └── src/
│       ├── config/           # التحقق الصارم من متغيرات البيئة (Zero Hardcoded Secrets)
│       ├── common/           # الحراس، الفلاتر، تنقية المدخلات، الكاش، والسجل الهيكلي
│       ├── database/         # تعريفات الجداول الـ 29+ والفهارس وبذور البيانات (Seeds)
│       └── modules/          # auth, users, roles, audit-logs, students, teachers, assistants,
│                             # classrooms, groups, attendance, bookings, calendar, finance,
│                             # dashboard, reports
└── apps/web/                 # واجهة React + Tailwind المقسمة إلى Design System و Features
    └── src/
        ├── design-system/    # المكونات الذرية القابلة لإعادة الاستخدام + ServerDataTable
        ├── layout/           # الهيكل العام والقائمة الجانبية الذكية حسب الصلاحيات
        └── features/         # صفحات وبروفايلات النظام المقسمة لملفات صغيرة مسؤولة
```

---

## خطوات التشغيل السريع

1. **تثبيت الحزم وبناء الحزمة المشتركة:**
   ```bash
   npm install
   npm run build:shared
   ```

2. **ضبط ملف البيئة `apps/api/.env`:**
   انسخ `apps/api/.env.example` إلى `apps/api/.env` وتأكد من اتصال `DATABASE_URL` بقاعدة بيانات **PostgreSQL**.

3. **تطبيق الجداول والفهارس وتغذية البيانات التأسيسية:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **تشغيل النظام (Backend + Frontend):**
   ```bash
   # نافذة 1 - تشغيل الـ API على البورت 4000
   npm run dev:api

   # نافذة 2 - تشغيل الواجهة على البورت 5173
   npm run dev:web
   ```

5. **تشغيل الاختبارات والبناء الإنتاجي:**
   ```bash
   npm run test
   npm run build
   ```

