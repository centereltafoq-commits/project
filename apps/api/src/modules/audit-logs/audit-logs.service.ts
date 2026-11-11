import { Injectable } from '@nestjs/common';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsRepository, CreateAuditLogInput } from './audit-logs.repository';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { getActionArabicLabel, getEntityArabicLabel } from './audit-translations.util';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly repository: AuditLogsRepository,
    private readonly logger: AppLoggerService,
  ) {}

  async record(input: CreateAuditLogInput): Promise<void> {
    try {
      const actionAr = getActionArabicLabel(input.action);
      const entityTypeAr = getEntityArabicLabel(input.entityType);

      const metadataObj =
        typeof input.metadata === 'object' && input.metadata !== null && !Array.isArray(input.metadata)
          ? { ...(input.metadata as Record<string, unknown>) }
          : input.metadata != null
            ? { value: input.metadata }
            : {};

      const enrichedMetadata = {
        ...metadataObj,
        actionAr,
        entityTypeAr,
      };

      const resolvedActorName =
        input.actorName && input.actorName.trim() !== ''
          ? input.actorName.trim()
          : input.actorUserId
            ? null
            : 'النظام';

      await this.repository.insert({
        ...input,
        actorName: resolvedActorName ?? input.actorName ?? null,
        metadata: enrichedMetadata,
      });
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
    const enrichedRows = rows.map((r) => {
      const metadata =
        r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {};
      const actionAr =
        typeof metadata.actionAr === 'string' && metadata.actionAr.trim() !== ''
          ? metadata.actionAr
          : getActionArabicLabel(r.action);
      const entityTypeAr =
        typeof metadata.entityTypeAr === 'string' && metadata.entityTypeAr.trim() !== ''
          ? metadata.entityTypeAr
          : getEntityArabicLabel(r.entityType);

      return {
        ...r,
        actionAr,
        entityTypeAr,
        actorName: r.actorName || 'النظام',
      };
    });
    return createPaginatedResult(enrichedRows, total, page, limit);
  }
}


