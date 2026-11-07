import { sql } from 'drizzle-orm';
import { DrizzleDatabase } from '../../database/database.module';
import { DashboardClassroomLiveItem, DashboardClassroomsSummary } from './dashboard.types';

export async function queryClassroomsLiveSnapshot(
  db: DrizzleDatabase,
  todayDate: string,
  currentTime: string,
): Promise<{
  classroomsLive: DashboardClassroomLiveItem[];
  classroomsSummary: DashboardClassroomsSummary;
}> {
  const res = await db.execute<{
    id: string;
    roomNumber: string;
    name: string;
    maxCapacity: number;
    status: string;
    inMaintenanceNow: boolean;
    activeSessionTitle: string | null;
    activeBookingTitle: string | null;
  }>(sql`
    SELECT
      c.id,
      c.room_number AS "roomNumber",
      c.name,
      c.max_capacity AS "maxCapacity",
      c.status,
      EXISTS (
        SELECT 1 FROM classroom_maintenances cm
        WHERE cm.classroom_id = c.id AND NOW() BETWEEN cm.start_at AND cm.end_at
      ) AS "inMaintenanceNow",
      (
        SELECT g.name FROM sessions s
        INNER JOIN groups g ON g.id = s.group_id
        WHERE s.classroom_id = c.id
          AND s.session_date = ${todayDate}
          AND s.status != 'CANCELLED'
          AND s.start_time <= ${currentTime}
          AND s.end_time > ${currentTime}
        LIMIT 1
      ) AS "activeSessionTitle",
      (
        SELECT cb.title FROM classroom_bookings cb
        WHERE cb.classroom_id = c.id
          AND cb.booking_date = ${todayDate}
          AND cb.status = 'CONFIRMED'
          AND cb.start_time <= ${currentTime}
          AND cb.end_time > ${currentTime}
        LIMIT 1
      ) AS "activeBookingTitle"
    FROM classrooms c
    ORDER BY c.room_number ASC
  `);

  const classroomsLive: DashboardClassroomLiveItem[] = res.rows.map((c) => {
    const occupantTitle = c.activeSessionTitle || c.activeBookingTitle || null;
    let liveState: DashboardClassroomLiveItem['liveState'] = 'AVAILABLE';
    if (c.status === 'INACTIVE') {
      liveState = 'INACTIVE';
    } else if (c.status === 'MAINTENANCE' || c.inMaintenanceNow) {
      liveState = 'MAINTENANCE';
    } else if (occupantTitle) {
      liveState = 'OCCUPIED';
    }
    return {
      id: c.id,
      roomNumber: c.roomNumber,
      name: c.name,
      maxCapacity: c.maxCapacity,
      liveState,
      occupantTitle,
    };
  });

  const classroomsSummary: DashboardClassroomsSummary = {
    total: classroomsLive.length,
    availableNow: classroomsLive.filter((c) => c.liveState === 'AVAILABLE').length,
    occupiedNow: classroomsLive.filter((c) => c.liveState === 'OCCUPIED').length,
    maintenance: classroomsLive.filter((c) => c.liveState === 'MAINTENANCE').length,
  };

  return { classroomsLive, classroomsSummary };
}
