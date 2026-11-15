import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AttendanceStatus,
  PERMISSIONS,
  SessionStatus,
  StudentStatus,
  SystemRole,
} from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import { StudentsRepository } from '../students/students.repository';
import { StudentsService } from '../students/students.service';
import { StudentMonthOverviewItem } from '../students/students-months-overview.builder';
import { AttendanceRepository } from './attendance.repository';
import { QrCheckInDto } from './dto/qr-attendance.dto';
import { SessionSheetRepository } from './session-sheet.repository';

export interface QrTodaySessionCandidate {
  sessionId: string | null;
  groupId: string;
  groupCode: string;
  groupName: string;
  subject: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  roomNumber: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  sessionStatus: string;
  attendanceStatus: string | null;
  isVirtualSlot: boolean;
  isScheduledToday: boolean;
}

export interface QrPaymentGateSummary {
  isBlocked: boolean;
  totalRemaining: number;
  unpaidMonthsCount: number;
  unpaidMonths: Array<{
    yearMonth: string;
    paymentStatus: StudentMonthOverviewItem['paymentStatus'];
    totalDue: number;
    totalPaid: number;
    remaining: number;
  }>;
}

export function normalizeScannedStudentCode(rawCode: string): string {
  const trimmed = String(rawCode || '').trim();
  if (!trimmed) return '';
  if (trimmed.toUpperCase().startsWith('EDU:')) {
    return trimmed.slice(4).trim();
  }
  return trimmed;
}

function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function buildStudentPaymentGate(
  monthsOverview: StudentMonthOverviewItem[],
): QrPaymentGateSummary {
  const unpaidMonths = monthsOverview
    .filter((m) => Number(m.remaining || 0) > 0.009)
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
    .map((m) => ({
      yearMonth: m.yearMonth,
      paymentStatus: m.paymentStatus,
      totalDue: round2(m.totalDue),
      totalPaid: round2(m.totalPaid),
      remaining: round2(m.remaining),
    }));

  const totalRemaining = round2(unpaidMonths.reduce((sum, m) => sum + m.remaining, 0));

  return {
    isBlocked: totalRemaining > 0.009,
    totalRemaining,
    unpaidMonthsCount: unpaidMonths.length,
    unpaidMonths,
  };
}

@Injectable()
export class AttendanceQrService {
  constructor(
    private readonly studentsRepository: StudentsRepository,
    private readonly studentsService: StudentsService,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly sheetRepository: SessionSheetRepository,
    private readonly audit: AuditLogsService,
    private readonly cache: CacheService,
    @Optional() private readonly settlementService?: MonthlySettlementService,
  ) {}

  async lookupStudentByQr(
    rawCode: string,
    requestedDate?: string,
    actor?: AuthenticatedUser,
  ) {
    const normalizedCode = normalizeScannedStudentCode(rawCode);
    if (!normalizedCode) {
      throw new BadRequestException('يرجى مسح كود QR أو إدخال كود الطالب');
    }

    const student = await this.studentsRepository.findByCodeOrId(normalizedCode);
    if (!student) {
      throw new NotFoundException(`لم يتم العثور على طالب بالكود: ${normalizedCode}`);
    }

    const todayDate = requestedDate || this.formatIsoDate(new Date());
    const targetYearMonth = todayDate.slice(0, 7);

    // Fetch authoritative unmasked profile internally to evaluate mandatory payment gate
    const fullProfile = await this.studentsService.getProfile(student.id, targetYearMonth);
    const monthsOverview = fullProfile.monthsOverview ?? [];
    const rawGate = buildStudentPaymentGate(monthsOverview);

    const isOwner = !actor || actor.roleCode === SystemRole.OWNER;
    const perms = actor?.permissions ?? [];
    const canSeeAmounts =
      isOwner ||
      perms.includes(PERMISSIONS.FINANCE_VIEW) ||
      perms.includes(PERMISSIONS.FINANCE_COLLECT_PAYMENT);

    const sanitizedMonthsOverview = canSeeAmounts
      ? monthsOverview
      : monthsOverview.map((m) => ({
          ...m,
          totalDue: 0,
          totalPaid: 0,
          remaining: 0,
          paymentsCount: 0,
        }));

    const sanitizedPaymentGate: QrPaymentGateSummary = canSeeAmounts
      ? rawGate
      : {
          ...rawGate,
          totalRemaining: 0,
          unpaidMonths: rawGate.unpaidMonths.map((u) => ({
            ...u,
            totalDue: 0,
            totalPaid: 0,
            remaining: 0,
          })),
        };

    const todaySessions = await this.buildTodaySessionCandidates(student.id, todayDate);

    return {
      todayDate,
      canSeeAmounts,
      student: {
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        phone: student.phone,
        guardianPhone: student.guardianPhone,
        gradeLevel: student.gradeLevel,
        status: student.status,
        registrationDate: student.registrationDate,
      },
      paymentGate: sanitizedPaymentGate,
      monthsOverview: sanitizedMonthsOverview,
      enrollments: fullProfile.enrollments,
      monthlyBreakdown: canSeeAmounts
        ? fullProfile.monthlyBreakdown
        : fullProfile.monthlyBreakdown.map((g) => ({
            ...g,
            sessionPrice: 0,
            totalDue: 0,
            totalPaid: 0,
            remaining: 0,
          })),
      todaySessions,
    };
  }

  async checkInStudentByQr(dto: QrCheckInDto, actor: AuthenticatedUser) {
    const todayDate = dto.sessionDate || this.formatIsoDate(new Date());
    const targetYearMonth = todayDate.slice(0, 7);

    const student = await this.studentsRepository.findById(dto.studentId);
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }
    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('لا يمكن تسجيل حضور طالب غير نشط أو مؤرشف');
    }

    // Strict server-side mandatory payment check
    const fullProfile = await this.studentsService.getProfile(student.id, targetYearMonth);
    const gate = buildStudentPaymentGate(fullProfile.monthsOverview ?? []);
    if (gate.isBlocked) {
      const unpaidList = gate.unpaidMonths.map((m) => m.yearMonth).join('، ');
      throw new BadRequestException(
        `ممنوع تسجيل الحضور: الطالب (${student.fullName}) عليه مستحقات متأخرة بقيمة ${gate.totalRemaining} ج.م عن (${unpaidList}). يجب السداد أولاً.`,
      );
    }

    if (!dto.sessionId && !dto.groupId) {
      throw new BadRequestException('يرجى تحديد الحصة أو المجموعة لتسجيل حضور الطالب');
    }

    const session = await this.resolveOrCreateTargetSession(dto, student.id, todayDate, actor);

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('لا يمكن تسجيل حضور لحصة ملغاة');
    }

    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(session.yearMonth);
    }

    const existingMap = await this.sheetRepository.findExistingAttendanceMap(session.id);
    const prev = existingMap.get(student.id);

    if (prev && prev.status === AttendanceStatus.PRESENT) {
      return {
        success: true,
        alreadyCheckedIn: true,
        sessionId: session.id,
        groupId: session.groupId,
        groupName: session.groupName,
        sessionDate: session.sessionDate,
        attendanceStatus: AttendanceStatus.PRESENT,
        studentName: student.fullName,
      };
    }

    const canOverride =
      actor.roleCode === SystemRole.OWNER ||
      actor.permissions.includes(PERMISSIONS.ATTENDANCE_OVERRIDE);

    if (prev && prev.status !== AttendanceStatus.PRESENT && !canOverride) {
      throw new ForbiddenException('تعديل حالة حضور مسجلة مسبقاً يتطلب صلاحية إدارية');
    }

    const noteText = 'حضور عبر بوابة الـ QR';
    await this.sheetRepository.upsertSessionAttendance({
      sessionId: session.id,
      actorUserId: actor.id,
      inserts: prev
        ? []
        : [{ studentId: student.id, status: AttendanceStatus.PRESENT, notes: noteText }],
      updates: prev
        ? [{ studentId: student.id, status: AttendanceStatus.PRESENT, notes: noteText }]
        : [],
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: prev ? 'QR_CHECK_IN_OVERRIDE' : 'QR_CHECK_IN',
      entityType: 'SESSION',
      entityId: session.id,
      ...(prev ? { beforeData: { status: prev.status } } : {}),
      afterData: {
        studentId: student.id,
        studentCode: student.studentCode,
        groupId: session.groupId,
        status: AttendanceStatus.PRESENT,
      },
    });

    if (this.settlementService) {
      await this.settlementService.recalculateMonth(session.yearMonth);
    }

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return {
      success: true,
      alreadyCheckedIn: false,
      sessionId: session.id,
      groupId: session.groupId,
      groupName: session.groupName,
      sessionDate: session.sessionDate,
      attendanceStatus: AttendanceStatus.PRESENT,
      studentName: student.fullName,
    };
  }

  private async resolveOrCreateTargetSession(
    dto: QrCheckInDto,
    studentId: string,
    todayDate: string,
    actor: AuthenticatedUser,
  ) {
    if (dto.sessionId) {
      const existing = await this.attendanceRepository.findSessionById(dto.sessionId);
      if (!existing) {
        throw new NotFoundException('الحصة المطلوبة غير موجودة');
      }
      return existing;
    }

    const groupId = dto.groupId!;
    const activeGroups = await this.attendanceRepository.findStudentActiveGroupsForDate(
      studentId,
      todayDate,
    );
    const enrolledGroup = activeGroups.find((g) => g.groupId === groupId);
    if (!enrolledGroup) {
      throw new BadRequestException('الطالب غير مشترك بشكل نشط في هذه المجموعة');
    }

    const existingSessions =
      await this.attendanceRepository.findSessionsByGroupsAndDateForStudent(
        [groupId],
        studentId,
        todayDate,
      );
    if (existingSessions.length > 0) {
      const first = existingSessions[0]!;
      return {
        id: first.sessionId,
        groupId: first.groupId,
        groupName: first.groupName,
        sessionDate: first.sessionDate,
        yearMonth: first.yearMonth,
        status: first.sessionStatus,
      };
    }

    const yearMonth = todayDate.slice(0, 7);
    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(yearMonth);
    }

    const dayOfWeek = this.getDayOfWeek(todayDate);
    const matchingSlot = (enrolledGroup.scheduleSlots ?? []).find(
      (s) => Number(s.dayOfWeek) === dayOfWeek,
    );
    const startTime = dto.startTime ?? matchingSlot?.startTime ?? '16:00';
    const endTime = dto.endTime ?? matchingSlot?.endTime ?? '18:00';
    const classroomId = matchingSlot?.classroomId ?? enrolledGroup.defaultClassroomId ?? null;

    const created = await this.attendanceRepository.createSession({
      groupId,
      teacherId: enrolledGroup.primaryTeacherId,
      classroomId,
      sessionDate: todayDate,
      yearMonth,
      startTime,
      endTime,
      status: SessionStatus.COMPLETED,
      topic: 'حصة مفتوحة ببوابة حضور الـ QR',
    });

    return {
      id: created.id,
      groupId: created.groupId,
      groupName: enrolledGroup.groupName,
      sessionDate: created.sessionDate,
      yearMonth: created.yearMonth,
      status: created.status,
    };
  }

  private async buildTodaySessionCandidates(
    studentId: string,
    todayDate: string,
  ): Promise<QrTodaySessionCandidate[]> {
    const activeGroups = await this.attendanceRepository.findStudentActiveGroupsForDate(
      studentId,
      todayDate,
    );
    const groupIds = activeGroups.map((g) => g.groupId);
    const existingSessions =
      await this.attendanceRepository.findSessionsByGroupsAndDateForStudent(
        groupIds,
        studentId,
        todayDate,
      );

    const existingGroupIds = new Set(existingSessions.map((s) => s.groupId));
    const dayOfWeek = this.getDayOfWeek(todayDate);

    const realCandidates: QrTodaySessionCandidate[] = existingSessions.map((s) => ({
      sessionId: s.sessionId,
      groupId: s.groupId,
      groupCode: s.groupCode,
      groupName: s.groupName,
      subject: s.subject,
      teacherName: s.teacherName,
      classroomId: s.classroomId,
      classroomName: s.classroomName,
      roomNumber: s.roomNumber,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      sessionStatus: s.sessionStatus,
      attendanceStatus: s.attendanceStatus ?? null,
      isVirtualSlot: false,
      isScheduledToday: true,
    }));

    const virtualCandidates: QrTodaySessionCandidate[] = activeGroups
      .filter((g) => !existingGroupIds.has(g.groupId))
      .map((g) => {
        const slot = (g.scheduleSlots ?? []).find((sl) => Number(sl.dayOfWeek) === dayOfWeek);
        return {
          sessionId: null,
          groupId: g.groupId,
          groupCode: g.groupCode,
          groupName: g.groupName,
          subject: g.subject,
          teacherName: g.teacherName,
          classroomId: slot?.classroomId ?? g.defaultClassroomId,
          classroomName: g.classroomName,
          roomNumber: g.roomNumber,
          sessionDate: todayDate,
          startTime: slot?.startTime ?? '16:00',
          endTime: slot?.endTime ?? '18:00',
          sessionStatus: 'NOT_OPENED',
          attendanceStatus: null,
          isVirtualSlot: true,
          isScheduledToday: Boolean(slot),
        };
      })
      .sort((a, b) => Number(b.isScheduledToday) - Number(a.isScheduledToday));

    return [...realCandidates, ...virtualCandidates];
  }

  private getDayOfWeek(isoDate: string): number {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y!, m! - 1, d!).getDay();
  }

  private formatIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
