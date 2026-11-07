import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AttendanceService } from './attendance.service';
import { RecordSessionAttendanceDto } from './dto/attendance-record.dto';
import { CreateMakeupDto, MakeupQueryDto, UpdateMakeupDto } from './dto/makeup.dto';
import {
  CreateSessionDto,
  GenerateMonthSessionsDto,
  SessionQueryDto,
} from './dto/session.dto';
import { MakeupsService } from './makeups.service';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly makeupsService: MakeupsService,
  ) {}

  @Get('lookups')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  async getLookups() {
    return this.attendanceService.getLookups();
  }

  @Get('sessions')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
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
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
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

  @Get('makeups')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  async listMakeups(@Query() query: MakeupQueryDto) {
    return this.makeupsService.listMakeups(query);
  }

  @Post('makeups')
  @RequirePermissions(PERMISSIONS.MAKEUP_MANAGE)
  async createMakeup(
    @Body() dto: CreateMakeupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.makeupsService.createMakeup(dto, actor);
  }

  @Patch('makeups/:id')
  @RequirePermissions(PERMISSIONS.MAKEUP_MANAGE)
  async updateMakeup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMakeupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.makeupsService.updateMakeup(id, dto, actor);
  }
}
