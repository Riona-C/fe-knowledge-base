import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** 创建用户 DTO */
export class CreateUserDto {
  @ApiProperty({ description: '用户名' })
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码' })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password: string;

  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  nickName?: string;

  @ApiProperty({ description: '角色', example: 'member' })
  @IsNotEmpty({ message: '角色不能为空' })
  @IsString()
  role: string;
}

/** 更新用户 DTO */
export class UpdateUserDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  nickName?: string;

  @ApiPropertyOptional({ description: '角色' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: '状态：0-禁用 1-启用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

/** 用户列表查询 DTO */
export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({ description: '用户名（模糊搜索）' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: '关键词（搜索用户名/昵称）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '状态' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}
