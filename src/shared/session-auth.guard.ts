import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionService } from '../auth/session.service';
import { AppException } from './app-exception';
import { ERROR_CODES } from './error-codes';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined>; user?: unknown }>();
    const rawAuthHeader = request.headers.authorization;
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppException(401, ERROR_CODES.UNAUTHORIZED, 'Missing or expired session token');
    }

    const sessionToken = authHeader.slice('Bearer '.length).trim();
    const session = await this.sessionService.getSession(sessionToken);

    if (!session) {
      throw new AppException(401, ERROR_CODES.UNAUTHORIZED, 'Missing or expired session token');
    }

    request.user = {
      id: session.userId,
      username: session.username,
    };

    return true;
  }
}
