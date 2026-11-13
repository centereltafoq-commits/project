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
import { AttendanceService } from './attendance.service';
import { RecordSessionAttendanceDto } from './dto/attendance-record.dto';
import {
  CreateSessionDto,
  GenerateMonthSessionsDto,
  SessionQueryDto,
} from './dto/session.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

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
}
