# System Settings and Annual Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete System Settings module with dynamic Center Branding (Name, Logo, Phone, Address, Academic Year) and a highly secured 2-Phase "Start New Academic Year" reset engine protected by a 6-digit PIN and mandatory pre-purge full backup.

**Architecture:** A singleton `system_settings` database table managed through NestJS `SettingsModule` and consumed by React `CenterSettingsContext`. The annual reset pipeline executes: (1) Verification of `ANNUAL_RESET_PIN` from `.env`, (2) Mandatory `.sql.gz` pre-purge full backup via `BackupsService.createBackup()`, (3) Atomic PostgreSQL transaction purging transactional data (attendance, sessions, payments, dues, payouts, expenses, bookings, enrollments) while preserving master system users, roles, classrooms, and grade levels.

**Tech Stack:** NestJS, Drizzle ORM, PostgreSQL, React 18, Tailwind CSS, TanStack React Query, Lucide Icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-system-settings-and-annual-reset-design.md`

## Global Constraints
- Strictly monolith-free layered architecture: Schema -> Repository -> Service -> Controller.
- Zero hardcoded secrets: 6-digit PIN loaded exclusively from `process.env.ANNUAL_RESET_PIN`.
- Mandatory Pre-Backup Guarantee: Never purge any table if backup creation fails or encounters errors.
- Never delete master system records: `users`, `roles`, `permissions`, `classrooms`, `grade_levels`, `backups`, `audit_logs`, `system_settings`.
- Preserve RTL layout, IBM Plex Sans Arabic typography, and standard currency formatting.

---

### Task 1: Shared Permissions & Database Schema Definition

**Files:**
- Modify: `packages/shared/src/constants/permissions.constants.ts`
- Create: `apps/api/src/database/schemas/settings.schema.ts`
- Modify: `apps/api/src/database/schemas/index.ts`
- Modify: `apps/api/src/database/seeds/seed-identity.data.ts`
- Modify: `apps/api/.env`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Produces: `PERMISSIONS.SETTINGS_MANAGE = 'settings.manage'`, `systemSettings` pgTable schema.

- [x] **Step 1: Update permissions constants in `@edu-center/shared`**
Add `SETTINGS_MANAGE: 'settings.manage'` to `PERMISSIONS` object in `packages/shared/src/constants/permissions.constants.ts`.

- [x] **Step 2: Build `@edu-center/shared` to propagate types**
Run `cmd.exe /c npm run build:shared` and ensure exit code 0.

- [x] **Step 3: Create `settings.schema.ts` in API**
Define `systemSettings` in `apps/api/src/database/schemas/settings.schema.ts` with columns:
`id` (varchar pk default 'default'), `centerName` (varchar notNull default 'سنتر النخبة التعليمي'), `centerSubtitle` (varchar), `logoUrl` (text), `phone` (varchar), `address` (varchar), `academicYear` (varchar default '2026 / 2027'), `currencySymbol` (varchar default 'ج.م'), `updatedAt` (timestamp with tz defaultNow), `updatedBy` (uuid fk users.id).

- [x] **Step 4: Export schema and register in seed data**
Export `systemSettings` in `apps/api/src/database/schemas/index.ts`.
Add `'settings.manage'` to `OWNER` role permissions in `seed-identity.data.ts`.
Add `ANNUAL_RESET_PIN=123456` in `apps/api/.env` and `apps/api/.env.example`.

- [x] **Step 5: Apply schema push and commit**
Run `cmd.exe /c npx drizzle-kit push` (or `npm run db:migrate`) in `apps/api`.
Commit: `git add packages/shared/ apps/api/src/database/ apps/api/.env* && git commit -m "feat(settings): define system settings schema and permissions"`

---

### Task 2: Backend Settings & Annual Reset Service with Unit Tests

**Files:**
- Create: `apps/api/src/modules/settings/dto/settings.dto.ts`
- Create: `apps/api/src/modules/settings/settings.repository.ts`
- Create: `apps/api/src/modules/settings/settings.service.ts`
- Create: `apps/api/src/modules/settings/settings.controller.ts`
- Create: `apps/api/src/modules/settings/settings.module.ts`
- Create: `apps/api/src/modules/settings/settings.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `BackupsService.createBackup()`, `AuditService.logAction()`, `CacheService`.
- Produces: `GET /api/settings`, `PUT /api/settings`, `POST /api/settings/reset-academic-year`.

- [x] **Step 1: Write failing unit test for `SettingsService`**
In `apps/api/src/modules/settings/settings.service.spec.ts`, test:
1. `getSettings()` returns default or stored center settings.
2. `updateSettings()` updates name, logo, phone and invalidates cache.
3. `resetAcademicYear()` throws `UnauthorizedException` when PIN does not match `process.env.ANNUAL_RESET_PIN`.
4. `resetAcademicYear()` calls `BackupsService.createBackup()` and executes transactional deletion when PIN is valid.

- [x] **Step 2: Run test to verify it fails**
Run `cmd.exe /c npx vitest run src/modules/settings/settings.service.spec.ts` in `apps/api`.
Expected: FAIL (modules not found).

- [x] **Step 3: Implement DTOs, Repository, Service and Controller**
- In `settings.dto.ts`: `UpdateSettingsDto` with `@IsString()`, `@IsOptional()`; `ResetAcademicYearDto` with `@IsString() @Length(6, 6) pin`, `@IsBoolean() @IsOptional() purgeStudents`.
- In `settings.repository.ts`: methods to get singleton row, upsert singleton row, and atomic purge transaction (`clearOperationalData(purgeStudents: boolean)`).
- In `settings.service.ts`: PIN timing-safe verification, backup invocation, purge invocation, audit log recording, cache clearing.
- In `settings.controller.ts`: endpoints with `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
- In `app.module.ts`: register `SettingsModule`.

- [x] **Step 4: Run unit tests to verify they pass**
Run `cmd.exe /c npx vitest run src/modules/settings/settings.service.spec.ts` in `apps/api`.
Expected: PASS (all tests green).

- [x] **Step 5: Commit backend implementation**
Commit: `git add apps/api/src/ && git commit -m "feat(settings): implement settings service, annual reset engine and unit tests"`

---

### Task 3: Frontend Settings Page & New Academic Year Modal

**Files:**
- Create: `apps/web/src/features/settings/settings-api.ts`
- Create: `apps/web/src/features/settings/center-settings-context.tsx`
- Create: `apps/web/src/features/settings/components/new-academic-year-modal.tsx`
- Create: `apps/web/src/features/settings/settings-page.tsx`
- Create: `apps/web/src/features/settings/settings-page.spec.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `apiClient`, `useToast`, `Button`, `Card`, `Badge`.
- Produces: `CenterSettingsProvider`, `useCenterSettings()`, `/settings` route component.

- [x] **Step 1: Write failing component test for `SettingsPage`**
In `apps/web/src/features/settings/settings-page.spec.tsx`:
Test that `SettingsPage` renders center branding form, displays the Danger Zone card with "بدء سنة دراسية جديدة", and opens `NewAcademicYearModal` when clicked.

- [x] **Step 2: Run test to verify it fails**
Run `cmd.exe /c npx vitest run src/features/settings/settings-page.spec.tsx` in `apps/web`.
Expected: FAIL (modules not found).

- [x] **Step 3: Implement Settings API, Context, Page, and Reset Modal**
- `settings-api.ts`: `fetchSettings()`, `updateSettings(data)`, `resetAcademicYear(data)`.
- `center-settings-context.tsx`: Context holding `{ settings, isLoading, refetch }` with fallback defaults.
- `settings-page.tsx`: Two cards: (1) Center Branding form with live logo image preview, name, subtitle, phone, address, and academic year; (2) Danger Zone card with warning and "بدء سنة دراسية جديدة والتصفير" button.
- `new-academic-year-modal.tsx`: Modal with warning text, 6-digit PIN input, optional checkbox for purging student master profiles, double progress status ("جاري عمل النسخة الاحتياطية...", "جاري تصفير البيانات..."), and submit/cancel buttons.
- In `App.tsx`: wrap routes with `CenterSettingsProvider`, add `<Route path="/settings" element={<PermissionGuardRoute permission={PERMISSIONS.SETTINGS_MANAGE}><SettingsPage /></PermissionGuardRoute>} />`.

- [x] **Step 4: Run component tests to verify they pass**
Run `cmd.exe /c npx vitest run src/features/settings/settings-page.spec.tsx` in `apps/web`.
Expected: PASS.

- [x] **Step 5: Commit frontend settings page**
Commit: `git add apps/web/src/ && git commit -m "feat(settings): create settings page, center settings context, and reset modal"`

---

### Task 4: Dynamic Branding Across Sidebar, Receipts & Printed Reports

**Files:**
- Modify: `apps/web/src/layout/nav-items.ts`
- Modify: `apps/web/src/layout/app-layout.tsx`
- Modify: `apps/web/src/features/finance/modals/receipt-print-modal.tsx`
- Modify: `apps/web/src/features/reports/reports-page.tsx`

**Interfaces:**
- Consumes: `useCenterSettings()`.

- [x] **Step 1: Add `/settings` to `nav-items.ts`**
Add `{ label: 'إعدادات النظام', to: '/settings', icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE }` to `SIDEBAR_NAV_ITEMS`.

- [x] **Step 2: Connect `app-layout.tsx` to `useCenterSettings()`**
Replace hardcoded "سنتر النخبة التعليمي" and "نظام الإدارة المتكامل" with `settings.centerName` and `settings.centerSubtitle`. If `settings.logoUrl` exists, render `<img>` with fallback to `GraduationCap` icon.

- [x] **Step 3: Connect `receipt-print-modal.tsx` to `useCenterSettings()`**
In printed receipt header, dynamically render `settings.centerName`, `settings.logoUrl`, `settings.phone`, and `settings.address`.

- [x] **Step 4: Connect `reports-page.tsx` to `useCenterSettings()`**
In printed report header, dynamically render `settings.centerName` and `settings.academicYear`.

- [x] **Step 5: Verify tests and commit**
Run `cmd.exe /c npm test`.
Commit: `git add apps/web/src/ && git commit -m "feat(settings): connect dynamic branding to sidebar, receipts, and printed reports"`

---

### Task 5: End-to-End Verification & Full Monorepo Build

**Files:**
- Test verification across all packages.

- [x] **Step 1: Run complete automated test suite**
Run `cmd.exe /c npm test`.
Expected: All API tests (>= 92 tests) and Web tests (>= 16 tests) PASS with 0 failures.

- [x] **Step 2: Run complete monorepo production build**
Run `cmd.exe /c npm run build`.
Expected: `@edu-center/shared`, `@edu-center/api`, and `@edu-center/web` compile with exit code 0.

- [x] **Step 3: Execute live smoke test on running servers**
Perform live check against `http://localhost:4000/api/settings` and `http://localhost:5173/settings`.
Verify changing center name and logo reflects live in the header and sidebar.

