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
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BookingsReviewService } from './bookings-review.service';
import { BookingsService } from './bookings.service';
import {
  AvailableClassroomsQueryDto,
  BookingQueryDto,
  CancelBookingDto,
  CreateBookingDto,
  CreateBookingSeriesDto,
  ReviewBookingDto,
} from './dto/booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly reviewService: BookingsReviewService,
  ) {}

  @Get('lookups')
  @RequirePermissions(PERMISSIONS.BOOKINGS_VIEW)
  async getLookups() {
    return this.bookingsService.getLookups();
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BOOKINGS_VIEW)
  async list(@Query() query: BookingQueryDto) {
    return this.bookingsService.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BOOKINGS_CREATE)
  async createOneTime(
    @Body() dto: CreateBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookingsService.createOneTime(dto, actor);
  }

  @Post('series')
  @RequirePermissions(PERMISSIONS.BOOKINGS_CREATE)
  async createSeries(
    @Body() dto: CreateBookingSeriesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookingsService.createSeries(dto, actor);
  }

  @Get(':id/available-classrooms')
  @RequirePermissions(PERMISSIONS.BOOKINGS_VIEW)
  async getAvailableClassrooms(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailableClassroomsQueryDto,
  ) {
    return this.reviewService.getAvailableClassrooms(id, query);
  }

  @Post(':id/review')
  @RequirePermissions(PERMISSIONS.BOOKINGS_VIEW)
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reviewService.review(id, dto, actor);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.BOOKINGS_CREATE)
  async cancelSingle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reviewService.cancelSingle(id, dto, actor);
  }

  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.BOOKINGS_VIEW)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reviewService.complete(id, actor);
  }
}
