import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.module';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.module';
import {
  ALLOW_EXPIRED,
  AuthUser,
  COOKIE,
  IS_PUBLIC,
  ROLES,
} from './decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
    private subs: SubscriptionService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets))
      return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const header = req.headers.authorization;
    const token: string | undefined =
      (req.cookies as Record<string, string> | undefined)?.[COOKIE] ??
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

    const reject = () => {
      res.clearCookie(COOKIE, { path: '/' });
      return new UnauthorizedException(
        'লগইন সেশন শেষ হয়ে গেছে। আবার লগইন করুন।',
      );
    };
    if (!token) throw reject();

    let userId: number;
    try {
      userId = (await this.jwt.verifyAsync<{ sub: number }>(token)).sub;
    } catch {
      throw reject();
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw reject();
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Without an active subscription only the super admin can work; everyone else sees the lock screen.
    if (
      user.role !== 'SUPER_ADMIN' &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_EXPIRED, targets) &&
      !(await this.subs.isActive())
    )
      throw new HttpException(
        'সফটওয়্যারের সাবস্ক্রিপশনের মেয়াদ শেষ। চালু করতে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।',
        HttpStatus.PAYMENT_REQUIRED,
      );

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES,
      targets,
    );
    // The super admin can do everything an admin can; @Roles('SUPER_ADMIN') routes are theirs alone.
    if (roles && user.role !== 'SUPER_ADMIN' && !roles.includes(user.role))
      throw new ForbiddenException(
        roles.includes('ADMIN')
          ? 'এই কাজটা শুধু অ্যাডমিন করতে পারেন।'
          : 'এই কাজটা শুধু সুপার অ্যাডমিন করতে পারেন।',
      );
    return true;
  }
}
