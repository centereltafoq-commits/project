import { Global, Module, forwardRef } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditRollbackRepository } from './audit-rollback.repository';
import { AuditRollbackService } from './audit-rollback.service';

@Global()
@Module({
  imports: [forwardRef(() => FinanceModule)],
  controllers: [AuditLogsController],
  providers: [
    AuditLogsRepository,
    AuditLogsService,
    AuditRollbackRepository,
    AuditRollbackService,
  ],
  exports: [AuditLogsService, AuditRollbackService],
})
export class AuditLogsModule {}

