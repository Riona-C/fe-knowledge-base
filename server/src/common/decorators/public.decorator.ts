import { SetMetadata } from '@nestjs/common';

/** 标记无需 JWT 认证的公开接口 */
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
