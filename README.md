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
│       ├── database/         # تعريفات الجداول الـ 39 والفهارس وبذور البيانات (Seeds)
│       └── modules/          # auth, users, roles, audit-logs, students, teachers, assistants,
│                             # classrooms, groups, attendance, bookings, calendar, finance,
│                             # dashboard, reports, backups, settings
├── apps/web/                 # واجهة React + Tailwind المقسمة إلى Design System و Features
│   └── src/
│       ├── design-system/    # المكونات الذرية القابلة لإعادة الاستخدام + ServerDataTable
│       ├── layout/           # الهيكل العام والقائمة الجانبية الذكية حسب الصلاحيات
│       └── features/         # صفحات وبروفايلات النظام المقسمة لملفات صغيرة مسؤولة
├── apps/desktop/             # تطبيق سطح المكتب لنظام Windows عبر Electron مع طباعة حرارية مباشرة
└── docs/                     # التوثيق الفني والهندسي والمحاسبي الشامل لكافة أجزاء النظام
```

---

## 📚 موسوعة التوثيق الفني الشاملة (System Documentation Hub)

تتوفر توثيقات مفصلة وعميقة ومطابقة للكود الفعلي داخل مجلد [`docs/`](./docs/README.md):

1. 💵 [**المحرك المالي والمحاسبي الشامل**](./docs/01-financial-and-accounting-engine.md) — المعادلات الرياضية لفواتير الطلاب، توزيع إيراد المدرسين، أتعاب المساعدين، الإغلاق المالي، والقفل التاريخي (`assertMonthOpen`).
2. 🗄️ [**قاموس البيانات ومخطط الجداول الكامل**](./docs/02-database-schema-and-data-dictionary.md) — توثيق الـ 39 جدولاً، الحقول، الأنواع، القيود، والفهارس.
3. 🏫 [**الوحدات الأكاديمية والتشغيلية**](./docs/03-operational-and-academic-modules.md) — الطلاب، المدرسين، المساعدين، المجموعات، الحضور والتعويضات، ومحرك منع التعارضات الخماسي.
4. 🔒 [**الأمان ومصفوفة الصلاحيات وسجل التدقيق**](./docs/04-security-rbac-and-audit.md) — التوثيق المزدوج، مصفوفة 41 صلاحية على 5 أدوار، وجدران الحماية، والتدقيق المؤسسي.
5. 💾 [**النسخ الاحتياطي وتصفير العام الدراسي**](./docs/05-backups-and-annual-reset.md) — التصدير المضغوط، الربط السحابي (Drive/Dropbox)، وبروتوكول بدء العام الجديد ورمز PIN.
6. 🖥️ [**تطبيق سطح المكتب والطباعة والعتاد**](./docs/06-desktop-application-and-hardware.md) — وضع Server/Client، الاكتشاف التلقائي لشبكة LAN، والطباعة الحرارية الصامتة (80mm).
7. 🌐 [**دليل واجهات البرمجة REST API**](./docs/07-api-reference-and-integration.md) — الدليل المرجعي لجميع الـ Endpoints عبر الـ 19 Controller، ومعايير الـ 25 سجلاً، ومعالجة الأخطاء.
8. 🎨 [**معمارية الواجهة الأمامية ونظام التصميم**](./docs/08-frontend-and-design-system.md) — React 18, TanStack Query, Radix UI, المكونات الذرية، ودعم RTL العربي الكامل.

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

