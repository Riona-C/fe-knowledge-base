import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** 智能检索请求 DTO */
export class SearchDto {
  @ApiProperty({ description: '检索问题', minLength: 2 })
  @IsNotEmpty({ message: '检索内容不能为空' })
  @IsString()
  @MinLength(2, { message: '检索内容至少 2 个字符' })
  @MaxLength(2000, { message: '检索内容不能超过 2000 个字符' })
  query: string;

  @ApiPropertyOptional({ description: '返回结果数量，默认 5', minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}

/** 对话式问答 DTO */
export class RagChatDto {
  @ApiProperty({ description: '用户问题' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  query: string;

  @ApiPropertyOptional({ description: '检索参考条数', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;
}
