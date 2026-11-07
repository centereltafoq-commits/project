import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateStudentDto,
  StudentProfileQueryDto,
  StudentQueryDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STUDENTS_VIEW)
  async list(@Query() query: StudentQueryDto) {
    return this.studentsService.list(query);
  }

  @Get(':id/profile')
  @RequirePermissions(PERMISSIONS.STUDENTS_VIEW)
  async getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StudentProfileQueryDto,
  ) {
    return this.studentsService.getProfile(id, query.yearMonth);
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
