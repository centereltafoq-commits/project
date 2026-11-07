# Backup & Disaster Recovery Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an enterprise-grade automated and manual backup & disaster recovery subsystem supporting PostgreSQL dumps with gzip compression, multiple storage drivers (Local/USB path, Direct browser download, One-click Google Drive OAuth, Dropbox), and secure one-click restoration with supervisor confirmation.

**Architecture:** Layered, monolith-free architecture. Core pg_dump execution stream piped through gzip, SHA-256 verification, pluggable storage drivers (`IBackupStorageDriver`), background scheduler for daily automated backups, retention cleaner, and an Arabic RTL management dashboard in React with Lucide icons.

**Tech Stack:** NestJS, PostgreSQL, Drizzle ORM, Node.js child_process, zlib, crypto, React, Tailwind CSS, TanStack Query, Radix UI.

**Spec:** `docs/superpowers/specs/2026-11-07-backup-system-design.md`

## Global Constraints
- Zero God Files: Every file strictly under 250 lines, adhering to the Single Responsibility Principle (SRP).
- Production Security: Guarded with OWNER/MANAGER permissions. Restore operations strictly require password verification via Argon2id.
- Non-blocking I/O: Streaming child processes for pg_dump/pg_restore and gzip compression without blocking the Event Loop.
- Arabic RTL UI using IBM Plex Sans Arabic and Tailwind design system.

---

### Task 1: Database Schemas & Migration

**Files:**
- Create: `apps/api/src/database/schemas/backups.schema.ts`
- Modify: `apps/api/src/database/schemas/index.ts`
- Test: PostgreSQL table existence verification script

**Interfaces:**
- Produces: `backupSettings`, `backupRecords` Drizzle table definitions.

- [ ] **Step 1: Create `backups.schema.ts`**
Define `backupSettings` and `backupRecords` pgTable schemas with UUID primary keys, JSONB tokens, and audit timestamps.

- [ ] **Step 2: Export in `apps/api/src/database/schemas/index.ts`**
Add `export * from './backups.schema';`.

- [ ] **Step 3: Execute table migration in PostgreSQL**
Run DDL script to create `backup_settings` and `backup_records` tables with indexes.

- [ ] **Step 4: Verify tables created**
Query PostgreSQL database to ensure both tables exist and columns match the spec.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/database/schemas/backups.schema.ts apps/api/src/database/schemas/index.ts
git commit -m "feat(backups): create backup_settings and backup_records database schemas"
```

---

### Task 2: Core Storage Drivers & Repository

**Files:**
- Create: `apps/api/src/modules/backups/dto/backup.dto.ts`
- Create: `apps/api/src/modules/backups/backups.repository.ts`
- Create: `apps/api/src/modules/backups/drivers/storage-driver.interface.ts`
- Create: `apps/api/src/modules/backups/drivers/local-storage.driver.ts`
- Create: `apps/api/src/modules/backups/drivers/google-drive.driver.ts`

**Interfaces:**
- Consumes: `DRIZZLE_DB`, `backupSettings`, `backupRecords`.
- Produces: `IBackupStorageDriver`, `LocalStorageDriver`, `GoogleDriveDriver`, `BackupsRepository`.

- [ ] **Step 1: Create DTOs**
Write `TriggerBackupDto`, `UpdateBackupSettingsDto`, `RestoreBackupDto` in `dto/backup.dto.ts`.

- [ ] **Step 2: Create Storage Driver Interface & LocalStorageDriver**
Implement `IBackupStorageDriver` interface and `LocalStorageDriver` to safely copy files to configured local/USB directories with directory creation.

- [ ] **Step 3: Create GoogleDriveDriver**
Implement Google Drive folder creator and file uploader using standard HTTPS/fetch with bearer token.

- [ ] **Step 4: Create BackupsRepository**
Implement queries for getting/updating settings, listing records with pagination (25/page), finding record by ID, and deleting records exceeding retention limit.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/modules/backups/
git commit -m "feat(backups): implement storage drivers, dtos, and backups repository"
```

---

### Task 3: Backup Core Service, Scheduler & Controller

**Files:**
- Create: `apps/api/src/modules/backups/backups.service.ts`
- Create: `apps/api/src/modules/backups/backups.scheduler.ts`
- Create: `apps/api/src/modules/backups/backups.controller.ts`
- Create: `apps/api/src/modules/backups/backups.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `BackupsRepository`, `LocalStorageDriver`, `GoogleDriveDriver`.
- Produces: REST endpoints `/api/backups/*`, automated daily cron job.

- [ ] **Step 1: Create `backups.service.ts`**
Implement `pg_dump` stream execution piped through `zlib.createGzip()`, SHA-256 calculation, dispatch to drivers, retention policy enforcement, and restore flow via `pg_restore`.

- [ ] **Step 2: Create `backups.scheduler.ts`**
Implement interval/cron checker to trigger daily backup at the configured `scheduleTime`.

- [ ] **Step 3: Create `backups.controller.ts`**
Implement endpoints for trigger, list, download, restore, restore-upload, settings, and Google OAuth URL/callback.

- [ ] **Step 4: Create `backups.module.ts` and register in `apps/api/src/app.module.ts`**
Wire dependencies and register module.

- [ ] **Step 5: Verify API build**
Run `npm.cmd --workspace=@edu-center/api run build` to confirm zero compilation errors.

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/modules/backups/ apps/api/src/app.module.ts
git commit -m "feat(backups): implement backup engine, scheduler, and REST controller"
```

---

### Task 4: Frontend API Client, Types & State Hooks

**Files:**
- Create: `apps/web/src/features/backups/backups.types.ts`
- Create: `apps/web/src/features/backups/backups-api.ts`
- Create: `apps/web/src/features/backups/use-backups.ts`

**Interfaces:**
- Consumes: `/api/backups` endpoints.
- Produces: `useBackups`, `useBackupSettings`, `backupsApi` utilities.

- [ ] **Step 1: Create `backups.types.ts`**
Define `BackupRecord`, `BackupSettings`, and payload types.

- [ ] **Step 2: Create `backups-api.ts`**
Implement API methods for listing, triggering backup, downloading backup file, restoring, updating settings, and Google Drive connect.

- [ ] **Step 3: Create `use-backups.ts`**
Implement React Query hooks with cache invalidation and loading states.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/features/backups/
git commit -m "feat(backups): add frontend backup types, api client, and query hooks"
```

---

### Task 5: Frontend Dashboard UI & Navigation Integration

**Files:**
- Create: `apps/web/src/features/backups/backup-restore-modal.tsx`
- Create: `apps/web/src/features/backups/backup-upload-modal.tsx`
- Create: `apps/web/src/features/backups/backups-page.tsx`
- Modify: `apps/web/src/layout/sidebar.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `useBackups`, `ServerDataTable`, `Modal`, `Button`, `Input`.
- Produces: Route `/backups`, Sidebar entry "النسخ الاحتياطي والأمان".

- [ ] **Step 1: Create `backup-restore-modal.tsx`**
Security confirmation modal requiring supervisor password input before restore.

- [ ] **Step 2: Create `backup-upload-modal.tsx`**
Modal to upload and restore `.sql` / `.sql.gz` backup files from USB/PC.

- [ ] **Step 3: Create `backups-page.tsx`**
Complete Arabic RTL dashboard with live statistics, Google Drive card, local path configuration, quick action trigger button, and paginated backup history table with direct download.

- [ ] **Step 4: Update Sidebar and Routes**
Add "النسخ الاحتياطي" (`/backups`) to `sidebar.tsx` with `Database` or `ShieldCheck` icon, and register Route in `App.tsx`.

- [ ] **Step 5: Verify Web Build**
Run `npm.cmd --workspace=@edu-center/web run build` to verify 0 errors.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/features/backups/ apps/web/src/layout/sidebar.tsx apps/web/src/App.tsx
git commit -m "feat(backups): implement frontend backup management page and modals"
```

---

### Task 6: End-to-End Verification & Real Backup Testing

**Files:**
- Verification only

- [ ] **Step 1: Trigger a live manual backup via the API / Web UI**
Verify that a `.sql.gz` archive is successfully generated with checksum and registered in `backup_records`.

- [ ] **Step 2: Verify direct browser download**
Ensure `/api/backups/:id/download` streams the compressed file with proper Content-Disposition header.

- [ ] **Step 3: Verify local path copying**
Configure a local path (e.g. desktop/local directory) and verify the backup file is written there.

- [ ] **Step 4: Final verification and commit**
```bash
git status
git commit --allow-empty -m "chore(backups): complete end-to-end testing and verification"
```
