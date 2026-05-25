import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { DocController } from './doc.controller';
import { DocService } from './doc.service';

/** 问题文档模块 */
@Module({
  imports: [TypeOrmModule.forFeature([DocIssueEntity])],
  controllers: [DocController],
  providers: [DocService],
  exports: [DocService],
})
export class DocModule {}
