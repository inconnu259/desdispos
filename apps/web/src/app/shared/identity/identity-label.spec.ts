import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IdentityLabel } from './identity-label';
import { ThemeToneService } from '../../core/theme/theme-tone.service';

function makeThemeService() {
  return {
    // `activeTheme` : `<app-icon>` (icônes de rôle « de sens », story 51.7) lit le thème actif.
    activeTheme: signal('grimoire-emeraude'),
    tone: () => ({
      'identity.character_label': 'Personnage',
      'identity.player_label': 'Joueur',
    }),
  };
}

async function createComponent(inputs: {
  characterName?: string | null;
  playerName?: string | null;
  pseudo?: string | null;
  ambiguous?: boolean;
}) {
  await TestBed.configureTestingModule({
    imports: [IdentityLabel],
    providers: [{ provide: ThemeToneService, useValue: makeThemeService() }],
  }).compileComponents();
  const fixture = TestBed.createComponent(IdentityLabel);
  if (inputs.characterName !== undefined) {
    fixture.componentRef.setInput('characterName', inputs.characterName);
  }
  if (inputs.playerName !== undefined) {
    fixture.componentRef.setInput('playerName', inputs.playerName);
  }
  if (inputs.pseudo !== undefined) {
    fixture.componentRef.setInput('pseudo', inputs.pseudo);
  }
  if (inputs.ambiguous !== undefined) {
    fixture.componentRef.setInput('ambiguous', inputs.ambiguous);
  }
  fixture.detectChanges();
  return fixture;
}

describe('IdentityLabel', () => {
  it('mode joint (les deux noms fournis) : personnage en italique, joueur en romain, aucune icône', async () => {
    const fixture = await createComponent({
      characterName: 'Ombreflèche',
      playerName: 'Incon',
    });
    const el = fixture.nativeElement;
    const characterEl = el.querySelector('.identity-label__character');
    const playerEl = el.querySelector('.identity-label__player');
    expect(characterEl.textContent.trim()).toBe('Ombreflèche');
    expect(playerEl.textContent.trim()).toBe('Incon');
    expect(el.querySelector('svg')).toBeNull();
  });

  it('mode single-character (personnage seul) : icône écu + aria-label', async () => {
    const fixture = await createComponent({ characterName: 'Ombreflèche' });
    const el = fixture.nativeElement;
    expect(el.querySelector('.identity-label__name').textContent.trim()).toBe('Ombreflèche');
    const svg = el.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('app-icon')?.getAttribute('data-icon')).toBe('role-mj');
    const wrapper = el.querySelector('.identity-label--single');
    expect(wrapper.getAttribute('aria-label')).toBe('Personnage Ombreflèche');
  });

  it('mode single-player (joueur seul) : icône silhouette + aria-label', async () => {
    const fixture = await createComponent({ playerName: 'Incon' });
    const el = fixture.nativeElement;
    expect(el.querySelector('.identity-label__name').textContent.trim()).toBe('Incon');
    const wrapper = el.querySelector('.identity-label--single');
    expect(wrapper.getAttribute('aria-label')).toBe('Joueur Incon');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('app-icon')?.getAttribute('data-icon')).toBe('role-joueur');
  });

  it('mode single-player + ambiguous=true + pseudo fourni : pseudo visible en complément (AC3)', async () => {
    const fixture = await createComponent({
      playerName: 'Incon',
      ambiguous: true,
      pseudo: 'incon259',
    });
    const el = fixture.nativeElement;
    const pseudoEl = el.querySelector('.identity-label__pseudo');
    expect(pseudoEl).not.toBeNull();
    expect(pseudoEl.textContent.trim()).toBe('(incon259)');
  });

  it("Revue de code : mode single-player + ambiguous=true + pseudo fourni → l'aria-label inclut le pseudo (le lecteur d'écran doit pouvoir distinguer deux entrées homonymes)", async () => {
    const fixture = await createComponent({
      playerName: 'Même Nom',
      ambiguous: true,
      pseudo: 'incon259',
    });
    const el = fixture.nativeElement;
    const wrapper = el.querySelector('.identity-label--single');
    expect(wrapper.getAttribute('aria-label')).toBe('Joueur Même Nom (incon259)');
  });

  it('mode single-player + ambiguous=false (défaut) : pseudo absent même si fourni', async () => {
    const fixture = await createComponent({ playerName: 'Incon', pseudo: 'incon259' });
    const el = fixture.nativeElement;
    expect(el.querySelector('.identity-label__pseudo')).toBeNull();
  });

  it('mode joint avec ambiguous=true : aucun effet, le pseudo ne s’affiche pas hors mode single-player', async () => {
    const fixture = await createComponent({
      characterName: 'Ombreflèche',
      playerName: 'Incon',
      ambiguous: true,
      pseudo: 'incon259',
    });
    const el = fixture.nativeElement;
    expect(el.querySelector('.identity-label__pseudo')).toBeNull();
  });

  it('mode single-character avec ambiguous=true : aucun effet', async () => {
    const fixture = await createComponent({
      characterName: 'Ombreflèche',
      ambiguous: true,
      pseudo: 'incon259',
    });
    const el = fixture.nativeElement;
    expect(el.querySelector('.identity-label__pseudo')).toBeNull();
  });

  it('story 51.7 : l’icône de rôle suit le thème en place (silhouette et écu), jamais de <svg> en ligne', async () => {
    const joueur = await createComponent({ playerName: 'Incon' });
    const icon = joueur.nativeElement.querySelector('app-icon') as HTMLElement;
    const before = icon.querySelector('svg')!.innerHTML;

    (
      TestBed.inject(ThemeToneService) as unknown as { activeTheme: { set(t: string): void } }
    ).activeTheme.set('foret-ancienne');
    joueur.detectChanges();
    expect(icon.getAttribute('data-icon')).toBe('role-joueur');
    expect(icon.querySelector('svg')!.innerHTML).not.toBe(before);
    expect(icon.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });
});
