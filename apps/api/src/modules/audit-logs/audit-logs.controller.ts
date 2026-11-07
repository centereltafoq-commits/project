import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async list(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.list(query);
  }
}

