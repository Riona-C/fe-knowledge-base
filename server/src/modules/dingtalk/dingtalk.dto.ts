import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** 更新钉钉配置 DTO */
export class UpdateDingtalkConfigDto {
  @ApiProperty({ description: 'AppKey' })
  @IsNotEmpty({ message: 'appKey 不能为空' })
  @IsString()
  appKey: string;

  @ApiProperty({ description: 'AppSecret' })
  @IsNotEmpty({ message: 'appSecret 不能为空' })
  @IsString()
  appSecret: string;

  @ApiPropertyOptional({ description: '机器人 Code' })
  @IsOptional()
  @IsString()
  robotCode?: string;

  @ApiPropertyOptional({ description: '群 ID 列表，逗号分隔' })
  @IsOptional()
  @IsString()
  groupIds?: string;

  @ApiProperty({ description: '是否启用：0-禁用 1-启用' })
  @Type(() => Number)
  @IsInt()
  enable: number;
}

/** 钉钉消息列表查询 DTO */
export class QueryMessageDto extends PaginationDto {
  @ApiPropertyOptional({ description: '处理状态：0-待处理 1-已生成 2-已忽略' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  handleStatus?: number;

  @ApiPropertyOptional({ description: '发送者' })
  @IsOptional()
  @IsString()
  sender?: string;
}

/** 自动检测配置 DTO */
export class UpdateAutoDetectDto {
  @ApiProperty({ description: '是否启用自动检测' })
  @IsNotEmpty({ message: 'enabled 不能为空' })
  enabled: boolean;

  @ApiPropertyOptional({ description: '自定义关键词列表，逗号分隔（留空使用默认关键词）' })
  @IsOptional()
  @IsString()
  keywords?: string;
}

/** 模拟消息测试 DTO */
export class TestMessageDto {
  @ApiProperty({ description: '模拟消息内容' })
  @IsNotEmpty({ message: '消息内容不能为空' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '模拟发送人' })
  @IsOptional()
  @IsString()
  sender?: string;
}
