import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertPayoutWithinRemainingBalance } from './money.util';

describe('assertPayoutWithinRemainingBalance', () => {
  it('allows payouts up to and including the remaining balance', () => {
    expect(() =>
      assertPayoutWithinRemainingBalance(
        { totalDues: '30.00', totalPaidOut: '0.00', isClosed: false },
        30,
      ),
    ).not.toThrow();
    expect(() =>
      assertPayoutWithinRemainingBalance(
        { totalDues: '60.00', totalPaidOut: '0.00', isClosed: false },
        60,
      ),
    ).not.toThrow();
  });

  it('rejects payouts exceeding remaining due balance', () => {
    expect(() =>
      assertPayoutWithinRemainingBalance(
        { totalDues: '30.00', totalPaidOut: '0.00', isClosed: false },
        31,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPayoutWithinRemainingBalance(
        { totalDues: '60.00', totalPaidOut: '0.00', isClosed: false },
        61,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects payout when no balance remains or month is closed', () => {
    expect(() =>
      assertPayoutWithinRemainingBalance(
        { totalDues: '30.00', totalPaidOut: '30.00', isClosed: false },
        1,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPayoutWithinRemainingBalance(undefined, 10),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPayoutWithinRemainingBalance(
        { totalDues: '100.00', totalPaidOut: '0.00', isClosed: true },
        50,
      ),
    ).toThrow(ConflictException);
  });
});
