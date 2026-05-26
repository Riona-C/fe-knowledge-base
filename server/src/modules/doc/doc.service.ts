import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ApiResponse } from '../../common/dto/api-response';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  assertDocOwner,
  canViewDoc,
  isAdmin,
} from '../../common/utils/access.util';
import { CategoryEntity } from '../../entities/category.entity';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { DocVersionEntity } from '../../entities/doc-version.entity';
import { UserEntity } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { RagService } from '../rag/rag.service';
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
    @InjectRepository(DocVersionEntity)
    private readonly versionRepo: Repository<DocVersionEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    private readonly ragService: RagService,
  ) {}

  /** 混合检索：全文 + 语义（仅已发布文档） */
  async hybridSearch(keyword: string, user: JwtPayload, topK = 5) {
    const fulltextQuery: QueryDocDto = {
      keyword,
      page: 1,
      pageSize: 10,
      status: isAdmin(user) ? undefined : 1,
    } as QueryDocDto;
    const fulltextResult = await this.list(fulltextQuery, user);
    const fulltextList = fulltextResult.data?.list ?? [];

    let semanticList: Array<{ docId: number; title: string; score: number }> = [];
    try {
      const rag = await this.ragService.search(keyword, topK);
      semanticList = ((rag.results ?? []) as Array<{ doc: { id: number; title: string }; distance: number }>)
        .filter((r) => r.doc)
        .map((r) => ({
          docId: r.doc.id,
          title: r.doc.title,
          score: 1 - (r.distance ?? 0),
        }));
    } catch (err) {
      // 语义检索失败时降级为仅全文
    }

    const merged = new Map<number, { source: string[]; doc: DocIssueEntity | null; score: number }>();
    for (const doc of fulltextList) {
      merged.set(Number(doc.id), { source: ['fulltext'], doc, score: 1 });
    }
    for (const hit of semanticList) {
      const existing = merged.get(hit.docId);
      if (existing) {
        existing.source.push('semantic');
        existing.score = Math.max(existing.score, hit.score);
      } else {
        merged.set(hit.docId, { source: ['semantic'], doc: null, score: hit.score });
      }
    }

    const missingIds = [...merged.entries()]
      .filter(([, v]) => !v.doc)
      .map(([id]) => id);
    if (missingIds.length > 0) {
      const docs = await this.docRepo.find({
        where: { id: In(missingIds), deleted: 0, status: 1 },
      });
      for (const d of docs) {
        const entry = merged.get(Number(d.id));
        if (entry) {
          entry.doc = d;
        }
      }
    }

    return {
      keyword,
      results: [...merged.values()]
        .filter((v) => v.doc)
        .sort((a, b) => b.score - a.score)
        .map((v) => ({
          doc: v.doc,
          sources: v.source,
          score: v.score,
        })),
    };
  }

  /** 分页查询文档列表 */
  async list(query: QueryDocDto, user: JwtPayload) {
    const qb = this.docRepo
      .createQueryBuilder('doc')
      .leftJoin(CategoryEntity, 'cat', 'cat.id = doc.categoryId AND cat.deleted = 0')
      .leftJoin(UserEntity, 'creator', 'creator.id = doc.createUserId AND creator.deleted = 0')
      .addSelect('cat.categoryName', 'categoryName')
      .addSelect('creator.nickName', 'createUserName')
      .where('doc.deleted = 0');

    this.applyMemberListScope(qb, user, query);

    if (query.categoryId !== undefined) {
      qb.andWhere('doc.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.keyword) {
      const kw = query.keyword.trim().replace(/[+\-><()~*\"@]+/g, ' ');
      if (kw) {
        qb.andWhere(
          'MATCH(doc.title, doc.problem) AGAINST (:keyword IN BOOLEAN MODE)',
          { keyword: `*${kw}*` },
        );
      }
    }
    if (query.tags) {
      qb.andWhere('doc.tags LIKE :tags', { tags: `%${query.tags}%` });
    }
    if (query.source !== undefined) {
      qb.andWhere('doc.source = :source', { source: query.source });
    }

    qb.orderBy('doc.createTime', 'DESC');
    const total = await qb.getCount();
    qb.skip(query.skip).take(query.take);

    const { entities, raw } = await qb.getRawAndEntities();
    const list = entities.map((doc, i) => ({
      ...doc,
      categoryName: raw[i]?.categoryName ?? '',
      createUserName: raw[i]?.createUserName ?? '',
    }));
    return ApiResponse.page(list, total, query.page ?? 1, query.pageSize ?? 20);
  }

  /** 文档详情，浏览次数 +1 */
  async detail(id: number, user: JwtPayload) {
    const doc = await this.findActive(id);
    if (!canViewDoc(doc, user)) {
      throw new ForbiddenException('无权查看该文档');
    }
    await this.docRepo.increment({ id }, 'viewCount', 1);
    doc.viewCount += 1;
    const enriched = await this.enrichDoc(doc);
    return enriched;
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
    await this.auditService.log(userId, 'doc.create', 'doc_issue', saved.id, saved.title);
    return saved;
  }

  /** 更新文档 */
  async update(id: number, dto: UpdateDocDto, user: JwtPayload) {
    const doc = await this.findActive(id);
    assertDocOwner(doc, user);
    await this.saveVersionSnapshot(doc, user.userId);
    Object.assign(doc, dto, { updateUserId: user.userId });
    const saved = await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.updated', { docId: saved.id });
    await this.auditService.log(user.userId, 'doc.update', 'doc_issue', id, saved.title);
    return saved;
  }

  /** 软删除文档 */
  async remove(id: number, user: JwtPayload): Promise<void> {
    const doc = await this.findActive(id);
    assertDocOwner(doc, user);
    doc.deleted = 1;
    await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.deleted', { docId: id });
    await this.auditService.log(user.userId, 'doc.delete', 'doc_issue', id, doc.title);
  }

  /** 审核文档 */
  async audit(id: number, dto: AuditDocDto, auditUser: JwtPayload) {
    const doc = await this.findActive(id);
    const prevStatus = doc.status;
    doc.status = dto.status;
    doc.auditRemark = dto.auditRemark ?? null;
    doc.auditUserId = auditUser.userId;
    doc.auditTime = new Date();
    const saved = await this.docRepo.save(doc);
    this.eventEmitter.emit('doc.updated', { docId: id });
    this.eventEmitter.emit('doc.audited', {
      docId: id,
      status: dto.status,
      auditRemark: dto.auditRemark,
      prevStatus,
      source: doc.source,
      createUserId: doc.createUserId,
      title: doc.title,
    });
    await this.auditService.log(
      auditUser.userId,
      'doc.audit',
      'doc_issue',
      id,
      `status=${dto.status}`,
    );
    return saved;
  }

  /** 批量软删除 */
  async batchDelete(ids: number[], operatorId: number): Promise<void> {
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
    await this.auditService.log(operatorId, 'doc.batch_delete', 'doc_issue', 0, `ids=${ids.join(',')}`);
  }

  /** 批量审核 */
  async batchAudit(dto: BatchAuditDto, auditUser: JwtPayload) {
    const docs = await this.docRepo.find({
      where: { id: In(dto.ids), deleted: 0 },
    });
    const now = new Date();
    for (const doc of docs) {
      const prevStatus = doc.status;
      doc.status = dto.status;
      doc.auditRemark = dto.auditRemark ?? null;
      doc.auditUserId = auditUser.userId;
      doc.auditTime = now;
      this.eventEmitter.emit('doc.audited', {
        docId: doc.id,
        status: dto.status,
        auditRemark: dto.auditRemark,
        prevStatus,
        source: doc.source,
        createUserId: doc.createUserId,
        title: doc.title,
      });
    }
    const saved = await this.docRepo.save(docs);
    for (const doc of docs) {
      this.eventEmitter.emit('doc.updated', { docId: doc.id });
    }
    await this.auditService.log(
      auditUser.userId,
      'doc.batch_audit',
      'doc_issue',
      0,
      `ids=${dto.ids.join(',')};status=${dto.status}`,
    );
    return saved;
  }

  /** 文档统计信息（首页仪表盘，仅管理员） */
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

  /** 文档版本历史 */
  async getVersions(docId: number, user: JwtPayload) {
    const doc = await this.findActive(docId);
    if (!canViewDoc(doc, user)) {
      throw new ForbiddenException('无权查看该文档');
    }
    return this.versionRepo.find({
      where: { docId },
      order: { versionNo: 'DESC' },
    });
  }

  /** 根据 ID 查询文档（供其他模块调用） */
  async findById(id: number): Promise<DocIssueEntity | null> {
    return this.docRepo.findOne({ where: { id, deleted: 0 } });
  }

  private applyMemberListScope(
    qb: ReturnType<Repository<DocIssueEntity>['createQueryBuilder']>,
    user: JwtPayload,
    query: QueryDocDto,
  ): void {
    if (isAdmin(user)) {
      if (query.status !== undefined) {
        qb.andWhere('doc.status = :status', { status: query.status });
      }
      return;
    }

    if (query.status !== undefined) {
      if (query.status === 1) {
        qb.andWhere('doc.status = 1');
      } else {
        qb.andWhere('doc.status = :status AND doc.createUserId = :uid', {
          status: query.status,
          uid: user.userId,
        });
      }
      return;
    }

    qb.andWhere('(doc.status = 1 OR doc.createUserId = :uid)', {
      uid: user.userId,
    });
  }

  private async enrichDoc(doc: DocIssueEntity) {
    const row = await this.docRepo
      .createQueryBuilder('doc')
      .leftJoin(CategoryEntity, 'cat', 'cat.id = doc.categoryId AND cat.deleted = 0')
      .leftJoin(UserEntity, 'creator', 'creator.id = doc.createUserId')
      .addSelect('cat.categoryName', 'categoryName')
      .addSelect('creator.nickName', 'createUserName')
      .where('doc.id = :id', { id: doc.id })
      .getRawOne();
    return {
      ...doc,
      categoryName: row?.categoryName ?? '',
      createUserName: row?.createUserName ?? '',
    };
  }

  private async saveVersionSnapshot(doc: DocIssueEntity, editorId: number) {
    const last = await this.versionRepo.findOne({
      where: { docId: doc.id },
      order: { versionNo: 'DESC' },
    });
    const versionNo = (last?.versionNo ?? 0) + 1;
    await this.versionRepo.save(
      this.versionRepo.create({
        docId: doc.id,
        versionNo,
        title: doc.title,
        problem: doc.problem,
        solution: doc.solution,
        tags: doc.tags,
        categoryId: doc.categoryId,
        editorUserId: editorId,
      }),
    );
  }

  private async findActive(id: number): Promise<DocIssueEntity> {
    const doc = await this.docRepo.findOne({ where: { id, deleted: 0 } });
    if (!doc) {
      throw new NotFoundException('文档不存在');
    }
    return doc;
  }
}
