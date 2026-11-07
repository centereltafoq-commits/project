import { Module } from '@nestjs/common';
import { BookingsConflictRepository } from './bookings-conflict.repository';
import { BookingsReviewService } from './bookings-review.service';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';
import { ScheduleConflictChecker } from './validators/schedule-conflict.checker';

@Module({
  controllers: [BookingsController],
  providers: [
    BookingsRepository,
    BookingsConflictRepository,
    ScheduleConflictChecker,
    BookingsService,
    BookingsReviewService,
  ],
  exports: [BookingsService, BookingsReviewService, ScheduleConflictChecker],
})
export class BookingsModule {}
