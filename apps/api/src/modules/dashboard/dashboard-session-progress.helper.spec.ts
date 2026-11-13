import { describe, expect, it } from 'vitest';
import {
  buildSessionProgressSummary,
  classifyStudentSessionProgress,
} from './dashboard-session-progress.helper';

describe('dashboard-session-progress.helper', () => {
  it('classifies 4-session cycle stages accurately (near-last on 3rd, last on 4th+)', () => {
    expect(classifyStudentSessionProgress(0, 4)).toEqual({
      target: 4,
      attended: 0,
      stepNumber: 0,
      status: 'NOT_STARTED',
    });
    expect(classifyStudentSessionProgress(2, 4)).toEqual({
      target: 4,
      attended: 2,
      stepNumber: 2,
      status: 'IN_PROGRESS',
    });
    expect(classifyStudentSessionProgress(3, 4)).toEqual({
      target: 4,
      attended: 3,
      stepNumber: 3,
      status: 'NEAR_LAST',
    });
    expect(classifyStudentSessionProgress(4, 4)).toEqual({
      target: 4,
      attended: 4,
      stepNumber: 4,
      status: 'LAST_OR_DONE',
    });
    expect(classifyStudentSessionProgress(5, 4)).toEqual({
      target: 4,
      attended: 5,
      stepNumber: 4,
      status: 'LAST_OR_DONE',
    });
  });

  it('groups enrollments cleanly by targetSessions track with per-step counts and student sorting', () => {
    const summary = buildSessionProgressSummary([
      {
        enrollmentId: 'e1',
        studentId: 's1',
        studentName: 'أحمد علي',
        studentCode: 'ST-001',
        studentPhone: '0100000001',
        groupId: 'g1',
        groupName: 'فيزياء - مجموعة 4 حصص',
        groupCode: 'G-01',
        subject: 'فيزياء',
        targetSessions: 4,
        attendedSessions: 3,
        remainingBalance: '100.00',
      },
      {
        enrollmentId: 'e2',
        studentId: 's2',
        studentName: 'سارة محمود',
        studentCode: 'ST-002',
        studentPhone: '0100000002',
        groupId: 'g1',
        groupName: 'فيزياء - مجموعة 4 حصص',
        groupCode: 'G-01',
        subject: 'فيزياء',
        targetSessions: 4,
        attendedSessions: 4,
        remainingBalance: '0.00',
      },
      {
        enrollmentId: 'e3',
        studentId: 's3',
        studentName: 'يوسف حسن',
        studentCode: 'ST-003',
        studentPhone: '0100000003',
        groupId: 'g1',
        groupName: 'فيزياء - مجموعة 4 حصص',
        groupCode: 'G-01',
        subject: 'فيزياء',
        targetSessions: 4,
        attendedSessions: 3,
        remainingBalance: '200.00',
      },
      {
        enrollmentId: 'e4',
        studentId: 's4',
        studentName: 'مريم عادل',
        studentCode: 'ST-004',
        studentPhone: '0100000004',
        groupId: 'g2',
        groupName: 'كيمياء - مجموعة 8 حصص',
        groupCode: 'G-02',
        subject: 'كيمياء',
        targetSessions: 8,
        attendedSessions: 7,
        remainingBalance: '150.00',
      },
    ]);

    expect(summary.totalTrackedEnrollments).toBe(4);
    expect(summary.nearLastTotalCount).toBe(3); // 2 students on 3/4 + 1 student on 7/8
    expect(summary.lastOrCompletedTotalCount).toBe(1); // 1 student on 4/4
    expect(summary.tracks).toHaveLength(2);

    const track4 = summary.tracks[0];
    expect(track4.targetSessions).toBe(4);
    expect(track4.nearLastCount).toBe(2);
    expect(track4.lastOrCompletedCount).toBe(1);
    expect(track4.steps).toEqual([
      { stepNumber: 1, label: 'الحصة 1', isNearLast: false, isLast: false, studentsCount: 0 },
      { stepNumber: 2, label: 'الحصة 2', isNearLast: false, isLast: false, studentsCount: 0 },
      { stepNumber: 3, label: 'الحصة 3 (قبل الأخيرة)', isNearLast: true, isLast: false, studentsCount: 2 },
      { stepNumber: 4, label: 'الحصة 4 (الأخيرة)', isNearLast: false, isLast: true, studentsCount: 1 },
    ]);

    const track8 = summary.tracks[1];
    expect(track8.targetSessions).toBe(8);
    expect(track8.nearLastCount).toBe(1);
    expect(track8.steps.find((s) => s.stepNumber === 7)?.isNearLast).toBe(true);
    expect(track8.steps.find((s) => s.stepNumber === 7)?.studentsCount).toBe(1);

    // LAST_OR_DONE sorted before NEAR_LAST
    expect(summary.students[0].studentId).toBe('s2');
    expect(summary.students[1].status).toBe('NEAR_LAST');
  });
});

