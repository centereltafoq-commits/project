import { describe, expect, it } from 'vitest';
import {
  findClassroomConflictReason,
  getEventVisualStyle,
  resolveEventVisualState,
  UnifiedCalendarEvent,
} from './calendar.types';

describe('calendar helpers', () => {
  const baseEvent: UnifiedCalendarEvent = {
    id: 'slot-g1-2026-11-14-16:00',
    sourceId: 'g1',
    category: 'GROUP_SESSION',
    date: '2026-11-14',
    startTime: '16:00',
    endTime: '18:00',
    title: 'مجموعة الفيزياء',
    subtitle: 'أ. أحمد',
    status: 'SCHEDULED',
    groupId: 'g1',
    groupName: 'مجموعة الفيزياء',
    classroomId: null,
  };

  it('resolves NEEDS_CLASSROOM, READY_SCHEDULED, and COMPLETED visual states cleanly', () => {
    expect(resolveEventVisualState(baseEvent)).toBe('NEEDS_CLASSROOM');
    expect(getEventVisualStyle(baseEvent).badgeLabel).toBe('اختر القاعة');

    const assigned = { ...baseEvent, classroomId: 'room-1' };
    expect(resolveEventVisualState(assigned)).toBe('READY_SCHEDULED');
    expect(getEventVisualStyle(assigned).badgeLabel).toBe('مجدولة بقاعة');

    const completed = { ...assigned, status: 'COMPLETED' };
    expect(resolveEventVisualState(completed)).toBe('COMPLETED');
    expect(getEventVisualStyle(completed).badgeLabel).toBe('تم الحضور ✓');
  });

  it('detects overlapping group session conflict in a classroom', () => {
    const otherEvent: UnifiedCalendarEvent = {
      id: 'session-s2',
      sourceId: 's2',
      category: 'GROUP_SESSION',
      date: '2026-11-14',
      startTime: '17:00',
      endTime: '19:00',
      title: 'مجموعة الكيمياء',
      subtitle: 'أ. خالد',
      status: 'SCHEDULED',
      groupId: 'g2',
      groupName: 'مجموعة الكيمياء',
      classroomId: 'room-1',
    };

    const conflict = findClassroomConflictReason({
      room: { id: 'room-1', roomNumber: '101', name: 'قاعة A', maxCapacity: 30, status: 'AVAILABLE' },
      dayEvents: [baseEvent, otherEvent],
      currentEventId: baseEvent.id,
      startTime: '16:00',
      endTime: '18:00',
    });

    expect(conflict).toContain('مشغولة: مجموعة الكيمياء');

    const noConflict = findClassroomConflictReason({
      room: { id: 'room-2', roomNumber: '102', name: 'قاعة B', maxCapacity: 30, status: 'AVAILABLE' },
      dayEvents: [baseEvent, otherEvent],
      currentEventId: baseEvent.id,
      startTime: '16:00',
      endTime: '18:00',
    });

    expect(noConflict).toBeNull();
  });
});
