import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import '../session-lifetime.middleware';

// Au login : exécute la stratégie locale PUIS établit la session (super.logIn).
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest<Request>();
    await super.logIn(request);
    // Point de départ de la durée de vie absolue de la session (cf. enforceSessionLifetime). Posé APRÈS
    // logIn(), qui régénère la session (anti-fixation) et en efface donc le contenu.
    request.session.authenticatedAt = Date.now();
    return result;
  }
}
