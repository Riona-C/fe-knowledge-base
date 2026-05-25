import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from '../../entities/category.entity';
import { DingtalkConfigEntity } from '../../entities/dingtalk-config.entity';
import { DingtalkMessageEntity } from '../../entities/dingtalk-message.entity';
import { DocIssueEntity } from '../../entities/doc-issue.entity';
import { SysConfigEntity } from '../../entities/sys-config.entity';
import { DingtalkController } from './dingtalk.controller';
import { DingtalkService } from './dingtalk.service';

/** 钉钉消息采集模块 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryEntity,
      DingtalkConfigEntity,
      DingtalkMessageEntity,
      DocIssueEntity,
      SysConfigEntity,
    ]),
  ],
  controllers: [DingtalkController],
  providers: [DingtalkService],
  exports: [DingtalkService],
})
export class DingtalkModule {}
