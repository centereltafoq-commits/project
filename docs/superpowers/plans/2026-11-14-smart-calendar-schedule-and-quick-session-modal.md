# Smart Calendar Automatic Group Schedules & Quick Session Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically display all active groups' weekly schedule slots (`groups.scheduleSlots`) on the Calendar page (`/calendar`) on their matching days and times (smartly merged with real `sessions`), with visual status distinction (`NEEDS_CLASSROOM` / `READY_SCHEDULED` / `COMPLETED`), and provide a fast interactive modal upon clicking any group event to select/update today's classroom (`classroomId`) and time (`startTime`, `endTime`), optionally pin the classroom & time to the group's permanent schedule, and optionally confirm group attendance (`COMPLETED` + financial billing recalculation) in one click.

**Architecture:**
1. **Backend Smart Schedule Expansion & Merge (`apps/api/src/modules/calendar/`):**
   - `CalendarRepository.fetchUnifiedRangeData` fetches active groups (`groups.isActive = true`) along with their `scheduleSlots`, `defaultClassroomId`, and primary teacher info (`teachers.fullName`), filtered by `teacherId` if requested.
   - A pure helper `expandAndMergeGroupScheduleEvents` in `apps/api/src/modules/calendar/validators/calendar-schedule-expander.util.ts` iterates over each date in `[fromDate..toDate]`, matches active groups' `scheduleSlots` by `dayOfWeek`, and merges them with existing `sessions` on that date so virtual weekly slots appear automatically whenever a real session has not been created yet (without duplicating existing sessions).
   - Each `GROUP_SESSION` event carries `visualState`: `'NEEDS_CLASSROOM'` (amber), `'READY_SCHEDULED'` (blue), or `'COMPLETED'` (emerald), plus metadata (`isVirtualSlot`, `sessionId`, `groupId`, `groupName`, `subject`, `slotDayOfWeek`, `originalSlotStartTime`).
2. **Backend Quick Session Upsert, Pinning & Group Attendance Endpoint (`POST /calendar/quick-session`):**
   - Dedicated service `CalendarQuickSessionService` (`apps/api/src/modules/calendar/calendar-quick-session.service.ts`) and DTO `QuickCalendarSessionDto` (`apps/api/src/modules/calendar/dto/quick-calendar-session.dto.ts`).
   - Validates time range, open month status (`MonthlySettlementService.assertMonthOpen`), and teacher/classroom/maintenance conflicts (`AttendanceRepository.checkSessionConflicts`).
   - Creates a new `sessions` record (if clicked from a virtual slot) or updates the existing `sessions` record's `classroomId`, `startTime`, `endTime`, and `topic`.
   - When `pinToGroupSchedule: true`, updates the group's `defaultClassroomId` and updates the matching `scheduleSlots` entry in `groups` for that `dayOfWeek`.
   - When `completeGroupAttendance: true`, marks the session `COMPLETED` and triggers `MonthlySettlementService.recalculateMonth(yearMonth)` so all enrolled students in the group are billed and center/teacher dues are updated immediately.
3. **Frontend Visual States & Interactive Quick Session Modal (`apps/web/src/features/calendar/`):**
   - Updates `calendar.types.ts` and `calendar-views.tsx` (`DailyTimelineView`, `WeeklyGridView`, `MonthlyGridView`) + legend in `calendar-page.tsx` to visually distinguish:
     - **موعد مجدول بدون قاعة (`NEEDS_CLASSROOM`):** Amber styling with badge `"بدون قاعة — اضغط للتحديد"`.
     - **حصة جاهزة بقاعة (`READY_SCHEDULED`):** Blue styling showing assigned classroom name & room number.
     - **حصة مكتملة تم تحضيرها (`COMPLETED`):** Emerald styling with badge `"تم تسجيل الحضور ✓"`.
   - Replaces the read-only `CalendarEventModal` for `GROUP_SESSION` events with an interactive `CalendarEventModal` that lets the user:
     - Pick today's classroom (`classroomId`) with live availability indicators (`متاحة ✓` vs `مشغولة بـ ...` / `صيانة`) computed from the day's events.
     - Adjust `startTime` and `endTime` (pre-filled automatically from the group's schedule).
     - Toggle **"تثبيت هذه القاعة والموعد كجدول ثابت للمجموعة"** (`pinToGroupSchedule`).
     - Click **"حفظ القاعة والموعد"** or **"حفظ وتأكيد حضور المجموعة"** in a single step.

**Tech Stack:** NestJS 10, Drizzle ORM, PostgreSQL, React 18, TanStack Query v5, Tailwind CSS, Vitest, Jest.

**Spec:** Approved interactive brainstorming design in conversation `8c22a366-71fb-463f-9742-cc2eb226f540`.

## Global Constraints
- Strictly modular Single-Responsibility Principle (SRP) files — no God files.
- Routes/Controllers handle HTTP lifecycle only; business logic lives in Services and pure utilities; database queries live in Repositories.
- All inputs validated via `class-validator` DTOs (`QuickCalendarSessionDto`).
- Conflict detection must prevent assigning two overlapping group sessions to the same classroom or teacher on the same date, and prevent assigning a classroom under maintenance.

---

### Task 1: Pure Schedule Slot Expander & Smart Session Merger Utility

**Files:**
- Create: `apps/api/src/modules/calendar/validators/calendar-schedule-expander.util.ts`
- Test: `apps/api/src/modules/calendar/calendar-schedule-expander.spec.ts`

**Interfaces:**
- Produces:
  - `CalendarSessionVisualState = 'NEEDS_CLASSROOM' | 'READY_SCHEDULED' | 'COMPLETED'`
  - `expandAndMergeGroupScheduleEvents(params)`

- [ ] **Step 1: Write the failing unit test `apps/api/src/modules/calendar/calendar-schedule-expander.spec.ts`**

```ts
import { SessionStatus } from '@edu-center/shared';
import { expandAndMergeGroupScheduleEvents } from './validators/calendar-schedule-expander.util';

describe('expandAndMergeGroupScheduleEvents', () => {
  const classroomsMap = new Map([
    ['room-1', { id: 'room-1', name: 'قاعة A', roomNumber: '101' }],
    ['room-2', { id: 'room-2', name: 'قاعة B', roomNumber: '102' }],
  ]);

  it('synthesizes virtual calendar events from group scheduleSlots on matching days of week', () => {
    // 2026-11-14 is Saturday (dayOfWeek = 6), 2026-11-15 is Sunday (dayOfWeek = 0)
    const result = expandAndMergeGroupScheduleEvents({
      fromDate: '2026-11-14',
      toDate: '2026-11-15',
      existingSessions: [],
      activeGroups: [
        {
          id: 'group-1',
          name: 'مجموعة الفيزياء',
          groupCode: 'GRP-101',
          subject: 'فيزياء',
          primaryTeacherId: 'teacher-1',
          teacherName: 'أ. أحمد علي',
          defaultClassroomId: null,
          scheduleSlots: [
            { dayOfWeek: 6, startTime: '16:00', endTime: '18:00', classroomId: null },
          ],
        },
      ],
      classroomsMap,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'slot-group-1-2026-11-14-16:00',
      category: 'GROUP_SESSION',
      date: '2026-11-14',
      startTime: '16:00',
      endTime: '18:00',
      groupId: 'group-1',
      sessionId: null,
      isVirtualSlot: true,
      visualState: 'NEEDS_CLASSROOM',
      classroomId: null,
    });
  });

  it('merges real sessions with virtual slots without duplicating the same day session', () => {
    const result = expandAndMergeGroupScheduleEvents({
      fromDate: '2026-11-14',
      toDate: '2026-11-14',
      existingSessions: [
        {
          id: 'sess-1',
          sessionDate: '2026-11-14',
          startTime: '17:00', // shifted time for today
          endTime: '19:00',
          status: SessionStatus.COMPLETED,
          topic: 'قانون أوم',
          groupId: 'group-1',
          groupName: 'مجموعة الفيزياء',
          groupCode: 'GRP-101',
          subject: 'فيزياء',
          teacherId: 'teacher-1',
          teacherName: 'أ. أحمد علي',
          classroomId: 'room-1',
          classroomName: 'قاعة A',
          roomNumber: '101',
        },
      ],
      activeGroups: [
        {
          id: 'group-1',
          name: 'مجموعة الفيزياء',
          groupCode: 'GRP-101',
          subject: 'فيزياء',
          primaryTeacherId: 'teacher-1',
          teacherName: 'أ. أحمد علي',
          defaultClassroomId: null,
          scheduleSlots: [
            { dayOfWeek: 6, startTime: '16:00', endTime: '18:00', classroomId: null },
          ],
        },
      ],
      classroomsMap,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'session-sess-1',
      sessionId: 'sess-1',
      isVirtualSlot: false,
      startTime: '17:00',
      endTime: '19:00',
      classroomId: 'room-1',
      visualState: 'COMPLETED',
    });
  });
});
```

- [ ] **Step 2: Implement `apps/api/src/modules/calendar/validators/calendar-schedule-expander.util.ts`**

```ts
import { SessionStatus } from '@edu-center/shared';
import { GroupScheduleSlot } from '../../../database/schemas';
import { UnifiedCalendarEvent } from '../calendar.service';

export type CalendarSessionVisualState =
  | 'NEEDS_CLASSROOM'
  | 'READY_SCHEDULED'
  | 'COMPLETED';

export interface CalendarRealSessionRow {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  topic: string | null;
  groupId: string;
  groupName: string;
  groupCode: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  roomNumber: string | null;
}

export interface CalendarActiveGroupRow {
  id: string;
  name: string;
  groupCode: string;
  subject: string;
  primaryTeacherId: string;
  teacherName: string;
  defaultClassroomId: string | null;
  scheduleSlots: GroupScheduleSlot[];
}

export interface ClassroomLookupItem {
  id: string;
  name: string;
  roomNumber: string;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveSessionVisualState(
  status: string,
  classroomId?: string | null,
): CalendarSessionVisualState {
  if (status === SessionStatus.COMPLETED) {
    return 'COMPLETED';
  }
  if (classroomId) {
    return 'READY_SCHEDULED';
  }
  return 'NEEDS_CLASSROOM';
}

export function expandAndMergeGroupScheduleEvents(params: {
  fromDate: string;
  toDate: string;
  existingSessions: CalendarRealSessionRow[];
  activeGroups: CalendarActiveGroupRow[];
  classroomsMap: Map<string, ClassroomLookupItem>;
  classroomFilterId?: string;
}): UnifiedCalendarEvent[] {
  const events: UnifiedCalendarEvent[] = [];

  // Index real sessions by `${groupId}|${sessionDate}`
  const realSessionsByGroupDate = new Map<string, CalendarRealSessionRow[]>();
  for (const s of params.existingSessions) {
    const key = `${s.groupId}|${s.sessionDate}`;
    const list = realSessionsByGroupDate.get(key) ?? [];
    list.push(s);
    realSessionsByGroupDate.set(key, list);

    const [y, m, d] = s.sessionDate.split('-').map(Number);
    const dayOfWeek = new Date(y!, m! - 1, d!).getDay();

    events.push({
      id: `session-${s.id}`,
      sourceId: s.id,
      category: 'GROUP_SESSION',
      date: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      title: `${s.groupName} (${s.subject})`,
      subtitle: s.topic ? `${s.teacherName} — ${s.topic}` : s.teacherName,
      status: s.status,
      visualState: resolveSessionVisualState(s.status, s.classroomId),
      isVirtualSlot: false,
      sessionId: s.id,
      groupId: s.groupId,
      groupName: s.groupName,
      subject: s.subject,
      slotDayOfWeek: dayOfWeek,
      originalSlotStartTime: s.startTime,
      teacherId: s.teacherId,
      teacherName: s.teacherName,
      classroomId: s.classroomId,
      classroomName: s.classroomName,
      roomNumber: s.roomNumber,
    });
  }

  // Iterate through dates in [fromDate..toDate]
  const [fy, fm, fd] = params.fromDate.split('-').map(Number);
  const [ty, tm, td] = params.toDate.split('-').map(Number);
  const cursor = new Date(fy!, fm! - 1, fd!);
  const endCursor = new Date(ty!, tm! - 1, td!);

  while (cursor <= endCursor) {
    const dateStr = formatYmd(cursor);
    const dayOfWeek = cursor.getDay();

    for (const group of params.activeGroups) {
      const matchingSlots = (group.scheduleSlots ?? []).filter(
        (slot) => Number(slot.dayOfWeek) === dayOfWeek,
      );
      if (matchingSlots.length === 0) continue;

      const existingForDay = realSessionsByGroupDate.get(`${group.id}|${dateStr}`) ?? [];

      // If real sessions already cover the group's slots for this date, only add uncovered slots
      const usedRealSessionIds = new Set<string>();

      for (const slot of matchingSlots) {
        // First try exact startTime match, otherwise match any remaining real session for this group on this date
        let matchedReal = existingForDay.find(
          (r) => !usedRealSessionIds.has(r.id) && r.startTime === slot.startTime,
        );
        if (!matchedReal && existingForDay.length <= matchingSlots.length) {
          matchedReal = existingForDay.find((r) => !usedRealSessionIds.has(r.id));
        }

        if (matchedReal) {
          usedRealSessionIds.add(matchedReal.id);
          continue;
        }

        const effectiveClassroomId = slot.classroomId ?? group.defaultClassroomId ?? null;
        if (
          params.classroomFilterId &&
          effectiveClassroomId !== params.classroomFilterId
        ) {
          continue;
        }

        const roomInfo = effectiveClassroomId
          ? params.classroomsMap.get(effectiveClassroomId)
          : undefined;

        events.push({
          id: `slot-${group.id}-${dateStr}-${slot.startTime}`,
          sourceId: group.id,
          category: 'GROUP_SESSION',
          date: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
          title: `${group.name} (${group.subject})`,
          subtitle: group.teacherName,
          status: SessionStatus.SCHEDULED,
          visualState: resolveSessionVisualState(
            SessionStatus.SCHEDULED,
            effectiveClassroomId,
          ),
          isVirtualSlot: true,
          sessionId: null,
          groupId: group.id,
          groupName: group.name,
          subject: group.subject,
          slotDayOfWeek: dayOfWeek,
          originalSlotStartTime: slot.startTime,
          teacherId: group.primaryTeacherId,
          teacherName: group.teacherName,
          classroomId: effectiveClassroomId,
          classroomName: roomInfo?.name ?? null,
          roomNumber: roomInfo?.roomNumber ?? null,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return events;
}
```

- [ ] **Step 3: Run unit tests to verify they pass**
Run: `cmd /c "npx --prefix apps/api jest calendar-schedule-expander.spec.ts"`

---

### Task 2: Update `CalendarRepository` & `CalendarService` to Include Active Group Schedules

**Files:**
- Modify: `apps/api/src/modules/calendar/calendar.repository.ts`
- Modify: `apps/api/src/modules/calendar/calendar.service.ts`

- [ ] **Step 1: Update `CalendarRepository.fetchUnifiedRangeData` to query active groups with `scheduleSlots`**
In `apps/api/src/modules/calendar/calendar.repository.ts`, add `activeGroups` to the parallel `Promise.all` query:
```ts
    const groupConditions: SQL[] = [eq(groups.isActive, true)];
    if (params.teacherId) {
      groupConditions.push(eq(groups.primaryTeacherId, params.teacherId));
    }
```
And select:
```ts
      this.db
        .select({
          id: groups.id,
          name: groups.name,
          groupCode: groups.groupCode,
          subject: groups.subject,
          primaryTeacherId: groups.primaryTeacherId,
          teacherName: teachers.fullName,
          defaultClassroomId: groups.defaultClassroomId,
          scheduleSlots: groups.scheduleSlots,
        })
        .from(groups)
        .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
        .where(and(...groupConditions))
        .orderBy(asc(groups.name)),
```

- [ ] **Step 2: Update `CalendarService.getEvents` to use `expandAndMergeGroupScheduleEvents`**
In `apps/api/src/modules/calendar/calendar.service.ts`, build `classroomsMap` from `data.allClassrooms`, call `expandAndMergeGroupScheduleEvents`, and compute `occupiedRoomIds` and `eventsCountByRoom` from all resulting `GROUP_SESSION` events that have a `classroomId`.

---

### Task 3: Backend Quick Session Endpoint (`POST /calendar/quick-session`)

**Files:**
- Create: `apps/api/src/modules/calendar/dto/quick-calendar-session.dto.ts`
- Create: `apps/api/src/modules/calendar/calendar-quick-session.service.ts`
- Modify: `apps/api/src/modules/calendar/calendar.repository.ts`
- Modify: `apps/api/src/modules/calendar/calendar.controller.ts`
- Modify: `apps/api/src/modules/calendar/calendar.module.ts`
- Test: `apps/api/src/modules/calendar/calendar-quick-session.service.spec.ts`

- [ ] **Step 1: Create `QuickCalendarSessionDto` in `apps/api/src/modules/calendar/dto/quick-calendar-session.dto.ts`**

```ts
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class QuickCalendarSessionDto {
  @IsOptional()
  @IsUUID('4', { message: 'معرف الحصة غير صالح' })
  sessionId?: string | null;

  @IsUUID('4', { message: 'معرف المجموعة مطلوب وغير صالح' })
  groupId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'تاريخ الحصة يجب أن يكون بصيغة YYYY-MM-DD',
  })
  sessionDate!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت البداية يجب أن يكون بصيغة HH:mm',
  })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت النهاية يجب أن يكون بصيغة HH:mm',
  })
  endTime!: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة غير صالح' })
  classroomId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string | null;

  @IsOptional()
  @IsBoolean()
  pinToGroupSchedule?: boolean;

  @IsOptional()
  @IsBoolean()
  completeGroupAttendance?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  originalSlotStartTime?: string | null;
}
```

- [ ] **Step 2: Add helper methods in `CalendarRepository` (`findGroupSessionOnDate`, `updateSessionSchedule`, `updateGroupPinnedSchedule`)**
In `apps/api/src/modules/calendar/calendar.repository.ts`:
- `findGroupSessionOnDate(groupId: string, sessionDate: string, preferredStartTime?: string | null)`
- `updateSessionSchedule(sessionId: string, updates: { startTime: string; endTime: string; classroomId: string | null; topic?: string | null })`
- `updateGroupPinnedSchedule(groupId: string, defaultClassroomId: string | null, scheduleSlots: GroupScheduleSlot[])`

- [ ] **Step 3: Create `CalendarQuickSessionService` in `apps/api/src/modules/calendar/calendar-quick-session.service.ts`**
Handles:
1. Validating `startTime < endTime`.
2. Checking `settlementService.assertMonthOpen(yearMonth)`.
3. Resolving existing session by `dto.sessionId` or `findGroupSessionOnDate(dto.groupId, dto.sessionDate, dto.originalSlotStartTime)`.
4. Calling `attendanceRepository.checkSessionConflicts({ date: dto.sessionDate, startTime: dto.startTime, endTime: dto.endTime, teacherId: group.primaryTeacherId, classroomId: dto.classroomId, excludeSessionId: existingSession?.id })`.
5. Creating or updating the session in `sessions`.
6. If `dto.pinToGroupSchedule === true`, updating the group's `scheduleSlots` for that `dayOfWeek` and `defaultClassroomId`.
7. If `dto.completeGroupAttendance === true`, calling `attendanceService.completeGroupSession(session.id, actor)` so the session is marked `COMPLETED` and monthly student/teacher/center billing is recalculated.

- [ ] **Step 4: Expose `POST /calendar/quick-session` in `CalendarController` and wire `AttendanceModule` & `FinanceModule` in `CalendarModule`**
- Route guarded with `@RequireAnyPermissions(PERMISSIONS.SESSIONS_MANAGE, PERMISSIONS.ATTENDANCE_RECORD, PERMISSIONS.CLASSROOMS_MANAGE)`.
- Write and run unit tests in `apps/api/src/modules/calendar/calendar-quick-session.service.spec.ts`.

---

### Task 4: Frontend Visual Distinction & Quick Session Modal

**Files:**
- Modify: `apps/web/src/features/calendar/calendar.types.ts`
- Modify: `apps/web/src/features/calendar/calendar-views.tsx`
- Modify: `apps/web/src/features/calendar/calendar-event-modal.tsx`
- Modify: `apps/web/src/features/calendar/calendar-page.tsx`

- [ ] **Step 1: Add `CalendarSessionVisualState` & visual style helpers in `apps/web/src/features/calendar/calendar.types.ts`**
Define `SESSION_VISUAL_STATE_STYLES`:
- `NEEDS_CLASSROOM`:
  - `label: 'موعد مجموعة (بدون قاعة)'`
  - `badgeLabel: 'اختر القاعة'`
  - `pillClass: 'border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25 border-dashed'`
  - `dotClass: 'bg-amber-500'`
  - `badgeVariant: 'warning'`
- `READY_SCHEDULED`:
  - `label: 'حصة محددة القاعة'`
  - `badgeLabel: 'جاهزة'`
  - `pillClass: 'border-blue-500/40 bg-blue-500/15 text-blue-800 dark:text-blue-200 hover:bg-blue-500/25'`
  - `dotClass: 'bg-blue-500'`
  - `badgeVariant: 'info'`
- `COMPLETED`:
  - `label: 'حصة مكتملة (تم التحضير)'`
  - `badgeLabel: 'تم الحضور ✓'`
  - `pillClass: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/25'`
  - `dotClass: 'bg-emerald-500'`
  - `badgeVariant: 'success'`

- [ ] **Step 2: Update `calendar-views.tsx` (`DailyTimelineView`, `WeeklyGridView`, `MonthlyGridView`) and `calendar-page.tsx` legend**
- Render each `GROUP_SESSION` card using its `visualState` style (`getEventVisualStyle(ev)`).
- Clearly display:
  - Time range (`من .. إلى ..`)
  - Group name & subject
  - Classroom badge (`قاعة: ...` or warning badge `بدون قاعة — اضغط للتحديد`)
  - Status badge (`تم الحضور ✓` when `COMPLETED`)

- [ ] **Step 3: Upgrade `CalendarEventModal` (`apps/web/src/features/calendar/calendar-event-modal.tsx`) into the Interactive Quick Session Modal**
For `GROUP_SESSION` events:
- Receives `event`, `classrooms`, `dayEvents`, `onClose`, `onSuccess`.
- Pre-fills `classroomId`, `startTime`, `endTime`, and `topic`.
- Computes live room availability for `(startTime, endTime)` against `dayEvents` (excluding current event), labeling each classroom option in the dropdown:
  - `قاعة 101 (سعة 40) — متاحة ✓`
  - `قاعة 102 (سعة 30) — مشغولة: مجموعة الكيمياء (04:00 م - 06:00 م) ⚠️`
  - `قاعة 103 — قيد الصيانة 🔧`
- Includes checkbox **"تثبيت هذه القاعة والموعد كجدول ثابت للمجموعة"** (`pinToGroupSchedule`).
- Provides two primary action buttons:
  1. **«حفظ القاعة والموعد»** (`completeGroupAttendance: false`)
  2. **«حفظ وتأكيد حضور المجموعة»** (`completeGroupAttendance: true`)

- [ ] **Step 4: Run Frontend & Backend Tests and Production Builds**
- Run `cmd /c "npm --prefix apps/api test"` and `cmd /c "npm --prefix apps/api run build"`
- Run `cmd /c "npm --prefix apps/web test"` and `cmd /c "npm --prefix apps/web run build"`
