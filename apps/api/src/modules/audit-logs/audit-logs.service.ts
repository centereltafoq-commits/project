import { Injectable } from '@nestjs/common';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsRepository, CreateAuditLogInput } from './audit-logs.repository';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AppLoggerService } from '../../common/logger/app-logger.service';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly repository: AuditLogsRepository,
    private readonly logger: AppLoggerService,
  ) {}

  async record(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.repository.insert(input);
    } catch (err) {
      this.logger.error(
        'Failed to persist audit log entry',
        err instanceof Error ? err.stack : undefined,
        { action: input.action, entityType: input.entityType },
      );
    }
  }

  async list(query: AuditLogQueryDto) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }
}

