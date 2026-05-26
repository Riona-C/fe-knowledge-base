import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { APP_CONFIG, AppConfig } from '../../config';

/** Embedding API 封装（OpenAI 兼容接口） */
@Injectable()
export class RagEmbeddingService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new OpenAI({
      apiKey: config.rag.embeddingApiKey,
      baseURL: config.rag.embeddingBaseUrl,
      timeout: 60000,
    });
    this.model = config.rag.embeddingModel;
  }

  /** 单条文本向量化 */
  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  /** 批量文本向量化 */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
