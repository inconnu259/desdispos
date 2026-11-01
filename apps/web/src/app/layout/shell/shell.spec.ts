import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type { AnnouncementDto, PartieDto } from '@master-jdr/shared';
import { Shell } from './shell';
import { MyPartiesService } from '../../core/my-parties/my-parties.service';
import { OpenPollsService } from '../../core/poll/open-polls.service';
import { UnseenAnnouncementsService } from '../../core/announcements/unseen-announcements.service';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { ContextualNavService } from '../../core/navigation/contextual-nav.service';
import { TONE_MAP, type Theme } from '../../core/theme/tones';
import { fillTone } from '../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

@Component({ selector: 'app-test-blank', template: '' })
class BlankComponent {}

function makePartie(overrides: Partial<PartieDto> = {}): PartieDto {
  return {
    id: 'p1',
    name: 'La Forêt Noire',
    kind: 'CAMPAGNE_LINEAIRE',
    gameSystemId: 'ryuutama',
    description: null,
    ownerId: 'mj1',
    createdAt: '',
    nextSessionDate: null,
    nextSessionSlot: null,
    role: 'player',
    status: 'EN_COURS',
    isFavorite: false,
    coverImageVersion: null,
    ...overrides,
  };
}

function makeAnnouncement(overrides: Partial<AnnouncementDto> = {}): AnnouncementDto {
  return {
    id: 'ann1',
    partieId: 'p1',
    scenarioId: null,
    text: 'Une annonce importante',
    createdAt: '2026-08-01T00:00:00.000Z',
    authorPseudo: 'le-mj',
    authorDisplayName: 'Le Grand MJ',
    ...overrides,
  };
}

async function createFixture(
  openPollsCount: number,
  unseenAnnouncementsCount = 0,
  opts: {
    unseenAnnouncements?: AnnouncementDto[];
    parties?: PartieDto[];
    markRead?: ReturnType<typeof vi.fn>;
  } = {},
) {
  await TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideRouter([{ path: 'parties/:id', component: BlankComponent }]),
      provideAnimationsAsync(),
      {
        provide: MyPartiesService,
        useValue: {
          refreshAll: vi.fn().mockResolvedValue(undefined),
          allParties: signal(opts.parties ?? []),
        },
      },
      { provide: OpenPollsService, useValue: { count: signal(openPollsCount) } },
      {
        provide: UnseenAnnouncementsService,
        useValue: {
          count: signal(unseenAnnouncementsCount),
          unseenAnnouncements: signal(opts.unseenAnnouncements ?? []),
          markRead: opts.markRead ?? vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: ThemeToneService,
        useValue: {
          tone: signal(TONE_MAP['grimoire-emeraude']),
          // Lu par <app-icon> : les icônes de sens suivent le thème actif.
          activeTheme: signal<Theme>('grimoire-emeraude'),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Shell);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('Shell — barre de navigation à 4 destinations (Story 29.3, AC1/AC2/AC4/AC5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('expose 4 liens vers Parties, Personnages, Calendrier et Compte', async () => {
    const fixture = await createFixture(0);
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('nav.nav-bar a'),
    ) as HTMLAnchorElement[];
    const hrefs = links.map((a) => a.getAttribute('routerLink') ?? a.getAttribute('href'));

    expect(links.length).toBe(4);
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/characters');
    expect(hrefs).toContain('/profile/calendar');
    expect(hrefs).toContain('/account');
  });

  it('AC4 — le lien vers /account est direct, sans passer par un sous-menu', async () => {
    const fixture = await createFixture(0);
    expect(fixture.nativeElement.querySelector('a[routerLink="/account"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[matMenuTriggerFor]')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-menu')).toBeNull();
  });

  it('aucun mat-menu ni bouton account_circle ne subsiste dans le DOM (menu remplacé par la barre)', async () => {
    const fixture = await createFixture(0);
    expect(fixture.nativeElement.querySelector('mat-menu')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('account_circle');
  });
});

describe('Shell — badge de vote en attente sur la destination Parties (Story 29.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le badge avec le bon compte quand des polls sont ouverts', async () => {
    const fixture = await createFixture(3);
    expect((fixture.componentInstance as any).openPollsCount()).toBe(3);
    const partiesLink = fixture.nativeElement.querySelector('nav.nav-bar a[routerLink="/"]');
    expect(partiesLink.classList.contains('mat-badge-hidden')).toBe(false);
    const content = partiesLink.querySelector('.mat-badge-content');
    expect(content?.textContent?.trim()).toBe('3');
  });

  it('masque le badge quand le compte est 0', async () => {
    const fixture = await createFixture(0);
    expect((fixture.componentInstance as any).openPollsCount()).toBe(0);
    const partiesLink = fixture.nativeElement.querySelector('nav.nav-bar a[routerLink="/"]');
    expect(partiesLink.classList.contains('mat-badge-hidden')).toBe(true);
  });
});

describe('Shell — badge combiné annonces non vues + votes en attente (Story 29.13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('additionne polls en attente et annonces non vues dans le même badge', async () => {
    const fixture = await createFixture(2, 3);
    const partiesLink = fixture.nativeElement.querySelector('nav.nav-bar a[routerLink="/"]');
    expect(partiesLink.classList.contains('mat-badge-hidden')).toBe(false);
    const content = partiesLink.querySelector('.mat-badge-content');
    expect(content?.textContent?.trim()).toBe('5');
  });

  it('affiche le badge dès qu’il y a des annonces non vues, même sans poll en attente', async () => {
    const fixture = await createFixture(0, 1);
    const partiesLink = fixture.nativeElement.querySelector('nav.nav-bar a[routerLink="/"]');
    expect(partiesLink.classList.contains('mat-badge-hidden')).toBe(false);
    const content = partiesLink.querySelector('.mat-badge-content');
    expect(content?.textContent?.trim()).toBe('1');
  });

  it('la description accessible mentionne les annonces non vues, jamais la couleur seule', async () => {
    const fixture = await createFixture(0, 2);
    const partiesLink = fixture.nativeElement.querySelector('nav.nav-bar a[routerLink="/"]');
    expect(partiesLink.getAttribute('aria-description') ?? partiesLink.textContent).toBeTruthy();
    expect((fixture.componentInstance as any).homeBadgeDescription()).toContain(
      fillTone(GRIMOIRE_TONE['shell.badge_announcements_aria'], { n: 2 }),
    );
  });

  it('masque le badge quand aucun poll ni aucune annonce non vue', async () => {
    const fixture = await createFixture(0, 0);
    const partiesLink = fixture.nativeElement.querySelector('nav.nav-bar a[routerLink="/"]');
    expect(partiesLink.classList.contains('mat-badge-hidden')).toBe(true);
  });
});

describe('Shell — bandeau « push » d’annonce non vue (Story 29.13, révision du 2026-08-13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("aucun bandeau tant qu'il n'y a aucune annonce non vue", async () => {
    const fixture = await createFixture(0, 0);
    expect(fixture.nativeElement.querySelector('.announcement-banner')).toBeNull();
  });

  it("aucun bandeau tant que le nom de la Partie n'est pas résolu (course de chargement)", async () => {
    const fixture = await createFixture(0, 1, {
      unseenAnnouncements: [makeAnnouncement()],
      parties: [], // MyPartiesService pas encore chargé
    });
    expect(fixture.nativeElement.querySelector('.announcement-banner')).toBeNull();
  });

  it('affiche la Partie et le texte intégral de l’annonce la plus récente', async () => {
    const fixture = await createFixture(0, 1, {
      unseenAnnouncements: [makeAnnouncement({ text: 'Rendez-vous samedi soir !' })],
      parties: [makePartie({ id: 'p1', name: 'La Forêt Noire' })],
    });

    const banner = fixture.nativeElement.querySelector('.announcement-banner');
    expect(banner?.textContent).toContain('La Forêt Noire');
    expect(banner?.textContent).toContain('Rendez-vous samedi soir !');
  });

  it('un clic sur le bandeau (hors bouton fermer) mène vers la Partie concernée', async () => {
    const fixture = await createFixture(0, 1, {
      unseenAnnouncements: [makeAnnouncement({ partieId: 'p1' })],
      parties: [makePartie({ id: 'p1', name: 'La Forêt Noire' })],
    });

    const link = fixture.nativeElement.querySelector('.announcement-banner__link');
    expect(link.getAttribute('href')).toContain('/parties/p1');
  });

  it('fermer le bandeau appelle markRead() avec le bon id, jamais au simple affichage', async () => {
    const markRead = vi.fn().mockResolvedValue(undefined);
    const fixture = await createFixture(0, 1, {
      unseenAnnouncements: [makeAnnouncement({ id: 'ann-x' })],
      parties: [makePartie({ id: 'p1', name: 'La Forêt Noire' })],
      markRead,
    });

    expect(markRead).not.toHaveBeenCalled();

    fixture.nativeElement.querySelector('.announcement-banner__close').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(markRead).toHaveBeenCalledWith('ann-x');
  });
});

describe('Shell — icônes aux couleurs du thème (Story 51.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const navIcons = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('nav.nav-bar a')).map((a) => a.querySelector('app-icon')!);

  it('chaque destination porte son icône de sens, décorative', async () => {
    const fixture = await createFixture(0);
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('nav.nav-bar a'),
    ) as HTMLAnchorElement[];
    const byHref = Object.fromEntries(
      links.map((a) => [a.getAttribute('routerLink'), a.querySelector('app-icon')]),
    );

    expect(byHref['/']?.getAttribute('data-icon')).toBe('nav-parties');
    expect(byHref['/characters']?.getAttribute('data-icon')).toBe('nav-personnages');
    expect(byHref['/profile/calendar']?.getAttribute('data-icon')).toBe('nav-calendrier');
    expect(byHref['/account']?.getAttribute('data-icon')).toBe('nav-compte');
    for (const icon of navIcons(fixture.nativeElement)) {
      const svg = icon.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
      expect(svg.getAttribute('role')).toBeNull();
    }
    // Plus aucune ligature Material Icons dans la barre.
    expect(fixture.nativeElement.querySelector('nav.nav-bar mat-icon')).toBeNull();
  });

  it('les quatre icônes changent avec le thème, sans recréer le composant', async () => {
    const fixture = await createFixture(0);
    const el = fixture.nativeElement as HTMLElement;
    const drawings = () => navIcons(el).map((i) => i.querySelector('svg')!.innerHTML);
    const before = drawings();
    const instances = navIcons(el);

    (TestBed.inject(ThemeToneService).activeTheme as ReturnType<typeof signal<Theme>>).set(
      'foret-ancienne',
    );
    fixture.detectChanges();

    const after = drawings();
    navIcons(el).forEach((icon, i) => expect(icon).toBe(instances[i]));
    for (let i = 0; i < 4; i++) expect(after[i]).not.toBe(before[i]);
  });

  it('le badge et aria-current restent portés par le lien, pas par l’icône', async () => {
    const fixture = await createFixture(2);
    await TestBed.inject(Router).navigate(['/']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const partiesLink = fixture.nativeElement.querySelector('nav.nav-bar a[routerLink="/"]');
    expect(partiesLink.getAttribute('aria-current')).toBe('page');
    expect(partiesLink.querySelector('.mat-badge-content')?.textContent?.trim()).toBe('2');
    expect(partiesLink.querySelector('app-icon')?.getAttribute('aria-current')).toBeNull();
  });

  it('la croix du bandeau d’annonce est décorative : le bouton garde son aria-label de thème', async () => {
    const fixture = await createFixture(0, 1, {
      unseenAnnouncements: [makeAnnouncement()],
      parties: [makePartie({ id: 'p1', name: 'La Forêt Noire' })],
    });

    const close = fixture.nativeElement.querySelector('.announcement-banner__close') as HTMLElement;
    expect(close.getAttribute('aria-label')).toBe(
      fillTone(GRIMOIRE_TONE['shell.banner_close_aria'], { partie: 'La Forêt Noire' }),
    );
    const icon = close.querySelector('app-icon')!;
    expect(icon.getAttribute('data-icon')).toBe('fermer');
    expect(icon.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(icon.querySelector('svg')?.getAttribute('aria-label')).toBeNull();
    expect(close.querySelector('mat-icon')).toBeNull();
  });
});

describe('Shell — suppression du sélecteur de mode (Story 29.1, AC1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("aucun mat-button-toggle-group n'existe plus dans la navigation", async () => {
    const fixture = await createFixture(0);
    expect(fixture.nativeElement.querySelector('mat-button-toggle-group')).toBeNull();
  });

  it('ngOnInit() charge toute la liste des parties en un seul appel (Story 38.5)', async () => {
    await createFixture(0);
    const myParties = TestBed.inject(MyPartiesService) as unknown as {
      refreshAll: ReturnType<typeof vi.fn>;
    };
    expect(myParties.refreshAll).toHaveBeenCalledTimes(1);
  });
});

describe('Shell — entrée active distinguée autrement que par la couleur (Story 29.3, AC3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('la destination correspondant à la route courante porte aria-current="page" et la classe active', async () => {
    const fixture = await createFixture(0);
    await TestBed.inject(Router).navigate(['/']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('nav.nav-bar a'),
    ) as HTMLAnchorElement[];
    const active = links.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(active.length).toBe(1);
    expect(active[0].classList.contains('nav-bar__link--active')).toBe(true);
  });

  it('les destinations non actives ne portent ni aria-current ni la classe active', async () => {
    const fixture = await createFixture(0);
    await TestBed.inject(Router).navigate(['/']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('nav.nav-bar a'),
    ) as HTMLAnchorElement[];
    const inactive = links.filter((a) => a.getAttribute('aria-current') !== 'page');
    expect(inactive.length).toBe(3);
    for (const link of inactive) {
      expect(link.classList.contains('nav-bar__link--active')).toBe(false);
    }
  });
});

describe('Shell — bandeau contextuel (Story 29.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affiche le titre et le sous-titre quand ContextualNavService.set() a été appelé', async () => {
    const fixture = await createFixture(0);
    const contextualNav = TestBed.inject(ContextualNavService);

    contextualNav.set({ title: 'Les Cendres de Kavaan', subtitle: 'Maître' });
    fixture.detectChanges();

    const t1 = fixture.nativeElement.querySelector('.contextual-header .t1');
    const t2 = fixture.nativeElement.querySelector('.contextual-header .t2');
    expect(t1?.textContent?.trim()).toBe('Les Cendres de Kavaan');
    expect(t2?.textContent?.trim()).toBe('Maître');
  });

  it("n'affiche pas de sous-titre quand aucun n'a été fourni", async () => {
    const fixture = await createFixture(0);
    const contextualNav = TestBed.inject(ContextualNavService);

    contextualNav.set({ title: 'Mes aventures' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.contextual-header .t1')?.textContent?.trim()).toBe(
      'Mes aventures',
    );
    expect(fixture.nativeElement.querySelector('.contextual-header .t2')).toBeNull();
  });

  it('aucun bandeau ne s’affiche tant que title() est null (état par défaut)', async () => {
    const fixture = await createFixture(0);
    expect(fixture.nativeElement.querySelector('.contextual-header')).toBeNull();
  });

  it('AC3 (29.4) : sur un écran contextualisé, aucune entrée de la barre globale ne reste active', async () => {
    const fixture = await createFixture(0);
    await TestBed.inject(Router).navigate(['/']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Point de départ : "Parties" est actif sur '/'.
    let active = Array.from(
      fixture.nativeElement.querySelectorAll('nav.nav-bar a.nav-bar__link--active'),
    );
    expect(active.length).toBe(1);

    await TestBed.inject(Router).navigate(['/parties', '1']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    active = Array.from(
      fixture.nativeElement.querySelectorAll('nav.nav-bar a.nav-bar__link--active'),
    );
    expect(active.length).toBe(0);
    expect(fixture.nativeElement.querySelector('nav.nav-bar a[aria-current="page"]')).toBeNull();
  });
});

describe('Shell — marque « Dés Dispos » après connexion (Story 34.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('barre d’outils : pictogramme + « Dés Dispos », lien vers /, plus de « master-jdr »', async () => {
    const fixture = await createFixture(0);
    const el = fixture.nativeElement as HTMLElement;

    const brand = el.querySelector('mat-toolbar a.brand') as HTMLAnchorElement;
    expect(brand).not.toBeNull();
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.textContent?.trim()).toBe('Dés Dispos');
    // Pictogramme décoratif : le nom écrit à côté donne son nom accessible au lien.
    const svg = brand.querySelector('app-brand-logo svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('mat-toolbar')?.textContent).not.toContain('master-jdr');
  });

  it('bandeau contextuel mobile : pictogramme seul, lien vers /, nom accessible « Dés Dispos »', async () => {
    const fixture = await createFixture(0);
    TestBed.inject(ContextualNavService).set({ title: 'Mes aventures' });
    fixture.detectChanges();

    const compact = fixture.nativeElement.querySelector(
      '.contextual-header a.wordmark-compact',
    ) as HTMLAnchorElement;
    expect(compact).not.toBeNull();
    expect(compact.getAttribute('href')).toBe('/');
    expect(compact.getAttribute('aria-label')).toBe('Dés Dispos');
    expect(compact.textContent?.trim()).toBe('');
    expect(compact.querySelector('app-brand-logo svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Shell — bouton de création dans l’en-tête (Story 38.1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const createLinks = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('a[routerLink="/parties/new"]')) as HTMLAnchorElement[];

  it('barre du haut : lien vers /parties/new, icône + libellé du thème, pour tout utilisateur', async () => {
    // Le Shell ne lit ni rôle ni parties pour ce bouton : aucune partie (nouvel inscrit) suffit.
    const fixture = await createFixture(0);
    const el = fixture.nativeElement as HTMLElement;

    const link = el.querySelector('mat-toolbar a.create-cta') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('routerLink')).toBe('/parties/new');
    expect(link.textContent?.trim()).toBe(GRIMOIRE_TONE['nav.create_game']);
    expect(link.getAttribute('aria-label')).toBe(GRIMOIRE_TONE['nav.create_game']);
    expect(link.querySelector('app-create-icon svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sans titre contextuel : un seul bouton dans le DOM, celui de la barre', async () => {
    const fixture = await createFixture(0);
    expect(createLinks(fixture.nativeElement)).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.contextual-header')).toBeNull();
    // La barre reste affichée sur mobile : c'est elle qui porte le bouton.
    expect(fixture.nativeElement.querySelector('mat-toolbar').classList).not.toContain(
      'hidden-mobile',
    );
  });

  it('avec titre contextuel : bouton icône seule dans le bandeau, nom accessible = libellé du thème', async () => {
    const fixture = await createFixture(0);
    TestBed.inject(ContextualNavService).set({ title: 'Mes aventures' });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.contextual-header a.create-cta--header',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('routerLink')).toBe('/parties/new');
    expect(link.getAttribute('aria-label')).toBe(GRIMOIRE_TONE['nav.create_game']);
    // La barre du haut est masquée sur mobile (CSS) : un seul bouton visible à la fois.
    expect(fixture.nativeElement.querySelector('mat-toolbar').classList).toContain('hidden-mobile');
    // Icône seule : aucun texte visible, glyphe décoratif.
    expect(link.textContent?.trim()).toBe('');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // Le titre reste entier : le bouton est le dernier enfant du bandeau, à droite de .titles.
    expect(link.previousElementSibling?.classList).toContain('titles');
    expect(fixture.nativeElement.querySelector('.titles .t1').textContent.trim()).toBe(
      'Mes aventures',
    );
  });

  it.each([
    ['foret-ancienne', 'Ouvrir un sentier'],
    ['atelier-cuivre', 'Initier une mission'],
  ] as const)('le libellé et le nom accessible suivent le thème %s', async (theme, label) => {
    const fixture = await createFixture(0);
    TestBed.inject(ContextualNavService).set({ title: 'Mes aventures' });
    (TestBed.inject(ThemeToneService).tone as ReturnType<typeof signal>).set(TONE_MAP[theme]);
    fixture.detectChanges();

    const links = createLinks(fixture.nativeElement);
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute('aria-label')).toBe(label);
    }
    expect(links[0].textContent?.trim()).toBe(label);
  });
});
