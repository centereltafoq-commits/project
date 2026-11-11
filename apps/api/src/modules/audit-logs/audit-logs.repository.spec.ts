import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogsRepository } from './audit-logs.repository';

describe('AuditLogsRepository', () => {
  let repository: AuditLogsRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
    };

    repository = new AuditLogsRepository(mockDb);
  });

  describe('insert', () => {
    it('inserts audit log entry with fallback nulls', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({ values: mockValues });

      await repository.insert({
        action: 'CREATE_STUDENT',
        entityType: 'STUDENT',
        actorUserId: 'user-1',
        actorName: 'سارة',
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_STUDENT',
          entityType: 'STUDENT',
          actorUserId: 'user-1',
          actorName: 'سارة',
        }),
      );
    });
  });

  describe('findPaginated', () => {
    it('executes paginated query with left join on users', async () => {
      const mockRows = [
        {
          id: 'log-1',
          actorUserId: 'user-1',
          actorName: 'سارة أحمد',
          action: 'CREATE_STUDENT',
          entityType: 'STUDENT',
          entityId: 'stu-1',
          createdAt: new Date(),
        },
      ];

      const mockOffset = vi.fn().mockResolvedValue(mockRows);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

      const mockCountWhere = vi.fn().mockResolvedValue([{ total: 1 }]);
      const mockCountLeftJoin = vi.fn().mockReturnValue({ where: mockCountWhere });
      const mockCountFrom = vi.fn().mockReturnValue({ leftJoin: mockCountLeftJoin });

      mockDb.select.mockImplementation((fields?: any) => {
        if (fields && fields.total) {
          return { from: mockCountFrom };
        }
        return { from: mockFrom };
      });

      const result = await repository.findPaginated({
        page: 1,
        limit: 10,
        entityType: 'PAYOUT',
        search: 'سارة',
      });

      expect(mockDb.select).toHaveBeenCalled();
      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
