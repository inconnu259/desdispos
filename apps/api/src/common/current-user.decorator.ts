import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';

/** Récupère l'utilisateur de la session (désérialisé par Passport) dans un handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
