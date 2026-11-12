import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Route needs no login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_EXPIRED = 'allowExpired';

/** Route stays open after the subscription has run out (who am I, subscription status). */
export const AllowExpired = () => SetMetadata(ALLOW_EXPIRED, true);

/** Route needs one of these roles (on top of being logged in). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);

export const COOKIE = 'gr_token';
