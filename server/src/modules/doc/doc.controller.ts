import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DocService } from './doc.service';
import {
  AuditDocDto,
  BatchAuditDto,
  BatchDeleteDto,
  CreateDocDto,
  QueryDocDto,
  UpdateDocDto,
} from './doc.dto';

@ApiTags('文档管理')
@ApiBearerAuth()
@Controller('doc')
export class DocController {
  constructor(private readonly docService: DocService) {}

  @Get('stats')
  @ApiOperation({ summary: '文档统计信息' })
  stats() {
    return this.docService.getStats();
  }

  @Get('list')
  @ApiOperation({ summary: '文档列表（分页 + 筛选）' })
  list(@Query() query: QueryDocDto) {
    return this.docService.list(query);
  }

  @Roles('admin')
  @Delete('batch')
  @ApiOperation({ summary: '批量删除文档' })
  batchDelete(@Body() dto: BatchDeleteDto) {
    return this.docService.batchDelete(dto.ids);
  }

  @Roles('admin')
  @Put('batch/audit')
  @ApiOperation({ summary: '批量审核文档' })
  batchAudit(@Body() dto: BatchAuditDto, @CurrentUser() user: JwtPayload) {
    return this.docService.batchAudit(dto, user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '文档详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.docService.detail(id);
  }

  @Post()
  @ApiOperation({ summary: '新增文档' })
  create(@Body() dto: CreateDocDto, @CurrentUser() user: JwtPayload) {
    return this.docService.create(dto, user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑文档' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.docService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文档（软删除）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.docService.remove(id);
  }

  @Roles('admin')
  @Put(':id/audit')
  @ApiOperation({ summary: '审核文档' })
  audit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AuditDocDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.docService.audit(id, dto, user.userId);
  }
}
