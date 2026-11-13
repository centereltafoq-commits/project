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
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import type { UploadedMulterFile } from '../../common/types/multer.types';
import { CreateGroupDto, GroupQueryDto, UpdateGroupDto } from './dto/group.dto';
import {
  GroupExcelCommitDto,
  GroupExcelImportOptionsDto,
  GroupExportQueryDto,
} from './dto/group-excel.dto';
import {
  CreateEnrollmentDto,
  EnrollmentQueryDto,
  UpdateEnrollmentDto,
} from './dto/enrollment.dto';
import { GroupsService } from './groups.service';
import { GroupsExcelService } from './groups-excel.service';
import { EnrollmentsService } from './enrollments.service';

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly groupsExcelService: GroupsExcelService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GROUPS_VIEW)
  async list(
    @Query() query: GroupQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groupsService.list(query, actor);
  }

  @Get('lookups')
  @RequireAnyPermissions(
    PERMISSIONS.GROUPS_VIEW,
    PERMISSIONS.GROUPS_MANAGE,
    PERMISSIONS.ENROLLMENTS_MANAGE,
  )
  async getLookups(@CurrentUser() actor: AuthenticatedUser) {
    return this.groupsService.getLookups(actor);
  }

  @Get('import/template')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.groupsExcelService.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="groups-import-template.xlsx"');
    res.send(buffer);
  }

  @Post('import/preview')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async previewImport(
    @UploadedFile() file: UploadedMulterFile,
    @Body() dto: GroupExcelImportOptionsDto,
  ) {
    return this.groupsExcelService.previewImport(file, dto.duplicateStrategy);
  }

  @Post('import/commit')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async commitImport(
    @UploadedFile() file: UploadedMulterFile,
    @Body() dto: GroupExcelCommitDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groupsExcelService.commitImport(file, dto, actor);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.GROUPS_VIEW, PERMISSIONS.REPORTS_EXPORT)
  async exportExcel(
    @Query() query: GroupExportQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.groupsExcelService.exportExcel(query, actor);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Patch('enrollments/:enrollmentId')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_MANAGE)
  async updateEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.updateEnrollment(enrollmentId, dto, actor);
  }

  @Get(':groupId/enrollments')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_VIEW)
  async listEnrollments(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: EnrollmentQueryDto,
  ) {
    return this.enrollmentsService.listEnrollments(groupId, query);
  }

  @Post(':groupId/enrollments')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_MANAGE)
  async subscribeStudent(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateEnrollmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.subscribeStudent(groupId, dto, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_VIEW)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groupsService.getById(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async create(@Body() dto: CreateGroupDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.groupsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groupsService.update(id, dto, actor);
  }
}
