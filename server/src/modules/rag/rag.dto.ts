import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/** 智能检索请求 DTO */
export class SearchDto {
  @ApiProperty({ description: '检索问题', minLength: 2 })
  @IsNotEmpty({ message: '检索内容不能为空' })
  @IsString()
  @MinLength(2, { message: '检索内容至少 2 个字符' })
  query: string;
}
