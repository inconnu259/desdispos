import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type { PartieDto, PartieKind, ScenarioDto } from '@master-jdr/shared';
import { PartieForm } from './partie-form';
import { PartiesService } from '../../../core/parties/parties.service';
import { MyPartiesService } from '../../../core/my-parties/my-parties.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { TONE_MAP, THEMES } from '../../../core/theme/tones';

const PARTIE: PartieDto = {
  id: 'p1',
  name: 'La Guilde des Ombres',
  kind: 'CAMPAGNE_EPISODIQUE',
  gameSystemId: 'draconis',
  description: null,
  ownerId: 'mj1',
  ownerPseudo: 'mj-pseudo',
  ownerDisplayName: 'MJ Nom',
  createdAt: '2026-07-01T00:00:00.000Z',
  nextSessionDate: null,
  nextSessionSlot: null,
  role: 'mj',
  status: 'A_VENIR',
  isFavorite: false,
  coverImageVersion: null,
};

function scenario(over: Partial<ScenarioDto> = {}): ScenarioDto {
  return {
    id: 's1',
    partieId: 'p1',
    title: 'Le Marché aux Ombres',
    description: null,
    status: 'A_VENIR',
    dureeHeures: null,
    dureeSeances: null,
    resumeFin: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    closedAt: null,
    seances: [],
    retrospectiveNotes: [],
    ...over,
  } as ScenarioDto;
}

async function createComponent(
  editId: string | null = null,
  options: {
    partie?: Partial<PartieDto>;
    scenarios?: ScenarioDto[];
    /** Maintient `get()` en attente : observe l'état intermédiaire d'une édition. */
    getPromise?: Promise<PartieDto>;
  } = {},
) {
  const partie = { ...PARTIE, ...options.partie };
  const partiesSvc = {
    get: vi.fn().mockImplementation(() => options.getPromise ?? Promise.resolve(partie)),
    create: vi.fn().mockResolvedValue({ ...partie, id: 'new-id' }),
    update: vi.fn().mockResolvedValue(partie),
    convertKind: vi.fn().mockResolvedValue(partie),
    setCoverImage: vi.fn().mockResolvedValue({ ...partie, coverImageVersion: 'v1' }),
    removeCoverImage: vi.fn().mockResolvedValue({ ...partie, coverImageVersion: null }),
  };
  const myPartiesSvc = { refreshAll: vi.fn().mockResolvedValue(undefined) };
  const scenariosSvc = {
    listAll: vi.fn().mockResolvedValue(options.scenarios ?? []),
  };

  await TestBed.configureTestingModule({
    imports: [PartieForm],
    providers: [
      provideAnimationsAsync(),
      // Vrai Router (patron my-characters.spec.ts) : ContextualNavService s'abonne à
      // `Router.events`, qu'un mock objet n'expose pas.
      provideRouter([]),
      { provide: PartiesService, useValue: partiesSvc },
      { provide: MyPartiesService, useValue: myPartiesSvc },
      { provide: ScenariosService, useValue: scenariosSvc },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => editId } } },
      },
    ],
  }).compileComponents();

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(PartieForm);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, partiesSvc, myPartiesSvc, scenariosSvc, router };
}

describe('PartieForm', () => {
  it('propose les 3 types de partie, y compris la campagne épisodique', async () => {
    const { fixture } = await createComponent();
    const toggles = Array.from(
      fixture.nativeElement.querySelectorAll('.kind-toggle mat-button-toggle'),
    ) as HTMLElement[];
    expect(toggles).toHaveLength(3);
  });

  describe('systèmes de jeu proposés (Story 29.17)', () => {
    it('AC1 — création : seuls les systèmes avec module de création de personnage sont proposés', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      expect(comp.systems().map((s: { id: string }) => s.id)).toEqual(['ryuutama']);
    });

    it('défaut du formulaire de création : le premier système avec module (jamais draconis)', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      expect(comp.form.value.gameSystemId).toBe('ryuutama');
    });

    it('édition d’une partie déjà sur un système sans module : ce système reste visible/sélectionné', async () => {
      const { fixture } = await createComponent('p1', { partie: { gameSystemId: 'draconis' } });
      const comp = fixture.componentInstance as any;
      expect(comp.systems().map((s: { id: string }) => s.id)).toEqual(
        expect.arrayContaining(['ryuutama', 'draconis']),
      );
      expect(comp.form.value.gameSystemId).toBe('draconis');
    });

    it("édition d’une partie déjà sur un système sans module : aucun AUTRE système sans module ne devient choisissable", async () => {
      const { fixture } = await createComponent('p1', { partie: { gameSystemId: 'draconis' } });
      const comp = fixture.componentInstance as any;
      const ids = comp.systems().map((s: { id: string }) => s.id);
      expect(ids).not.toContain('conte-de-minuit');
      expect(ids).not.toContain('esteren');
    });

    it("édition d'une partie dont le gameSystemId ne correspond à AUCUN GAME_SYSTEMS connu : reste visible plutôt que disparaître du menu (revue de code)", async () => {
      const { fixture } = await createComponent('p1', {
        partie: { gameSystemId: 'systeme-disparu' },
      });
      const comp = fixture.componentInstance as any;
      const ids = comp.systems().map((s: { id: string }) => s.id);
      expect(ids).toContain('systeme-disparu');
      expect(comp.form.value.gameSystemId).toBe('systeme-disparu');
    });
  });

  it.each(['ONE_SHOT', 'CAMPAGNE_LINEAIRE', 'CAMPAGNE_EPISODIQUE'] as PartieKind[])(
    'création : soumettre avec kind=%s appelle create() avec ce kind exact',
    async (kind) => {
      const { fixture, partiesSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.form.patchValue({ name: 'Ma partie', gameSystemId: 'draconis', kind });
      await comp.submit();
      expect(partiesSvc.create).toHaveBeenCalledWith(expect.objectContaining({ kind }));
    },
  );

  it('création : appelle refreshAll() après succès (Story 29.1, setMode disparu)', async () => {
    const { fixture, myPartiesSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    comp.form.patchValue({ name: 'Ma partie', gameSystemId: 'draconis', kind: 'ONE_SHOT' });
    await comp.submit();
    expect(myPartiesSvc.refreshAll).toHaveBeenCalledTimes(1);
  });

  it('édition d’une Partie CAMPAGNE_EPISODIQUE : le formulaire pré-remplit kind sans le rabattre sur CAMPAGNE_LINEAIRE', async () => {
    const { fixture, partiesSvc } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    expect(comp.form.value.kind).toBe('CAMPAGNE_EPISODIQUE');

    await comp.submit();
    expect(partiesSvc.update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ kind: 'CAMPAGNE_EPISODIQUE' }),
    );
  });

  it('édition sans changement de type : aucune conversion déclenchée', async () => {
    const { fixture, partiesSvc } = await createComponent('p1');
    const comp = fixture.componentInstance as any;
    comp.form.patchValue({ name: 'Nouveau nom' });

    await comp.submit();

    expect(partiesSvc.convertKind).not.toHaveBeenCalled();
    expect(partiesSvc.update).toHaveBeenCalled();
  });

  describe('conversion de type (Story 29.14)', () => {
    it('AC11 — un type inatteignable est désactivé ET sa raison est visible', async () => {
      const { fixture } = await createComponent('p1', {
        scenarios: [scenario({ id: 's1' }), scenario({ id: 's2' })],
      });

      const oneShotToggle = Array.from(
        fixture.nativeElement.querySelectorAll('mat-button-toggle'),
      )[0] as HTMLElement;
      expect(oneShotToggle.classList.contains('mat-button-toggle-disabled')).toBe(true);

      const reasons = fixture.nativeElement.querySelectorAll('.kind-reason');
      expect(reasons.length).toBeGreaterThan(0);
      expect((reasons[0] as HTMLElement).textContent).toContain('2');
    });

    it('AC11 — à 1 scénario, aucun type n’est désactivé', async () => {
      const { fixture } = await createComponent('p1', {
        scenarios: [scenario({ id: 's1' })],
      });
      const disabled = fixture.nativeElement.querySelectorAll(
        'mat-button-toggle.mat-button-toggle-disabled',
      );
      expect(disabled).toHaveLength(0);
      expect(fixture.nativeElement.querySelectorAll('.kind-reason')).toHaveLength(0);
    });

    it('AC11 — partie clôturée : tous les autres types sont refusés, raison affichée', async () => {
      const { fixture } = await createComponent('p1', {
        partie: { status: 'TERMINEE' },
        scenarios: [scenario({ id: 's1' })],
      });
      const disabled = fixture.nativeElement.querySelectorAll(
        'mat-button-toggle.mat-button-toggle-disabled',
      );
      expect(disabled).toHaveLength(2); // les deux types autres que celui en cours
      expect(fixture.nativeElement.textContent).toMatch(/rouvr/i);
    });

    it('AC8 (révisé, revue de code du 2026-08-14) — l’enregistrement des autres champs passe AVANT la conversion', async () => {
      // Ordre inversé par rapport à la version initiale : convertKind() lit partie.name côté
      // serveur — l'exécuter en premier titrerait un scénario auto-créé (AC7) avec un nom déjà
      // périmé si le MJ renomme ET convertit dans le même envoi.
      const { fixture, partiesSvc } = await createComponent('p1', {
        scenarios: [scenario({ id: 's1' })],
      });
      const comp = fixture.componentInstance as any;
      const order: string[] = [];
      partiesSvc.convertKind.mockImplementation(async () => {
        order.push('convert');
        return PARTIE;
      });
      partiesSvc.update.mockImplementation(async () => {
        order.push('update');
        return PARTIE;
      });

      comp.form.patchValue({ kind: 'ONE_SHOT' });
      await comp.submit();

      expect(order).toEqual(['update', 'convert']);
      expect(partiesSvc.convertKind).toHaveBeenCalledWith('p1', 'ONE_SHOT', undefined);
    });

    it('une conversion refusée laisse les autres champs déjà enregistrés (ordre révisé)', async () => {
      const { fixture, partiesSvc } = await createComponent('p1', {
        scenarios: [scenario({ id: 's1' })],
      });
      const comp = fixture.componentInstance as any;
      partiesSvc.convertKind.mockRejectedValue({
        error: { message: 'Cette partie compte 3 scénarios ; un one-shot n’en a qu’un' },
      });

      comp.form.patchValue({ kind: 'ONE_SHOT' });
      await comp.submit();

      expect(partiesSvc.update).toHaveBeenCalled();
    });

    it("une conversion refusée après l'enregistrement affiche un message distinguant les deux, jamais une navigation", async () => {
      const { fixture, partiesSvc, router } = await createComponent('p1', {
        scenarios: [scenario({ id: 's1' })],
      });
      const comp = fixture.componentInstance as any;
      partiesSvc.convertKind.mockRejectedValue({
        error: { message: 'Cette partie compte 3 scénarios ; un one-shot n’en a qu’un' },
      });

      comp.form.patchValue({ kind: 'ONE_SHOT' });
      await comp.submit();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(comp.savedKind()).not.toBe('ONE_SHOT');
    });

    it('AC15 — le message de refus du serveur est relayé tel quel, jamais masqué', async () => {
      const { fixture, partiesSvc } = await createComponent('p1', {
        scenarios: [scenario({ id: 's1' })],
      });
      const comp = fixture.componentInstance as any;
      partiesSvc.convertKind.mockRejectedValue({
        error: { message: 'Cette partie compte 3 scénarios ; un one-shot n’en a qu’un' },
      });

      comp.form.patchValue({ kind: 'ONE_SHOT' });
      await comp.submit();

      expect(comp.error()).toContain('3 scénarios');
    });

    it("sans message serveur, une conversion refusée après l'enregistrement affiche un message distinct (autres champs enregistrés, type non changé)", async () => {
      const { fixture, partiesSvc } = await createComponent('p1', {
        scenarios: [scenario({ id: 's1' })],
      });
      const comp = fixture.componentInstance as any;
      partiesSvc.convertKind.mockRejectedValue(new Error('network'));

      comp.form.patchValue({ kind: 'ONE_SHOT' });
      await comp.submit();

      expect(comp.error()).toMatch(/enregistr/i);
    });

    it('AC9 — deux scénarios COURANT : l’arbitrage est demandé AVANT toute soumission', async () => {
      const { fixture, partiesSvc } = await createComponent('p1', {
        scenarios: [
          scenario({ id: 's1', status: 'COURANT', title: 'Premier' }),
          scenario({ id: 's2', status: 'COURANT', title: 'Second' }),
        ],
      });
      const comp = fixture.componentInstance as any;

      comp.form.patchValue({ kind: 'CAMPAGNE_LINEAIRE' });
      await comp.submit();
      fixture.detectChanges();

      expect(partiesSvc.convertKind).not.toHaveBeenCalled();
      expect(comp.courantChoice()).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('mat-radio-button')).toHaveLength(2);
    });

    it('AC9 — le scénario désigné est transmis à la conversion', async () => {
      const { fixture, partiesSvc } = await createComponent('p1', {
        scenarios: [
          scenario({ id: 's1', status: 'COURANT' }),
          scenario({ id: 's2', status: 'COURANT' }),
        ],
      });
      const comp = fixture.componentInstance as any;

      comp.form.patchValue({ kind: 'CAMPAGNE_LINEAIRE' });
      await comp.submit();
      comp.chosenCourantId.set('s2');
      await comp.submit();

      expect(partiesSvc.convertKind).toHaveBeenCalledWith('p1', 'CAMPAGNE_LINEAIRE', 's2');
    });

    it('AC9 — un seul COURANT : aucun arbitrage, conversion directe', async () => {
      const { fixture, partiesSvc } = await createComponent('p1', {
        scenarios: [
          scenario({ id: 's1', status: 'COURANT' }),
          scenario({ id: 's2', status: 'A_VENIR' }),
        ],
      });
      const comp = fixture.componentInstance as any;

      comp.form.patchValue({ kind: 'CAMPAGNE_LINEAIRE' });
      await comp.submit();

      expect(comp.courantChoice()).toBeNull();
      expect(partiesSvc.convertKind).toHaveBeenCalledWith('p1', 'CAMPAGNE_LINEAIRE', undefined);
    });

    it('un échec de chargement des scénarios ne bloque pas l’édition — le serveur reste l’autorité', async () => {
      const scenariosSvc = { listAll: vi.fn().mockRejectedValue(new Error('boom')) };
      await TestBed.configureTestingModule({
        imports: [PartieForm],
        providers: [
          provideAnimationsAsync(),
          provideRouter([]),
          {
            provide: PartiesService,
            useValue: {
              get: vi.fn().mockResolvedValue(PARTIE),
              update: vi.fn().mockResolvedValue(PARTIE),
              convertKind: vi.fn(),
              create: vi.fn(),
              setCoverImage: vi.fn(),
              removeCoverImage: vi.fn(),
            },
          },
          { provide: MyPartiesService, useValue: { refreshAll: vi.fn() } },
          { provide: ScenariosService, useValue: scenariosSvc },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: { get: () => 'p1' } } },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(PartieForm);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelectorAll('mat-button-toggle.mat-button-toggle-disabled'),
      ).toHaveLength(0);
    });
  });

  describe('image de couverture (Story 29.12 AC1/AC3, étendue par 29.14)', () => {
    function fileEvent(file: File) {
      return { target: { files: [file], value: '' } } as unknown as Event;
    }

    const validFile = () => new File(['bytes'], 'cover.jpg', { type: 'image/jpeg' });

    it('AC3 — la section couverture est présente DÈS la création', async () => {
      const { fixture } = await createComponent(null);
      expect(fixture.nativeElement.querySelector('.cover-section')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-party-banner')).not.toBeNull();
    });

    it('édition : la section couverture s’affiche, la bannière de partie est rendue', async () => {
      const { fixture } = await createComponent('p1');
      expect(fixture.nativeElement.querySelector('.cover-section')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-party-banner')).not.toBeNull();
    });

    it('édition — dépôt : appelle setCoverImage(id, file), coverImageVersion() reflète le résultat', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      const comp = fixture.componentInstance as any;
      const file = validFile();

      await comp.onCoverFileSelected(fileEvent(file));

      expect(partiesSvc.setCoverImage).toHaveBeenCalledWith('p1', file);
      expect(comp.coverImageVersion()).toBe('v1');
    });

    it('Review Findings 29.12 : un second dépôt pendant coverSaving() est ignoré', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      const comp = fixture.componentInstance as any;
      comp.coverSaving.set(true);

      await comp.onCoverFileSelected(fileEvent(validFile()));

      expect(partiesSvc.setCoverImage).not.toHaveBeenCalled();
    });

    it('Review Findings 29.12 : un second retrait pendant coverSaving() est ignoré', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      const comp = fixture.componentInstance as any;
      comp.coverSaving.set(true);

      await comp.removeCoverImage();

      expect(partiesSvc.removeCoverImage).not.toHaveBeenCalled();
    });

    it('édition — retrait : appelle removeCoverImage(id), coverImageVersion() redevient null', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      const comp = fixture.componentInstance as any;
      comp.coverImageVersion.set('v1');

      await comp.removeCoverImage();

      expect(partiesSvc.removeCoverImage).toHaveBeenCalledWith('p1');
      expect(comp.coverImageVersion()).toBeNull();
    });

    it('échec du dépôt → message d’erreur affiché, coverImageVersion() inchangé', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      partiesSvc.setCoverImage.mockRejectedValueOnce(new Error('boom'));
      const comp = fixture.componentInstance as any;

      await comp.onCoverFileSelected(fileEvent(validFile()));
      fixture.detectChanges();

      expect(comp.coverError()).not.toBeNull();
      expect(comp.coverImageVersion()).toBeNull();
    });

    it('AC12 — création : la partie est créée PUIS l’image déposée sur son identifiant', async () => {
      const { fixture, partiesSvc } = await createComponent(null);
      const comp = fixture.componentInstance as any;
      const file = validFile();

      await comp.onCoverFileSelected(fileEvent(file));
      expect(partiesSvc.setCoverImage).not.toHaveBeenCalled(); // rien à cibler encore

      comp.form.patchValue({ name: 'Ma partie', gameSystemId: 'draconis', kind: 'ONE_SHOT' });
      await comp.submit();

      expect(partiesSvc.create).toHaveBeenCalled();
      expect(partiesSvc.setCoverImage).toHaveBeenCalledWith('new-id', file);
    });

    it('AC12 — si le dépôt échoue après création, le message ne prétend JAMAIS que la partie a échoué', async () => {
      const { fixture, partiesSvc, router } = await createComponent(null);
      const comp = fixture.componentInstance as any;
      partiesSvc.setCoverImage.mockRejectedValueOnce(new Error('boom'));

      await comp.onCoverFileSelected(fileEvent(validFile()));
      comp.form.patchValue({ name: 'Ma partie', gameSystemId: 'draconis', kind: 'ONE_SHOT' });
      await comp.submit();

      expect(comp.error()).toMatch(/bien (inscrit|tracé|enregistrée)/i);
      expect(router.navigate).not.toHaveBeenCalled();
      // La partie existe : le formulaire bascule en mode édition sur son identifiant.
      expect(comp.editId()).toBe('new-id');
    });

    it('AC14 — un type non accepté est rejeté AVANT tout envoi réseau', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      const comp = fixture.componentInstance as any;
      const pdf = new File(['bytes'], 'doc.pdf', { type: 'application/pdf' });

      await comp.onCoverFileSelected(fileEvent(pdf));

      expect(partiesSvc.setCoverImage).not.toHaveBeenCalled();
      expect(comp.coverError()).not.toBeNull();
    });

    it('AC14 — un fichier de plus de 5 Mo est rejeté AVANT tout envoi réseau', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      const comp = fixture.componentInstance as any;
      const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });

      await comp.onCoverFileSelected(fileEvent(big));

      expect(partiesSvc.setCoverImage).not.toHaveBeenCalled();
      expect(comp.coverError()).not.toBeNull();
    });

    it('AC14 — un fichier exactement au plafond est accepté (borne inclusive, comme le serveur)', async () => {
      const { fixture, partiesSvc } = await createComponent('p1');
      const comp = fixture.componentInstance as any;
      const atLimit = new File(['x'], 'limit.jpg', { type: 'image/jpeg' });
      Object.defineProperty(atLimit, 'size', { value: 5 * 1024 * 1024 });

      await comp.onCoverFileSelected(fileEvent(atLimit));

      expect(partiesSvc.setCoverImage).toHaveBeenCalled();
    });

    it('AC13 — un indicateur de progression est visible pendant le dépôt', async () => {
      const { fixture } = await createComponent('p1');
      const comp = fixture.componentInstance as any;

      comp.coverSaving.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-progress-bar')).not.toBeNull();
    });

    describe('bannière d’aperçu et puces (Story 38.3)', () => {
      const chipTexts = (root: HTMLElement): string[] =>
        Array.from(root.querySelectorAll('.cover-chip')).map((el) =>
          (el.textContent ?? '').trim(),
        );

      // Les stubs globaux sont restaurés après chaque test (jsdom peut ne pas définir ces méthodes).
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;

      beforeEach(() => {
        let n = 0;
        URL.createObjectURL = vi.fn(() => `blob:test-${++n}`);
        URL.revokeObjectURL = vi.fn();
      });

      afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
      });

      /** Simule le choix d'un fichier sur le vrai champ du gabarit (teste le câblage `(change)`). */
      const pickOnInput = (root: HTMLElement, file: File): void => {
        const input = root.querySelector('label.cover-chip input[type="file"]') as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
      };

      it('câblage (change) — création : le champ fichier retient le fichier et fait apparaître « Retirer »', async () => {
        const { fixture } = await createComponent(null);
        const comp = fixture.componentInstance as any;
        pickOnInput(fixture.nativeElement, validFile());
        await vi.waitFor(() => expect(comp.pendingCoverPreview()).toBe('blob:test-1'));
        fixture.detectChanges();
        expect(chipTexts(fixture.nativeElement)).toEqual(['Retirer', 'Changer']);
      });

      it('story 51.7 : « Changer » porte l’icône « modifier » (décorative), « Retirer » aucune, plus de <svg> dans les puces', async () => {
        const { fixture } = await createComponent(null);
        const root = fixture.nativeElement as HTMLElement;
        pickOnInput(root, validFile());
        await vi.waitFor(() => expect(chipTexts(root)).toEqual(['Retirer', 'Changer']));
        fixture.detectChanges();

        const changer = root.querySelector('label.cover-chip')!;
        expect(changer.querySelector('app-icon')?.getAttribute('data-icon')).toBe('modifier');
        expect(changer.querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
        expect(root.querySelector('button.cover-chip app-icon')).toBeNull();
        // Les seuls <svg> des puces sont ceux d'<app-icon> : plus de dessin en ligne.
        const chips = root.querySelector('.cover-chips')!;
        expect(chips.querySelectorAll('svg')).toHaveLength(
          chips.querySelectorAll('app-icon').length,
        );
        expect(chips.querySelector('svg.cover-chip__icon')).toBeNull();
      });

      it('câblage (change) — édition : le champ fichier appelle setCoverImage avec l’id de la partie', async () => {
        const { fixture, partiesSvc } = await createComponent('p1');
        const file = validFile();
        pickOnInput(fixture.nativeElement, file);
        await vi.waitFor(() => expect(partiesSvc.setCoverImage).toHaveBeenCalledWith('p1', file));
      });

      it('un fichier refusé (type ou taille) laisse l’aperçu et le fichier en attente intacts', async () => {
        const { fixture } = await createComponent(null);
        const comp = fixture.componentInstance as any;
        const first = validFile();
        await comp.onCoverFileSelected(fileEvent(first));
        const preview = comp.pendingCoverPreview();

        await comp.onCoverFileSelected(
          fileEvent(new File(['x'], 'doc.txt', { type: 'text/plain' })),
        );
        expect(comp.coverError()).toBeTruthy();
        expect(comp.pendingCoverFile()).toBe(first);
        expect(comp.pendingCoverPreview()).toBe(preview);

        const huge = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
        Object.defineProperty(huge, 'size', { value: 5 * 1024 * 1024 + 1 });
        await comp.onCoverFileSelected(fileEvent(huge));
        expect(comp.pendingCoverFile()).toBe(first);
        expect(comp.pendingCoverPreview()).toBe(preview);
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      });

      it('édition : retirer la couverture enregistrée fait disparaître la puce « Retirer »', async () => {
        const { fixture, partiesSvc } = await createComponent('p1', {
          partie: { coverImageVersion: 'v9' },
        });
        const comp = fixture.componentInstance as any;
        expect(comp.hasPersonalCover()).toBe(true);

        (fixture.nativeElement.querySelector('button.cover-chip') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(partiesSvc.removeCoverImage).toHaveBeenCalledWith('p1'));
        await vi.waitFor(() => expect(comp.hasPersonalCover()).toBe(false));
        fixture.detectChanges();
        expect(chipTexts(fixture.nativeElement)).toEqual(['Changer']);
      });

      it('édition : si le retrait échoue, la puce « Retirer » reste et l’erreur s’affiche', async () => {
        const { fixture, partiesSvc } = await createComponent('p1', {
          partie: { coverImageVersion: 'v9' },
        });
        const comp = fixture.componentInstance as any;
        partiesSvc.removeCoverImage.mockRejectedValueOnce(new Error('boom'));

        (fixture.nativeElement.querySelector('button.cover-chip') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(comp.coverError()).toBeTruthy());
        fixture.detectChanges();

        expect(comp.hasPersonalCover()).toBe(true);
        expect(chipTexts(fixture.nativeElement)).toEqual(['Retirer', 'Changer']);
        expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
          comp.coverError(),
        );
      });

      const themeCases = [
        { theme: 'grimoire-emeraude', changer: 'Changer', retirer: 'Retirer' },
        { theme: 'foret-ancienne', changer: 'Échanger', retirer: 'Ôter' },
        { theme: 'atelier-cuivre', changer: 'Substituer', retirer: 'Démonter' },
      ] as const;

      for (const t of themeCases) {
        it(`thème ${t.theme} : textes des puces suivent le thème et le nom accessible commence par le mot visible`, async () => {
          const { fixture } = await createComponent('p1', { partie: { coverImageVersion: 'v9' } });
          TestBed.inject(ThemeToneService).activeTheme.set(t.theme);
          fixture.detectChanges();

          const root = fixture.nativeElement as HTMLElement;
          expect(chipTexts(root)).toEqual([t.retirer, t.changer]);
          // WCAG 2.5.3 : le nom accessible commence par le mot affiché.
          expect(
            root.querySelector('button.cover-chip')?.getAttribute('aria-label'),
          ).toMatch(new RegExp(`^${t.retirer} — `));
          expect(
            root.querySelector('label.cover-chip input')?.getAttribute('aria-label'),
          ).toMatch(new RegExp(`^${t.changer} — `));
        });
      }

      it('création : pendant l’envoi du formulaire (saving), puces et champ fichier sont désactivés', async () => {
        const { fixture } = await createComponent(null);
        const comp = fixture.componentInstance as any;
        await comp.onCoverFileSelected(fileEvent(validFile()));
        comp.saving.set(true);
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        expect((root.querySelector('button.cover-chip') as HTMLButtonElement).disabled).toBe(true);
        expect((root.querySelector('.cover-chip input') as HTMLInputElement).disabled).toBe(true);
        expect(root.querySelector('label.cover-chip')?.classList).toContain('cover-chip--disabled');
      });

      it('la destruction du composant révoque l’URL de blob du fichier en attente', async () => {
        const { fixture } = await createComponent(null);
        const comp = fixture.componentInstance as any;
        await comp.onCoverFileSelected(fileEvent(validFile()));

        fixture.destroy();

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
      });

      const cases: { label: string; editId: string | null; partie?: Partial<PartieDto> }[] = [
        { label: 'création', editId: null },
        { label: 'édition d’une quête', editId: 'p1' },
        {
          label: 'édition d’un ralliement',
          editId: 'p1',
          partie: { gameSystemId: 'ralliement', kind: 'ONE_SHOT' },
        },
      ];

      for (const c of cases) {
        it(`${c.label} : la bannière grand format est le premier bloc, sans « Retirer » ni champ visible`, async () => {
          const { fixture } = await createComponent(c.editId, { partie: c.partie });
          const root = fixture.nativeElement as HTMLElement;
          const section = root.querySelector('.cover-section') as HTMLElement;
          expect(section).not.toBeNull();
          expect(section.querySelector('app-party-banner')?.getAttribute('mode')).toBe('large');
          expect(section.querySelector('.cover-frame app-party-banner')).not.toBeNull();
          // « Changer » seul ; la bannière (aria-hidden) ne contient aucune puce.
          expect(chipTexts(root)).toEqual(['Changer']);
          expect(section.querySelector('app-party-banner .cover-chip')).toBeNull();
          expect(section.querySelector('button.cover-chip')).toBeNull();
        });
      }

      it('le champ fichier est dans la puce « Changer », ni hidden ni display:none, accessible au clavier', async () => {
        const { fixture } = await createComponent(null);
        const input = fixture.nativeElement.querySelector(
          'label.cover-chip input[type="file"]',
        ) as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.hidden).toBe(false);
        expect(input.hasAttribute('hidden')).toBe(false);
        expect(input.style.display).not.toBe('none');
        expect(input.tabIndex).toBeGreaterThanOrEqual(0);
        expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
        // Nom accessible issu de la clé de ton `partie.cover_change`.
        expect(input.getAttribute('aria-label')).toBe('Changer — Changer l’enluminure');
      });

      it('création : après le choix d’un fichier, « Retirer » apparaît à côté de « Changer »', async () => {
        const { fixture } = await createComponent(null);
        const comp = fixture.componentInstance as any;
        await comp.onCoverFileSelected(fileEvent(validFile()));
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        expect(chipTexts(root)).toEqual(['Retirer', 'Changer']);
        const remove = root.querySelector('button.cover-chip') as HTMLButtonElement;
        expect(remove.type).toBe('button');
        expect(remove.getAttribute('aria-label')).toBe('Retirer — Retirer l’enluminure');
        // L'aperçu du fichier en attente remplace la bannière générée, dans le même cadre.
        expect(root.querySelector('.cover-frame img.cover-image')?.getAttribute('src')).toBe(
          'blob:test-1',
        );
        expect(root.querySelector('app-party-banner')).toBeNull();
      });

      it('création : « Retirer » ramène la bannière générée et révoque l’URL de blob', async () => {
        const { fixture } = await createComponent(null);
        const comp = fixture.componentInstance as any;
        await comp.onCoverFileSelected(fileEvent(validFile()));
        fixture.detectChanges();

        (fixture.nativeElement.querySelector('button.cover-chip') as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelector('app-party-banner')).not.toBeNull();
        expect(chipTexts(root)).toEqual(['Changer']);
      });

      it('création : une seconde sélection révoque l’URL de blob précédente', async () => {
        const { fixture } = await createComponent(null);
        const comp = fixture.componentInstance as any;
        await comp.onCoverFileSelected(fileEvent(validFile()));
        await comp.onCoverFileSelected(fileEvent(validFile()));

        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
        expect(comp.pendingCoverPreview()).toBe('blob:test-2');
      });

      it('édition avec couverture enregistrée : « Retirer » et « Changer » sont proposés', async () => {
        const { fixture } = await createComponent('p1', { partie: { coverImageVersion: 'v9' } });
        expect(chipTexts(fixture.nativeElement)).toEqual(['Retirer', 'Changer']);
      });

      it('pendant le dépôt, les deux puces et le champ fichier sont désactivés', async () => {
        const { fixture } = await createComponent('p1', { partie: { coverImageVersion: 'v9' } });
        const comp = fixture.componentInstance as any;
        comp.coverSaving.set(true);
        fixture.detectChanges();

        const root = fixture.nativeElement as HTMLElement;
        expect((root.querySelector('button.cover-chip') as HTMLButtonElement).disabled).toBe(true);
        expect((root.querySelector('.cover-chip input') as HTMLInputElement).disabled).toBe(true);
        expect(root.querySelector('label.cover-chip')?.classList).toContain('cover-chip--disabled');
      });
    });
  });

  describe('mode quête / ralliement (Story 38.2)', () => {
    const labels = (fixture: { nativeElement: HTMLElement }, selector: string): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll(selector)).map((el) =>
        // Story 45.7 : une option porte son nom (ligne 1) et sa ligne en clair (ligne 2) — les libellés se lisent sur le nom.
        ((el as HTMLElement).querySelector('.option-name')?.textContent ?? el.textContent ?? '').trim(),
      );

    it('création : la bascule est présente, à deux options, ralliement à gauche et quête à droite, quête par défaut', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      expect(fixture.nativeElement.querySelector('.mode-toggle')).not.toBeNull();
      expect(labels(fixture, '.mode-toggle mat-button-toggle')).toEqual(['Ralliement', 'Quête']);
      expect(comp.mode()).toBe('quest');
      // La bascule est nommée (groupe annoncé).
      expect(
        fixture.nativeElement.querySelector('.mode-toggle').getAttribute('aria-label'),
      ).toBeTruthy();
    });

    it('ordre des champs : couverture, nom, bascule, champs du mode, description', async () => {
      const { fixture } = await createComponent();
      const root = fixture.nativeElement as HTMLElement;
      const position = (selector: string): number => {
        const el = root.querySelector(selector);
        expect(el, selector).not.toBeNull();
        return Array.from(root.querySelectorAll('*')).indexOf(el as Element);
      };
      const cover = position('.cover-section');
      const name = position('input[formcontrolname="name"]');
      const toggle = position('.mode-toggle');
      const system = position('mat-select');
      const kind = position('.kind-field');
      const description = position('textarea');
      expect([cover, name, toggle, system, kind, description]).toEqual(
        [cover, name, toggle, system, kind, description].sort((a, b) => a - b),
      );
    });

    it('mode quête : livre de règles + nature (comportement actuel), libellé de validation de nav.create_game', async () => {
      const { fixture } = await createComponent();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('mat-select')).not.toBeNull();
      expect(labels(fixture, '.kind-toggle mat-button-toggle')).toHaveLength(3);
      expect(labels(fixture, 'button[type=submit]')).toEqual(['Lancer une quête']);
    });

    it('le registre du livre de règles ne propose jamais le ralliement', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      expect(comp.systems().map((s: { id: string }) => s.id)).not.toContain('ralliement');
    });

    it('bascule vers ralliement : plus de livre de règles, deux types, libellés du ralliement, bouton dédié', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.setMode('ralliement');
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('mat-select')).toBeNull();
      expect(labels(fixture, '.kind-toggle mat-button-toggle')).toEqual([
        'La conjonction des Esprits',
        'La convergence des Sortilèges',
      ]);
      expect(labels(fixture, 'legend')).toEqual(['Nature du ralliement']);
      expect(labels(fixture, 'mat-label')).toContain('Nom du ralliement');
      expect(labels(fixture, 'button[type=submit]')).toEqual(['Convoquer le ralliement']);
      expect(comp.form.value.gameSystemId).toBe('ralliement');
    });

    it('basculer ne vide ni le nom ni la description, et le retour à la quête restitue le livre de règles', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.form.patchValue({ name: 'Ma partie', description: 'Un mot', kind: 'CAMPAGNE_LINEAIRE' });

      comp.setMode('ralliement');
      expect(comp.form.value.name).toBe('Ma partie');
      expect(comp.form.value.description).toBe('Un mot');
      // CAMPAGNE_LINEAIRE n'existe pas pour un ralliement : retour au premier type.
      expect(comp.form.value.kind).toBe('ONE_SHOT');

      comp.setMode('quest');
      expect(comp.form.value.name).toBe('Ma partie');
      expect(comp.form.value.description).toBe('Un mot');
      expect(comp.form.value.gameSystemId).toBe('ryuutama');
    });

    it.each(['ONE_SHOT', 'CAMPAGNE_EPISODIQUE'] as PartieKind[])(
      'ralliement %s : create() reçoit ce kind et le système ralliement',
      async (kind) => {
        const { fixture, partiesSvc } = await createComponent();
        const comp = fixture.componentInstance as any;
        comp.setMode('ralliement');
        comp.form.patchValue({ name: 'Soirée', kind });
        await comp.submit();
        expect(partiesSvc.create).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Soirée', kind, gameSystemId: 'ralliement' }),
        );
      },
    );

    it('Story 41.2 : une soirée isolée tout juste créée navigue avec l’état qui ouvre la fenêtre de conjonction ; un groupe ou une quête, sans état', async () => {
      const cases: [PartieKind, boolean][] = [
        ['ONE_SHOT', true],
        ['CAMPAGNE_EPISODIQUE', false],
      ];
      for (const [kind, opens] of cases) {
        const { fixture, partiesSvc } = await createComponent();
        const router = TestBed.inject(Router);
        partiesSvc.create.mockResolvedValue({ id: 'new-1', kind, name: 'Soirée' });
        const comp = fixture.componentInstance as any;
        comp.setMode('ralliement');
        comp.form.patchValue({ name: 'Soirée', kind });
        await comp.submit();
        const args = (router.navigate as ReturnType<typeof vi.fn>).mock.lastCall as [
          unknown[],
          { state?: { soireeCreation?: boolean } } | undefined,
        ];
        expect(args[0]).toEqual(['/parties', 'new-1']);
        expect(args[1]?.state?.soireeCreation === true, kind).toBe(opens);
        TestBed.resetTestingModule();
      }

      const { fixture, partiesSvc } = await createComponent();
      const router = TestBed.inject(Router);
      partiesSvc.create.mockResolvedValue({ id: 'quete-1', kind: 'ONE_SHOT', name: 'Quête' });
      const comp = fixture.componentInstance as any;
      comp.form.patchValue({ name: 'Quête', gameSystemId: 'draconis', kind: 'ONE_SHOT' });
      await comp.submit();
      const args = (router.navigate as ReturnType<typeof vi.fn>).mock.lastCall as [
        unknown[],
        { state?: unknown } | undefined,
      ];
      expect(args[1]?.state).toBeUndefined();
    });

    it('édition d’une quête : la bascule est absente', async () => {
      const { fixture } = await createComponent('p1');
      expect(fixture.nativeElement.querySelector('.mode-toggle')).toBeNull();
      expect((fixture.componentInstance as any).mode()).toBe('quest');
    });

    it('édition d’un ralliement : bascule absente, mode ralliement, type verrouillé, aucune conversion ni lecture de scénarios', async () => {
      const { fixture, partiesSvc, scenariosSvc } = await createComponent('p1', {
        partie: { gameSystemId: 'ralliement', kind: 'ONE_SHOT' },
      });
      const comp = fixture.componentInstance as any;
      expect(fixture.nativeElement.querySelector('.mode-toggle')).toBeNull();
      expect(comp.mode()).toBe('ralliement');
      expect(scenariosSvc.listAll).not.toHaveBeenCalled();
      expect(
        comp.kindAvailability().every((o: { disabled: boolean }) => o.disabled),
      ).toBe(true);
      expect(labels(fixture, 'button[type=submit]')).toEqual(['Inscrire']);

      await comp.submit();
      expect(partiesSvc.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ gameSystemId: 'ralliement', kind: 'ONE_SHOT' }),
      );
      expect(partiesSvc.convertKind).not.toHaveBeenCalled();
    });

    it.each(THEMES)(
      'thème %s : échec d’enregistrement et échec de couverture parlent le langage du ralliement',
      async (theme) => {
        const tone = TONE_MAP[theme];
        const { fixture, partiesSvc } = await createComponent();
        TestBed.inject(ThemeToneService).activeTheme.set(theme);
        const comp = fixture.componentInstance as any;
        comp.setMode('ralliement');
        comp.form.patchValue({ name: 'Soirée' });

        partiesSvc.create.mockRejectedValueOnce(new Error('boom'));
        await comp.submit();
        expect(comp.error()).toBe(tone['partie.ralliement_save_error']);

        partiesSvc.setCoverImage.mockRejectedValueOnce(new Error('boom'));
        await comp.onCoverFileSelected({
          target: { files: [new File([new Uint8Array(10)], 'c.png', { type: 'image/png' })], value: '' },
        });
        await comp.submit();
        expect(comp.error()).toBe(tone['partie.ralliement_created_but_cover_failed']);
      },
    );

    it('une quête garde ses messages d’échec d’origine', async () => {
      const { fixture, partiesSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.form.patchValue({ name: 'Ma quête' });
      partiesSvc.create.mockRejectedValueOnce(new Error('boom'));
      await comp.submit();
      expect(comp.error()).toBe(TONE_MAP['grimoire-emeraude']['partie.save_error']);
    });
  });

  describe('titre contextuel selon le mode (Story 38.4)', () => {
    const settle = async (fixture: { detectChanges: () => void; whenStable: () => Promise<unknown> }) => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it.each(THEMES)('création, thème %s : le titre suit la bascule quête / ralliement', async (theme) => {
      const { fixture } = await createComponent();
      TestBed.inject(ThemeToneService).activeTheme.set(theme);
      const nav = TestBed.inject(ContextualNavService);
      const tone = TONE_MAP[theme];
      await settle(fixture);
      expect(nav.title()).toBe(tone['partie.new_title']);

      (fixture.componentInstance as any).setMode('ralliement');
      await settle(fixture);
      expect(nav.title()).toBe(tone['partie.ralliement_new_title']);

      (fixture.componentInstance as any).setMode('quest');
      await settle(fixture);
      expect(nav.title()).toBe(tone['partie.new_title']);
    });

    it('édition d’un ralliement : titre de modification du ralliement, nom de la partie en sous-titre', async () => {
      const { fixture } = await createComponent('p1', {
        partie: { gameSystemId: 'ralliement', kind: 'ONE_SHOT' },
      });
      await settle(fixture);
      const nav = TestBed.inject(ContextualNavService);
      const tone = TestBed.inject(ThemeToneService).tone();
      expect(nav.title()).toBe(tone['partie.ralliement_edit_title']);
      expect(nav.subtitle()).toBe('La Guilde des Ombres');
    });

    it('édition : aucun titre (donc aucun mot de quête) tant que la partie n’est pas chargée', async () => {
      let resolve!: (p: PartieDto) => void;
      const getPromise = new Promise<PartieDto>((r) => (resolve = r));
      const { fixture } = await createComponent('p1', { getPromise });
      await settle(fixture);
      const nav = TestBed.inject(ContextualNavService);
      expect(nav.title()).toBeNull();

      resolve({ ...PARTIE, gameSystemId: 'ralliement', kind: 'ONE_SHOT' });
      await settle(fixture);
      await settle(fixture);
      expect(nav.title()).toBe(
        TestBed.inject(ThemeToneService).tone()['partie.ralliement_edit_title'],
      );
    });

    it('édition d’une quête : titre inchangé', async () => {
      const { fixture } = await createComponent('p1');
      await settle(fixture);
      const nav = TestBed.inject(ContextualNavService);
      const tone = TestBed.inject(ThemeToneService).tone();
      expect(nav.title()).toBe(tone['partie.edit_title']);
      expect(nav.subtitle()).toBe('La Guilde des Ombres');
    });
  });
});

// ─── Story 45.7 — comprendre ce qu'on crée : la ligne en clair sous chaque mode et chaque nature ───

describe('PartieForm — lignes en clair (Story 45.7)', () => {
  const cell = (root: HTMLElement, selector: string) =>
    Array.from(root.querySelectorAll(selector)).map((el) => ({
      name: el.querySelector('.option-name')?.textContent?.trim(),
      plain: el.querySelector('.option-plain')?.textContent?.trim(),
    }));
  const MODE = '.mode-toggle mat-button-toggle';
  const KIND = '.kind-toggle mat-button-toggle';

  it('création : la bascule montre le nom du thème PUIS « Jeu de rôle » / « Soirée entre amis », dans les trois thèmes', async () => {
    const { fixture } = await createComponent();
    const root = fixture.nativeElement as HTMLElement;
    for (const theme of THEMES) {
      TestBed.inject(ThemeToneService).activeTheme.set(theme);
      fixture.detectChanges();
      const tone = TONE_MAP[theme];
      expect(cell(root, MODE), theme).toEqual([
        { name: tone['partie.mode_ralliement'], plain: 'Soirée entre amis' },
        { name: tone['partie.mode_quete'], plain: 'Jeu de rôle' },
      ]);
    }
  });

  it('mode quête : chaque nature porte sa ligne (EXPERIENCE §2.7), la choisie comme les autres', async () => {
    const { fixture } = await createComponent();
    const root = fixture.nativeElement as HTMLElement;
    expect(cell(root, KIND).map((o) => o.plain)).toEqual([
      'Une seule séance : l’histoire commence et se termine le même soir.',
      'Une histoire suivie sur plusieurs séances, avec la même troupe.',
      'Plusieurs séances complètes chacune ; les joueurs peuvent changer d’une séance à l’autre.',
    ]);

    (fixture.componentInstance as any).form.patchValue({ kind: 'CAMPAGNE_LINEAIRE' });
    fixture.detectChanges();
    // Le choix ne retire aucune ligne.
    expect(cell(root, KIND).every((o) => !!o.plain)).toBe(true);
    expect(root.querySelectorAll(`${KIND}.mat-button-toggle-checked .option-plain`)).toHaveLength(1);
  });

  it('mode ralliement : les deux lignes de la soirée isolée et du groupe, sans mot du JDR', async () => {
    const { fixture } = await createComponent();
    (fixture.componentInstance as any).setMode('ralliement');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const lines = cell(root, KIND).map((o) => o.plain);
    expect(lines).toEqual([
      'Un rendez-vous unique : on invite, on trouve une date, et c’est fini.',
      'Une bande d’amis durable : chaque membre peut proposer des rencontres, chez lui, quand il veut.',
    ]);
    for (const line of lines) {
      expect(line).not.toMatch(/\b(MJ|campagne|sc[ée]nario|s[ée]ance|joueur|qu[êe]te|troupe|partie)/i);
    }
  });

  it('les lignes en clair sont identiques dans les trois thèmes, les noms diffèrent', async () => {
    const { fixture } = await createComponent();
    const root = fixture.nativeElement as HTMLElement;
    const plains = new Set<string>();
    const names = new Set<string>();
    for (const theme of THEMES) {
      TestBed.inject(ThemeToneService).activeTheme.set(theme);
      fixture.detectChanges();
      plains.add(
        cell(root, KIND)
          .map((o) => o.plain)
          .join('|'),
      );
      names.add(
        cell(root, KIND)
          .map((o) => o.name)
          .join('|'),
      );
    }
    expect(plains.size).toBe(1);
    expect(names.size).toBe(THEMES.length);
  });

  it('édition d’une partie de JDR : pas de bascule de mode, les natures gardent leur ligne', async () => {
    const { fixture } = await createComponent('p1');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.mode-toggle')).toBeNull();
    expect(cell(root, KIND).every((o) => !!o.plain)).toBe(true);
  });

  it('édition d’un ralliement : natures figées mais avec leur ligne', async () => {
    const { fixture } = await createComponent('p1', {
      partie: { gameSystemId: 'ralliement', kind: 'ONE_SHOT' },
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.mode-toggle')).toBeNull();
    const lines = cell(root, KIND).map((o) => o.plain);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Un rendez-vous unique : on invite, on trouve une date, et c’est fini.');
  });

  it('une nature désactivée garde sa ligne, et sa raison reste écrite dessous', async () => {
    const { fixture } = await createComponent('p1', {
      partie: { kind: 'CAMPAGNE_LINEAIRE' },
      scenarios: [scenario({ id: 's1' }), scenario({ id: 's2' })],
    });
    const root = fixture.nativeElement as HTMLElement;
    const disabled = root.querySelector(`${KIND}.mat-button-toggle-disabled`)!;
    expect(disabled.querySelector('.option-plain')?.textContent?.trim()).toBeTruthy();
    expect(root.querySelector('.kind-reason')).not.toBeNull();
  });
});
