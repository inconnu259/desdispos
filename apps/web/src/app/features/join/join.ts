import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { familyOf } from '@master-jdr/shared';
import type { InviteLinkPreviewDto } from '@master-jdr/shared';
import { AuthService } from '../../core/auth/auth.service';
import { JoinService } from '../../core/join/join.service';
import { MyPartiesService } from '../../core/my-parties/my-parties.service';
import { gameSystemName } from '../../core/parties/parties.util';
import { APP_TITLE } from '../../core/title/page-title.strategy';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { fillTone } from '../../core/theme/tone-format';
import { AuthBand } from '../auth/auth-band/auth-band';

@Component({
  selector: 'app-join',
  imports: [AuthBand, RouterLink, MatCardModule, MatButtonModule],
  templateUrl: './join.html',
  styleUrl: './join.scss',
})
export class Join implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly joinSvc = inject(JoinService);
  private readonly myPartiesSvc = inject(MyPartiesService);
  private readonly theme = inject(ThemeToneService);
  private readonly titleService = inject(Title);
  protected readonly tone = this.theme.tone;

  protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  protected readonly preview = signal<InviteLinkPreviewDto | null>(null);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loggedIn = this.auth.currentUser;
  protected readonly system = gameSystemName;

  /** Story 39.3 : l'invitation mène à un groupe de ralliement — famille lue dans le registre des
   *  systèmes (jamais un identifiant en dur). Tous les textes de l'écran passent alors par les
   *  variantes `join.ralliement_*`, sans mot de JDR. */
  protected readonly isGroup = computed(() => {
    const pv = this.preview();
    return pv !== null && familyOf(pv.gameSystemId) === 'ralliement';
  });

  /** Libellé thématisé d'un texte de l'écran, variante « ralliement » comprise. */
  protected text(name: 'title' | 'login_or_register' | 'join_error'): string {
    const tone = this.tone();
    return this.isGroup() ? tone[`join.ralliement_${name}`] : tone[`join.${name}`];
  }

  /** Libellé du bouton « Rejoindre » (et titre d'onglet) : variante « ralliement » pour un groupe. */
  protected joinLabel(): string {
    const tone = this.tone();
    return this.isGroup() ? tone['join.ralliement_join_btn'] : tone['common.rejoindre'];
  }

  /** Titre de l'écran : « Rejoindre « nom de la partie » », gabarit lu dans le registre. */
  protected joinTitle(partieName: string): string {
    return fillTone(this.text('title'), { name: partieName });
  }

  async ngOnInit(): Promise<void> {
    await this.auth.loadSession();
    try {
      this.preview.set(await this.joinSvc.preview(this.token));
      // Le titre d'onglet de la route (« Rejoindre le grimoire ») ne connaît pas la famille de
      // l'invitation : pour un groupe, on le remplace une fois l'aperçu reçu (Story 39.3).
      if (this.isGroup()) this.titleService.setTitle(`${APP_TITLE} – ${this.joinLabel()}`);
    } catch {
      this.notFound.set(true);
    }
  }

  async join(): Promise<void> {
    this.error.set(null);
    try {
      const { partieId } = await this.joinSvc.join(this.token);
      await this.myPartiesSvc.refreshAll();
      void this.router.navigate(['/parties', partieId]);
    } catch {
      this.error.set(this.text('join_error'));
    }
  }
}
