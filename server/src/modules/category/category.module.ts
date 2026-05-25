import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from '../../entities/category.entity';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

/** 分类管理模块 */
@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, DocIssueEntity])],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
