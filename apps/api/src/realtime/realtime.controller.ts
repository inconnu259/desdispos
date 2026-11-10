import {
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Req,
  Sse,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import type { Request } from 'express';
import { from, interval, merge, of, type Observable } from 'rxjs';
import { catchError, concatMap, filter, finalize, map, share, takeUntil } from 'rxjs/operators';
import type { AuthUser } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PermissionService } from '../permissions/permission.service';
import { RealtimeEventsService, partieTopic, userTopic } from './realtime-events.service';

/** Battement de cœur : un proxy (Cloudflare coupe à 100 s) ne doit jamais voir un flux muet. À chaque
 *  battement, le droit d'écouter est revérifié. */
export const SSE_HEARTBEAT_MS = 25_000;
/** Flux simultanés par utilisateur (plusieurs onglets × une page et ses dialogues ouverts). */
export const MAX_SSE_STREAMS_PER_USER = 10;

/** Événement nommé `ping` : le client n'écoute que `message` et `open`, il l'ignore donc (aucun rechargement). */
const PING: MessageEvent = { type: 'ping', data: '' };

// Pas de préfixe de classe (contrairement aux autres controllers `parties/:id/...` du projet) :
// ce fichier portera aussi GET /users/me/events (Story 21.1), un préfixe distinct dans le même
// controller — chaque route déclare donc son chemin complet plutôt qu'un préfixe partagé
// (revue de code Story 18.2).
@UseGuards(AuthenticatedGuard)
@Controller()
export class RealtimeController {
  /** Flux ouverts par utilisateur (mémoire du processus : une seule instance d'API). */
  private readonly openStreams = new Map<string, number>();

  constructor(
    private readonly permissions: PermissionService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  @Sse('parties/:id/events')
  async partieEvents(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<Observable<MessageEvent>> {
    // AD-5 : même contrôle que le reste de l'API.
    await this.permissions.assert(user.id, 'PARTIE_READ', { partieId: id });
    return this.guardedStream(user.id, partieTopic(id), async () => {
      if (!(await sessionStillValid(req))) return false;
      await this.permissions.assert(user.id, 'PARTIE_READ', { partieId: id });
      return true;
    });
  }

  @Sse('users/me/events')
  userEvents(@CurrentUser() user: AuthUser, @Req() req: Request): Observable<MessageEvent> {
    return this.guardedStream(user.id, userTopic(user.id), () => sessionStillValid(req));
  }

  /**
   * Revue de sécurité 2026-11. Avant, le droit n'était vérifié qu'à l'ouverture : un membre retiré (ou une
   * session révoquée par un changement de mot de passe) continuait de recevoir les signaux du flux déjà
   * ouvert ; le nombre de flux n'était pas borné ; et aucun battement ne passait. Désormais : plafond par
   * utilisateur, battement toutes les 25 s, et le flux se FERME dès que le droit tombe (la reconnexion
   * automatique du navigateur reçoit alors 401/403 et s'arrête).
   */
  private guardedStream(
    userId: string,
    topic: string,
    stillAllowed: () => Promise<boolean>,
  ): Observable<MessageEvent> {
    const open = this.openStreams.get(userId) ?? 0;
    if (open >= MAX_SSE_STREAMS_PER_USER) {
      throw new HttpException(
        'Trop de connexions temps réel ouvertes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.openStreams.set(userId, open + 1);

    const checks$ = interval(SSE_HEARTBEAT_MS).pipe(
      concatMap(() => from(stillAllowed()).pipe(catchError(() => of(false)))),
      share(),
    );
    const events$ = this.realtimeEvents
      .subscribe(topic)
      .pipe(map((): MessageEvent => ({ data: {} })));
    const pings$ = checks$.pipe(
      filter((ok) => ok),
      map(() => PING),
    );
    const revoked$ = checks$.pipe(filter((ok) => !ok));

    return merge(events$, pings$).pipe(
      takeUntil(revoked$),
      finalize(() => {
        const n = (this.openStreams.get(userId) ?? 1) - 1;
        if (n <= 0) this.openStreams.delete(userId);
        else this.openStreams.set(userId, n);
      }),
    );
  }
}

/** La session de cette requête existe-t-elle encore dans le store (déconnexion, mot de passe changé, compte
 *  effacé, durée de vie dépassée) ? */
function sessionStillValid(req: Request): Promise<boolean> {
  return new Promise((resolve) => {
    req.sessionStore.get(req.sessionID, (err, session) => {
      resolve(
        !err && Boolean((session as { passport?: { user?: unknown } } | null)?.passport?.user),
      );
    });
  });
}
