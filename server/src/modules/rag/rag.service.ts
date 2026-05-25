import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { In, Repository } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../../config';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { SysConfigEntity } from '../../entities/sys-config.entity';
import { VectorMappingEntity } from '../../entities/vector-mapping.entity';
import { RagChromaService } from './rag-chroma.service';
import { RagEmbeddingService } from './rag-embedding.service';

const CACHE_PREFIX = 'rag:search:';
const CACHE_TTL_DEFAULT = 1800;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly redis: Redis;
  private readonly aiClient: OpenAI;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(DocIssueEntity)
    private readonly docRepo: Repository<DocIssueEntity>,
    @InjectRepository(VectorMappingEntity)
    private readonly mappingRepo: Repository<VectorMappingEntity>,
    @InjectRepository(SysConfigEntity)
    private readonly configRepo: Repository<SysConfigEntity>,
    private readonly embeddingService: RagEmbeddingService,
    private readonly chromaService: RagChromaService,
  ) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
    });
    this.aiClient = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }

  /** 智能检索相似问题 */
  async search(query: string, topKOverride?: number) {
    const cacheKey = CACHE_PREFIX + createHash('md5').update(`${query}:${topKOverride ?? ''}`).digest('hex');
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const topK = topKOverride ?? await this.getConfigNumber('rag_search_top_k', 5);
    const rerankEnabled = await this.getConfigBoolean('rag_rerank_enabled', false);
    const cacheTtl = await this.getConfigNumber('rag_cache_ttl', CACHE_TTL_DEFAULT);

    const embedding = await this.embeddingService.embed(query);
    let results = await this.chromaService.queryByEmbedding(embedding, topK);

    if (rerankEnabled && results.length > 0) {
      results = await this.rerank(query, results);
    }

    const docIds = [
      ...new Set(
        results
          .map((r) => Number(r.metadata?.docId))
          .filter((id) => !Number.isNaN(id) && id > 0),
      ),
    ];

    const docs =
      docIds.length > 0
        ? await this.docRepo.find({
          where: { id: In(docIds), deleted: 0, status: 1 },
        })
        : [];

    const response = {
      query,
      results: results.map((r) => ({
        vectorId: r.id,
        distance: r.distance,
        chunkContent: r.content,
        doc: docs.find((d) => Number(d.id) === Number(r.metadata?.docId)) ?? null,
      })),
    };

    await this.redis.setex(cacheKey, cacheTtl, JSON.stringify(response));
    return response;
  }

  /** 手动同步文档到向量库 */
  async syncDoc(docId: number): Promise<void> {
    const doc = await this.docRepo.findOne({
      where: { id: docId, deleted: 0 },
    });
    if (!doc) {
      throw new NotFoundException('文档不存在');
    }
    await this.removeDoc(docId);
    await this.indexDoc(doc);
  }

  /** 全量同步所有已发布文档到向量库（初始化/重建用） */
  async syncAll(): Promise<{ total: number; success: number; failed: number }> {
    const docs = await this.docRepo.find({ where: { deleted: 0, status: 1 } });
    let success = 0;
    let failed = 0;
    for (const doc of docs) {
      try {
        await this.removeDoc(doc.id);
        await this.indexDoc(doc);
        success++;
      } catch (err) {
        this.logger.error(`全量同步失败 docId=${doc.id}`, err);
        failed++;
      }
    }
    this.logger.log(`全量同步完成 total=${docs.length} success=${success} failed=${failed}`);
    return { total: docs.length, success, failed };
  }

  /** 手动删除文档向量 */
  async removeDoc(docId: number): Promise<void> {
    const mappings = await this.mappingRepo.find({ where: { docId } });
    if (mappings.length > 0) {
      await this.chromaService.deleteByIds(mappings.map((m) => m.vectorId));
      await this.mappingRepo.delete({ docId });
    }
  }

  @OnEvent('doc.created')
  async onDocCreated(payload: { docId: number }) {
    await this.safeSync(payload.docId, 'created');
  }

  @OnEvent('doc.updated')
  async onDocUpdated(payload: { docId: number }) {
    await this.safeSync(payload.docId, 'updated');
  }

  @OnEvent('doc.deleted')
  async onDocDeleted(payload: { docId: number }) {
    try {
      await this.removeDoc(payload.docId);
    } catch (err) {
      this.logger.error(`删除文档向量失败 docId=${payload.docId}`, err);
    }
  }

  private async safeSync(docId: number, action: string) {
    try {
      const doc = await this.docRepo.findOne({
        where: { id: docId, deleted: 0, status: 1 },
      });
      if (!doc) {
        await this.removeDoc(docId);
        return;
      }
      await this.removeDoc(docId);
      await this.indexDoc(doc);
    } catch (err) {
      this.logger.error(`文档向量同步失败 docId=${docId} action=${action}`, err);
    }
  }

  private async indexDoc(doc: DocIssueEntity) {
    const solutionSummary =
      doc.solution && doc.solution.length > 200
        ? doc.solution.slice(0, 200) + '...'
        : doc.solution ?? '';
    const text = [doc.title, doc.problem, solutionSummary, doc.tags]
      .filter(Boolean)
      .join('\n');

    const embedding = await this.embeddingService.embed(text);
    const vectorId = `doc_${doc.id}_0`;

    await this.chromaService.addDocuments([
      {
        id: vectorId,
        content: text,
        embedding,
        metadata: { docId: doc.id },
      },
    ]);

    await this.mappingRepo.save(
      this.mappingRepo.create({
        docId: doc.id,
        vectorId,
        chunkIndex: 0,
        chunkContent: text,
      }),
    );
  }

  private async rerank(
    query: string,
    results: { id: string; content: string; distance: number; metadata?: Record<string, string | number> }[],
  ) {
    const prompt = results
      .map((r, i) => `[${i}] ${r.content.slice(0, 300)}`)
      .join('\n');

    const completion = await this.aiClient.chat.completions.create({
      model: this.config.ai.modelName,
      messages: [
        {
          role: 'system',
          content:
            '你是检索重排序助手。根据用户问题，对候选文档按相关性从高到低排序，仅返回 JSON 数组，如 [2,0,1]',
        },
        { role: 'user', content: `问题：${query}\n\n候选：\n${prompt}` },
      ],
      temperature: 0,
    });

    try {
      const order: number[] = JSON.parse(
        completion.choices[0]?.message?.content ?? '[]',
      );
      return order
        .filter((i) => i >= 0 && i < results.length)
        .map((i) => results[i]);
    } catch {
      return results;
    }
  }

  private async getConfigValue(key: string): Promise<string | null> {
    const row = await this.configRepo.findOne({ where: { configKey: key } });
    return row?.configValue ?? null;
  }

  private async getConfigNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.getConfigValue(key);
    return val ? parseInt(val, 10) || defaultValue : defaultValue;
  }

  private async getConfigBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const val = await this.getConfigValue(key);
    if (val === null) {
      return defaultValue;
    }
    return val === '1' || val === 'true';
  }
}
