import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import {
  CreateStudentDto,
  StudentProfileQueryDto,
  StudentQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';
import {
  StudentExcelCommitDto,
  StudentExcelImportOptionsDto,
  StudentExportQueryDto,
} from './dto/student-excel.dto';
import { StudentsExcelService } from './students-excel.service';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentsExcelService: StudentsExcelService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_VIEW)
  async list(@Query() query: StudentQueryDto) {
    return this.studentsService.list(query);
  }

  @Get('import/template')
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.studentsExcelService.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="students-import-template.xlsx"');
    res.send(buffer);
  }

  @Post('import/preview')
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async previewImport(
    @UploadedFile() file: UploadedMulterFile,
    @Body() dto: StudentExcelImportOptionsDto,
  ) {
    return this.studentsExcelService.previewImport(file, dto);
  }

  @Post('import/commit')
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async commitImport(
    @UploadedFile() file: UploadedMulterFile,
    @Body() dto: StudentExcelCommitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.studentsExcelService.commitImport(file, dto, actor);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.REPORTS_EXPORT)
  async exportExcel(@Query() query: StudentExportQueryDto, @Res() res: Response) {
    const { buffer, filename } = await this.studentsExcelService.exportExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id/profile')
  @RequirePermissions(PERMISSIONS.STUDENTS_VIEW)
  async getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StudentProfileQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.studentsService.getProfile(id, query.yearMonth, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_VIEW)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STUDENTS_CREATE)
  async create(@Body() dto: CreateStudentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.studentsService.create(dto, actor);
  }

  @Patch(':id/archive')
  @RequirePermissions(PERMISSIONS.STUDENTS_ARCHIVE)
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.studentsService.archive(id, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STUDENTS_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.studentsService.update(id, dto, actor);
  }
}
