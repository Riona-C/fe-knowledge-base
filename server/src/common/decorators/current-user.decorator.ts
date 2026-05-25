import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JWT 解析后的用户信息 */
export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

/** 从请求中提取当前登录用户 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
