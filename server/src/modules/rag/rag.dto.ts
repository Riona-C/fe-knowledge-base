import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/** 智能检索请求 DTO */
export class SearchDto {
  @ApiProperty({ description: '检索问题', minLength: 2 })
  @IsNotEmpty({ message: '检索内容不能为空' })
  @IsString()
  @MinLength(2, { message: '检索内容至少 2 个字符' })
  query: string;

  @ApiPropertyOptional({ description: '返回结果数量，默认 5', minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
