import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  async log(
    userId: number,
    action: string,
    resourceType: string,
    resourceId: number,
    detail?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          userId,
          action,
          resourceType,
          resourceId,
          detail: detail?.slice(0, 500) ?? null,
          ipAddress: ipAddress ?? null,
        }),
      );
    } catch (err) {
      this.logger.error(`审计日志写入失败 action=${action}`, err);
    }
  }
}
