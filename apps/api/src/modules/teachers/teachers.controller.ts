import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import {
  CreateTeacherDto,
  TeacherProfileQueryDto,
  TeacherQueryDto,
  UpdateTeacherAvailabilityDto,
  UpdateTeacherDto,
} from './dto/teacher.dto';
import {
  TeacherExcelCommitDto,
  TeacherExcelImportOptionsDto,
  TeacherExportQueryDto,
} from './dto/teacher-excel.dto';
import { TeachersExcelService } from './teachers-excel.service';
import { TeachersService } from './teachers.service';

@Controller('teachers')
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly teachersExcelService: TeachersExcelService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW)
  async list(@Query() query: TeacherQueryDto) {
    return this.teachersService.list(query);
  }

  @Get('import/template')
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.teachersExcelService.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="teachers-import-template.xlsx"');
    res.send(buffer);
  }

  @Post('import/preview')
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async previewImport(
    @UploadedFile() file: UploadedMulterFile,
    @Body() dto: TeacherExcelImportOptionsDto,
  ) {
    return this.teachersExcelService.previewImport(file, dto);
  }

  @Post('import/commit')
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async commitImport(
    @UploadedFile() file: UploadedMulterFile,
    @Body() dto: TeacherExcelCommitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.teachersExcelService.commitImport(file, dto, actor);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.REPORTS_EXPORT)
  async exportExcel(@Query() query: TeacherExportQueryDto, @Res() res: Response) {
    const { buffer, filename } = await this.teachersExcelService.exportExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('me/profile')
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW_OWN)
  async getOwnProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: TeacherProfileQueryDto,
  ) {
    return this.teachersService.getOwnProfile(actor.id, query.yearMonth);
  }

  @Get(':id/profile')
  @RequireAnyPermissions(PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN)
  async getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TeacherProfileQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.teachersService.getProfile(id, query.yearMonth, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  async create(@Body() dto: CreateTeacherDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.teachersService.create(dto, actor);
  }

  @Put(':id/availability')
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherAvailabilityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.teachersService.updateAvailability(id, dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.teachersService.update(id, dto, actor);
  }
}
