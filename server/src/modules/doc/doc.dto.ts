import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** 创建文档 DTO */
export class CreateDocDto {
  @ApiProperty({ description: '分类 ID' })
  @Type(() => Number)
  @IsInt()
  categoryId: number;

  @ApiProperty({ description: '标题' })
  @IsNotEmpty({ message: '标题不能为空' })
  @IsString()
  title: string;

  @ApiProperty({ description: '问题描述' })
  @IsNotEmpty({ message: '问题描述不能为空' })
  @IsString()
  problem: string;

  @ApiProperty({ description: '解决方案' })
  @IsNotEmpty({ message: '解决方案不能为空' })
  @IsString()
  solution: string;

  @ApiPropertyOptional({ description: '标签，逗号分隔' })
  @IsOptional()
  @IsString()
  tags?: string;
}

/** 更新文档 DTO */
export class UpdateDocDto {
  @ApiPropertyOptional({ description: '分类 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: '标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '问题描述' })
  @IsOptional()
  @IsString()
  problem?: string;

  @ApiPropertyOptional({ description: '解决方案' })
  @IsOptional()
  @IsString()
  solution?: string;

  @ApiPropertyOptional({ description: '标签' })
  @IsOptional()
  @IsString()
  tags?: string;
}

/** 文档列表查询 DTO */
export class QueryDocDto extends PaginationDto {
  @ApiPropertyOptional({ description: '分类 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: '状态：0-待审核 1-已通过 2-已驳回' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '关键词（标题模糊搜索）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '标签' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: '来源：1-手动 2-钉钉' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  source?: number;
}

/** 审核文档 DTO */
export class AuditDocDto {
  @ApiProperty({ description: '审核状态：1-通过 2-驳回' })
  @Type(() => Number)
  @IsIn([1, 2], { message: '状态值无效，仅支持 1(通过) 或 2(驳回)' })
  status: number;

  @ApiPropertyOptional({ description: '审核备注' })
  @IsOptional()
  @IsString()
  auditRemark?: string;
}

/** 批量删除 DTO */
export class BatchDeleteDto {
  @ApiProperty({ description: '文档 ID 列表', type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: '至少选择一个文档' })
  @Type(() => Number)
  @IsInt({ each: true })
  ids: number[];
}

/** 批量审核 DTO */
export class BatchAuditDto {
  @ApiProperty({ description: '文档 ID 列表', type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: '至少选择一个文档' })
  @Type(() => Number)
  @IsInt({ each: true })
  ids: number[];

  @ApiProperty({ description: '审核状态：1-通过 2-驳回' })
  @Type(() => Number)
  @IsIn([1, 2], { message: '状态值无效，仅支持 1(通过) 或 2(驳回)' })
  status: number;

  @ApiPropertyOptional({ description: '审核备注' })
  @IsOptional()
  @IsString()
  auditRemark?: string;
}
