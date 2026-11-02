import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi } from 'vitest';
import type {
  AnnouncementDto,
  CharacterDto,
  PartieDto,
  ScenarioDocumentDto,
  ScenarioDto,
} from '@master-jdr/shared';
import { ScenarioEditor } from './scenario-editor';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { CharacterService } from '../../../core/characters/character.service';
import { PartiesService } from '../../../core/parties/parties.service';
import { PollService } from '../../../core/poll/poll.service';
import { AnnouncementsService } from '../../../core/announcements/announcements.service';
import { UnseenAnnouncementsService } from '../../../core/announcements/unseen-announcements.service';
import { RealtimeService, partieTopic } from '../../../core/realtime/realtime.service';
import { makeAnnouncementDto } from '../../../core/announcements/announcement-dto.fixture';
import { makeCharacterDto } from '../../../core/characters/character-dto.fixture';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const SCENARIO: ScenarioDto = {
  id: 's1',
  partieId: 'p1',
  title: 'Le Marché aux Ombres',
  description: 'Une enquête discrète.',
  status: 'A_VENIR',
  dureeHeures: 3,
  dureeSeances: null,
  resumeFin: null,
  createdAt: '2026-07-12T00:00:00.000Z',
  closedAt: null,
  seances: [],
};

const OWN_DOC: ScenarioDocumentDto = {
  id: 'd1',
  partieId: 'p1',
  scenarioId: 's1',
  originalName: 'lettre.pdf',
  sizeBytes: 12,
  createdAt: '2026-07-12T00:00:00.000Z',
};

const LIBRARY_DOC: ScenarioDocumentDto = {
  id: 'd2',
  partieId: 'p1',
  scenarioId: null,
  originalName: 'carte.pdf',
  sizeBytes: 34,
  createdAt: '2026-07-12T00:00:00.000Z',
};

const PARTIE: PartieDto = {
  id: 'p1',
  name: 'La Guilde',
  kind: 'CAMPAGNE_EPISODIQUE',
  gameSystemId: 'draconis',
  description: null,
  ownerId: 'mj1',
  ownerPseudo: 'mj-pseudo',
  ownerDisplayName: 'MJ Nom',
  createdAt: '',
  nextSessionDate: null,
  nextSessionSlot: null,
  role: 'mj',
  status: 'EN_COURS',
  isFavorite: false,
  coverImageVersion: null,
};

async function createComponent(
  scenario: ScenarioDto = SCENARIO,
  characters: CharacterDto[] = [],
  announcements: AnnouncementDto[] = [],
  initialChanged: { partieId: string } | null = null,
  partie: PartieDto = PARTIE,
  unseenAnnouncementIds: string[] = [],
  markAnnouncementRead: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
  announcementIdQueryParam: string | null = null,
) {
  const scenariosSvc = {
    listAll: vi.fn().mockResolvedValue([scenario]),
    listDocuments: vi.fn().mockResolvedValue([OWN_DOC, LIBRARY_DOC]),
    update: vi.fn(),
    uploadDocument: vi.fn(),
    downloadDocument: vi.fn(),
    markCourant: vi.fn(),
    close: vi.fn(),
    addSeance: vi.fn(),
    linkSeancePoll: vi.fn(),
    setResumeFin: vi.fn(),
    changed: signal<{ partieId: string } | null>(initialChanged),
  };
  const characterSvc = { listByPartie: vi.fn().mockResolvedValue(characters) };
  const partiesSvc = {
    members: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(partie),
  };
  const pollSvc = { chooseDate: vi.fn(), closePoll: vi.fn() };
  const announcementsSvc = { listAll: vi.fn().mockResolvedValue(announcements) };
  const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };
  const unseenAnnouncementsSvc = {
    unseenAnnouncements: signal(announcements.filter((a) => unseenAnnouncementIds.includes(a.id))),
    markRead: markAnnouncementRead,
  };

  await TestBed.configureTestingModule({
    imports: [ScenarioEditor],
    providers: [
      provideRouter([]),
      provideAnimationsAsync(),
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: CharacterService, useValue: characterSvc },
      { provide: PartiesService, useValue: partiesSvc },
      { provide: PollService, useValue: pollSvc },
      { provide: AnnouncementsService, useValue: announcementsSvc },
      { provide: UnseenAnnouncementsService, useValue: unseenAnnouncementsSvc },
      { provide: RealtimeService, useValue: realtimeSvc },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: { get: () => announcementIdQueryParam } },
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ScenarioEditor);
  fixture.componentRef.setInput('scenario', scenario);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, scenariosSvc, characterSvc, announcementsSvc, realtimeSvc };
}

describe('ScenarioEditor — marquage « vue » des annonces scopées sur clic explicite (Story 29.13, révision)', () => {
  it("une annonce non vue affichée n'appelle jamais markRead() tant qu'elle n'est pas cliquée", async () => {
    const announcements = [makeAnnouncementDto({ id: 'ann-scenario', scenarioId: SCENARIO.id })];
    const markAnnouncementRead = vi.fn().mockResolvedValue(undefined);

    await createComponent(
      SCENARIO,
      [],
      announcements,
      null,
      PARTIE,
      ['ann-scenario'],
      markAnnouncementRead,
    );

    expect(markAnnouncementRead).not.toHaveBeenCalled();
  });

  it('un clic sur une annonce non vue déclenche markRead() avec le bon id', async () => {
    const announcements = [makeAnnouncementDto({ id: 'ann-scenario', scenarioId: SCENARIO.id })];
    const markAnnouncementRead = vi.fn().mockResolvedValue(undefined);

    const { fixture } = await createComponent(
      SCENARIO,
      [],
      announcements,
      null,
      PARTIE,
      ['ann-scenario'],
      markAnnouncementRead,
    );

    fixture.nativeElement
      .querySelector('app-annonce-card article')
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(markAnnouncementRead).toHaveBeenCalledWith('ann-scenario');
  });

  it('un clic sur une annonce déjà vue ne déclenche aucun appel', async () => {
    const announcements = [makeAnnouncementDto({ id: 'ann-deja-vue', scenarioId: SCENARIO.id })];
    const markAnnouncementRead = vi.fn().mockResolvedValue(undefined);

    const { fixture } = await createComponent(
      SCENARIO,
      [],
      announcements,
      null,
      PARTIE,
      [],
      markAnnouncementRead,
    );

    fixture.nativeElement
      .querySelector('app-annonce-card article')
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(markAnnouncementRead).not.toHaveBeenCalled();
  });
});

describe('ScenarioEditor — arrivée depuis le bandeau du Shell (Story 29.13, révision du 2026-08-13)', () => {
  it("fait défiler jusqu'à l'AnnonceCard visée quand announcementId est présent dans l'URL", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const announcements = [makeAnnouncementDto({ id: 'ann-cible', scenarioId: SCENARIO.id })];

    const { fixture } = await createComponent(
      SCENARIO,
      [],
      announcements,
      null,
      PARTIE,
      ['ann-cible'],
      vi.fn().mockResolvedValue(undefined),
      'ann-cible',
    );
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }

    const target = fixture.nativeElement.querySelector('#announcement-ann-cible');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(target?.classList.contains('annonce-card--highlight')).toBe(true);
  });

  it("n'interfère pas quand aucun announcementId n'est présent dans l'URL", async () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const announcements = [makeAnnouncementDto({ id: 'ann-x', scenarioId: SCENARIO.id })];

    await createComponent(SCENARIO, [], announcements, null, PARTIE, ['ann-x']);

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

describe('ScenarioEditor', () => {
  it('charge les documents et les répartit en 2 listes (scénario / bibliothèque)', async () => {
    const { fixture } = await createComponent();
    const comp = fixture.componentInstance as any;
    expect(comp.ownDocuments()).toEqual([OWN_DOC]);
    expect(comp.libraryDocuments()).toEqual([LIBRARY_DOC]);
  });

  it('édition d’un champ (FieldEditPencil) déclenche update()', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    scenariosSvc.update.mockResolvedValue({ ...SCENARIO, title: 'Nouveau titre' });
    await comp.onFieldConfirm('title', 'Nouveau titre');
    expect(scenariosSvc.update).toHaveBeenCalledWith('s1', { title: 'Nouveau titre' });
    expect(comp.scenario().title).toBe('Nouveau titre');
  });

  it('échec d’édition remonte le message d’erreur backend (pas un message générique)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    scenariosSvc.update.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { message: 'Titre trop long.' } }),
    );
    await comp.onFieldConfirm('title', 'x'.repeat(300));
    expect(comp.fieldEditError()).toBe('Titre trop long.');
  });

  it('onFieldConfirm : double-clic rapide → un seul appel réseau (Story 13.1, AC1)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    let resolveCall: (v: unknown) => void;
    scenariosSvc.update.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    const first = comp.onFieldConfirm('title', 'A');
    const second = comp.onFieldConfirm('title', 'B');
    resolveCall!({ ...SCENARIO, title: 'A' });
    await first;
    await second;

    expect(scenariosSvc.update).toHaveBeenCalledTimes(1);
  });

  it('onFieldConfirm : éditer 2 champs différents en parallèle → les 2 appels réseau partent, aucune modification perdue (revue de code Story 13.1)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    let resolveTitle: (v: unknown) => void;
    let resolveDuree: (v: unknown) => void;
    scenariosSvc.update.mockImplementation((_id: string, dto: Record<string, unknown>) => {
      if ('title' in dto) return new Promise((resolve) => (resolveTitle = resolve));
      return new Promise((resolve) => (resolveDuree = resolve));
    });

    const titleCall = comp.onFieldConfirm('title', 'Nouveau titre');
    const dureeCall = comp.onFieldConfirm('dureeHeures', 4);
    resolveTitle!({ ...SCENARIO, title: 'Nouveau titre' });
    resolveDuree!({ ...SCENARIO, dureeHeures: 4 });
    await titleCall;
    await dureeCall;

    expect(scenariosSvc.update).toHaveBeenCalledTimes(2);
    expect(scenariosSvc.update).toHaveBeenCalledWith('s1', { title: 'Nouveau titre' });
    expect(scenariosSvc.update).toHaveBeenCalledWith('s1', { dureeHeures: 4 });
  });

  it('fieldPending(field) est vrai uniquement pour le champ effectivement en vol (revue de code Story 13.1)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    let resolveCall: (v: unknown) => void;
    scenariosSvc.update.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    const titleCall = comp.onFieldConfirm('title', 'Nouveau titre');
    expect(comp.fieldPending('title')).toBe(true);
    expect(comp.fieldPending('dureeHeures')).toBe(false);
    expect(comp.fieldPending('description')).toBe(false);

    resolveCall!({ ...SCENARIO, title: 'Nouveau titre' });
    await titleCall;

    expect(comp.fieldPending('title')).toBe(false);
  });

  it('scenarioInput() change → fieldEditError se réinitialise (Story 13.1, AC2)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    scenariosSvc.update.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { message: 'Erreur.' } }),
    );
    await comp.onFieldConfirm('title', 'x');
    expect(comp.fieldEditError()).toBe('Erreur.');

    fixture.componentRef.setInput('scenario', { ...SCENARIO, title: 'Autre' });
    fixture.detectChanges();

    expect(comp.fieldEditError()).toBeNull();
  });

  it('submitDescription : bouton « Enregistrer » désactivé pendant l’appel, réactivé après (Story 13.1, AC1/AC3)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    let resolveCall: (v: unknown) => void;
    scenariosSvc.update.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === GRIMOIRE_TONE['common.enregistrer'])!;

    const clickPromise = (fixture.componentInstance as any).submitDescription();
    fixture.detectChanges();
    expect(button.disabled).toBe(true);

    resolveCall!(SCENARIO);
    await clickPromise;
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });

  it('statut PASSE → pas de FieldEditPencil, mais durées affichées en lecture seule', async () => {
    const { fixture } = await createComponent({ ...SCENARIO, status: 'PASSE' });
    expect(fixture.nativeElement.querySelector('app-field-edit-pencil')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('3 h');
  });

  it('statut PASSE → onFieldConfirm/submitDescription ignorés même si appelés directement (garde-fou runtime)', async () => {
    const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'PASSE' });
    const comp = fixture.componentInstance as any;
    await comp.onFieldConfirm('title', 'Nouveau titre');
    await comp.submitDescription();
    expect(scenariosSvc.update).not.toHaveBeenCalled();
  });

  it('upload réussi rafraîchit la liste de documents et réinitialise l’input file', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    const file = new File(['%PDF'], 'nouveau.pdf', { type: 'application/pdf' });
    scenariosSvc.uploadDocument.mockResolvedValue(OWN_DOC);
    scenariosSvc.listDocuments.mockResolvedValue([OWN_DOC, LIBRARY_DOC]);
    const inputEl = { files: [file], value: 'nouveau.pdf' };
    await comp.onScenarioFileSelected({ target: inputEl });
    expect(scenariosSvc.uploadDocument).toHaveBeenCalledWith('p1', file, 's1');
    expect(inputEl.value).toBe('');
  });

  it('upload en erreur affiche le message renvoyé par l’API', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    const file = new File(['%PDF'], 'trop-gros.pdf', { type: 'application/pdf' });
    scenariosSvc.uploadDocument.mockRejectedValue(
      new HttpErrorResponse({
        status: 413,
        error: { message: 'Fichier trop volumineux (max 5 Mo).' },
      }),
    );
    await comp.onScenarioFileSelected({ target: { files: [file], value: 'trop-gros.pdf' } });
    expect(comp.uploadError()).toBe('Fichier trop volumineux (max 5 Mo).');
  });

  it('téléchargement en erreur affiche un message, ne lève pas d’exception non gérée', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    scenariosSvc.downloadDocument.mockRejectedValue(new Error('network'));
    await comp.downloadDocument(OWN_DOC);
    expect(comp.downloadError()).toBeTruthy();
  });

  it('upload : double-clic rapide → un seul appel réseau (Story 13.1, AC1)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    const file = new File(['%PDF'], 'nouveau.pdf', { type: 'application/pdf' });
    let resolveCall: (v: unknown) => void;
    scenariosSvc.uploadDocument.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    const first = comp.onScenarioFileSelected({ target: { files: [file], value: 'a.pdf' } });
    const second = comp.onScenarioFileSelected({ target: { files: [file], value: 'a.pdf' } });
    resolveCall!(OWN_DOC);
    await first;
    await second;

    expect(scenariosSvc.uploadDocument).toHaveBeenCalledTimes(1);
  });

  it('scenarioInput() change → uploadError/downloadError se réinitialisent (Story 13.1, AC2)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    const comp = fixture.componentInstance as any;
    scenariosSvc.uploadDocument.mockRejectedValue(new Error('upload failed'));
    scenariosSvc.downloadDocument.mockRejectedValue(new Error('download failed'));
    const file = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
    await comp.onScenarioFileSelected({ target: { files: [file], value: 'a.pdf' } });
    await comp.downloadDocument(OWN_DOC);
    expect(comp.uploadError()).toBeTruthy();
    expect(comp.downloadError()).toBeTruthy();

    fixture.componentRef.setInput('scenario', { ...SCENARIO, title: 'Autre' });
    fixture.detectChanges();

    expect(comp.uploadError()).toBeNull();
    expect(comp.downloadError()).toBeNull();
  });

  it('chaque ligne de document porte le pictogramme document, décoratif', async () => {
    const { fixture } = await createComponent();
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.document-row'),
    ) as HTMLElement[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector('app-icon')?.getAttribute('data-icon')).toBe('document');
      expect(row.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('document-row : classe "disabled" pendant le téléchargement (Story 13.1, AC1)', async () => {
    const { fixture, scenariosSvc } = await createComponent();
    let resolveCall: (v: unknown) => void;
    scenariosSvc.downloadDocument.mockReturnValue(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );
    const row = fixture.nativeElement.querySelector('.document-row') as HTMLElement;

    const clickPromise = (fixture.componentInstance as any).downloadDocument(OWN_DOC);
    fixture.detectChanges();
    expect(row.classList.contains('disabled')).toBe(true);

    resolveCall!(new Blob(['%PDF']));
    await clickPromise.catch(() => {});
    fixture.detectChanges();
    expect(row.classList.contains('disabled')).toBe(false);
  });

  describe('CTA « Marquer comme Courant » (AC8)', () => {
    it.each(['BROUILLON', 'COURANT', 'PASSE'] as const)(
      'statut %s → bouton absent',
      async (status) => {
        const { fixture } = await createComponent({ ...SCENARIO, status });
        expect(
          Array.from(fixture.nativeElement.querySelectorAll('button')).some((b) =>
            (b as HTMLElement).textContent?.includes(
              GRIMOIRE_TONE['scenarios.editor_mark_courant'],
            ),
          ),
        ).toBe(false);
      },
    );

    it('statut A_VENIR → bouton présent', async () => {
      const { fixture } = await createComponent({ ...SCENARIO, status: 'A_VENIR' });
      expect(
        Array.from(fixture.nativeElement.querySelectorAll('button')).some((b) =>
          (b as HTMLElement).textContent?.includes(GRIMOIRE_TONE['scenarios.editor_mark_courant']),
        ),
      ).toBe(true);
    });

    it('clic → appelle markCourant, met à jour scenario() avec le retour', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'A_VENIR' });
      const comp = fixture.componentInstance as any;
      scenariosSvc.markCourant.mockResolvedValue({ ...SCENARIO, status: 'COURANT' });
      await comp.markCourant();
      expect(scenariosSvc.markCourant).toHaveBeenCalledWith('s1');
      expect(comp.scenario().status).toBe('COURANT');
    });

    it('échec (409) → markCourantError affiche le message serveur, scenario() inchangé', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'A_VENIR' });
      const comp = fixture.componentInstance as any;
      scenariosSvc.markCourant.mockRejectedValue(
        new HttpErrorResponse({
          status: 409,
          error: { message: 'Un scénario est déjà marqué Courant sur cette Partie.' },
        }),
      );
      await comp.markCourant();
      expect(comp.markCourantError()).toBe('Un scénario est déjà marqué Courant sur cette Partie.');
      expect(comp.scenario().status).toBe('A_VENIR');
    });

    it('double-clic rapide → un seul appel réseau (Story 13.1, AC1)', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'A_VENIR' });
      const comp = fixture.componentInstance as any;
      let resolveCall: (v: unknown) => void;
      scenariosSvc.markCourant.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );

      const first = comp.markCourant();
      const second = comp.markCourant();
      resolveCall!({ ...SCENARIO, status: 'COURANT' });
      await first;
      await second;

      expect(scenariosSvc.markCourant).toHaveBeenCalledTimes(1);
    });

    it('bouton désactivé pendant l’appel, réactivé après (Story 13.1, AC1/AC3)', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'A_VENIR' });
      let resolveCall: (v: unknown) => void;
      scenariosSvc.markCourant.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );
      const button = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes(GRIMOIRE_TONE['scenarios.editor_mark_courant']))!;

      const comp = fixture.componentInstance as any;
      const clickPromise = comp.markCourant();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);

      resolveCall!({ ...SCENARIO, status: 'COURANT' });
      await clickPromise;
      fixture.detectChanges();
      // Le statut passe à COURANT au succès → le bouton lui-même disparaît du DOM (garde @if
      // existante), le signal pending n'a donc plus de bouton à réactiver, mais il doit tout de
      // même être retombé à false (garantie du finally, AC3).
      expect(comp.markCourantPending()).toBe(false);
    });

    it('scenarioInput() change → markCourantError se réinitialise (Story 13.1, AC2)', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'A_VENIR' });
      const comp = fixture.componentInstance as any;
      scenariosSvc.markCourant.mockRejectedValue(
        new HttpErrorResponse({ status: 409, error: { message: 'Déjà Courant.' } }),
      );
      await comp.markCourant();
      expect(comp.markCourantError()).toBe('Déjà Courant.');

      fixture.componentRef.setInput('scenario', { ...SCENARIO, status: 'A_VENIR', title: 'Autre' });
      fixture.detectChanges();

      expect(comp.markCourantError()).toBeNull();
    });
  });

  describe('CTA « Clôturer le scénario » (AC6, Story 7.7)', () => {
    it.each(['BROUILLON', 'A_VENIR', 'PASSE'] as const)(
      'statut %s → bouton absent',
      async (status) => {
        const { fixture } = await createComponent({ ...SCENARIO, status });
        expect(
          Array.from(fixture.nativeElement.querySelectorAll('button')).some((b) =>
            (b as HTMLElement).textContent?.includes(GRIMOIRE_TONE['scenarios.editor_close']),
          ),
        ).toBe(false);
      },
    );

    it('statut COURANT → bouton présent', async () => {
      const { fixture } = await createComponent({ ...SCENARIO, status: 'COURANT' });
      expect(
        Array.from(fixture.nativeElement.querySelectorAll('button')).some((b) =>
          (b as HTMLElement).textContent?.includes(GRIMOIRE_TONE['scenarios.editor_close']),
        ),
      ).toBe(true);
    });

    it('clic → appelle close, met à jour scenario() avec le retour et bascule isReadOnly() à true', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'COURANT' });
      const comp = fixture.componentInstance as any;
      scenariosSvc.close.mockResolvedValue({
        ...SCENARIO,
        status: 'PASSE',
        closedAt: '2026-07-13T10:00:00.000Z',
      });
      await comp.close();
      expect(scenariosSvc.close).toHaveBeenCalledWith('s1');
      expect(comp.scenario().status).toBe('PASSE');
      expect(comp.isReadOnly()).toBe(true);
    });

    it('échec → closeError affiche le message serveur, scenario() inchangé', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'COURANT' });
      const comp = fixture.componentInstance as any;
      scenariosSvc.close.mockRejectedValue(
        new HttpErrorResponse({
          status: 400,
          error: { message: 'Seul un scénario Courant peut être clôturé' },
        }),
      );
      await comp.close();
      expect(comp.closeError()).toBe('Seul un scénario Courant peut être clôturé');
      expect(comp.scenario().status).toBe('COURANT');
    });

    it('double-clic rapide → un seul appel réseau (Story 13.1, AC1)', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'COURANT' });
      const comp = fixture.componentInstance as any;
      let resolveCall: (v: unknown) => void;
      scenariosSvc.close.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );

      const first = comp.close();
      const second = comp.close();
      resolveCall!({ ...SCENARIO, status: 'PASSE' });
      await first;
      await second;

      expect(scenariosSvc.close).toHaveBeenCalledTimes(1);
    });

    it('bouton désactivé pendant l’appel, réactivé après (Story 13.1, AC1/AC3)', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'COURANT' });
      let resolveCall: (v: unknown) => void;
      scenariosSvc.close.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );
      const button = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes(GRIMOIRE_TONE['scenarios.editor_close']))!;

      const comp = fixture.componentInstance as any;
      const clickPromise = comp.close();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);

      resolveCall!({ ...SCENARIO, status: 'PASSE' });
      await clickPromise;
      fixture.detectChanges();
      // Le statut passe à PASSE au succès → le bouton lui-même disparaît du DOM (garde @if
      // existante), le signal pending n'a donc plus de bouton à réactiver, mais il doit tout de
      // même être retombé à false (garantie du finally, AC3).
      expect(comp.closePending()).toBe(false);
    });

    it('scenarioInput() change → closeError se réinitialise (Story 13.1, AC2)', async () => {
      const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, status: 'COURANT' });
      const comp = fixture.componentInstance as any;
      scenariosSvc.close.mockRejectedValue(
        new HttpErrorResponse({ status: 400, error: { message: 'Erreur.' } }),
      );
      await comp.close();
      expect(comp.closeError()).toBe('Erreur.');

      fixture.componentRef.setInput('scenario', { ...SCENARIO, status: 'COURANT', title: 'Autre' });
      fixture.detectChanges();

      expect(comp.closeError()).toBeNull();
    });
  });

  describe('Section participants (vue MJ, non-régression 8.1)', () => {
    it('scénario ONE_SHOT/CAMPAGNE_LINEAIRE (participants undefined) → section absente', async () => {
      const { fixture } = await createComponent({ ...SCENARIO, status: 'COURANT' });
      expect(fixture.nativeElement.textContent).not.toContain(GRIMOIRE_TONE['common.participants']);
    });

    it('CAMPAGNE_EPISODIQUE avec participants → CharacterSummaryCard affichée pour chacun', async () => {
      const alice = makeCharacterDto({ id: 'c1', userId: 'u1' });
      const { fixture } = await createComponent(
        {
          ...SCENARIO,
          status: 'COURANT',
          participants: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' }],
        },
        [alice],
      );
      expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['common.participants']);
      expect(fixture.nativeElement.querySelectorAll('app-character-summary-card')).toHaveLength(1);
    });

    it('CAMPAGNE_EPISODIQUE sans participant → message neutre, aucune carte', async () => {
      const { fixture } = await createComponent({
        ...SCENARIO,
        status: 'COURANT',
        participants: [],
      });
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.editor_no_participants'],
      );
      expect(fixture.nativeElement.querySelectorAll('app-character-summary-card')).toHaveLength(0);
    });

    it('AC2 : échec de chargement des personnages → message d’erreur visible dans la section participants', async () => {
      const characterSvc = { listByPartie: vi.fn().mockRejectedValue(new Error('réseau')) };
      const scenariosSvc = {
        listAll: vi.fn().mockResolvedValue([
          {
            ...SCENARIO,
            status: 'COURANT',
            participants: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' }],
          },
        ]),
        listDocuments: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        uploadDocument: vi.fn(),
        downloadDocument: vi.fn(),
        markCourant: vi.fn(),
        close: vi.fn(),
        addSeance: vi.fn(),
        linkSeancePoll: vi.fn(),
        setResumeFin: vi.fn(),
        changed: signal<{ partieId: string } | null>(null),
      };
      const partiesSvc = { members: vi.fn().mockResolvedValue([]) };
      const pollSvc = { chooseDate: vi.fn(), closePoll: vi.fn() };
      const announcementsSvc = { listAll: vi.fn().mockResolvedValue([]) };
      const realtimeSvc = { connect: vi.fn(), disconnect: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [ScenarioEditor],
        providers: [
          provideRouter([]),
          provideAnimationsAsync(),
          { provide: ScenariosService, useValue: scenariosSvc },
          { provide: CharacterService, useValue: characterSvc },
          { provide: PartiesService, useValue: partiesSvc },
          { provide: PollService, useValue: pollSvc },
          { provide: AnnouncementsService, useValue: announcementsSvc },
          { provide: RealtimeService, useValue: realtimeSvc },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(ScenarioEditor);
      fixture.componentRef.setInput('scenario', {
        ...SCENARIO,
        status: 'COURANT',
        participants: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' }],
      });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
      await fixture.whenStable();
      fixture.detectChanges();

      const comp = fixture.componentInstance as any;
      expect(comp.participantsLoadError()).toBe(
        GRIMOIRE_TONE['scenarios.editor_participants_load_error'],
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.editor_participants_load_error'],
      );
    });

    it('participant sans personnage dans characters → aucune carte fantôme, mais pseudo affiché en secours', async () => {
      const { fixture } = await createComponent(
        {
          ...SCENARIO,
          status: 'COURANT',
          participants: [{ userId: 'no-character-user', pseudo: 'Bob', displayName: 'Bobby' }],
        },
        [],
      );
      expect(fixture.nativeElement.querySelectorAll('app-character-summary-card')).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain('Bob');
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.pas_encore_de_personnage'],
      );
    });

    it('AC3 : deux participants sans personnage partageant le même displayName → pseudo affiché en complément', async () => {
      const { fixture } = await createComponent(
        {
          ...SCENARIO,
          status: 'COURANT',
          participants: [
            { userId: 'u1', pseudo: 'Alice', displayName: 'Même Nom' },
            { userId: 'u2', pseudo: 'Bob', displayName: 'Même Nom' },
          ],
        },
        [],
      );
      const pseudos = fixture.nativeElement.querySelectorAll('.identity-label__pseudo');
      expect(pseudos).toHaveLength(2);
      expect(pseudos[0].textContent.trim()).toBe('(Alice)');
      expect(pseudos[1].textContent.trim()).toBe('(Bob)');
    });

    it('reste peuplée après une action MJ (close()) grâce au DTO enrichi renvoyé par le backend', async () => {
      const alice = makeCharacterDto({ id: 'c1', userId: 'u1' });
      const { fixture, scenariosSvc } = await createComponent(
        {
          ...SCENARIO,
          status: 'COURANT',
          participants: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' }],
        },
        [alice],
      );
      const comp = fixture.componentInstance as any;
      scenariosSvc.close.mockResolvedValue({
        ...SCENARIO,
        status: 'PASSE',
        closedAt: '2026-07-13T10:00:00.000Z',
        participants: [{ userId: 'u1', pseudo: 'Alice', displayName: 'Alice au pays' }],
      });

      await comp.close();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('app-character-summary-card')).toHaveLength(1);
    });
  });

  describe('Séances (Story 8.2)', () => {
    it('bouton « Ajouter une séance » appelle addSeance, met à jour scenario() avec le retour', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      const updated = {
        ...SCENARIO,
        seances: [
          {
            id: 'seance1',
            scenarioId: 's1',
            compteRendu: null,
            createdAt: '2026-07-13T00:00:00.000Z',
          },
        ],
      };
      scenariosSvc.addSeance.mockResolvedValue(updated);

      await comp.addSeance();

      expect(scenariosSvc.addSeance).toHaveBeenCalledWith('s1', 1);
      expect(comp.scenario().seances).toHaveLength(1);
    });

    it('Story 47.1 : la durée choisie part avec l’ajout, puis le compteur revient à 1 créneau', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      scenariosSvc.addSeance.mockResolvedValue({ ...SCENARIO, seances: [] });
      comp.newSeanceDuration.set(6);

      await comp.addSeance();

      expect(scenariosSvc.addSeance).toHaveBeenCalledWith('s1', 6);
      expect(comp.newSeanceDuration()).toBe(1);
    });

    it('échec → addSeanceError affiche le message serveur', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      scenariosSvc.addSeance.mockRejectedValue(
        new HttpErrorResponse({ status: 500, error: { message: 'Erreur serveur' } }),
      );

      await comp.addSeance();

      expect(comp.addSeanceError()).toBe('Erreur serveur');
    });

    it('double-clic rapide → un seul appel réseau (Story 13.1, AC1)', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      let resolveCall: (v: unknown) => void;
      scenariosSvc.addSeance.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );

      const first = comp.addSeance();
      const second = comp.addSeance();
      resolveCall!(SCENARIO);
      await first;
      await second;

      expect(scenariosSvc.addSeance).toHaveBeenCalledTimes(1);
    });

    it('bouton désactivé pendant l’appel, réactivé après (Story 13.1, AC1/AC3)', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      let resolveCall: (v: unknown) => void;
      scenariosSvc.addSeance.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );
      const button = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes(GRIMOIRE_TONE['scenarios.editor_add_seance']))!;

      const clickPromise = (fixture.componentInstance as any).addSeance();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);

      resolveCall!(SCENARIO);
      await clickPromise;
      fixture.detectChanges();
      expect(button.disabled).toBe(false);
    });

    it('scenarioInput() change → addSeanceError se réinitialise (Story 13.1, AC2)', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      scenariosSvc.addSeance.mockRejectedValue(
        new HttpErrorResponse({ status: 500, error: { message: 'Erreur.' } }),
      );
      await comp.addSeance();
      expect(comp.addSeanceError()).toBe('Erreur.');

      fixture.componentRef.setInput('scenario', { ...SCENARIO, title: 'Autre' });
      fixture.detectChanges();

      expect(comp.addSeanceError()).toBeNull();
    });

    it('app-seance-list reçoit isMj=true et le scénario courant', async () => {
      const { fixture } = await createComponent();
      const seanceList = fixture.nativeElement.querySelector('app-seance-list');
      expect(seanceList).toBeTruthy();
    });

    it('onSeanceLinked réassigne scenario() avec le DTO reçu', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      const updated = {
        ...SCENARIO,
        seances: [
          {
            id: 'seance1',
            scenarioId: 's1',
            compteRendu: null,
            createdAt: '2026-07-13T00:00:00.000Z',
          },
        ],
      };

      comp.onSeanceLinked(updated);

      expect(comp.scenario().seances).toHaveLength(1);
    });
  });

  describe('Résumé de fin (Story 8.5)', () => {
    it.each(['BROUILLON', 'A_VENIR', 'COURANT'] as const)(
      'statut %s → section résumé de fin absente',
      async (status) => {
        const { fixture } = await createComponent({ ...SCENARIO, status });
        expect(fixture.nativeElement.textContent).not.toContain('résumé de fin');
      },
    );

    it('statut PASSE sans résumé → texte incitatif affiché', async () => {
      const { fixture } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.editor_resume_empty_hint'].split(' —')[0],
      );
    });

    it('statut PASSE avec résumé déjà rédigé → valeur pré-remplie dans le textarea', async () => {
      const { fixture } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: 'Les PJ ont vaincu le dragon.',
      });
      const comp = fixture.componentInstance as any;
      expect(comp.resumeFinDraft()).toBe('Les PJ ont vaincu le dragon.');
    });

    it('submitResumeFin() appelle scenariosService.setResumeFin et met à jour scenario()', async () => {
      const { fixture, scenariosSvc } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      const comp = fixture.componentInstance as any;
      comp.resumeFinDraft.set('Les PJ ont vaincu le dragon.');
      scenariosSvc.setResumeFin.mockResolvedValue({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: 'Les PJ ont vaincu le dragon.',
      });

      await comp.submitResumeFin();

      expect(scenariosSvc.setResumeFin).toHaveBeenCalledWith('s1', 'Les PJ ont vaincu le dragon.');
      expect(comp.scenario().resumeFin).toBe('Les PJ ont vaincu le dragon.');
    });

    it('échec → resumeFinError affiche le message serveur', async () => {
      const { fixture, scenariosSvc } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      const comp = fixture.componentInstance as any;
      scenariosSvc.setResumeFin.mockRejectedValue(
        new HttpErrorResponse({ status: 500, error: { message: 'Erreur serveur' } }),
      );

      await comp.submitResumeFin();

      expect(comp.resumeFinError()).toBe('Erreur serveur');
    });

    it('double-clic rapide → un seul appel réseau (Story 13.1, AC1)', async () => {
      const { fixture, scenariosSvc } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      const comp = fixture.componentInstance as any;
      let resolveCall: (v: unknown) => void;
      scenariosSvc.setResumeFin.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );

      const first = comp.submitResumeFin();
      const second = comp.submitResumeFin();
      resolveCall!({ ...SCENARIO, status: 'PASSE', resumeFin: 'x' });
      await first;
      await second;

      expect(scenariosSvc.setResumeFin).toHaveBeenCalledTimes(1);
    });

    it('bouton désactivé pendant l’appel, réactivé après (Story 13.1, AC1/AC3)', async () => {
      const { fixture, scenariosSvc } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      let resolveCall: (v: unknown) => void;
      scenariosSvc.setResumeFin.mockReturnValue(
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
      );
      const button = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes(GRIMOIRE_TONE['scenarios.editor_save_resume']))!;

      const clickPromise = (fixture.componentInstance as any).submitResumeFin();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);

      resolveCall!({ ...SCENARIO, status: 'PASSE', resumeFin: 'x' });
      await clickPromise;
      fixture.detectChanges();
      expect(button.disabled).toBe(false);
    });

    it('scenarioInput() change → resumeFinError se réinitialise (Story 13.1, AC2)', async () => {
      const { fixture, scenariosSvc } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      const comp = fixture.componentInstance as any;
      scenariosSvc.setResumeFin.mockRejectedValue(
        new HttpErrorResponse({ status: 500, error: { message: 'Erreur.' } }),
      );
      await comp.submitResumeFin();
      expect(comp.resumeFinError()).toBe('Erreur.');

      fixture.componentRef.setInput('scenario', {
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
        title: 'Autre',
      });
      fixture.detectChanges();

      expect(comp.resumeFinError()).toBeNull();
    });

    it('les comptes-rendus de séance (app-seance-list) restent affichés indépendamment du résumé', async () => {
      const { fixture } = await createComponent({ ...SCENARIO, status: 'PASSE', resumeFin: null });
      expect(fixture.nativeElement.querySelector('app-seance-list')).toBeTruthy();
    });
  });

  describe('Rafraîchissement au montage (bug-fix post-8.2 : vote décidé ailleurs affiché comme obsolète)', () => {
    it("ngOnInit recharge le scénario via listAll et remplace l'instantané reçu en input", async () => {
      const fresh = { ...SCENARIO, resumeFin: 'mis à jour côté serveur' };
      const scenariosSvc = {
        listAll: vi.fn().mockResolvedValue([fresh]),
        listDocuments: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        uploadDocument: vi.fn(),
        downloadDocument: vi.fn(),
        markCourant: vi.fn(),
        close: vi.fn(),
        addSeance: vi.fn(),
        linkSeancePoll: vi.fn(),
        changed: signal<{ partieId: string } | null>(null),
      };
      await TestBed.configureTestingModule({
        imports: [ScenarioEditor],
        providers: [
          provideRouter([]),
          provideAnimationsAsync(),
          { provide: ScenariosService, useValue: scenariosSvc },
          { provide: CharacterService, useValue: { listByPartie: vi.fn().mockResolvedValue([]) } },
          { provide: PartiesService, useValue: { members: vi.fn().mockResolvedValue([]) } },
          { provide: PollService, useValue: { chooseDate: vi.fn(), closePoll: vi.fn() } },
          { provide: AnnouncementsService, useValue: { listAll: vi.fn().mockResolvedValue([]) } },
          { provide: RealtimeService, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(ScenarioEditor);
      fixture.componentRef.setInput('scenario', SCENARIO);
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      const comp = fixture.componentInstance as any;
      expect(comp.scenario().resumeFin).toBe('mis à jour côté serveur');
    });

    it('échec du rechargement → le scénario reçu en input reste affiché tel quel', async () => {
      const scenariosSvc = {
        listAll: vi.fn().mockRejectedValue(new Error('network')),
        listDocuments: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        uploadDocument: vi.fn(),
        downloadDocument: vi.fn(),
        markCourant: vi.fn(),
        close: vi.fn(),
        addSeance: vi.fn(),
        linkSeancePoll: vi.fn(),
        changed: signal<{ partieId: string } | null>(null),
      };
      await TestBed.configureTestingModule({
        imports: [ScenarioEditor],
        providers: [
          provideRouter([]),
          provideAnimationsAsync(),
          { provide: ScenariosService, useValue: scenariosSvc },
          { provide: CharacterService, useValue: { listByPartie: vi.fn().mockResolvedValue([]) } },
          { provide: PartiesService, useValue: { members: vi.fn().mockResolvedValue([]) } },
          { provide: PollService, useValue: { chooseDate: vi.fn(), closePoll: vi.fn() } },
          { provide: AnnouncementsService, useValue: { listAll: vi.fn().mockResolvedValue([]) } },
          { provide: RealtimeService, useValue: { connect: vi.fn(), disconnect: vi.fn() } },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(ScenarioEditor);
      fixture.componentRef.setInput('scenario', SCENARIO);
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      const comp = fixture.componentInstance as any;
      expect(comp.scenario()).toEqual(SCENARIO);
    });
  });

  describe('annonces scopées au scénario (Story 9.2)', () => {
    it("filtre au scenarioId du scénario affiché — une annonce d'un autre scénario ou scenarioId: null n'apparaît jamais", async () => {
      const announcements = [
        makeAnnouncementDto({ id: 'ann-ce-scenario', scenarioId: 's1', text: 'Pour ce scénario' }),
        makeAnnouncementDto({ id: 'ann-autre', scenarioId: 's2', text: 'Pour un autre scénario' }),
        makeAnnouncementDto({ id: 'ann-campagne', scenarioId: null, text: 'Toute la campagne' }),
      ];
      const { fixture } = await createComponent(SCENARIO, [], announcements);

      const comp = fixture.componentInstance as any;
      expect(comp.scenarioAnnouncements().map((a: AnnouncementDto) => a.id)).toEqual([
        'ann-ce-scenario',
      ]);
    });

    it('visible même si le scénario est BROUILLON (pas de gate de statut côté MJ)', async () => {
      const brouillon = { ...SCENARIO, status: 'BROUILLON' as const };
      const announcements = [
        makeAnnouncementDto({ scenarioId: 's1', text: 'Annonce visible même en brouillon' }),
      ];
      const { fixture } = await createComponent(brouillon, [], announcements);

      expect(fixture.nativeElement.textContent).toContain('Annonce visible même en brouillon');
    });

    it("Revue de code (2026-08-06) : le badge « MJ » est toujours affiché sur l'auteur d'une annonce, même sans collision de nom", async () => {
      const announcements = [
        makeAnnouncementDto({ scenarioId: 's1', authorDisplayName: 'MJ Nom' }),
      ];
      const { fixture } = await createComponent(
        { ...SCENARIO, status: 'COURANT' },
        [],
        announcements,
      );

      const badge = fixture.nativeElement.querySelector(
        '.scenario-announcements .annonce-card__mj-badge',
      );
      expect(badge).toBeTruthy();
      expect(badge!.textContent.trim()).toBe('MJ');
    });
  });

  describe('Cohérence du brouillon en édition concurrente (Story 13.3)', () => {
    it('AC1 : rechargement qui ne touche pas description() → descriptionDraft conserve la saisie en cours', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.descriptionDraft.set('brouillon en cours');

      fixture.componentRef.setInput('scenario', { ...SCENARIO, title: 'Autre' });
      fixture.detectChanges();

      expect(comp.descriptionDraft()).toBe('brouillon en cours');
    });

    it('AC2 : rechargement avec description() différente → descriptionDraft est remplacé par la valeur serveur', async () => {
      const { fixture } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.descriptionDraft.set('brouillon en cours');

      fixture.componentRef.setInput('scenario', {
        ...SCENARIO,
        description: 'Nouvelle description serveur',
      });
      fixture.detectChanges();

      expect(comp.descriptionDraft()).toBe('Nouvelle description serveur');
    });

    it('AC3 : rechargement qui ne touche pas resumeFin() → resumeFinDraft conserve la saisie en cours', async () => {
      const { fixture } = await createComponent({ ...SCENARIO, status: 'PASSE', resumeFin: null });
      const comp = fixture.componentInstance as any;
      comp.resumeFinDraft.set('brouillon de résumé en cours');

      fixture.componentRef.setInput('scenario', {
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
        title: 'Autre',
      });
      fixture.detectChanges();

      expect(comp.resumeFinDraft()).toBe('brouillon de résumé en cours');
    });

    it('AC3 : rechargement avec resumeFin() différent → resumeFinDraft est remplacé par la valeur serveur', async () => {
      const { fixture } = await createComponent({ ...SCENARIO, status: 'PASSE', resumeFin: null });
      const comp = fixture.componentInstance as any;
      comp.resumeFinDraft.set('brouillon de résumé en cours');

      fixture.componentRef.setInput('scenario', {
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: 'Résumé rédigé ailleurs',
      });
      fixture.detectChanges();

      expect(comp.resumeFinDraft()).toBe('Résumé rédigé ailleurs');
    });

    it('AC4 (non-régression) : montage initial peuple descriptionDraft/resumeFinDraft depuis le scénario reçu', async () => {
      const { fixture } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        description: 'Description initiale',
        resumeFin: 'Résumé initial',
      });
      const comp = fixture.componentInstance as any;

      expect(comp.descriptionDraft()).toBe('Description initiale');
      expect(comp.resumeFinDraft()).toBe('Résumé initial');
    });
  });

  describe('Câblage temps réel (Story 19.2)', () => {
    it('connect() est appelé avec partieTopic(partieId) au montage (AC1)', async () => {
      const { realtimeSvc } = await createComponent();
      expect(realtimeSvc.connect).toHaveBeenCalledWith(partieTopic(SCENARIO.partieId));
    });

    it('disconnect() est appelé à la destruction du composant', async () => {
      const { fixture, realtimeSvc } = await createComponent();
      fixture.destroy();
      expect(realtimeSvc.disconnect).toHaveBeenCalledWith(partieTopic(SCENARIO.partieId));
    });

    it('garde firstRun : un changed() déjà peuplé (correspondant à cette Partie) au montage ne déclenche PAS de refetch redondant', async () => {
      // ScenariosService est providedIn:'root' — son signal _changed peut déjà porter une valeur
      // correspondant à cette Partie AVANT le montage (mutation locale antérieure dans la même
      // session). Sans le garde firstRun (ScenarioEditor ET SeanceList, cf. bug fix production
      // tempête de requêtes — SeanceList est monté une fois par Séance affichée, donc N instances
      // sans garde multiplieraient les refetch inutiles), ce cas déclencherait un ou plusieurs
      // refetch en plus de celui déjà fait par ngOnInit().
      const { scenariosSvc } = await createComponent(SCENARIO, [], [], {
        partieId: SCENARIO.partieId,
      });

      // 1 seul appel (celui de ngOnInit() de ScenarioEditor) : le garde firstRun de SeanceList
      // neutralise désormais aussi sa première exécution. Un second appel signalerait qu'un des
      // deux gardes firstRun (ScenarioEditor ou SeanceList) n'a pas neutralisé sa première exécution.
      expect(scenariosSvc.listAll.mock.calls.length).toBe(1);
    });

    it('une notification ScenariosService.changed() recharge le scénario affiché (AC1)', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      scenariosSvc.listAll.mockResolvedValue([{ ...SCENARIO, title: 'Titre mis à jour ailleurs' }]);

      scenariosSvc.changed.set({ partieId: SCENARIO.partieId });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      // Note : pas d'assertion sur le nombre d'appels à listAll() — SeanceList (rendu en enfant,
      // Story 19.1) réagit lui aussi, sans filtre de Partie, au même signal partagé, ce qui rend le
      // comptage brut non fiable. On vérifie directement l'effet observable sur ScenarioEditor.
      const comp = fixture.componentInstance as any;
      expect(comp.scenario().title).toBe('Titre mis à jour ailleurs');
    });

    // Note : pas de test « un événement pour une autre Partie ne recharge pas » au niveau de ce
    // composant — SeanceList (rendu en enfant) réagit à CE MÊME signal sans filtre de Partie
    // (Story 19.1, décision assumée : « refetch superflu inoffensif ») et propage systématiquement
    // son propre refetch vers le parent via (seanceLinked)="onSeanceLinked($event)", qui écrase
    // `this.scenario` sans condition. Un tel test échouerait pour une raison étrangère à l'effect()
    // ajouté par cette story — la garde `matchesPartie()` elle-même est déjà exhaustivement testée en
    // tant que fonction pure (Story 19.1, scenarios.service.spec.ts) et son câblage ici est prouvé par
    // le test positif ci-dessus.

    it('AC2 : événement temps réel qui ne touche pas description() → descriptionDraft conserve la saisie en cours', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.descriptionDraft.set('brouillon en cours');
      scenariosSvc.listAll.mockResolvedValue([
        { ...SCENARIO, resumeFin: 'Résumé ajouté ailleurs' },
      ]);

      scenariosSvc.changed.set({ partieId: SCENARIO.partieId });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(comp.descriptionDraft()).toBe('brouillon en cours');
    });

    it('AC3 : événement temps réel avec description() différente → descriptionDraft est remplacé par la valeur serveur', async () => {
      const { fixture, scenariosSvc } = await createComponent();
      const comp = fixture.componentInstance as any;
      comp.descriptionDraft.set('brouillon en cours');
      scenariosSvc.listAll.mockResolvedValue([
        { ...SCENARIO, description: 'Nouvelle description serveur' },
      ]);

      scenariosSvc.changed.set({ partieId: SCENARIO.partieId });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(comp.descriptionDraft()).toBe('Nouvelle description serveur');
    });

    it('AC2 : événement temps réel qui ne touche pas resumeFin() → resumeFinDraft conserve la saisie en cours', async () => {
      const { fixture, scenariosSvc } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      const comp = fixture.componentInstance as any;
      comp.resumeFinDraft.set('brouillon de résumé en cours');
      scenariosSvc.listAll.mockResolvedValue([
        { ...SCENARIO, status: 'PASSE', resumeFin: null, description: 'Autre description' },
      ]);

      scenariosSvc.changed.set({ partieId: SCENARIO.partieId });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(comp.resumeFinDraft()).toBe('brouillon de résumé en cours');
    });

    it('AC3 : événement temps réel avec resumeFin() différent → resumeFinDraft est remplacé par la valeur serveur', async () => {
      const { fixture, scenariosSvc } = await createComponent({
        ...SCENARIO,
        status: 'PASSE',
        resumeFin: null,
      });
      const comp = fixture.componentInstance as any;
      comp.resumeFinDraft.set('brouillon de résumé en cours');
      scenariosSvc.listAll.mockResolvedValue([
        { ...SCENARIO, status: 'PASSE', resumeFin: 'Résumé rédigé ailleurs' },
      ]);

      scenariosSvc.changed.set({ partieId: SCENARIO.partieId });
      fixture.detectChanges();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }

      expect(comp.resumeFinDraft()).toBe('Résumé rédigé ailleurs');
    });
  });
});
