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
  @RequireAnyPermissions(
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_CREATE,
    PERMISSIONS.BOOKINGS_APPROVE_ADMIN,
    PERMISSIONS.BOOKINGS_APPROVE_TEACHER,
  )
  async getLookups(@CurrentUser() actor: AuthenticatedUser) {
    return this.bookingsService.getLookups(actor);
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
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reviewService.getAvailableClassrooms(id, query, actor);
  }

  @Post(':id/review')
  @RequireAnyPermissions(
    PERMISSIONS.BOOKINGS_APPROVE_ADMIN,
    PERMISSIONS.BOOKINGS_APPROVE_TEACHER,
  )
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reviewService.review(id, dto, actor);
  }

  @Post(':id/cancel')
  @RequireAnyPermissions(
    PERMISSIONS.BOOKINGS_CREATE,
    PERMISSIONS.BOOKINGS_APPROVE_ADMIN,
    PERMISSIONS.BOOKINGS_APPROVE_TEACHER,
  )
  async cancelSingle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reviewService.cancelSingle(id, dto, actor);
  }

  @Post(':id/complete')
  @RequireAnyPermissions(
    PERMISSIONS.BOOKINGS_APPROVE_ADMIN,
    PERMISSIONS.BOOKINGS_APPROVE_TEACHER,
  )
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reviewService.complete(id, actor);
  }
}
