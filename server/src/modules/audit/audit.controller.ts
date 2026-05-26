import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../common/dto/api-response';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditLogEntity } from '../../entities/audit-log.entity';

@ApiTags('审计日志')
@ApiBearerAuth()
@Roles('admin')
@Controller('audit')
export class AuditController {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  @Get('logs')
  @ApiOperation({ summary: '操作审计日志（分页）' })
  async list(@Query() query: PaginationDto) {
    const [list, total] = await this.auditRepo.findAndCount({
      order: { createTime: 'DESC' },
      skip: query.skip,
      take: query.take,
    });
    return ApiResponse.page(list, total, query.page ?? 1, query.pageSize ?? 20);
  }
}
