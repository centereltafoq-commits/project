# Excel Import, Template Download & Export (Students & Teachers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable, 100%-validated `.xlsx` template download, two-step preview-then-commit bulk import, and filtered `.xlsx` export for both **Students** and **Teachers** across the NestJS API and React Web App.

**Architecture:** Use `exceljs` strictly on the backend inside a shared `@Global()` `ExcelModule` (`apps/api/src/common/excel/`) to generate styled RTL `.xlsx` templates (with text-formatted phone columns, dynamic grade-level Excel Data Validation dropdowns, and an Instructions sheet), generate filtered `.xlsx` exports, and parse/normalize uploaded workbooks. Both import `preview` and `commit` endpoints accept the `.xlsx` file via `multipart/form-data` (`FileInterceptor('file')`) so the workflow stays completely stateless and immune to the global `100kb` JSON body limit (`apps/api/src/main.ts:28`).

**Tech Stack:** NestJS 10, Drizzle ORM + PostgreSQL, `exceljs`, Multer (`@nestjs/platform-express`), React 18, TanStack Query, SweetAlert2 (`confirmAction` from `@/lib/alerts`), Vitest.

## Global Constraints

- **Zero Monoliths / Strict SRP:** Excel workbook styling, cell normalization (Arabic-Indic digits -> ASCII, Excel serial dates, invisible RTL markers), and error-report generation live in `apps/api/src/common/excel/`; entity-specific column mapping & validation live in `StudentsExcelService` and `TeachersExcelService`.
- **Stateless Multi-Node Ready:** Never store pending upload rows in in-memory server state between `preview` and `commit`. Re-submit the validated `File` + strategy flag in `FormData` on `commit`.
- **Phone Leading-Zero Integrity:** All template and export phone columns MUST set Excel `numFmt = '@'` (Text) and write string values so `010...` never drops its leading zero.
- **No Fake Sample Row Pollution:** Template data sheet (`بيانات الطلاب` / `بيانات المدرسين`) has headers in Row 1 and empty data entry starting at Row 2; sample examples live ONLY in the read-only second sheet (`التعليمات والأمثلة`) so users cannot accidentally import an example row.
- **Security & Permissions:**
  - Magic-byte check (`PK\x03\x04`) + `.xlsx` extension check + `5 MB` file size limit + `2,000` rows max per import file.
  - Template Download & Import: `PERMISSIONS.STUDENTS_CREATE` (students) and `PERMISSIONS.TEACHERS_MANAGE` (teachers).
  - Filtered Excel Export: `PERMISSIONS.STUDENTS_VIEW` + `PERMISSIONS.REPORTS_EXPORT` (students) and `PERMISSIONS.TEACHERS_VIEW` + `PERMISSIONS.REPORTS_EXPORT` (teachers).
- **SweetAlert2 Confirmations:** Every import commit confirmation MUST use `confirmAction` from `@/lib/alerts`, never native `window.confirm`.
- **Route Ordering in NestJS:** Literal routes (`/students/import/template`, `/students/import/preview`, `/students/import/commit`, `/students/export`, and matching `/teachers/...` routes) MUST be declared BEFORE `@Get(':id')` / `@Patch(':id')` so NestJS doesn't try to run `ParseUUIDPipe` on `"export"` or `"import"`.

---

## Excel Workbook & Column Contracts

### A. Students Template (`students-import-template.xlsx`)
- **Sheet 1 (`بيانات الطلاب` — RTL, frozen Row 1, AutoFilter, Text `@` on code/phone/date columns):**
  1. `كود الطالب (اختياري)` — `studentCode` (optional; auto-generated `STU-YYYY-XXXX` if blank; max 40 chars)
  2. `اسم الطالب *` — `fullName` (required, 2..160 chars)
  3. `هاتف الطالب *` — `phone` (required, text `@`, normalized digits, 6..30 chars)
  4. `هاتف ولي الأمر *` — `guardianPhone` (required, text `@`, normalized digits, 6..30 chars)
  5. `الصف الدراسي *` — `gradeLevel` (required, matched against active DB `grade_levels` names; dropdown data validation populated dynamically from active `grade_levels`, falling back to active defaults if empty)
  6. `تاريخ التسجيل (YYYY-MM-DD)` — `registrationDate` (optional; defaults to today ISO date)
  7. `الحالة` — `status` (optional; accepts `نشط` / `ACTIVE`, `موقوف` / `SUSPENDED`, `مؤرشف` / `ARCHIVED`; defaults to `ACTIVE`; Excel dropdown validation)
  8. `ملاحظات` — `notes` (optional; max 2000 chars)
- **Sheet 2 (`التعليمات والأمثلة`):** Clear Arabic filling instructions, valid statuses list, active grade levels reference list, and 1 illustrative example row.

### B. Teachers Template (`teachers-import-template.xlsx`)
- **Sheet 1 (`بيانات المدرسين` — RTL, frozen Row 1, AutoFilter, Text `@` on code/phone/date columns):**
  1. `كود المدرس (اختياري)` — `teacherCode` (optional; auto-generated `TCH-XXXX` if blank; max 40 chars)
  2. `اسم المدرس *` — `fullName` (required, 2..160 chars)
  3. `رقم الهاتف *` — `phone` (required, text `@`, normalized digits, 6..30 chars)
  4. `التخصص *` — `specialization` (required, 2..100 chars)
  5. `تاريخ التعاقد (YYYY-MM-DD)` — `contractDate` (optional; defaults to today ISO date)
  6. `حالة التعاقد` — `employmentStatus` (optional; accepts `نشط` / `ACTIVE`, `في إجازة` / `ON_LEAVE`, `غير نشط` / `INACTIVE`; defaults to `ACTIVE`; Excel dropdown validation)
  7. `الموافقة على الحجوزات` — `canApproveBookings` (optional; accepts `نعم` / `true` / `1`, `لا` / `false` / `0`; defaults to `true`; Excel dropdown validation)
  8. `ملاحظات` — `notes` (optional; max 2000 chars)
- **Sheet 2 (`التعليمات والأمثلة`):** Clear Arabic filling instructions, valid employment statuses list, and 1 illustrative example row.

### C. Duplicate Handling Modes (`duplicateStrategy`)
- `'skip'` *(default in UI)*: Existing records with matching `studentCode` / `teacherCode` are skipped in commit (flagged in preview with status `'skip'` / warning), while new rows with valid data are inserted.
- `'error'`: Any matching code in DB or duplicate code inside the file fails validation for that row.
- *(Note: Non-code phone + fullName match in DB emits a non-blocking `warning` in preview so staff catch accidental double-entries before clicking Confirm.)*

---

### Task 1: Shared Backend `ExcelModule` & `ExcelWorkbookService`

**Files:**
- Modify: `apps/api/package.json` (add `exceljs`)
- Create: `apps/api/src/common/excel/excel-import.types.ts`
- Create: `apps/api/src/common/excel/excel-workbook.service.ts`
- Create: `apps/api/src/common/excel/excel.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `ExcelModule`)
- Test: `apps/api/src/common/excel/excel-workbook.service.spec.ts`

**Interfaces:**
- Produces:
  - `ExcelWorkbookService.buildWorkbookBuffer(spec: WorkbookBuildSpec): Promise<Buffer>`
  - `ExcelWorkbookService.parseUploadedWorkbook(file: UploadedMulterFile, options: ParseSheetOptions): Promise<ParsedExcelSheet>`
  - `ExcelWorkbookService.normalizeCellText(value: unknown): string`
  - `ExcelWorkbookService.normalizePhoneText(value: unknown): string`
  - `ExcelWorkbookService.normalizeDateCell(value: unknown): string | null`
  - `ExcelWorkbookService.normalizeArabicDigits(input: string): string`

- [ ] **Step 1: Install `exceljs` in `@edu-center/api`**

Run: `cmd /c "cd apps/api && npm install exceljs"`
Expected: `exceljs` added to `apps/api/package.json` dependencies cleanly.

- [ ] **Step 2: Write failing unit tests for `ExcelWorkbookService`**

Create `apps/api/src/common/excel/excel-workbook.service.spec.ts`:
```ts
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ExcelWorkbookService } from './excel-workbook.service';

describe('ExcelWorkbookService', () => {
  const service = new ExcelWorkbookService();

  it('normalizes Arabic-Indic digits and directional marks in phone cells', () => {
    expect(service.normalizePhoneText('٠١٠١٢٣٤٥٦٧٨\u200F ')).toBe('01012345678');
    expect(service.normalizePhoneText(1012345678)).toBe('1012345678');
  });

  it('normalizes Excel Date objects and ISO date strings without timezone shift', () => {
    const utcDate = new Date(Date.UTC(2026, 10, 13));
    expect(service.normalizeDateCell(utcDate)).toBe('2026-11-13');
    expect(service.normalizeDateCell('2026/11/5')).toBe('2026-11-05');
    expect(service.normalizeDateCell('13/11/2026')).toBe('2026-11-13');
    expect(service.normalizeDateCell('invalid-date')).toBeNull();
  });

  it('builds a styled RTL .xlsx template buffer and parses it back cleanly', async () => {
    const buffer = await service.buildWorkbookBuffer({
      sheetName: 'بيانات الطلاب',
      columns: [
        { key: 'fullName', header: 'اسم الطالب *', width: 28 },
        { key: 'phone', header: 'هاتف الطالب *', width: 18, numFmt: '@' },
        {
          key: 'status',
          header: 'الحالة',
          width: 16,
          dropdownValues: ['نشط', 'موقوف', 'مؤرشف'],
        },
      ],
      rows: [{ fullName: 'أحمد محمد', phone: '01012345678', status: 'نشط' }],
      instructionsSheet: {
        title: 'تعليمات الاستيراد',
        lines: ['املأ الحقول المطلوبة'],
      },
    });

    const parsed = await service.parseUploadedWorkbook(
      {
        fieldname: 'file',
        originalname: 'students.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        buffer,
      },
      { maxRows: 2000 },
    );

    expect(parsed.headers).toEqual(['اسم الطالب *', 'هاتف الطالب *', 'الحالة']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].rowNumber).toBe(2);
    expect(parsed.rows[0].cells['هاتف الطالب *']).toBe('01012345678');
  });

  it('rejects non-xlsx files or invalid magic bytes', async () => {
    await expect(
      service.parseUploadedWorkbook(
        {
          fieldname: 'file',
          originalname: 'bad.csv',
          encoding: '7bit',
          mimetype: 'text/csv',
          size: 10,
          buffer: Buffer.from('a,b,c\n1,2,3'),
        },
        { maxRows: 2000 },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cmd /c "cd apps/api && npm test -- src/common/excel/excel-workbook.service.spec.ts"`
Expected: FAIL because `excel-workbook.service.ts` does not exist yet.

- [ ] **Step 4: Implement `excel-import.types.ts`, `excel-workbook.service.ts`, `excel.module.ts`, and register in `app.module.ts`**

- Implement `ExcelImportPreviewRow<T>`, `ExcelImportPreviewResponse<T>`, `ExcelImportCommitResponse`, `ExcelColumnSpec`, `WorkbookBuildSpec`, `ParsedExcelSheet`.
- In `ExcelWorkbookService`:
  - Validate `.xlsx` filename, non-empty buffer, ZIP magic bytes (`0x50 0x4B 0x03 0x04`), and `maxRows` limit.
  - Set `worksheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]`, bold primary-colored header row, thin cell borders, `numFmt = '@'` on text columns, and Excel list `dataValidation` (`type: 'list'`) when `dropdownValues` is provided.
  - Normalize headers by trimming whitespace and stripping Unicode bidirectional marks (`[\u200E\u200F\u202A-\u202E\u00A0]`).
  - Skip completely empty trailing rows; extract RichText/Hyperlink/Formula cell values safely to scalar values.

- [ ] **Step 5: Run test to verify it passes and commit**

Run: `cmd /c "cd apps/api && npm test -- src/common/excel/excel-workbook.service.spec.ts"`
Expected: PASS (4 tests).

---

### Task 2: Students Excel Template, Import Preview, Commit & Export API (`apps/api/src/modules/students`)

**Files:**
- Create: `apps/api/src/modules/students/dto/student-excel.dto.ts`
- Create: `apps/api/src/modules/students/students-excel.service.ts`
- Modify: `apps/api/src/modules/students/students.repository.ts` (add `findAllForExport`, `findExistingCodesAndPhones`, `findActiveGradeLevelNames`, `createManyTx`)
- Modify: `apps/api/src/modules/students/students.controller.ts` (add literal routes BEFORE `:id`)
- Modify: `apps/api/src/modules/students/students.module.ts` (register `StudentsExcelService`)
- Test: `apps/api/src/modules/students/students-excel.service.spec.ts`

**Interfaces:**
- Endpoints in `StudentsController`:
  - `GET /api/students/import/template` (`@RequirePermissions(PERMISSIONS.STUDENTS_CREATE)`) -> `.xlsx` attachment
  - `POST /api/students/import/preview` (`@RequirePermissions(PERMISSIONS.STUDENTS_CREATE)`, `FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } })`) -> `ExcelImportPreviewResponse<ParsedStudentImportRow>`
  - `POST /api/students/import/commit` (`@RequirePermissions(PERMISSIONS.STUDENTS_CREATE)`, `FileInterceptor('file', ...)`, body `duplicateStrategy?: 'skip' | 'error'`) -> `ExcelImportCommitResponse`
  - `GET /api/students/export` (`@RequirePermissions(PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.REPORTS_EXPORT)`, `@Query() query: StudentExportQueryDto`) -> `.xlsx` attachment matching active filters (`search`, `status`, `gradeLevel`)

- [ ] **Step 1: Write failing unit tests in `apps/api/src/modules/students/students-excel.service.spec.ts`**

Test cases:
1. Generates `.xlsx` template containing active DB grade levels in Sheet 2 reference and expected RTL column headers in Sheet 1.
2. Preview accepts valid rows (Arabic status `نشط`, Arabic-Indic phone digits `٠١٠...`), rejects missing `fullName` / short phone / unknown `gradeLevel`, detects in-file duplicate `studentCode`, and flags existing DB `studentCode` according to `duplicateStrategy` (`skip` vs `error`), plus warning when `phone + fullName` already exists in DB.
3. Commit executes `createManyTx` inside a single DB transaction for valid rows, auto-generates unique `STU-YYYY-XXXX` codes without colliding with existing or in-batch codes, records one summary `IMPORT_STUDENTS_EXCEL` audit log, and rejects if `errorCount > 0 && !skipInvalidRows` (or skips invalid rows cleanly when `skipInvalidRows = true`).
4. Export passes active filter parameters to `findAllForExport` and produces a non-empty `.xlsx` buffer with text-formatted phones.

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "cd apps/api && npm test -- src/modules/students/students-excel.service.spec.ts"`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `StudentsRepository` helpers, `student-excel.dto.ts`, `students-excel.service.ts`, and `StudentsController` routes**

Key validation & mapping rules in `StudentsExcelService`:
- Map headers flexibly using normalized header lookup supporting both exact Arabic template headers (with or without `*`) and English field keys (`studentCode`, `fullName`, `phone`, `guardianPhone`, `gradeLevel`, `registrationDate`, `status`, `notes`).
- Validate `gradeLevel` case-insensitively / trimmed against active DB `grade_levels.name` (and `GRADE_LEVEL_OPTIONS` fallback only if `grade_levels` table has 0 active rows). Provide clear Arabic error: `الصف الدراسي "${val}" غير مسجل في الصفوف الدراسية المفعلة`.
- Map Arabic statuses (`نشط` -> `ACTIVE`, `موقوف` -> `SUSPENDED`, `مؤرشف` -> `ARCHIVED`) alongside English enum values.
- Batch-check existing `studentCode` and `(fullName, phone)` in PostgreSQL with `inArray` (zero N+1 queries!).
- Export uses unpaginated repository query ordered by `createdAt DESC`, capped safely at 10,000 rows, writing `studentCode`, `fullName`, `gradeLevel`, `phone` (`@`), `guardianPhone` (`@`), `activeGroupsCount`, `registrationDate`, Arabic status label, `notes`.

- [ ] **Step 4: Run test & production build typecheck**

Run: `cmd /c "cd apps/api && npm test -- src/modules/students/students-excel.service.spec.ts"` and `npx.cmd tsc --noEmit --project apps/api/tsconfig.build.json`
Expected: PASS and exit code 0.

---

### Task 3: Teachers Excel Template, Import Preview, Commit & Export API (`apps/api/src/modules/teachers`)

**Files:**
- Create: `apps/api/src/modules/teachers/dto/teacher-excel.dto.ts`
- Create: `apps/api/src/modules/teachers/teachers-excel.service.ts`
- Modify: `apps/api/src/modules/teachers/teachers.repository.ts` (add `findAllForExport`, `findExistingCodesAndPhones`, `createManyTx`)
- Modify: `apps/api/src/modules/teachers/teachers.controller.ts` (add literal routes BEFORE `:id` and `me/profile` ordering safety)
- Modify: `apps/api/src/modules/teachers/teachers.module.ts` (register `TeachersExcelService`)
- Test: `apps/api/src/modules/teachers/teachers-excel.service.spec.ts`

**Interfaces:**
- Endpoints in `TeachersController`:
  - `GET /api/teachers/import/template` (`@RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)`) -> `.xlsx` attachment
  - `POST /api/teachers/import/preview` (`@RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)`, `FileInterceptor('file', ...)`) -> `ExcelImportPreviewResponse<ParsedTeacherImportRow>`
  - `POST /api/teachers/import/commit` (`@RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)`, `FileInterceptor('file', ...)`) -> `ExcelImportCommitResponse`
  - `GET /api/teachers/export` (`@RequirePermissions(PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.REPORTS_EXPORT)`, `@Query() query: TeacherExportQueryDto`) -> `.xlsx` attachment matching active filters (`search`, `employmentStatus`, `specialization`)

- [ ] **Step 1: Write failing unit tests in `apps/api/src/modules/teachers/teachers-excel.service.spec.ts`**

Test cases:
1. Generates `.xlsx` template with expected teacher RTL columns and Sheet 2 instructions.
2. Preview validates required fields (`fullName`, `phone`, `specialization`), normalizes Arabic-Indic digits, parses `employmentStatus` (`نشط` -> `ACTIVE`, `في إجازة` -> `ON_LEAVE`, `غير نشط` -> `INACTIVE`) and `canApproveBookings` (`نعم`/`لا`/`true`/`false`), flags invalid dates and duplicate `teacherCode`, warns on duplicate `fullName + phone`.
3. Commit inserts valid rows atomically via `createManyTx`, generates unique `TCH-XXXX` codes, and records one `IMPORT_TEACHERS_EXCEL` audit log.
4. Export returns styled `.xlsx` respecting `search`, `employmentStatus`, and `specialization` filters.

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "cd apps/api && npm test -- src/modules/teachers/teachers-excel.service.spec.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `TeachersRepository` additions, `teacher-excel.dto.ts`, `teachers-excel.service.ts`, and `TeachersController` routes**

- Note on `teachers.controller.ts`: place `import/template`, `import/preview`, `import/commit`, and `export` ABOVE `@Get(':id/profile')` and `@Get(':id')`.
- Export includes: `teacherCode`, `fullName`, `phone` (`@`), `specialization`, `assignedGroupsCount`, `contractDate`, Arabic `employmentStatus` label, `canApproveBookings` (`نعم` / `لا`), `notes`.

- [ ] **Step 4: Run API full build + test suite**

Run: `cmd /c "cd apps/api && npm run build && npm test"`
Expected: PASS (all existing + new API specs).

---

### Task 4: Frontend Shared Blob Download Helper & Reusable `ExcelImportModal` (`apps/web`)

**Files:**
- Create: `apps/web/src/lib/file-download.ts`
- Modify: `apps/web/src/features/reports/reports-page.tsx:110-124` (reuse `downloadBlobFile` helper)
- Create: `apps/web/src/components/excel-import-modal.tsx`
- Test: `apps/web/src/components/excel-import-modal.spec.tsx`

**Interfaces:**
- `downloadBlobFile(url: string, fallbackFilename: string, params?: Record<string, unknown>): Promise<void>` in `apps/web/src/lib/file-download.ts`
- `<ExcelImportModal />` props:
  ```ts
  export interface ExcelImportColumnPreview {
    key: string;
    label: string;
    dir?: 'ltr' | 'rtl';
  }

  export interface ExcelImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    entityLabelPlural: string; // e.g. "الطلاب" | "المدرسين"
    templateUrl: string;
    templateFilename: string;
    previewUrl: string;
    commitUrl: string;
    previewColumns: ExcelImportColumnPreview[];
    invalidateQueryKeys: string[][];
  }
  ```

- [ ] **Step 1: Write failing component test `apps/web/src/components/excel-import-modal.spec.tsx`**

Test cases:
1. Renders "تحميل نموذج Excel الجاهز" button and triggers `apiClient.get(templateUrl, { responseType: 'blob' })` when clicked.
2. Uploading a `.xlsx` file triggers `apiClient.post(previewUrl, FormData)` and renders preview counts (`إجمالي الصفوف`, `صالح للاستيراد`, `أخطاء`) plus per-row Arabic error messages in the preview table.
3. Clicking confirm when valid rows exist triggers SweetAlert2 `confirmAction(...)`; if confirmed, calls `apiClient.post(commitUrl, FormData)` and displays imported/skipped summary toast + invalidates query keys.

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c "cd apps/web && npm test -- src/components/excel-import-modal.spec.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement `file-download.ts`, refactor `reports-page.tsx` to use it, and build `ExcelImportModal`**

UX features inside `ExcelImportModal`:
- Clear 3-step visual flow:
  1. **تحميل النموذج:** Button to download ready `.xlsx` template with instructions & dropdowns.
  2. **رفع الملف والمعاينة:** Drag-and-drop / file picker (`accept=".xlsx"`), option switch/radio for duplicate code handling (`تخطي الأكواد الموجودة` vs `إظهار الأكواد المكررة كخطأ`).
  3. **جدول المعاينة قبل الحفظ:** Filter pills (`الكل` / `الصالح فقط` / `الأخطاء فقط`), row numbers matching Excel rows (`صف 2`, `صف 3`...), clear red error chips & amber warning chips, toggle `"استيراد الصفوف الصالحة فقط وتخطي صفوف الأخطاء"` when mixed valid/error rows exist, and SweetAlert2 `confirmAction` before calling `/commit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd /c "cd apps/web && npm test -- src/components/excel-import-modal.spec.tsx"`
Expected: PASS.

---

### Task 5: Integrate Excel Import & Export Buttons into `StudentsPage` and `TeachersPage`

**Files:**
- Modify: `apps/web/src/features/students/students-page.tsx:160-186` & `270-279`
- Modify: `apps/web/src/features/teachers/teachers-page.tsx:175-191` & `265-274`
- Create: `apps/web/src/features/students/students-page-excel.spec.tsx`
- Create: `apps/web/src/features/teachers/teachers-page-excel.spec.tsx`

- [ ] **Step 1: Write failing UI integration tests for StudentsPage and TeachersPage Excel buttons**

Test cases:
1. `StudentsPage`: renders `تصدير Excel` when user has `STUDENTS_VIEW` + `REPORTS_EXPORT` and `استيراد من Excel` when user has `STUDENTS_CREATE`; hides them cleanly when user lacks those permissions. Clicking `تصدير Excel` passes current filters (`search`, `status`, `gradeLevel`) to `/students/export`. Clicking `استيراد من Excel` opens `ExcelImportModal`.
2. `TeachersPage`: renders `تصدير Excel` when user has `TEACHERS_VIEW` + `REPORTS_EXPORT` and `استيراد من Excel` when user has `TEACHERS_MANAGE`. Clicking `تصدير Excel` passes `search`, `employmentStatus`, `specialization` to `/teachers/export`. Clicking `استيراد من Excel` opens `ExcelImportModal`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd /c "cd apps/web && npm test -- src/features/students/students-page-excel.spec.tsx src/features/teachers/teachers-page-excel.spec.tsx"`
Expected: FAIL.

- [ ] **Step 3: Wire buttons and `ExcelImportModal` into `StudentsPage` and `TeachersPage`**

- In `StudentsPage`:
  - Export button: `variant="success"` (or `outline` green accent matching `ReportsPage`), `Download` icon, label `تصدير Excel`.
  - Import button: `variant="outline"`, `Upload` / `FileSpreadsheet` icon, label `استيراد من Excel`.
- In `TeachersPage`:
  - Same consistent action bar layout beside `إضافة مدرس جديد` inside a `flex flex-wrap items-center gap-2` container.

- [ ] **Step 4: Run full verification suite (Web + API)**

Run:
- `npx.cmd tsc --noEmit --project apps/web/tsconfig.json`
- `cmd /c "cd apps/web && npm test && npm run build"`
- `npx.cmd tsc --noEmit --project apps/api/tsconfig.build.json`
- `cmd /c "cd apps/api && npm run build && npm test"`
- Live API smoke script testing template download, preview validation errors, commit persistence, and filtered `.xlsx` export roundtrip.

---

## Plan Self-Review

- **Spec coverage:** Covers downloadable `.xlsx` template with reference dropdowns & instructions, two-phase safe import (preview + SweetAlert2 confirmation + transactional commit), strict error reporting by Excel row number, Arabic digit/date/phone leading-zero preservation, and filtered `.xlsx` export buttons on both Students and Teachers pages.
- **No placeholders:** Every file path, permission constant, DTO field, route order constraint, and test scenario is explicitly defined.
- **Type consistency:** Shared contracts (`ExcelImportPreviewResponse`, `ExcelImportCommitResponse`, `UploadedMulterFile`) match existing codebase types (`profiles.schema.ts`, `StudentStatus`, `TeacherEmploymentStatus`, `PERMISSIONS`).

