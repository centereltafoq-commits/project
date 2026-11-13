import { Global, Module } from '@nestjs/common';
import { ExcelWorkbookService } from './excel-workbook.service';

@Global()
@Module({
  providers: [ExcelWorkbookService],
  exports: [ExcelWorkbookService],
})
export class ExcelModule {}

