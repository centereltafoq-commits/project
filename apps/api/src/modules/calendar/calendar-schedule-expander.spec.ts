import { SessionStatus } from '@edu-center/shared';
import {
  expandAndMergeGroupScheduleEvents,
  resolveSessionVisualState,
} from './validators/calendar-schedule-expander.util';

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

  it('uses classroom from slot or group defaultClassroomId and marks visualState READY_SCHEDULED', () => {
    const result = expandAndMergeGroupScheduleEvents({
      fromDate: '2026-11-14',
      toDate: '2026-11-14',
      existingSessions: [],
      activeGroups: [
        {
          id: 'group-1',
          name: 'مجموعة الفيزياء',
          groupCode: 'GRP-101',
          subject: 'فيزياء',
          primaryTeacherId: 'teacher-1',
          teacherName: 'أ. أحمد علي',
          defaultClassroomId: 'room-2',
          scheduleSlots: [
            { dayOfWeek: 6, startTime: '16:00', endTime: '18:00', classroomId: 'room-1' },
          ],
        },
      ],
      classroomsMap,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      classroomId: 'room-1',
      classroomName: 'قاعة A',
      roomNumber: '101',
      visualState: 'READY_SCHEDULED',
      isVirtualSlot: true,
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
          startTime: '17:00',
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

  it('resolves visual state correctly across statuses', () => {
    expect(resolveSessionVisualState(SessionStatus.COMPLETED, null)).toBe('COMPLETED');
    expect(resolveSessionVisualState(SessionStatus.SCHEDULED, 'room-1')).toBe('READY_SCHEDULED');
    expect(resolveSessionVisualState(SessionStatus.SCHEDULED, null)).toBe('NEEDS_CLASSROOM');
  });
});
