import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

/** 登录请求 DTO */
export class LoginDto {
  @ApiProperty({ description: '用户名' })
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码', minLength: 6 })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password: string;
}

/** 刷新 Token 请求 DTO */
export class RefreshTokenDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsNotEmpty({ message: 'refreshToken 不能为空' })
  @IsString()
  refreshToken: string;
}

/** 修改密码请求 DTO */
export class ChangePasswordDto {
  @ApiProperty({ description: '旧密码' })
  @IsNotEmpty({ message: '旧密码不能为空' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: '新密码（至少8位，包含字母和数字）' })
  @IsNotEmpty({ message: '新密码不能为空' })
  @IsString()
  @MinLength(8, { message: '新密码至少 8 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '新密码必须包含字母和数字',
  })
  newPassword: string;
}
