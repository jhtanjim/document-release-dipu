import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.module';
import { AuthUser, COOKIE, IS_PUBLIC, ROLES } from './decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
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

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES,
      targets,
    );
    if (roles && !roles.includes(user.role))
      throw new ForbiddenException('এই কাজটা শুধু অ্যাডমিন করতে পারেন।');
    return true;
  }
}
