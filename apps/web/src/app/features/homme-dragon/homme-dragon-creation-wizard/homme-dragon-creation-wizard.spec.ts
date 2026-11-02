import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import type { GameSystemContentDto, HommeDragonDto } from '@master-jdr/shared';
import { HommeDragonCreationWizard } from './homme-dragon-creation-wizard';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { CharacterService } from '../../../core/characters/character.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';

const LONG_INTRO = 'Un texte d’introduction long. '.repeat(10);

const CATALOG: GameSystemContentDto = {
  hommeDragonArtefact: [
    {
      key: 'encyclopedie',
      data: {
        key: 'encyclopedie',
        label: 'Encyclopédie',
        race: 'DRAGON_VERT',
        description: 'Les lois fondamentales de l’univers.',
      },
    },
    { key: 'lanterne', data: { key: 'lanterne', label: 'Lanterne', race: 'DRAGON_VERT' } },
    {
      key: 'grand-arc',
      data: { key: 'grand-arc', label: 'Grand arc', race: 'DRAGON_ROUGE' },
    },
  ],
  hommeDragonRace: [
    {
      key: 'DRAGON_VERT',
      data: {
        key: 'DRAGON_VERT',
        label: 'Dragon vert',
        description: 'Le goût du voyage.',
        preferences: ['aventure', 'quête'],
      },
    },
    {
      key: 'DRAGON_BLEU',
      data: { key: 'DRAGON_BLEU', label: 'Dragon bleu', description: 'Les histoires d’amitié.' },
    },
    {
      key: 'DRAGON_ROUGE',
      data: { key: 'DRAGON_ROUGE', label: 'Dragon rouge', description: 'Les récits de batailles.' },
    },
    // Dragon noir : volontairement sans description.
    { key: 'DRAGON_NOIR', data: { key: 'DRAGON_NOIR', label: 'Dragon noir' } },
  ],
  souffle: [
    {
      key: 'nostalgie',
      data: {
        key: 'nostalgie',
        label: 'Nostalgie',
        race: 'DRAGON_VERT',
        ps: 1,
        description: 'Fait resurgir un souvenir.',
      },
    },
    { key: 'defi', data: { key: 'defi', label: 'Défi', race: 'DRAGON_ROUGE', ps: 1 } },
    { key: 'chance', data: { key: 'chance', label: 'Chance', ps: 1, description: 'Commun.' } },
  ],
  hommeDragonCreationIntro: [
    { key: 'race', data: { key: 'race', label: 'Choisir sa race', text: 'Intro race courte.' } },
    { key: 'artefact', data: { key: 'artefact', label: 'Artefact', text: LONG_INTRO } },
    { key: 'artefactNom', data: { key: 'artefactNom', label: 'Nom', text: 'Aide nom artefact.' } },
    { key: 'nom', data: { key: 'nom', label: 'Nom', text: 'Aide nom du dragon.' } },
    { key: 'apparence', data: { key: 'apparence', label: 'Apparence', text: 'Aide apparence.' } },
    { key: 'avatar', data: { key: 'avatar', label: 'Avatar', text: LONG_INTRO } },
  ],
};

function makeDto(): HommeDragonDto {
  return {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: { race: 'DRAGON_VERT', artefact: { key: 'encyclopedie' }, nom: 'Ignis' },
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    aventures: [],
    historique: [],
    derived: { level: 1, PS: 3 },
    eveilPowers: [],
    pendingEveilLevels: [],
  };
}

async function settle(fixture: ComponentFixture<HommeDragonCreationWizard>): Promise<void> {
  for (let i = 0; i < 6; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
  }
  fixture.detectChanges();
}

async function createComponent(
  catalog: GameSystemContentDto | Error = CATALOG,
  create = vi.fn().mockResolvedValue(makeDto()),
  desktop = false,
) {
  const characterSvc = {
    getGameSystemContent:
      catalog instanceof Error
        ? vi.fn().mockRejectedValue(catalog)
        : vi.fn().mockResolvedValue(catalog),
  };
  await TestBed.configureTestingModule({
    imports: [HommeDragonCreationWizard],
    providers: [
      { provide: HommeDragonService, useValue: { create } },
      { provide: CharacterService, useValue: characterSvc },
      {
        provide: ThemeToneService,
        useValue: {
          tone: () => ({
            'homme-dragon.create_cta': 'Créer mon Homme Dragon',
            'homme-dragon.race_label': 'Race',
            'homme-dragon.artefact_label': 'Artefact',
            'common.reduire': 'Réduire',
            'common.lire_la_suite': 'Lire la suite',
            'common.en_savoir_plus': 'En savoir plus',
            'common.precedent_2': 'Précédent',
            'common.suivant_2': 'Suivant',
            'hd.wizard_step_progress': 'Étape {n}/{total} · {etape}',
            'hd.wizard_more_aria': 'En savoir plus sur {nom}',
            'hd.wizard_artefact_empty': "Aucun artefact n'est disponible pour cette race.",
            'hd.wizard_create_conflict_error': 'Cette aventure a déjà un Homme Dragon.',
            'hd.wizard_create_error': 'Impossible de créer votre Homme Dragon. Réessayez.',
          }),
        },
      },
      {
        provide: BreakpointObserver,
        useValue: {
          isMatched: () => desktop,
          observe: () => of({ matches: desktop, breakpoints: {} }),
        },
      },
      provideNoopAnimations(),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HommeDragonCreationWizard);
  fixture.componentRef.setInput('partieId', 'p1');
  fixture.componentRef.setInput('partieName', 'Ma Campagne');
  const emitted: HommeDragonDto[] = [];
  fixture.componentInstance.created.subscribe((d) => emitted.push(d));
  await settle(fixture);
  return { fixture, component: fixture.componentInstance, create, emitted };
}

const root = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement;

function navButtons(f: ComponentFixture<unknown>): { prev: HTMLButtonElement; next: HTMLButtonElement } {
  const [prev, next] = Array.from(
    root(f).querySelectorAll<HTMLButtonElement>('.hdw__nav-bottom button'),
  );
  return { prev, next };
}

async function click(f: ComponentFixture<HommeDragonCreationWizard>, el: HTMLElement): Promise<void> {
  el.click();
  await settle(f);
}

function cards(f: ComponentFixture<unknown>): HTMLButtonElement[] {
  return Array.from(root(f).querySelectorAll<HTMLButtonElement>('app-choice-card button'));
}

async function typeIn(
  f: ComponentFixture<HommeDragonCreationWizard>,
  index: number,
  value: string,
): Promise<void> {
  const fields = root(f).querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    '.hdw__fields input, .hdw__fields textarea',
  );
  const field = fields[index];
  field.value = value;
  field.dispatchEvent(new Event('input'));
  await settle(f);
}

async function next(f: ComponentFixture<HommeDragonCreationWizard>): Promise<void> {
  await click(f, navButtons(f).next);
}

describe('HommeDragonCreationWizard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('Précédent / Suivant : pictogrammes precedent avant et suivant après le libellé, sans caractère ❮ ❯', async () => {
    const { fixture } = await createComponent();
    const { prev, next } = navButtons(fixture);

    expect(prev.querySelector('app-icon')?.getAttribute('data-icon')).toBe('precedent');
    expect(prev.textContent).toContain('Précédent');
    expect(next.querySelector('app-icon')?.getAttribute('data-icon')).toBe('suivant');
    expect(next.textContent).toContain('Suivant');
    // Ordre : l'icône précède « Précédent » et suit « Suivant ».
    expect(prev.innerHTML.indexOf('<app-icon')).toBeLessThan(prev.innerHTML.indexOf('Précédent'));
    expect(next.innerHTML.indexOf('<app-icon')).toBeGreaterThan(next.innerHTML.indexOf('Suivant'));
    expect(prev.textContent! + next.textContent!).not.toMatch(/[❮❯]/);
    // Étape 1 : « Précédent » désactivé, « Suivant » bloqué sans race, comme avant.
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it('étape 1/5 : 4 cartes de race avec nom, étiquette et description du catalogue', async () => {
    const { fixture } = await createComponent();

    expect(root(fixture).querySelector('.hdw__title')!.textContent).toContain('Étape 1/5 · Race');
    const list = cards(fixture);
    expect(list).toHaveLength(4);
    expect(list.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Dragon Vert',
      'Dragon Bleu',
      'Dragon Rouge',
      'Dragon Noir',
    ]);
    const badges = Array.from(root(fixture).querySelectorAll('.choice-card__badge')).map((b) =>
      b.textContent!.trim(),
    );
    expect(badges).toEqual(['Vert', 'Bleu', 'Rouge', 'Noir']);
    expect(list[0].textContent).toContain('Le goût du voyage.');
    expect(list[0].getAttribute('role')).toBe('radio');
    expect(root(fixture).querySelector('[role="radiogroup"]')).toBeTruthy();
  });

  it('« En savoir plus » : hors de la carte-radio, ouvre description + préférences sans sélectionner', async () => {
    const { fixture, component } = await createComponent();

    const triggers = Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('.hdw__more'));
    // Dragon noir n'a pas de description ⇒ pas de déclencheur pour lui.
    expect(triggers).toHaveLength(3);
    expect(triggers.every((t) => !t.closest('[role="radio"]'))).toBe(true);

    await click(fixture, triggers[0]);

    const panel = root(fixture).querySelector('app-detail-surface')!;
    expect(panel.textContent).toContain('Dragon Vert');
    expect(panel.textContent).toContain('Le goût du voyage.');
    expect(panel.textContent).toContain('aventure, quête');
    // Aide au choix : artefacts et souffles PROPRES à la race, pas ceux des autres.
    expect(panel.textContent).toContain('Encyclopédie');
    expect(panel.textContent).toContain('Les lois fondamentales de l’univers.');
    expect(panel.textContent).toContain('Nostalgie · 1 PS');
    expect(panel.textContent).toContain('Fait resurgir un souvenir.');
    expect(panel.textContent).not.toContain('Grand arc');
    expect(panel.textContent).not.toContain('Défi');
    expect(panel.textContent).not.toContain('Chance');
    expect(component['race']()).toBeNull();
    expect(cards(fixture)[0].getAttribute('aria-checked')).toBe('false');
  });

  it('Suivant est bloqué sans race, actif une fois la race choisie', async () => {
    const { fixture } = await createComponent();

    expect(navButtons(fixture).next.disabled).toBe(true);
    expect(navButtons(fixture).prev.disabled).toBe(true);
    await click(fixture, cards(fixture)[0]);
    expect(cards(fixture)[0].getAttribute('aria-checked')).toBe('true');
    expect(navButtons(fixture).next.disabled).toBe(false);
  });

  it('étape 2 : artefacts de la race ; Suivant exige un artefact ET son nom', async () => {
    const { fixture } = await createComponent();
    await click(fixture, cards(fixture)[0]);
    await next(fixture);

    expect(root(fixture).querySelector('.hdw__title')!.textContent).toContain('Étape 2/5 · Artefact');
    expect(cards(fixture).map((c) => c.getAttribute('aria-label'))).toEqual([
      'Encyclopédie',
      'Lanterne',
    ]);
    expect(navButtons(fixture).next.disabled).toBe(true);

    await click(fixture, cards(fixture)[0]);
    expect(navButtons(fixture).next.disabled).toBe(true);

    await typeIn(fixture, 0, '  ');
    expect(navButtons(fixture).next.disabled).toBe(true);
    await typeIn(fixture, 0, 'Codex');
    expect(navButtons(fixture).next.disabled).toBe(false);
  });

  it('aide sous les champs = texte du catalogue', async () => {
    const { fixture } = await createComponent();
    await click(fixture, cards(fixture)[0]);
    await next(fixture);

    expect(root(fixture).querySelector('mat-hint')!.textContent).toContain('Aide nom artefact.');
  });

  it('changer de race réinitialise artefact, nom et inscription de l’artefact', async () => {
    const { fixture, component } = await createComponent();
    await click(fixture, cards(fixture)[0]);
    await next(fixture);
    await click(fixture, cards(fixture)[0]);
    await typeIn(fixture, 0, 'Codex');
    await typeIn(fixture, 1, 'Gravé à la main');
    expect(component['artefactKey']()).toBe('encyclopedie');

    await click(fixture, navButtons(fixture).prev);
    await click(fixture, cards(fixture)[2]);

    expect(component['race']()).toBe('DRAGON_ROUGE');
    expect(component['artefactKey']()).toBeNull();
    expect(component['artefactNom']()).toBe('');
    expect(component['artefactInscription']()).toBe('');
  });

  it('re-sélectionner la même race ne réinitialise rien', async () => {
    const { fixture, component } = await createComponent();
    await click(fixture, cards(fixture)[0]);
    component['artefactKey'].set('encyclopedie');
    component['artefactNom'].set('Codex');

    await click(fixture, cards(fixture)[0]);

    expect(component['artefactKey']()).toBe('encyclopedie');
    expect(component['artefactNom']()).toBe('Codex');
  });

  it('Précédent conserve les saisies', async () => {
    const { fixture, component } = await createComponent();
    await click(fixture, cards(fixture)[0]);
    await next(fixture);
    await click(fixture, cards(fixture)[1]);
    await typeIn(fixture, 0, 'Lumière');
    await next(fixture);
    await typeIn(fixture, 0, 'Ignis');

    await click(fixture, navButtons(fixture).prev);
    await click(fixture, navButtons(fixture).prev);
    expect(component['race']()).toBe('DRAGON_VERT');
    await next(fixture);
    expect(component['artefactKey']()).toBe('lanterne');
    expect(
      (root(fixture).querySelector('.hdw__fields input') as HTMLInputElement).value,
    ).toBe('Lumière');
    await next(fixture);
    expect((root(fixture).querySelector('.hdw__fields input') as HTMLInputElement).value).toBe(
      'Ignis',
    );
  });

  it('étape 3 : Suivant bloqué sans nom du dragon', async () => {
    const { fixture, component } = await createComponent();
    component['race'].set('DRAGON_VERT');
    component['artefactKey'].set('encyclopedie');
    component['artefactNom'].set('Codex');
    component['stepIndex'].set(2);
    await settle(fixture);

    expect(root(fixture).querySelector('.hdw__title')!.textContent).toContain('Étape 3/5 · Identité');
    expect(navButtons(fixture).next.disabled).toBe(true);
    await typeIn(fixture, 0, 'Ignis');
    expect(navButtons(fixture).next.disabled).toBe(false);
  });

  it('étape 4 : « Mondes protégés » pré-rempli du titre de la partie, éditable', async () => {
    const { fixture, component } = await createComponent();
    expect(component['mondesProteges']()).toBe('Ma Campagne');
    component['stepIndex'].set(3);
    await settle(fixture);

    const textareas = root(fixture).querySelectorAll<HTMLTextAreaElement>('.hdw__fields textarea');
    expect(textareas[2].value).toBe('Ma Campagne');
  });

  it('texte d’intro long : tronqué avec « Lire la suite » ; le bouton déploie puis réduit', async () => {
    const { fixture } = await createComponent();
    await click(fixture, cards(fixture)[0]);

    // Étape Race : intro courte ⇒ ni troncature ni bouton.
    expect(root(fixture).querySelector('.hdw__intro-toggle')).toBeNull();

    await next(fixture);
    const text = root(fixture).querySelector('.hdw__intro-text')!;
    const toggle = root(fixture).querySelector<HTMLButtonElement>('.hdw__intro-toggle')!;
    expect(text.classList).toContain('hdw__intro-text--clamped');
    expect(toggle.textContent).toContain('Lire la suite');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await click(fixture, toggle);
    expect(text.classList).not.toContain('hdw__intro-text--clamped');
    expect(toggle.textContent).toContain('Réduire');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await click(fixture, toggle);
    expect(text.classList).toContain('hdw__intro-text--clamped');
  });

  it('race sans artefact au catalogue : message d’absence, Suivant bloqué', async () => {
    const { fixture } = await createComponent();
    await click(fixture, cards(fixture)[1]); // Dragon Bleu : aucun artefact dans le catalogue de test
    await next(fixture);

    expect(cards(fixture)).toHaveLength(0);
    expect(root(fixture).querySelector('.hdw__empty')!.textContent).toContain('Aucun artefact');
    expect(navButtons(fixture).next.disabled).toBe(true);
  });

  it('textes absents (catalogue vide) : parcours complet, sans aide, sans erreur', async () => {
    const { fixture, component } = await createComponent({});

    expect(root(fixture).querySelector('.hdw__intro')).toBeNull();
    expect(root(fixture).querySelector('.hdw__more')).toBeNull();
    expect(cards(fixture)).toHaveLength(4);
    expect(root(fixture).querySelector('.hdw__error')).toBeNull();

    // Les 5 étapes restent atteignables (artefact/nom posés directement : aucun catalogue).
    component['race'].set('DRAGON_VERT');
    component['artefactKey'].set('encyclopedie');
    component['artefactNom'].set('Codex');
    component['nom'].set('Ignis');
    await settle(fixture);
    for (let i = 0; i < 4; i++) await next(fixture);
    expect(root(fixture).querySelector('.hdw__title')!.textContent).toContain('Étape 5/5 · Avatar');
    expect(root(fixture).querySelector('mat-hint')).toBeNull();
    expect(navButtons(fixture).next.disabled).toBe(false);
  });

  it('fetch des catalogues en échec : pas d’erreur bloquante', async () => {
    const { fixture } = await createComponent(new Error('réseau'));

    expect(cards(fixture)).toHaveLength(4);
    expect(root(fixture).querySelector('.hdw__error')).toBeNull();
  });

  it('parcours complet : create() avec artefact {key, nom, inscription} et champs vides à undefined', async () => {
    const { fixture, component, create, emitted } = await createComponent();
    await click(fixture, cards(fixture)[0]);
    await next(fixture);
    await click(fixture, cards(fixture)[0]);
    await typeIn(fixture, 0, '  Codex  ');
    await typeIn(fixture, 1, 'Gravé');
    await next(fixture);
    await typeIn(fixture, 0, 'Ignis');
    await typeIn(fixture, 1, 'Écailles cuivrées');
    await next(fixture);
    await next(fixture);
    await typeIn(fixture, 0, 'Un vieux sage');

    expect(root(fixture).querySelector('.hdw__title')!.textContent).toContain('Étape 5/5 · Avatar');
    const submit = navButtons(fixture).next;
    expect(submit.textContent).toContain('Créer mon Homme Dragon');
    await click(fixture, submit);

    expect(create).toHaveBeenCalledWith('p1', {
      race: 'DRAGON_VERT',
      artefact: { key: 'encyclopedie', nom: 'Codex', inscription: 'Gravé' },
      nom: 'Ignis',
      apparence: 'Écailles cuivrées',
      caractere: undefined,
      vocation: undefined,
      demeure: undefined,
      avatar: 'Un vieux sage',
      mondesProteges: 'Ma Campagne',
    });
    expect(emitted).toEqual([makeDto()]);
    expect(component['creating']()).toBe(false);
  });

  it('inscription vide : envoyée à undefined', async () => {
    const { component, create } = await createComponent();
    component['race'].set('DRAGON_ROUGE');
    component['artefactKey'].set('grand-arc');
    component['artefactNom'].set('Arc de Kael');
    component['nom'].set('Ignis');

    await component['onSubmit']();

    const dto = create.mock.calls[0][1];
    expect(dto.artefact).toEqual({ key: 'grand-arc', nom: 'Arc de Kael', inscription: undefined });
  });

  it('création rejetée : message d’erreur, saisies conservées, réessai possible', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('409')).mockResolvedValueOnce(makeDto());
    const { fixture, component, emitted } = await createComponent(CATALOG, create);
    component['race'].set('DRAGON_ROUGE');
    component['artefactKey'].set('grand-arc');
    component['artefactNom'].set('Arc de Kael');
    component['nom'].set('Ignis');
    component['stepIndex'].set(4);
    await settle(fixture);

    await click(fixture, navButtons(fixture).next);

    expect(root(fixture).querySelector('.hdw__error')!.textContent).toContain('Impossible de créer');
    expect(emitted).toHaveLength(0);
    expect(component['nom']()).toBe('Ignis');
    expect(component['artefactNom']()).toBe('Arc de Kael');
    expect(component['creating']()).toBe(false);

    await click(fixture, navButtons(fixture).next);
    expect(emitted).toHaveLength(1);
    expect(root(fixture).querySelector('.hdw__error')).toBeNull();
  });

  it('409 (l’aventure a reçu un Homme Dragon entre-temps, AD-23) : message dédié, la création est annulée côté serveur', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(new HttpErrorResponse({ status: 409, statusText: 'Conflict' }));
    const { fixture, component, emitted } = await createComponent(CATALOG, create);
    component['race'].set('DRAGON_ROUGE');
    component['artefactKey'].set('grand-arc');
    component['artefactNom'].set('Arc de Kael');
    component['nom'].set('Ignis');
    component['stepIndex'].set(4);
    await settle(fixture);

    await click(fixture, navButtons(fixture).next);

    expect(root(fixture).querySelector('.hdw__error')!.textContent).toContain(
      'Cette aventure a déjà un Homme Dragon',
    );
    expect(emitted).toHaveLength(0);
  });

  it('l’alerte d’erreur de création disparaît dès qu’on change d’étape (Précédent)', async () => {
    const create = vi.fn().mockRejectedValue(new Error('409'));
    const { fixture, component } = await createComponent(CATALOG, create);
    component['race'].set('DRAGON_ROUGE');
    component['artefactKey'].set('grand-arc');
    component['artefactNom'].set('Arc de Kael');
    component['nom'].set('Ignis');
    component['stepIndex'].set(4);
    await settle(fixture);
    await click(fixture, navButtons(fixture).next);
    expect(root(fixture).querySelector('.hdw__error')).toBeTruthy();

    await click(fixture, navButtons(fixture).prev);

    expect(root(fixture).querySelector('.hdw__error')).toBeNull();
    expect(component['createError']()).toBeNull();
  });

  describe('textes d’aide du catalogue rendus sur leur étape', () => {
    const HELP_KEYS = [
      'race',
      'artefact',
      'artefactNom',
      'artefactInscription',
      'nom',
      'apparence',
      'caractere',
      'vocation',
      'demeure',
      'mondesProteges',
      'avatar',
    ];
    const helpText = (key: string) => `Aide distincte pour ${key}.`;
    const HELP_CATALOG: GameSystemContentDto = {
      ...CATALOG,
      hommeDragonCreationIntro: HELP_KEYS.map((key) => ({
        key,
        data: { key, label: key, text: helpText(key) },
      })),
    };

    // step = index de l'étape ; selector = où le texte doit apparaître.
    it.each([
      { key: 'race', step: 0, selector: '.hdw__intro-text' },
      { key: 'artefact', step: 1, selector: '.hdw__intro-text' },
      { key: 'artefactNom', step: 1, selector: 'mat-hint' },
      { key: 'artefactInscription', step: 1, selector: 'mat-hint' },
      { key: 'nom', step: 2, selector: 'mat-hint' },
      { key: 'apparence', step: 2, selector: 'mat-hint' },
      { key: 'caractere', step: 2, selector: 'mat-hint' },
      { key: 'vocation', step: 3, selector: 'mat-hint' },
      { key: 'demeure', step: 3, selector: 'mat-hint' },
      { key: 'mondesProteges', step: 3, selector: 'mat-hint' },
      { key: 'avatar', step: 4, selector: '.hdw__intro-text' },
    ])('« $key » apparaît à l’étape $step ($selector)', async ({ key, step, selector }) => {
      const { fixture, component } = await createComponent(HELP_CATALOG);
      component['stepIndex'].set(step);
      await settle(fixture);

      const texts = Array.from(root(fixture).querySelectorAll(selector)).map((e) =>
        e.textContent!.trim(),
      );
      expect(texts).toContain(helpText(key));
    });
  });

  it('la soumission est refusée si le formulaire est incomplet (nom d’artefact manquant)', async () => {
    const { component, create } = await createComponent();
    component['race'].set('DRAGON_ROUGE');
    component['artefactKey'].set('grand-arc');
    component['nom'].set('Ignis');

    expect(component['isValid']()).toBe(false);
    await component['onSubmit']();
    expect(create).not.toHaveBeenCalled();
  });
  it('mobile : artefact avec description → « En savoir plus » et sous-titre coupé', async () => {
    const { fixture } = await createComponent();
    await click(fixture, cards(fixture)[0]);
    await next(fixture);

    expect(root(fixture).querySelectorAll('.hdw__more')).toHaveLength(1);
    expect(root(fixture).querySelector('.choice-card--full-detail')).toBeNull();
  });

  it('desktop : artefacts affichés en entier, sans « En savoir plus »', async () => {
    const { fixture } = await createComponent(CATALOG, undefined, true);
    await click(fixture, cards(fixture)[0]);
    await next(fixture);

    expect(root(fixture).querySelector('.hdw__more')).toBeNull();
    expect(root(fixture).querySelectorAll('.choice-card--full-detail')).toHaveLength(2);
    expect(root(fixture).querySelector('.choice-card__detail')!.textContent).toContain(
      'Les lois fondamentales de l’univers.',
    );
  });

  it('desktop : les intros longues ne sont jamais tronquées (ni artefact, ni avatar)', async () => {
    const { fixture, component } = await createComponent(CATALOG, undefined, true);
    await click(fixture, cards(fixture)[0]);
    await next(fixture);

    expect(root(fixture).querySelector('.hdw__intro-text')!.textContent).toContain('long');
    expect(root(fixture).querySelector('.hdw__intro-text--clamped')).toBeNull();
    expect(root(fixture).querySelector('.hdw__intro-toggle')).toBeNull();

    component['stepIndex'].set(4);
    await settle(fixture);
    expect(root(fixture).querySelector('.hdw__intro-text')!.textContent).toContain('long');
    expect(root(fixture).querySelector('.hdw__intro-toggle')).toBeNull();
  });
});
