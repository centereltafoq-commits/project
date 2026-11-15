import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { AttendanceQrService } from './attendance-qr.service';
import { AttendanceService } from './attendance.service';
import { RecordSessionAttendanceDto } from './dto/attendance-record.dto';
import { QrCheckInDto, QrLookupQueryDto } from './dto/qr-attendance.dto';
import {
  CreateSessionDto,
  GenerateMonthSessionsDto,
  SessionQueryDto,
} from './dto/session.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly attendanceQrService: AttendanceQrService,
  ) {}

  @Get('qr/lookup')
  @RequireAnyPermissions(
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.SESSIONS_VIEW,
  )
  async lookupStudentByQr(
    @Query() query: QrLookupQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendanceQrService.lookupStudentByQr(query.code, query.sessionDate, actor);
  }

  @Post('qr/check-in')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_RECORD)
  async checkInStudentByQr(
    @Body() dto: QrCheckInDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendanceQrService.checkInStudentByQr(dto, actor);
  }

  @Get('lookups')
  @RequireAnyPermissions(
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.SESSIONS_VIEW,
    PERMISSIONS.SESSIONS_MANAGE,
  )
  async getLookups(@CurrentUser() actor: AuthenticatedUser) {
    return this.attendanceService.getLookups(actor);
  }

  @Get('sessions')
  @RequireAnyPermissions(PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.SESSIONS_VIEW)
  async listSessions(@Query() query: SessionQueryDto) {
    return this.attendanceService.listSessions(query);
  }

  @Post('sessions')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendanceService.createSession(dto, actor);
  }

  @Post('sessions/generate-month')
  @RequirePermissions(PERMISSIONS.SESSIONS_MANAGE)
  async generateMonthSessions(
    @Body() dto: GenerateMonthSessionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendanceService.generateMonthSessions(dto, actor);
  }

  @Get('sessions/:sessionId/sheet')
  @RequireAnyPermissions(PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.SESSIONS_VIEW)
  async getSessionSheet(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.attendanceService.getSessionSheet(sessionId);
  }

  @Post('sessions/:sessionId/record')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_RECORD)
  async recordSessionAttendance(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RecordSessionAttendanceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendanceService.recordSessionAttendance(sessionId, dto, actor);
  }

  @Post('sessions/:sessionId/complete-group')
  @RequireAnyPermissions(PERMISSIONS.ATTENDANCE_RECORD, PERMISSIONS.SESSIONS_MANAGE)
  async completeGroupSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.attendanceService.completeGroupSession(sessionId, actor);
  }
}
