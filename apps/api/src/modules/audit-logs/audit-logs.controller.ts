import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditRollbackService } from './audit-rollback.service';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { RollbackAuditLogDto } from './dto/rollback-audit-log.dto';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly rollbackService: AuditRollbackService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async list(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.list(query);
  }

  @Get(':id/rollback-preview')
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async getRollbackPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rollbackService.previewRollback(id, actor);
  }

  @Post(':id/rollback')
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  async executeRollback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RollbackAuditLogDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rollbackService.executeRollback(id, dto.reason, actor);
  }
}

