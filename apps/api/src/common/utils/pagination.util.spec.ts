import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE } from '@edu-center/shared';
import { createPaginatedResult, normalizePagination } from './pagination.util';

describe('Pagination Utility (25 per page standard)', () => {
  it('defaults to page 1 and limit 25 when omitted', () => {
    const res = normalizePagination(undefined, undefined);
    expect(res).toEqual({ page: 1, limit: DEFAULT_PAGE_SIZE, offset: 0 });
    expect(res.limit).toBe(25);
  });

  it('calculates offset and caps max limit at 100', () => {
    expect(normalizePagination(3, 25)).toEqual({ page: 3, limit: 25, offset: 50 });
    expect(normalizePagination(2, 999)).toEqual({ page: 2, limit: 100, offset: 100 });
  });

  it('builds PaginatedResult metadata accurately', () => {
    const result = createPaginatedResult(['a', 'b'], 52, 2, 25);
    expect(result.meta).toEqual({
      page: 2,
      limit: 25,
      totalItems: 52,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });
});

