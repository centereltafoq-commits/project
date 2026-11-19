import { DrizzleDatabase } from '../database.module';
import { classroomMaintenances, teacherAvailability } from '../schemas';
import { seedUuid } from './seed-identity.data';
import { SeededCatalogContext } from './seed-operations.runner';

export async function seedMaintenanceAndAvailability(
  db: DrizzleDatabase,
  ctx: SeededCatalogContext,
): Promise<void> {
  const maintRoomId = ctx.classroomsByCode.get('R-105')!;
  const t1 = ctx.teachersByCode.get('TCH-2026')!;
  const t2 = ctx.teachersByCode.get('TCH-2041')!;
  const t3 = ctx.teachersByCode.get('TCH-2058')!;

  await db
    .insert(classroomMaintenances)
    .values({
      id: seedUuid('60', 1),
      classroomId: maintRoomId,
      startAt: new Date(Date.now() - 3600 * 1000 * 12),
      endAt: new Date(Date.now() + 3600 * 1000 * 72),
      reason: 'تحديث وحدات التكييف والإضاءة الصوتية',
    })
    .onConflictDoNothing({ target: classroomMaintenances.id });

  await db
    .insert(teacherAvailability)
    .values([
      { id: seedUuid('61', 1), teacherId: t1, dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
      { id: seedUuid('61', 2), teacherId: t2, dayOfWeek: 2, startTime: '15:00', endTime: '19:00' },
      { id: seedUuid('61', 3), teacherId: t3, dayOfWeek: 4, startTime: '13:00', endTime: '17:00' },
    ])
    .onConflictDoNothing({ target: teacherAvailability.id });
}

