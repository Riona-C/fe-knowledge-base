import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../decorators/current-user.decorator';

export function isAdmin(user: JwtPayload): boolean {
  return user.role === 'admin';
}

/** 校验普通成员仅能操作自己创建的文档 */
export function assertDocOwner(
  doc: { createUserId: number },
  user: JwtPayload,
): void {
  if (isAdmin(user)) {
    return;
  }
  if (doc.createUserId !== user.userId) {
    throw new ForbiddenException('无权操作该文档');
  }
}

/** 普通成员是否可查看该文档 */
export function canViewDoc(
  doc: { status: number; createUserId: number },
  user: JwtPayload,
): boolean {
  if (isAdmin(user)) {
    return true;
  }
  return doc.status === 1 || doc.createUserId === user.userId;
}
