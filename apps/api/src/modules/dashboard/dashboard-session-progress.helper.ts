import { sql } from 'drizzle-orm';
import { DrizzleDatabase } from '../../database/database.module';
import { getMonthDateBounds } from '../finance/utils/money.util';
import {
  DashboardSessionProgressStudentItem,
  DashboardSessionProgressSummary,
  DashboardSessionStepBucket,
  DashboardSessionTrackBreakdown,
  SessionProgressStatus,
} from './dashboard.types';

const MAX_PROGRESS_STUDENTS_RETURNED = 250;

export type RawEnrollmentSessionProgressRow = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  studentPhone: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  subject: string;
  targetSessions: number;
  attendedSessions: number;
  remainingBalance: string | number | null;
};

const STATUS_PRIORITY: Record<SessionProgressStatus, number> = {
  LAST_OR_DONE: 0,
  NEAR_LAST: 1,
  IN_PROGRESS: 2,
  NOT_STARTED: 3,
};

/**
 * Classifies a student's monthly session progress inside an enrollment against its target sessions quota.
 */
export function classifyStudentSessionProgress(
  attendedSessions: number,
  targetSessions: number,
): {
  target: number;
  attended: number;
  stepNumber: number;
  status: SessionProgressStatus;
} {
  const target = Math.max(1, Math.round(targetSessions || 1));
  const attended = Math.max(0, Math.round(attendedSessions || 0));
  const stepNumber = Math.min(attended, target);

  if (attended === 0) {
    return { target, attended, stepNumber: 0, status: 'NOT_STARTED' };
  }
  if (attended >= target) {
    return { target, attended, stepNumber: target, status: 'LAST_OR_DONE' };
  }
  if (target >= 2 && attended === target - 1) {
    return { target, attended, stepNumber, status: 'NEAR_LAST' };
  }
  return { target, attended, stepNumber, status: 'IN_PROGRESS' };
}

/**
 * Aggregates raw student-group enrollment attendance rows into organized step tracks & prioritized student list.
 */
export function buildSessionProgressSummary(
  rows: RawEnrollmentSessionProgressRow[],
): DashboardSessionProgressSummary {
  const trackMap = new Map<
    number,
    {
      totalEnrollments: number;
      notStartedCount: number;
      inProgressCount: number;
      nearLastCount: number;
      lastOrCompletedCount: number;
      stepCounts: Map<number, number>;
    }
  >();

  const allStudents: DashboardSessionProgressStudentItem[] = [];
  let nearLastTotalCount = 0;
  let lastOrCompletedTotalCount = 0;
  let inProgressTotalCount = 0;
  let notStartedTotalCount = 0;

  for (const row of rows) {
    const { target, attended, stepNumber, status } = classifyStudentSessionProgress(
      Number(row.attendedSessions ?? 0),
      Number(row.targetSessions ?? 4),
    );

    let track = trackMap.get(target);
    if (!track) {
      track = {
        totalEnrollments: 0,
        notStartedCount: 0,
        inProgressCount: 0,
        nearLastCount: 0,
        lastOrCompletedCount: 0,
        stepCounts: new Map<number, number>(),
      };
      trackMap.set(target, track);
    }

    track.totalEnrollments += 1;
    if (status === 'NOT_STARTED') {
      track.notStartedCount += 1;
      notStartedTotalCount += 1;
    } else if (status === 'LAST_OR_DONE') {
      track.lastOrCompletedCount += 1;
      lastOrCompletedTotalCount += 1;
    } else if (status === 'NEAR_LAST') {
      track.nearLastCount += 1;
      nearLastTotalCount += 1;
    } else {
      track.inProgressCount += 1;
      inProgressTotalCount += 1;
    }

    if (stepNumber > 0) {
      track.stepCounts.set(stepNumber, (track.stepCounts.get(stepNumber) ?? 0) + 1);
    }

    allStudents.push({
      enrollmentId: row.enrollmentId,
      studentId: row.studentId,
      studentName: row.studentName,
      studentCode: row.studentCode,
      studentPhone: row.studentPhone,
      groupId: row.groupId,
      groupName: row.groupName,
      groupCode: row.groupCode,
      subject: row.subject,
      attendedSessions: attended,
      targetSessions: target,
      stepNumber,
      status,
      remainingBalance: Number(row.remainingBalance ?? 0),
    });
  }

  const tracks: DashboardSessionTrackBreakdown[] = Array.from(trackMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([targetSessions, track]) => {
      const steps: DashboardSessionStepBucket[] = [];
      for (let step = 1; step <= targetSessions; step += 1) {
        const isLast = step === targetSessions;
        const isNearLast = targetSessions >= 2 && step === targetSessions - 1;
        const label = isLast
          ? `الحصة ${step} (الأخيرة)`
          : isNearLast
            ? `الحصة ${step} (قبل الأخيرة)`
            : `الحصة ${step}`;
        steps.push({
          stepNumber: step,
          label,
          isNearLast,
          isLast,
          studentsCount: track.stepCounts.get(step) ?? 0,
        });
      }

      return {
        targetSessions,
        totalEnrollments: track.totalEnrollments,
        notStartedCount: track.notStartedCount,
        inProgressCount: track.inProgressCount,
        nearLastCount: track.nearLastCount,
        lastOrCompletedCount: track.lastOrCompletedCount,
        steps,
      };
    });

  allStudents.sort((a, b) => {
    const prioDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (prioDiff !== 0) return prioDiff;
    if (b.stepNumber !== a.stepNumber) return b.stepNumber - a.stepNumber;
    return a.studentName.localeCompare(b.studentName, 'ar');
  });

  const isStudentsListTruncated = allStudents.length > MAX_PROGRESS_STUDENTS_RETURNED;

  return {
    totalTrackedEnrollments: allStudents.length,
    nearLastTotalCount,
    lastOrCompletedTotalCount,
    inProgressTotalCount,
    notStartedTotalCount,
    tracks,
    students: isStudentsListTruncated
      ? allStudents.slice(0, MAX_PROGRESS_STUDENTS_RETURNED)
      : allStudents,
    ...(isStudentsListTruncated ? { isStudentsListTruncated: true } : {}),
  };
}

/**
 * Fetches per-enrollment group-session progress for the requested financial month in a single SQL query.
 * Counts executed group sessions (COMPLETED or with recorded attendance) within the student's active enrollment period.
 */
export async function queryStudentSessionProgress(
  db: DrizzleDatabase,
  yearMonth: string,
): Promise<DashboardSessionProgressSummary> {
  const { monthStart, monthEnd } = getMonthDateBounds(yearMonth);

  const res = await db.execute<RawEnrollmentSessionProgressRow>(sql`
    SELECT
      e.id AS "enrollmentId",
      e.student_id AS "studentId",
      st.full_name AS "studentName",
      st.student_code AS "studentCode",
      st.phone AS "studentPhone",
      e.group_id AS "groupId",
      g.name AS "groupName",
      g.group_code AS "groupCode",
      g.subject AS "subject",
      GREATEST(1, COALESCE(NULLIF(e.agreed_sessions_count, 0), NULLIF(g.monthly_sessions_count, 0), 4))::int AS "targetSessions",
      COUNT(DISTINCT CASE
        WHEN s.status = 'COMPLETED' OR a.id IS NOT NULL THEN s.id
      END)::int AS "attendedSessions",
      COALESCE(MAX(smr.remaining_balance), 0)::text AS "remainingBalance"
    FROM enrollments e
    INNER JOIN students st ON st.id = e.student_id
    INNER JOIN groups g ON g.id = e.group_id
    LEFT JOIN student_monthly_records smr
      ON smr.student_id = e.student_id
     AND smr.group_id = e.group_id
     AND smr.year_month = ${yearMonth}
    LEFT JOIN sessions s
      ON s.group_id = e.group_id
     AND s.year_month = ${yearMonth}
     AND s.status != 'CANCELLED'
     AND s.session_date >= e.start_date
     AND (e.end_date IS NULL OR s.session_date <= e.end_date)
    LEFT JOIN attendance a
      ON a.session_id = s.id
    WHERE e.status = 'ACTIVE'
      AND e.start_date <= ${monthEnd}
      AND (e.end_date IS NULL OR e.end_date >= ${monthStart})
    GROUP BY
      e.id, e.student_id, st.full_name, st.student_code, st.phone,
      e.group_id, g.name, g.group_code, g.subject,
      e.agreed_sessions_count, g.monthly_sessions_count
    ORDER BY g.name ASC, st.full_name ASC
  `);

  return buildSessionProgressSummary(res.rows);
}

