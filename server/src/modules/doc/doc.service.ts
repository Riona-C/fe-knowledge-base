import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiResponse } from '../../common/dto/api-response';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import {
  AuditDocDto,
  BatchAuditDto,
  CreateDocDto,
  QueryDocDto,
  UpdateDocDto,
} from './doc.dto';

@Injectable()
export class DocService {
  constructor(
    @InjectRepository(DocIssueEntity)
    private readonly docRepo: Repository<DocIssueEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** 分页查询文档列表 */
  async list(query: QueryDocDto) {
    const qb = this.docRepo
      .createQueryBuilder('doc')
      .where('doc.deleted = 0');

    if (query.categoryId !== undefined) {
      qb.andWhere('doc.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.status !== undefined) {
      qb.andWhere('doc.status = :status', { status: query.status });
    }
    if (query.keyword) {
      qb.andWhere('doc.title LIKE :keyword', {
        keyword: `%${query.keyword}%`,
      });
    }
    if (query.tags) {
      qb.andWhere('doc.tags LIKE :tags', { tags: `%${query.tags}%` });
    }
    if (query.source !== undefined) {
      qb.andWhere('doc.source = :source', { source: query.source });
    }

    qb.orderBy('doc.createTime', 'DESC');
    qb.skip(query.skip).take(query.take);

    const [list, total] = await qb.getManyAndCount();
    return ApiResponse.page(list, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** 文档详情，浏览次数 +1 */
  async detail(id: number) {
    const doc = await this.findActive(id);
    await this.docRepo.increment({ id }, 'viewCount', 1);
    doc.viewCount += 1;
    return doc;
  }

  /** 新增文档 */
  async create(dto: CreateDocDto, userId: number) {
    const doc = this.docRepo.create({
      ...dto,
      source: 1,
      status: 0,
      createUserId: userId,
      deleted: 0,
    });
    const saved = await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.created', { docId: saved.id });
    return saved;
  }

  /** 更新文档 */
  async update(id: number, dto: UpdateDocDto, userId: number) {
    const doc = await this.findActive(id);
    Object.assign(doc, dto, { updateUserId: userId });
    const saved = await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.updated', { docId: saved.id });
    return saved;
  }

  /** 软删除文档 */
  async remove(id: number): Promise<void> {
    const doc = await this.findActive(id);
    doc.deleted = 1;
    await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.deleted', { docId: id });
  }

  /** 审核文档 */
  async audit(id: number, dto: AuditDocDto, auditUserId: number) {
    const doc = await this.findActive(id);
    doc.status = dto.status;
    doc.auditRemark = dto.auditRemark ?? null;
    doc.auditUserId = auditUserId;
    doc.auditTime = new Date();
    return this.docRepo.save(doc);
  }

  /** 批量软删除 */
  async batchDelete(ids: number[]): Promise<void> {
    const docs = await this.docRepo.find({
      where: { id: In(ids), deleted: 0 },
    });
    if (docs.length === 0) {
      return;
    }
    await this.docRepo.update({ id: In(docs.map((d) => d.id)) }, { deleted: 1 });
    for (const doc of docs) {
      this.eventEmitter.emit('doc.deleted', { docId: doc.id });
    }
  }

  /** 批量审核 */
  async batchAudit(dto: BatchAuditDto, auditUserId: number) {
    const docs = await this.docRepo.find({
      where: { id: In(dto.ids), deleted: 0 },
    });
    const now = new Date();
    for (const doc of docs) {
      doc.status = dto.status;
      doc.auditRemark = dto.auditRemark ?? null;
      doc.auditUserId = auditUserId;
      doc.auditTime = now;
    }
    return this.docRepo.save(docs);
  }

  /** 文档统计信息（首页仪表盘） */
  async getStats() {
    const total = await this.docRepo.count({ where: { deleted: 0 } });
    const pendingAudit = await this.docRepo.count({
      where: { deleted: 0, status: 0 },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyNew = await this.docRepo
      .createQueryBuilder('doc')
      .where('doc.deleted = 0')
      .andWhere('doc.createTime >= :monthStart', { monthStart })
      .getCount();

    const categoryCount = await this.docRepo
      .createQueryBuilder('doc')
      .select('COUNT(DISTINCT doc.categoryId)', 'cnt')
      .where('doc.deleted = 0')
      .getRawOne()
      .then((r) => Number(r?.cnt ?? 0));

    return { total, pendingAudit, monthlyNew, categoryCount };
  }

  /** 根据 ID 查询文档（供其他模块调用） */
  async findById(id: number): Promise<DocIssueEntity | null> {
    return this.docRepo.findOne({ where: { id, deleted: 0 } });
  }

  private async findActive(id: number): Promise<DocIssueEntity> {
    const doc = await this.docRepo.findOne({ where: { id, deleted: 0 } });
    if (!doc) {
      throw new NotFoundException('文档不存在');
    }
    return doc;
  }
}
