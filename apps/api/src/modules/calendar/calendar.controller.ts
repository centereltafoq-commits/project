import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CalendarService } from './calendar.service';
import { CalendarEventsQueryDto } from './dto/calendar-query.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @RequirePermissions(PERMISSIONS.CALENDAR_VIEW)
  async getEvents(@Query() query: CalendarEventsQueryDto) {
    return this.calendarService.getEvents(query);
  }
}
