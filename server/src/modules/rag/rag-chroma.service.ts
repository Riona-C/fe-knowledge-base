import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';
import { APP_CONFIG, AppConfig } from '../../config';

export interface ChromaDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, string | number>;
}

export interface ChromaQueryResult {
  id: string;
  content: string;
  distance: number;
  metadata?: Record<string, string | number>;
}

/** ChromaDB 向量库封装 */
@Injectable()
export class RagChromaService implements OnModuleInit {
  private readonly logger = new Logger(RagChromaService.name);
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit() {
    const { chromaHost, chromaPort, chromaCollection } = this.config.rag;
    try {
      this.client = new ChromaClient({
        path: `http://${chromaHost}:${chromaPort}`,
      });
      this.collection = await this.client.getOrCreateCollection({
        name: chromaCollection,
      });
      this.logger.log('ChromaDB 连接成功');
    } catch (err) {
      this.logger.warn(`ChromaDB 连接失败，RAG 功能不可用: ${err.message}`);
    }
  }

  /** 懒重连：若初始化时 ChromaDB 未就绪，首次调用时自动重试 */
  private async ensureCollectionAsync(): Promise<Collection> {
    if (this.collection) {
      return this.collection;
    }
    const { chromaHost, chromaPort, chromaCollection } = this.config.rag;
    this.client = new ChromaClient({ path: `http://${chromaHost}:${chromaPort}` });
    this.collection = await this.client.getOrCreateCollection({ name: chromaCollection });
    this.logger.log('ChromaDB 重连成功');
    return this.collection;
  }

  private ensureCollection(): Collection {
    if (!this.collection) {
      throw new Error('ChromaDB 未连接，RAG 功能不可用');
    }
    return this.collection;
  }

  /** 添加文档向量 */
  async addDocuments(docs: ChromaDocument[]): Promise<void> {
    if (docs.length === 0) {
      return;
    }
    const collection = await this.ensureCollectionAsync();
    await collection.add({
      ids: docs.map((d) => d.id),
      embeddings: docs.map((d) => d.embedding),
      documents: docs.map((d) => d.content),
      metadatas: docs.map((d) => d.metadata ?? {}),
    });
  }

  /** 按向量检索 TopK */
  async queryByEmbedding(
    embedding: number[],
    topK: number,
  ): Promise<ChromaQueryResult[]> {
    const collection = await this.ensureCollectionAsync();
    const result = await collection.query({
      queryEmbeddings: [embedding],
      nResults: topK,
    });

    const ids = result.ids[0] ?? [];
    const documents = result.documents[0] ?? [];
    const distances = result.distances?.[0] ?? [];
    const metadatas = result.metadatas?.[0] ?? [];

    return ids.map((id, index) => ({
      id: id as string,
      content: (documents[index] as string) ?? '',
      distance: distances[index] ?? 0,
      metadata: (metadatas[index] as Record<string, string | number>) ?? {},
    }));
  }

  /** 按 ID 删除向量 */
  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const collection = await this.ensureCollectionAsync();
    await collection.delete({ ids });
  }
}
