import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from '../../entities/category.entity';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { SysConfigEntity } from '../../entities/sys-config.entity';
import { VectorMappingEntity } from '../../entities/vector-mapping.entity';
import { RagChromaService } from './rag-chroma.service';
import { RagController } from './rag.controller';
import { RagEmbeddingService } from './rag-embedding.service';
import { RagService } from './rag.service';

/** RAG 向量检索模块 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      VectorMappingEntity,
      DocIssueEntity,
      SysConfigEntity,
      CategoryEntity,
    ]),
  ],
  controllers: [RagController],
  providers: [RagService, RagEmbeddingService, RagChromaService],
  exports: [RagService, RagChromaService],
})
export class RagModule {}
