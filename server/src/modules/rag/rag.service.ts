import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { In, Repository } from 'typeorm';
import { RAG_CACHE_PREFIX } from '../../common/constants';
import { REDIS_CLIENT } from '../../common/providers/redis.module';
import { stripMarkdownForEmbedding } from '../../common/utils/markdown.util';
import { splitTextIntoChunks } from '../../common/utils/text-chunk.util';
import { APP_CONFIG, AppConfig } from '../../config';
import { CategoryEntity } from '../../entities/category.entity';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { SysConfigEntity } from '../../entities/sys-config.entity';
import { VectorMappingEntity } from '../../entities/vector-mapping.entity';
import { RagChromaService } from './rag-chroma.service';
import { RagEmbeddingService } from './rag-embedding.service';

const CACHE_TTL_DEFAULT = 1800;
const SYNC_BATCH_SIZE = 5;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly aiClient: OpenAI;
  private configCache = new Map<string, { value: string; expireAt: number }>();
  private readonly CONFIG_CACHE_MS = 5 * 60 * 1000;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(DocIssueEntity)
    private readonly docRepo: Repository<DocIssueEntity>,
    @InjectRepository(VectorMappingEntity)
    private readonly mappingRepo: Repository<VectorMappingEntity>,
    @InjectRepository(SysConfigEntity)
    private readonly configRepo: Repository<SysConfigEntity>,
    private readonly embeddingService: RagEmbeddingService,
    private readonly chromaService: RagChromaService,
  ) {
    this.aiClient = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
      timeout: 60000,
    });
  }

  /** 智能检索相似问题 */
  async search(query: string, topKOverride?: number) {
    const cacheKey =
      RAG_CACHE_PREFIX +
      createHash('md5').update(`${query}:${topKOverride ?? ''}`).digest('hex');
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const topK = topKOverride ?? (await this.getConfigNumber('rag_search_top_k', 20));
    const rerankEnabled = await this.getConfigBoolean('rag_rerank_enabled', false);
    const rerankTopN = await this.getConfigNumber('rag_rerank_top_n', 5);
    const cacheTtl = await this.getConfigNumber('rag_cache_ttl', CACHE_TTL_DEFAULT);

    const embedding = await this.embeddingService.embed(
      stripMarkdownForEmbedding(query),
    );
    let results = await this.chromaService.queryByEmbedding(embedding, topK);

    if (rerankEnabled && results.length > 0) {
      results = await this.rerank(query, results);
    }
    if (rerankTopN > 0 && results.length > rerankTopN) {
      results = results.slice(0, rerankTopN);
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
        ? await this.docRepo
          .createQueryBuilder('doc')
          .leftJoin(CategoryEntity, 'cat', 'cat.id = doc.categoryId')
          .addSelect('cat.categoryName', 'categoryName')
          .where('doc.id IN (:...docIds)', { docIds })
          .andWhere('doc.deleted = 0')
          .andWhere('doc.status = 1')
          .getRawAndEntities()
          .then(({ entities, raw }) =>
            entities.map((d, i) => ({
              ...d,
              categoryName: raw[i]?.categoryName ?? '',
            })),
          )
        : [];

    const response = {
      query,
      results: results
        .map((r) => {
          const doc =
            docs.find((d) => Number(d.id) === Number(r.metadata?.docId)) ?? null;
          if (!doc) {
            return null;
          }
          return {
            vectorId: r.id,
            distance: r.distance,
            chunkContent: r.content,
            doc: {
              id: doc.id,
              title: doc.title,
              problem: doc.problem,
              solution: doc.solution,
              tags: doc.tags,
              categoryId: doc.categoryId,
              categoryName: (doc as DocIssueEntity & { categoryName?: string }).categoryName ?? '',
            },
          };
        })
        .filter(Boolean),
    };

    await this.redis.setex(cacheKey, cacheTtl, JSON.stringify(response));
    return response;
  }

  /** 对话式问答：检索 + LLM 生成带引用的答案 */
  async chat(query: string, topK = 5) {
    const searchResult = await this.search(query, topK);
    const hits = (searchResult.results ?? []) as Array<{
      doc: { id: number; title: string; problem: string; solution: string };
    }>;

    if (hits.length === 0) {
      return {
        query,
        answer: '知识库中未找到相关内容，请尝试换种问法或联系管理员补充文档。',
        references: [],
      };
    }

    const context = hits
      .map(
        (h, i) =>
          `[${i + 1}] 标题：${h.doc.title}\n问题：${(h.doc.problem || '').slice(0, 400)}\n方案：${(h.doc.solution || '').slice(0, 400)}`,
      )
      .join('\n\n');

    const completion = await this.aiClient.chat.completions.create({
      model: this.config.ai.modelName,
      messages: [
        {
          role: 'system',
          content:
            '你是前端知识库助手。仅根据提供的参考文档回答问题，引用时使用 [序号]。若无依据请明确说明不知道。',
        },
        {
          role: 'user',
          content: `用户问题：${query}\n\n参考文档：\n${context}`,
        },
      ],
      temperature: 0.3,
    });

    return {
      query,
      answer: completion.choices[0]?.message?.content ?? '',
      references: hits.map((h) => ({
        docId: Number(h.doc.id),
        title: h.doc.title,
      })),
    };
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

  /** 全量同步所有已发布文档到向量库 */
  async syncAll(): Promise<{ total: number; success: number; failed: number }> {
    const docs = await this.docRepo.find({ where: { deleted: 0, status: 1 } });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < docs.length; i += SYNC_BATCH_SIZE) {
      const batch = docs.slice(i, i + SYNC_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (doc) => {
          await this.removeDoc(doc.id);
          await this.indexDoc(doc);
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          success++;
        } else {
          failed++;
          this.logger.error('全量同步单篇失败', r.reason);
        }
      }
    }

    await this.invalidateSearchCache();
    this.logger.log(`全量同步完成 total=${docs.length} success=${success} failed=${failed}`);
    return { total: docs.length, success, failed };
  }

  /** 手动删除文档向量 */
  async removeDoc(docId: number): Promise<void> {
    const mappings = await this.mappingRepo.find({ where: { docId } });
    if (mappings.length === 0) {
      return;
    }
    const vectorIds = mappings.map((m) => m.vectorId);
    try {
      await this.chromaService.deleteByIds(vectorIds);
    } catch (err) {
      this.logger.error(`Chroma 删除向量失败 docId=${docId}`, err);
      throw err;
    }
    await this.mappingRepo.delete({ docId });
  }

  /** 清除 RAG 检索缓存 */
  async invalidateSearchCache(): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${RAG_CACHE_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  @OnEvent('doc.created')
  async onDocCreated(payload: { docId: number }) {
    await this.safeSync(payload.docId, 'created');
  }

  @OnEvent('doc.updated')
  async onDocUpdated(payload: { docId: number }) {
    await this.invalidateSearchCache();
    await this.safeSync(payload.docId, 'updated');
  }

  @OnEvent('doc.deleted')
  async onDocDeleted(payload: { docId: number }) {
    await this.invalidateSearchCache();
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
    const fullText = stripMarkdownForEmbedding(
      [doc.title, doc.problem, doc.solution, doc.tags].filter(Boolean).join('\n'),
    );
    const indexText = stripMarkdownForEmbedding(
      [doc.title, doc.problem, solutionSummary, doc.tags].filter(Boolean).join('\n'),
    );
    const chunks = splitTextIntoChunks(indexText || fullText, 600, 100);
    if (chunks.length === 0) {
      return;
    }

    const embeddings = await this.embeddingService.embedBatch(chunks);
    const documents = chunks.map((content, chunkIndex) => {
      const vectorId = `doc_${doc.id}_${chunkIndex}`;
      return {
        id: vectorId,
        content,
        embedding: embeddings[chunkIndex],
        metadata: { docId: doc.id, chunkIndex },
      };
    });

    try {
      await this.chromaService.addDocuments(documents);
    } catch (err) {
      this.logger.error(`Chroma 写入失败 docId=${doc.id}`, err);
      throw err;
    }

    try {
      await this.mappingRepo.save(
        chunks.map((content, chunkIndex) =>
          this.mappingRepo.create({
            docId: doc.id,
            vectorId: `doc_${doc.id}_${chunkIndex}`,
            chunkIndex,
            chunkContent: content,
          }),
        ),
      );
    } catch (err) {
      await this.chromaService.deleteByIds(documents.map((d) => d.id)).catch(() => undefined);
      this.logger.error(`向量映射写入失败，已回滚 Chroma docId=${doc.id}`, err);
      throw err;
    }
  }

  private async rerank(
    query: string,
    results: {
      id: string;
      content: string;
      distance: number;
      metadata?: Record<string, string | number>;
    }[],
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
    } catch (err) {
      this.logger.warn(`Rerank 解析失败，使用原始顺序: ${err}`);
      return results;
    }
  }

  private async getConfigValue(key: string): Promise<string | null> {
    const cached = this.configCache.get(key);
    if (cached && cached.expireAt > Date.now()) {
      return cached.value;
    }
    const row = await this.configRepo.findOne({ where: { configKey: key } });
    const value = row?.configValue ?? null;
    if (value !== null) {
      this.configCache.set(key, {
        value,
        expireAt: Date.now() + this.CONFIG_CACHE_MS,
      });
    }
    return value;
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
