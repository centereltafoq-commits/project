import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { CalendarQuickSessionService } from './calendar-quick-session.service';
import { CalendarService } from './calendar.service';
import { CalendarEventsQueryDto } from './dto/calendar-query.dto';
import { QuickCalendarSessionDto } from './dto/quick-calendar-session.dto';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly quickSessionService: CalendarQuickSessionService,
  ) {}

  @Get('events')
  @RequirePermissions(PERMISSIONS.CALENDAR_VIEW)
  async getEvents(
    @Query() query: CalendarEventsQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.calendarService.getEvents(query, actor);
  }

  @Post('quick-session')
  @RequireAnyPermissions(
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.CLASSROOMS_MANAGE,
  )
  async saveQuickSession(
    @Body() dto: QuickCalendarSessionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quickSessionService.saveQuickSession(dto, actor);
  }
}
