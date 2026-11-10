import { TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { AuthUser, HommeDragonDto, PartieDto } from '@desdispos/shared';
import { HommeDragonCreationPage } from './homme-dragon-creation-page';
import { HommeDragonCreationWizard } from '../homme-dragon-creation-wizard/homme-dragon-creation-wizard';
import { PartiesService } from '../../../core/parties/parties.service';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

@Component({
  selector: 'app-homme-dragon-creation-wizard',
  template: '<p class="wizard-stub"></p>',
})
class WizardStub {
  readonly partieId = input.required<string>();
  readonly partieName = input.required<string>();
  readonly created = output<HommeDragonDto>();
}

function makePartie(overrides: Partial<PartieDto> = {}): PartieDto {
  return {
    id: 'p1',
    name: 'Le Convoi du Nord',
    kind: 'CAMPAGNE_EPISODIQUE',
    gameSystemId: 'ryuutama',
    description: null,
    ownerId: 'mj1',
    createdAt: '2026-07-01T00:00:00.000Z',
    nextSessionDate: null,
    nextSessionSlot: null,
    role: 'mj',
    status: 'A_VENIR',
    isFavorite: false,
    coverImageVersion: null,
    can: { coverUpdate: true },
    ...overrides,
  };
}

async function createPage(options: {
  partie?: PartieDto;
  userId?: string;
  getRejects?: boolean;
  existing?: { id: string; nom: string } | null;
  findForPartieRejects?: boolean;
}) {
  const partiesSvc = {
    get: options.getRejects
      ? vi.fn().mockRejectedValue(new Error('404'))
      : vi.fn().mockResolvedValue(options.partie ?? makePartie()),
  };
  const hommeDragonSvc = {
    findForPartie: options.findForPartieRejects
      ? vi.fn().mockRejectedValue(new Error('500'))
      : vi.fn().mockResolvedValue(options.existing ?? null),
  };
  await TestBed.configureTestingModule({
    imports: [HommeDragonCreationPage],
    providers: [
      provideRouter([]),
      { provide: PartiesService, useValue: partiesSvc },
      { provide: HommeDragonService, useValue: hommeDragonSvc },
      {
        provide: AuthService,
        useValue: { currentUser: signal({ id: options.userId ?? 'mj1' } as AuthUser) },
      },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'p1']]) } } },
    ],
  })
    .overrideComponent(HommeDragonCreationPage, {
      remove: { imports: [HommeDragonCreationWizard] },
      add: { imports: [WizardStub] },
    })
    .compileComponents();
  const router = TestBed.inject(Router);
  const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(HommeDragonCreationPage);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  return { fixture, partiesSvc, hommeDragonSvc, navigateSpy };
}

describe('HommeDragonCreationPage (Story 33.5, AD-23 / 33.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('MJ d’une partie Ryuutama sans Homme Dragon → héberge le parcours de création, partie transmise', async () => {
    const { fixture, navigateSpy } = await createPage({});

    expect(fixture.nativeElement.querySelector('.wizard-stub')).not.toBeNull();
    const wizard = fixture.debugElement.query((d) => d.name === 'app-homme-dragon-creation-wizard');
    expect(wizard.componentInstance.partieId()).toBe('p1');
    expect(wizard.componentInstance.partieName()).toBe('Le Convoi du Nord');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('pose le bandeau contextuel (titre + nom de la partie)', async () => {
    await createPage({});

    const nav = TestBed.inject(ContextualNavService);
    expect(nav.title()).toBe(GRIMOIRE_TONE['hd.creation_page_title']);
    expect(nav.subtitle()).toBe('Le Convoi du Nord');
  });

  it('une fois la fiche créée → navigue vers /homme-dragons/:id avec l’indicateur « fiche créée »', async () => {
    const { fixture, navigateSpy } = await createPage({});
    const wizard = fixture.debugElement.query((d) => d.name === 'app-homme-dragon-creation-wizard');

    wizard.componentInstance.created.emit({ id: 'hdNew' } as HommeDragonDto);

    expect(navigateSpy).toHaveBeenCalledWith(['/homme-dragons', 'hdNew'], {
      state: { justCreated: true },
    });
  });

  it('l’aventure a déjà un Homme Dragon → redirige vers sa fiche, parcours jamais rendu', async () => {
    const { fixture, navigateSpy } = await createPage({ existing: { id: 'hd7', nom: 'Ignis' } });

    expect(navigateSpy).toHaveBeenCalledWith(['/homme-dragons', 'hd7'], { replaceUrl: true });
    expect(fixture.nativeElement.querySelector('.wizard-stub')).toBeNull();
  });

  it('utilisateur non MJ → redirection vers /parties/:id, rien d’autre lu', async () => {
    const { fixture, navigateSpy, hommeDragonSvc } = await createPage({ userId: 'joueur1' });

    expect(navigateSpy).toHaveBeenCalledWith(['/parties', 'p1'], { replaceUrl: true });
    expect(hommeDragonSvc.findForPartie).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.wizard-stub')).toBeNull();
  });

  it('MJ d’une partie hors Ryuutama → redirection vers /parties/:id', async () => {
    const { fixture, navigateSpy } = await createPage({
      partie: makePartie({ gameSystemId: 'draconis' }),
    });

    expect(navigateSpy).toHaveBeenCalledWith(['/parties', 'p1'], { replaceUrl: true });
    expect(fixture.nativeElement.querySelector('.wizard-stub')).toBeNull();
  });

  it('partie illisible → message d’erreur et lien de retour, ni redirection ni parcours', async () => {
    const { fixture, navigateSpy } = await createPage({ getRejects: true });

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.wizard-stub')).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('lecture de l’Homme Dragon de l’aventure en échec → message, jamais un parcours qui doublerait la création', async () => {
    const { fixture, navigateSpy } = await createPage({ findForPartieRejects: true });

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.wizard-stub')).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
