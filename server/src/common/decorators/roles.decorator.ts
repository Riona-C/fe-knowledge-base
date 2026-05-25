import { SetMetadata } from '@nestjs/common';

/** 角色权限元数据键 */
export const ROLES_KEY = 'roles';

/** 声明接口所需角色，如 @Roles('admin') */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
