import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import type { ScenarioDto, SeanceDto, SessionPollDto } from '@master-jdr/shared';
import { SeanceList } from './seance-list';
import { AuthService } from '../../../core/auth/auth.service';
import { ScenariosService } from '../../../core/scenarios/scenarios.service';
import { PollService } from '../../../core/poll/poll.service';
import { TONE_MAP } from '../../../core/theme/tones';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const POLL: SessionPollDto = {
  id: 'poll1',
  partieId: 'p1',
  status: 'OPEN',
  scenarioRef: null,
  expiresAt: null,
  chosenDate: null,
  chosenSlot: null,
  // Story 36.6 — effectif de la troupe (MJ + membres).
  membersCount: 4,
  durationSlots: 1,
  options: [],
};

const SEANCE_NO_POLL: SeanceDto = {
  endDate: null,
  endSlot: null,
  durationSlots: 1,
  id: 'seance1',
  scenarioId: 's1',
  // Story 32.3 — date effective servie à la RACINE du DTO (`poll.chosenDate` ?? `Seance.dateValidee`).
  dateValidee: null,
  slotValidee: null,
  compteRendu: null,
  heureRdv: null,
  lieu: null,
  notePratique: null,
  createdAt: '2026-07-13T00:00:00.000Z',
  can: { propose: false, edit: false, choose: false, extend: false },
};

const SEANCE_WITH_POLL: SeanceDto = {
  ...SEANCE_NO_POLL,
  poll: POLL,
};

const SCENARIO: ScenarioDto = {
  id: 's1',
  partieId: 'p1',
  title: 'Chapitre 1',
  description: null,
  status: 'COURANT',
  dureeHeures: null,
  dureeSeances: 3,
  resumeFin: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  closedAt: null,
  seances: [],
};

async function createComponent(
  scenario: ScenarioDto,
  {
    isMj = false,
    isEpisodique = false,
    currentUserId = 'u1',
  }: {
    isMj?: boolean;
    isEpisodique?: boolean;
    currentUserId?: string;
  } = {},
) {
  const scenariosSvc = {
    createSeancePoll: vi.fn(),
    deleteSeance: vi.fn(),
    resetSeanceDate: vi.fn(),
    listAll: vi.fn().mockResolvedValue([scenario]),
    setSeanceCapacity: vi.fn(),
    inscrire: vi.fn(),
    desinscrire: vi.fn(),
    setCompteRendu: vi.fn(),
    setInfosPratiques: vi.fn(),
    // Story 19.1 (Task 4) : SeanceList réagit désormais à ce signal (effect() du constructeur).
    changed: signal<{ partieId: string } | null>(null),
  };
  const pollSvc = {
    chooseDate: vi.fn(),
    closePoll: vi.fn(),
  };
  const authSvc = { currentUser: () => ({ id: currentUserId }) };
  const router = { navigate: vi.fn(), navigateByUrl: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [SeanceList],
    providers: [
      provideAnimationsAsync(),
      { provide: ScenariosService, useValue: scenariosSvc },
      { provide: PollService, useValue: pollSvc },
      { provide: AuthService, useValue: authSvc },
      { provide: Router, useValue: router },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SeanceList);
  fixture.componentRef.setInput('scenario', scenario);
  fixture.componentRef.setInput('partieId', 'p1');
  fixture.componentRef.setInput('isMj', isMj);
  fixture.componentRef.setInput('isEpisodique', isEpisodique);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, scenariosSvc, pollSvc, router };
}

describe('SeanceList', () => {
  it('une notification via ScenariosService.changed() recharge le scénario (Story 19.1, AC2)', async () => {
    const { fixture, scenariosSvc } = await createComponent({
      ...SCENARIO,
      seances: [SEANCE_NO_POLL],
    });
    scenariosSvc.listAll.mockClear();

    scenariosSvc.changed.set({ partieId: 'p1' });
    fixture.detectChanges();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }

    expect(scenariosSvc.listAll).toHaveBeenCalledWith('p1');
  });

  it('numérote chaque séance dans l’ordre (« Séance 1 », « Séance 2 »…)', async () => {
    const seance2: SeanceDto = { ...SEANCE_NO_POLL, id: 'seance2' };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL, seance2] },
      { isMj: true },
    );
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.seance-row__title')).map(
      (el: any) => el.textContent.trim(),
    );
    expect(titles).toEqual(['Séance 1', 'Séance 2']);
  });

  it('MJ, séance sans poll → bouton "Lancer le vote" visible', async () => {
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL] },
      { isMj: true },
    );
    expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['common.lancer_le_vote']);
    expect(fixture.nativeElement.querySelector('app-poll-status')).toBeNull();
  });

  it('MJ, clic sur "Lancer le vote" → navigue vers le calendrier avec seanceId en queryParam (Story 8.7, AC2/AC3)', async () => {
    const { fixture, router } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL] },
      { isMj: true },
    );
    const btn: HTMLButtonElement = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b: any) =>
      b.textContent.includes(GRIMOIRE_TONE['common.lancer_le_vote']),
    ) as HTMLButtonElement;
    btn.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/parties/p1/calendar?seanceId=seance1');
  });

  it('MJ, séance avec poll → résumé du vote (Story 54.3), plus de liste des créneaux', async () => {
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_WITH_POLL] },
      { isMj: true },
    );
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-poll-status')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-poll-creation')).toBeNull();
  });

  it('joueur, séance avec poll → app-seance-poll-summary visible (Story 54.2)', async () => {
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_WITH_POLL] },
      { isMj: false },
    );
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeTruthy();
  });

  it('joueur, séance sans poll → rien affiché pour cette séance', async () => {
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL] },
      { isMj: false },
    );
    expect(fixture.nativeElement.querySelector('app-poll-creation')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-poll-status')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeNull();
  });

  describe('onClosePoll() rafraîchit l’affichage (bug-fix : « rien ne se passe » après avoir scellé un créneau)', () => {
    it('onClosePoll appelle closePoll PUIS recharge le scénario et émet seanceLinked', async () => {
      const { fixture, scenariosSvc, pollSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_POLL] },
        { isMj: true },
      );
      const comp = fixture.componentInstance as any;
      const closedPoll: SessionPollDto = { ...POLL, status: 'CLOSED' };
      const fresh = { ...SCENARIO, seances: [{ ...SEANCE_WITH_POLL, poll: closedPoll }] };
      scenariosSvc.listAll.mockResolvedValue([fresh]);
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      await comp.onClosePoll('poll1');

      expect(pollSvc.closePoll).toHaveBeenCalledWith('p1', 'poll1');
      expect(emitted).toEqual(fresh);
    });
  });

  describe('Poll clôturé : date retenue affichée (bug-fix : aucune indication de la date choisie)', () => {
    const CLOSED_WITH_DATE: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: {
        ...POLL,
        status: 'CLOSED',
        chosenDate: '2026-08-01T00:00:00.000Z',
        chosenSlot: 'EVENING',
        // Story 36.6 — effectif de la troupe (MJ + membres).
        membersCount: 4,
        durationSlots: 1,
      },
    };
    const CLOSED_NO_DATE: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: { ...POLL, status: 'CLOSED' },
    };

    it('MJ, poll CLOSED avec chosenDate → affiche "Date retenue", plus de app-poll-status', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [CLOSED_WITH_DATE] },
        { isMj: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.date_retenue_date'].split(' :')[0],
      );
      expect(fixture.nativeElement.querySelector('app-poll-status')).toBeNull();
    });

    it('joueur, poll CLOSED avec chosenDate → affiche "Date retenue", plus de résumé', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [CLOSED_WITH_DATE] },
        { isMj: false },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.date_retenue_date'].split(' :')[0],
      );
      expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeNull();
    });

    it('MJ, poll CLOSED avec chosenDate → bouton "Réinitialiser la date" visible (Story 8.8, AC4)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [CLOSED_WITH_DATE] },
        { isMj: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.reinitialiser_la_date'],
      );
    });

    it('MJ, clic sur "Réinitialiser la date" (confirmé) → appelle resetSeanceDate et émet seanceLinked', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [CLOSED_WITH_DATE] },
        { isMj: true },
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const updated = { ...SCENARIO, seances: [SEANCE_NO_POLL] };
      scenariosSvc.resetSeanceDate.mockResolvedValue(updated);
      const comp = fixture.componentInstance as any;
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      const btn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b: any) =>
        b.textContent.includes(GRIMOIRE_TONE['common.reinitialiser_la_date']),
      ) as HTMLButtonElement;
      btn.click();
      await Promise.resolve();

      expect(scenariosSvc.resetSeanceDate).toHaveBeenCalledWith('seance1');
      expect(emitted).toEqual(updated);
    });

    it('MJ, clic sur "Réinitialiser la date" (refusé) → aucun appel à resetSeanceDate', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [CLOSED_WITH_DATE] },
        { isMj: true },
      );
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const btn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b: any) =>
        b.textContent.includes(GRIMOIRE_TONE['common.reinitialiser_la_date']),
      ) as HTMLButtonElement;
      btn.click();
      await Promise.resolve();

      expect(scenariosSvc.resetSeanceDate).not.toHaveBeenCalled();
    });

    it('poll CLOSED sans chosenDate → bouton "Réinitialiser la date" quand même visible (revue de code : sinon la séance reste bloquée)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [CLOSED_NO_DATE] },
        { isMj: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.reinitialiser_la_date'],
      );
    });

    it("poll CLOSED sans chosenDate → message neutre plutôt qu'une date vide", async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [CLOSED_NO_DATE] },
        { isMj: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.vote_cloture_sans_date_retenue'],
      );
    });
  });

  describe('Inscription à capacité limitée (Story 8.3, révisé Story 8.8 : coexiste désormais avec le vote)', () => {
    const SEANCE_NO_CAPACITY: SeanceDto = { ...SEANCE_NO_POLL };
    const SEANCE_WITH_CAPACITY: SeanceDto = {
      ...SEANCE_NO_POLL,
      inscription: {
        min: 4,
        max: 6,
        inscrits: [{ userId: 'u2', pseudo: 'Bob' }],
        dateValidee: null,
      },
    };
    const SEANCE_AT_MAX: SeanceDto = {
      ...SEANCE_NO_POLL,
      inscription: {
        min: 4,
        max: 2,
        inscrits: [
          { userId: 'u2', pseudo: 'Bob' },
          { userId: 'u3', pseudo: 'Carl' },
        ],
        dateValidee: null,
      },
    };
    const SEANCE_INSCRIT = {
      ...SEANCE_NO_POLL,
      inscription: {
        min: 4,
        max: 6,
        inscrits: [{ userId: 'u1', pseudo: 'Alice' }],
        dateValidee: null,
      },
    };
    // Compat rétroactive : une date posée par l'ancienne validerDate() (Story 8.3/8.7, retirée en
    // 8.8), jamais issue d'un vote — le champ Seance.dateValidee brut reste lu en repli.
    const SEANCE_VALIDATED_LEGACY: SeanceDto = {
      ...SEANCE_NO_POLL,
      inscription: {
        min: 4,
        max: 6,
        inscrits: [{ userId: 'u2', pseudo: 'Bob' }],
        dateValidee: '2026-08-01T00:00:00.000Z',
      },
    };
    const SEANCE_WITH_CAPACITY_AND_OPEN_POLL: SeanceDto = {
      ...SEANCE_WITH_CAPACITY,
      poll: POLL,
    };
    const SEANCE_VALIDATED_VIA_POLL: SeanceDto = {
      ...SEANCE_WITH_CAPACITY,
      poll: {
        ...POLL,
        status: 'CLOSED',
        chosenDate: '2026-08-15T00:00:00.000Z',
        chosenSlot: 'AFTERNOON',
        // Story 36.6 — effectif de la troupe (MJ + membres).
        membersCount: 4,
        durationSlots: 1,
      },
    };
    const SEANCE_CLOSED_NO_DATE: SeanceDto = {
      ...SEANCE_WITH_CAPACITY,
      poll: { ...POLL, status: 'CLOSED' },
    };

    it('MJ, séance sans capacité définie → formulaire visible, aucun FillIndicator', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_CAPACITY] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.querySelector('.capacity-form')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeNull();
    });

    it('formulaire de capacité : bouton désactivé si un champ est vide ou si max < min, activé sinon', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_CAPACITY] },
        { isMj: true, isEpisodique: true },
      );
      const el = fixture.nativeElement as HTMLElement;
      const inputs = Array.from(el.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
      const [minInput, maxInput] = inputs;
      const submitBtn = Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(GRIMOIRE_TONE['scenarios.seances_set_capacity']),
      ) as HTMLButtonElement;

      // Champs vides par défaut → désactivé.
      expect(submitBtn.disabled).toBe(true);

      minInput.value = '4';
      minInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      // min seul rempli, max toujours vide → toujours désactivé.
      expect(submitBtn.disabled).toBe(true);

      maxInput.value = '2';
      maxInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      // max < min → toujours désactivé.
      expect(submitBtn.disabled).toBe(true);

      maxInput.value = '6';
      maxInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      // min=4, max=6 → valide, activé.
      expect(submitBtn.disabled).toBe(false);
    });

    it('MJ, capacité définie, pas de vote en cours → FillIndicator + "Lancer le vote" + "Modifier la capacité" (Story 8.8, AC1/AC5)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['common.lancer_le_vote']);
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.seances_edit_capacity'],
      );
    });

    it('MJ, clic sur "Lancer le vote" (épisodique) → navigue vers le calendrier avec seanceId (Story 8.8, AC1)', async () => {
      const { fixture, router } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] },
        { isMj: true, isEpisodique: true },
      );
      const btn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b: any) =>
        b.textContent.includes(GRIMOIRE_TONE['common.lancer_le_vote']),
      ) as HTMLButtonElement;
      btn.click();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/parties/p1/calendar?seanceId=seance1');
    });

    it('MJ, capacité définie + vote OPEN → FillIndicator + résumé + "Clôturer le vote" (Story 8.8, AC2)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY_AND_OPEN_POLL] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-poll-status')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain(GRIMOIRE_TONE['common.cloturer_le_vote']);
    });

    it('MJ, capacité définie + vote clôturé avec chosenDate → "Date retenue", plus de FillIndicator/CTA (Story 8.8, AC2)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_VALIDATED_VIA_POLL] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.date_retenue_date'].split(' :')[0],
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-poll-status')).toBeNull();
    });

    it('MJ, capacité définie + vote clôturé sans date retenue → bouton "Réinitialiser la date" quand même visible (revue de code)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_CLOSED_NO_DATE] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.vote_cloture_sans_date_retenue'],
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.reinitialiser_la_date'],
      );
    });

    it('MJ, date validée (épisodique, via poll) → bouton "Réinitialiser la date" visible, appelle resetSeanceDate (Story 8.8, AC4)', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_VALIDATED_VIA_POLL] },
        { isMj: true, isEpisodique: true },
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const updated = { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] };
      scenariosSvc.resetSeanceDate.mockResolvedValue(updated);
      const comp = fixture.componentInstance as any;
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      const btn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b: any) =>
        b.textContent.includes(GRIMOIRE_TONE['common.reinitialiser_la_date']),
      ) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      btn.click();
      await Promise.resolve();

      expect(scenariosSvc.resetSeanceDate).toHaveBeenCalledWith('seance1');
      expect(emitted).toEqual(updated);
    });

    it('MJ, date validée (épisodique, héritage dateValidee sans poll) → bouton "Réinitialiser la date" visible (Story 8.8, AC4)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_VALIDATED_LEGACY] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.reinitialiser_la_date'],
      );
    });

    it('MJ, clic sur "Modifier la capacité" → réaffiche le formulaire pré-rempli (AC6)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] },
        { isMj: true, isEpisodique: true },
      );
      const btn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b: any) =>
        b.textContent.includes(GRIMOIRE_TONE['scenarios.seances_edit_capacity']),
      ) as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      const inputs = Array.from(
        fixture.nativeElement.querySelectorAll('input[type="number"]'),
      ) as HTMLInputElement[];
      expect(inputs[0].value).toBe('4');
      expect(inputs[1].value).toBe('6');
    });

    it('MJ, mode édition capacité → bouton "Annuler" ferme le formulaire sans soumettre (revue de code)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] },
        { isMj: true, isEpisodique: true },
      );
      const editBtn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b: any) =>
        b.textContent.includes(GRIMOIRE_TONE['scenarios.seances_edit_capacity']),
      ) as HTMLButtonElement;
      editBtn.click();
      fixture.detectChanges();

      const cancelBtn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find(
        (b: any) => b.textContent.trim() === GRIMOIRE_TONE['common.annuler'],
      ) as HTMLButtonElement;
      expect(cancelBtn).toBeTruthy();
      cancelBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.seances_edit_capacity'],
      );
      expect(fixture.nativeElement.querySelectorAll('input[type="number"]').length).toBe(0);
    });

    it('MJ, date validée (héritage validerDate(), sans poll) → texte "Date retenue", plus de CTA ni FillIndicator', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_VALIDATED_LEGACY] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.date_retenue_date'].split(' :')[0],
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain(
        GRIMOIRE_TONE['scenarios.seances_edit_capacity'],
      );
    });

    it('joueur, séance sans capacité définie → rien affiché', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_CAPACITY] },
        { isMj: false, isEpisodique: true },
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeNull();
      expect(fixture.nativeElement.querySelector('.capacity-form')).toBeNull();
    });

    it('joueur non-inscrit → FillIndicator + bouton "S\'inscrire" actif', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] },
        { isMj: false, isEpisodique: true, currentUserId: 'u1' },
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeTruthy();
      const btn: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b: any) =>
        b.textContent.includes(GRIMOIRE_TONE['scenarios.seances_inscrire']),
      ) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(false);
    });

    it('joueur déjà inscrit → bouton "Se désinscrire" affiché à la place', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_INSCRIT] },
        { isMj: false, isEpisodique: true, currentUserId: 'u1' },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.seances_desinscrire'],
      );
      expect(fixture.nativeElement.textContent).not.toContain(
        GRIMOIRE_TONE['scenarios.seances_inscrire'],
      );
    });

    it('joueur non-inscrit, capacité au max → aucun bouton d’inscription, ni encadré (AC4, Story 54.1)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_AT_MAX] },
        { isMj: false, isEpisodique: true, currentUserId: 'u1' },
      );
      // Complète : la ligne « Pas inscrit·e » suffit, plus de bouton grisé.
      expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain(
        GRIMOIRE_TONE['scenarios.seances_inscrire'],
      );
      expect(fixture.nativeElement.querySelector('.situation-line')).not.toBeNull();
    });

    it('joueur, capacité définie + vote OPEN → FillIndicator/inscrire ET résumé du vote, tous deux visibles (Story 8.8, AC2)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY_AND_OPEN_POLL] },
        { isMj: false, isEpisodique: true, currentUserId: 'u1' },
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeTruthy();
    });

    it('joueur, date validée via poll.chosenDate → texte "Date retenue", plus de FillIndicator ni bouton', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_VALIDATED_VIA_POLL] },
        { isMj: false, isEpisodique: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.date_retenue_date'].split(' :')[0],
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeNull();
    });

    it('joueur, date validée (héritage validerDate(), sans poll) → texte "Date retenue", plus de FillIndicator ni bouton', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_VALIDATED_LEGACY] },
        { isMj: false, isEpisodique: true },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['common.date_retenue_date'].split(' :')[0],
      );
      expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeNull();
    });

    it('onSetCapacity appelle setSeanceCapacity et émet seanceLinked', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_CAPACITY] },
        { isMj: true, isEpisodique: true },
      );
      const comp = fixture.componentInstance as any;
      const updated = { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] };
      scenariosSvc.setSeanceCapacity.mockResolvedValue(updated);
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      await comp.onSetCapacity('seance1', 4, 6);

      expect(scenariosSvc.setSeanceCapacity).toHaveBeenCalledWith('seance1', 4, 6);
      expect(emitted).toEqual(updated);
    });

    it('onInscrire appelle inscrire et émet seanceLinked', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] },
        { isMj: false, isEpisodique: true },
      );
      const comp = fixture.componentInstance as any;
      const updated = { ...SCENARIO, seances: [SEANCE_INSCRIT] };
      scenariosSvc.inscrire.mockResolvedValue(updated);
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      await comp.onInscrire('seance1');

      expect(scenariosSvc.inscrire).toHaveBeenCalledWith('seance1');
      expect(emitted).toEqual(updated);
    });

    it('onDesinscrire appelle desinscrire et émet seanceLinked', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_INSCRIT] },
        { isMj: false, isEpisodique: true },
      );
      const comp = fixture.componentInstance as any;
      const updated = { ...SCENARIO, seances: [SEANCE_WITH_CAPACITY] };
      scenariosSvc.desinscrire.mockResolvedValue(updated);
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      await comp.onDesinscrire('seance1');

      expect(scenariosSvc.desinscrire).toHaveBeenCalledWith('seance1');
      expect(emitted).toEqual(updated);
    });
  });

  describe('Suppression d’une séance (Story 8.7, AC5)', () => {
    const SEANCE_2: SeanceDto = { ...SEANCE_NO_POLL, id: 'seance2' };

    it('MJ, première séance (i=0) → aucun bouton de suppression', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_2] },
        { isMj: true },
      );
      const rows = fixture.nativeElement.querySelectorAll('.seance-row');
      expect(
        Array.from(rows[0].querySelectorAll('button')).some((b: any) =>
          b.textContent.includes('Supprimer cette séance'),
        ),
      ).toBe(false);
    });

    it('MJ, séance non-première (i>0) → bouton de suppression visible', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_2] },
        { isMj: true },
      );
      const rows = fixture.nativeElement.querySelectorAll('.seance-row');
      expect(
        Array.from(rows[1].querySelectorAll('button')).some((b: any) =>
          b.textContent.includes(GRIMOIRE_TONE['scenarios.seances_delete_button']),
        ),
      ).toBe(true);
    });

    it('joueur (isMj=false) → jamais de bouton de suppression, quelle que soit la séance', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_2] },
        { isMj: false },
      );
      expect(fixture.nativeElement.textContent).not.toContain('Supprimer cette séance');
    });

    it('clic sur "Supprimer cette séance" (confirmé) → appelle deleteSeance et émet seanceLinked', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_2] },
        { isMj: true },
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const updated = { ...SCENARIO, seances: [SEANCE_NO_POLL] };
      scenariosSvc.deleteSeance.mockResolvedValue(updated);
      const comp = fixture.componentInstance as any;
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      await comp.onDeleteSeance(SEANCE_2);

      expect(scenariosSvc.deleteSeance).toHaveBeenCalledWith('seance2');
      expect(emitted).toEqual(updated);
    });

    it('confirmation refusée (window.confirm → false) → aucun appel à deleteSeance', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_2] },
        { isMj: true },
      );
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const comp = fixture.componentInstance as any;

      await comp.onDeleteSeance(SEANCE_2);

      expect(scenariosSvc.deleteSeance).not.toHaveBeenCalled();
    });

    it('séance sans date validée → confirmation générique (revue de code)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_2] },
        { isMj: true },
      );
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const comp = fixture.componentInstance as any;

      await comp.onDeleteSeance(SEANCE_2);

      expect(confirmSpy).toHaveBeenCalledWith(GRIMOIRE_TONE['scenarios.seances_delete_confirm']);
    });

    it('séance épisodique avec date validée (inscription.dateValidee) → confirmation renforcée (revue de code)', async () => {
      const SEANCE_DATE_VALIDEE: SeanceDto = {
        ...SEANCE_2,
        inscription: {
          min: 2,
          max: 4,
          inscrits: [],
          dateValidee: '2026-08-15T00:00:00.000Z',
        },
      };
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_DATE_VALIDEE] },
        { isMj: true, isEpisodique: true },
      );
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const comp = fixture.componentInstance as any;

      await comp.onDeleteSeance(SEANCE_DATE_VALIDEE);

      expect(confirmSpy).toHaveBeenCalledWith(
        GRIMOIRE_TONE['scenarios.seances_delete_confirm_dated'],
      );
    });

    it('séance linéaire avec vote clôturé et date choisie (poll.chosenDate) → confirmation renforcée (revue de code)', async () => {
      const SEANCE_POLL_CHOSEN: SeanceDto = {
        ...SEANCE_2,
        poll: {
          id: 'poll1',
          partieId: 'p1',
          status: 'CLOSED',
          scenarioRef: null,
          expiresAt: null,
          chosenDate: '2026-08-15T00:00:00.000Z',
          chosenSlot: 'AFTERNOON',
          // Story 36.6 — effectif de la troupe (MJ + membres).
          membersCount: 4,
          durationSlots: 1,
          options: [],
        },
      };
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL, SEANCE_POLL_CHOSEN] },
        { isMj: true },
      );
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const comp = fixture.componentInstance as any;

      await comp.onDeleteSeance(SEANCE_POLL_CHOSEN);

      expect(confirmSpy).toHaveBeenCalledWith(
        GRIMOIRE_TONE['scenarios.seances_delete_confirm_dated'],
      );
    });
  });

  describe('Informations pratiques (Story 36.5, D-15 amendée)', () => {
    const SEANCE_AVEC_INFOS: SeanceDto = {
      ...SEANCE_NO_POLL,
      heureRdv: '20:30',
      lieu: 'chez Marc',
      notePratique: 'pensez aux dés',
    };

    it('AC1 : le MJ voit les trois contrôles, dont un sélecteur d’heure natif', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL] },
        { isMj: true },
      );
      const el = fixture.nativeElement as HTMLElement;

      const inputs = el.querySelectorAll('.infos-pratiques__field input');
      expect(inputs).toHaveLength(3);
      expect(el.querySelector<HTMLInputElement>('input[type="time"]')).not.toBeNull();
    });

    it('AC1 : les contrôles sont pré-remplis avec les valeurs existantes', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_AVEC_INFOS] },
        { isMj: true },
      );
      const el = fixture.nativeElement as HTMLElement;

      const values = [
        ...el.querySelectorAll<HTMLInputElement>('.infos-pratiques__field input'),
      ].map((i) => i.value);
      expect(values).toEqual(['20:30', 'chez Marc', 'pensez aux dés']);
    });

    it('Story 51.6 : heure illisible → pictogramme avertissement AVANT le texte du thème, sans caractère ⚠', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [{ ...SEANCE_NO_POLL, heureRdv: '8h30' }] },
        { isMj: true },
      );
      const warning = (fixture.nativeElement as HTMLElement).querySelector(
        '.infos-pratiques__warning',
      ) as HTMLElement;

      expect(warning).not.toBeNull();
      expect(warning.firstElementChild?.getAttribute('data-icon')).toBe('avertissement');
      expect(warning.firstElementChild?.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
      expect(warning.textContent).toContain('8h30');
      expect(warning.textContent).not.toContain('⚠');
    });

    it('Story 51.6 : heure bien formée ou absente → aucun avertissement', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_AVEC_INFOS] },
        { isMj: true },
      );
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.infos-pratiques__warning'),
      ).toBeNull();
    });

    it('AC5 : un joueur ne voit AUCUN champ de saisie', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_AVEC_INFOS] },
        { isMj: false },
      );
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('.infos-pratiques__fields')).toBeNull();
      expect(el.querySelector('.seance-row__infos-pratiques-text')?.textContent).toContain(
        'chez Marc',
      );
    });

    it('AC4 : une séance sans informations pratiques n’affiche RIEN au joueur', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL] },
        { isMj: false },
      );
      const el = fixture.nativeElement as HTMLElement;

      // Aucun état incitatif ici, contrairement au compte-rendu — divergence volontaire.
      expect(el.querySelector('.seance-row__infos-pratiques-text')).toBeNull();
    });

    it('AC4 : une séance n’ayant QU’UN lieu l’affiche seul, sans séparateur orphelin', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [{ ...SEANCE_NO_POLL, lieu: 'en visio' }] },
        { isMj: false },
      );
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('.seance-row__infos-pratiques-text')?.textContent?.trim()).toBe(
        'en visio',
      );
    });

    it('Story 47.3 : une plage de plusieurs créneaux se lit du début à la fin ; un créneau seul garde son texte', async () => {
      const ranged = {
        ...SEANCE_NO_POLL,
        dateValidee: '2026-11-06T00:00:00.000Z',
        slotValidee: 'EVENING' as const,
        endDate: '2026-11-08T00:00:00.000Z',
        endSlot: 'AFTERNOON' as const,
      };
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [ranged] },
        { isMj: false },
      );
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.seance-row__chosen-date')?.textContent).toContain(
        'ven. 6 nov. soir → dim. 8 nov. après-midi',
      );

      TestBed.resetTestingModule();
      const single = {
        ...ranged,
        endDate: '2026-11-06T00:00:00.000Z',
        endSlot: 'EVENING' as const,
      };
      const { fixture: f2 } = await createComponent({ ...SCENARIO, seances: [single] });
      expect(
        (f2.nativeElement as HTMLElement).querySelector('.seance-row__chosen-date')?.textContent,
      ).not.toContain('→');
    });

    it('Story 47.5 : un vote CLOSED dont la date retenue est une plage se lit « début → fin », côté MJ comme côté joueur', async () => {
      const closedRange: SeanceDto = {
        ...SEANCE_NO_POLL,
        poll: {
          ...POLL,
          status: 'CLOSED',
          chosenDate: '2026-11-06T00:00:00.000Z',
          chosenSlot: 'EVENING',
          durationSlots: 6,
        },
        endDate: '2026-11-08T00:00:00.000Z',
        endSlot: 'AFTERNOON',
        durationSlots: 6,
      };
      for (const isMj of [true, false]) {
        const { fixture } = await createComponent(
          { ...SCENARIO, seances: [closedRange] },
          { isMj },
        );
        const text = (fixture.nativeElement as HTMLElement).querySelector(
          '.seance-row__chosen-date',
        )?.textContent;
        expect(text, isMj ? 'MJ' : 'joueur').toContain('ven. 6 nov. soir → dim. 8 nov. après-midi');
        TestBed.resetTestingModule();
      }
    });

    it('AC1 : enregistrer appelle le service avec les trois valeurs et émet seanceLinked', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_AVEC_INFOS] },
        { isMj: true },
      );
      const updated = { ...SCENARIO, seances: [SEANCE_AVEC_INFOS] };
      scenariosSvc.setInfosPratiques.mockResolvedValue(updated);
      const emitted: unknown[] = [];
      fixture.componentInstance.seanceLinked.subscribe((v: unknown) => emitted.push(v));

      const el = fixture.nativeElement as HTMLElement;
      const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
      buttons.find((b) => b.textContent?.includes('informations pratiques'))!.click();
      await fixture.whenStable();

      expect(scenariosSvc.setInfosPratiques).toHaveBeenCalledWith(SEANCE_NO_POLL.id, {
        heureRdv: '20:30',
        lieu: 'chez Marc',
        notePratique: 'pensez aux dés',
      });
      expect(emitted).toHaveLength(1);
    });

    it('Story 47.1 : la durée choisie part avec les informations pratiques', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL] },
        { isMj: true },
      );
      scenariosSvc.setInfosPratiques.mockResolvedValue({ ...SCENARIO, seances: [] });
      const el = fixture.nativeElement as HTMLElement;

      el.querySelector<HTMLButtonElement>('.ds__step--more')!.click();
      el.querySelector<HTMLButtonElement>('.ds__step--more')!.click();
      fixture.detectChanges();
      expect(el.querySelector('.ds__value')?.textContent?.trim()).toBe('3 créneaux');

      const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
      buttons.find((b) => b.textContent?.includes('informations pratiques'))!.click();
      await fixture.whenStable();

      expect(scenariosSvc.setInfosPratiques).toHaveBeenCalledWith(
        SEANCE_NO_POLL.id,
        expect.objectContaining({ durationSlots: 3 }),
      );
    });

    it('Story 47.1 : sous un vote ouvert sans date, la durée est en lecture seule et ne part pas', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [{ ...SEANCE_WITH_POLL, durationSlots: 3 }] },
        { isMj: true },
      );
      scenariosSvc.setInfosPratiques.mockResolvedValue({ ...SCENARIO, seances: [] });
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector<HTMLButtonElement>('.ds__step--more')!.disabled).toBe(true);
      expect(el.querySelector('.ds__value')?.textContent?.trim()).toBe('3 créneaux');

      const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
      buttons.find((b) => b.textContent?.includes('informations pratiques'))!.click();
      await fixture.whenStable();

      const payload = scenariosSvc.setInfosPratiques.mock.calls[0][1];
      expect(payload).not.toHaveProperty('durationSlots');
    });

    it('un champ vidé part à null, jamais à la chaîne vide', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL] },
        { isMj: true },
      );
      scenariosSvc.setInfosPratiques.mockResolvedValue({ ...SCENARIO, seances: [] });

      const el = fixture.nativeElement as HTMLElement;
      const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
      buttons.find((b) => b.textContent?.includes('informations pratiques'))!.click();
      await fixture.whenStable();

      expect(scenariosSvc.setInfosPratiques).toHaveBeenCalledWith(SEANCE_NO_POLL.id, {
        heureRdv: null,
        lieu: null,
        notePratique: null,
      });
    });

    it('AC9 : une valeur contenant du balisage est affichée LITTÉRALEMENT', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [{ ...SEANCE_NO_POLL, lieu: '<img src=x onerror=alert(1)>' }] },
        { isMj: false },
      );
      const el = fixture.nativeElement as HTMLElement;
      const node = el.querySelector('.seance-row__infos-pratiques-text')!;

      expect(node.textContent).toContain('<img src=x onerror=alert(1)>');
      expect(node.querySelector('img')).toBeNull();
    });
  });

  describe('Compte-rendu de séance (Story 8.4, commun aux branches linéaire et épisodique)', () => {
    const SEANCE_WITH_COMPTE_RENDU: SeanceDto = {
      ...SEANCE_NO_POLL,
      compteRendu: 'Les PJ ont vaincu le dragon.',
    };
    const SEANCE_EMPTY_COMPTE_RENDU: SeanceDto = { ...SEANCE_NO_POLL, compteRendu: '' };
    const SEANCE_WHITESPACE_COMPTE_RENDU: SeanceDto = { ...SEANCE_NO_POLL, compteRendu: '   ' };

    it('MJ, branche linéaire → textarea + bouton toujours visibles, même sans compte-rendu (AC5)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL] },
        { isMj: true },
      );
      expect(fixture.nativeElement.querySelector('textarea')).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.seances_save_compte_rendu'],
      );
    });

    it('MJ, branche épisodique → textarea + bouton également visibles (AC1, indépendant du kind)', async () => {
      const seanceEpisodique: SeanceDto = {
        ...SEANCE_NO_POLL,
        inscription: { min: 4, max: 6, inscrits: [], dateValidee: null },
      };
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [seanceEpisodique] },
        { isMj: true, isEpisodique: true },
      );
      expect(fixture.nativeElement.querySelector('textarea')).toBeTruthy();
    });

    it('MJ, séance avec compte-rendu existant → textarea pré-rempli', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_COMPTE_RENDU] },
        { isMj: true },
      );
      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
      expect(textarea.value).toBe('Les PJ ont vaincu le dragon.');
    });

    it('joueur, compte-rendu présent → texte affiché, jamais de champ de saisie', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WITH_COMPTE_RENDU] },
        { isMj: false },
      );
      expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Les PJ ont vaincu le dragon.');
    });

    it('joueur, compte-rendu null → état incitatif (AC4)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL] },
        { isMj: false },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.seances_compte_rendu_empty'],
      );
    });

    it('joueur, compte-rendu chaîne vide → état incitatif également (jamais un vide silencieux)', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_EMPTY_COMPTE_RENDU] },
        { isMj: false },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.seances_compte_rendu_empty'],
      );
    });

    it('joueur, compte-rendu composé uniquement d’espaces → état incitatif également', async () => {
      const { fixture } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_WHITESPACE_COMPTE_RENDU] },
        { isMj: false },
      );
      expect(fixture.nativeElement.textContent).toContain(
        GRIMOIRE_TONE['scenarios.seances_compte_rendu_empty'],
      );
    });

    it('onSetCompteRendu appelle setCompteRendu et émet seanceLinked', async () => {
      const { fixture, scenariosSvc } = await createComponent(
        { ...SCENARIO, seances: [SEANCE_NO_POLL] },
        { isMj: true },
      );
      const comp = fixture.componentInstance as any;
      const updated = { ...SCENARIO, seances: [SEANCE_WITH_COMPTE_RENDU] };
      scenariosSvc.setCompteRendu.mockResolvedValue(updated);
      let emitted: ScenarioDto | undefined;
      comp.seanceLinked.subscribe((v: ScenarioDto) => (emitted = v));

      await comp.onSetCompteRendu('seance1', 'Les PJ ont vaincu le dragon.');

      expect(scenariosSvc.setCompteRendu).toHaveBeenCalledWith(
        'seance1',
        'Les PJ ont vaincu le dragon.',
      );
      expect(emitted).toEqual(updated);
    });
  });
});

// ─── Story 32.3 — le badge d'état de séance ────────────────────────────────
//
// 🚨 Ces tests vivent volontairement au niveau de la SURFACE : la dérivation elle-même est
// couverte ligne par ligne, et à jour figé, par `core/status/status-derivation.spec.ts`. Ici on
// vérifie seulement que la bonne chose arrive à l'écran, pour un MJ COMME pour un joueur.
//
// Les décalages sont volontairement larges (± 10 jours) : `SeanceList` lit son « aujourd'hui »
// depuis l'horloge réelle, et ces écarts restent du bon côté quel que soit le fuseau du runner.
function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

describe('SeanceList — badge d’état (Story 32.3)', () => {
  function badges(fixture: { nativeElement: HTMLElement }): string[] {
    return [...fixture.nativeElement.querySelectorAll('.status-badge')].map((n) =>
      (n.textContent ?? '').trim(),
    );
  }

  const OPEN_POLL: SessionPollDto = {
    ...POLL,
    options: [
      { id: 'o1', date: isoInDays(10), slot: 'EVENING', votes: [] },
      { id: 'o2', date: isoInDays(12), slot: 'EVENING', votes: [] },
    ],
  };

  it('MJ — séance sans date ni vote → « À planifier »', async () => {
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL] },
      { isMj: true },
    );
    expect(badges(fixture)).toEqual(['À planifier']);
  });

  it('joueur — séance sans date ni vote → le MÊME badge (l’état ne dépend pas du rôle)', async () => {
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL] },
      { isMj: false },
    );
    expect(badges(fixture)).toEqual(['À planifier']);
  });

  it('joueur qui n’a pas répondu → « Vote en cours » (badge impersonnel, story 53.1)', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN_POLL };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isMj: false, currentUserId: 'u1' },
    );
    expect(badges(fixture)).toEqual(['Vote en cours']);
  });

  it('joueur qui a répondu à TOUTES les options → le MÊME « Vote en cours » (l’état ne dépend plus du lecteur)', async () => {
    const vote = { userId: 'u1', pseudo: 'u1', displayName: 'u1', answer: 'YES' as const };
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: { ...OPEN_POLL, options: OPEN_POLL.options.map((o) => ({ ...o, votes: [vote] })) },
    };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isMj: false, currentUserId: 'u1' },
    );
    expect(badges(fixture)).toEqual(['Vote en cours']);
  });

  it('séance datée dans le futur → « Programmée », teinte soon', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, dateValidee: isoInDays(10) };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] }, { isMj: true });
    expect(badges(fixture)).toEqual(['Programmée']);
    expect(fixture.nativeElement.querySelector('.status-badge--soon')).toBeTruthy();
  });

  it('séance passée sans compte-rendu → « À débriefer » (ce qui réclame une action)', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, dateValidee: isoInDays(-10) };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] }, { isMj: true });
    expect(badges(fixture)).toEqual(['À débriefer']);
    expect(fixture.nativeElement.querySelector('.status-badge--todo')).toBeTruthy();
  });

  it('séance passée avec compte-rendu → « Jouée », teinte done', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      dateValidee: isoInDays(-10),
      compteRendu: 'On a survécu.',
    };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] }, { isMj: false });
    expect(badges(fixture)).toEqual(['Jouée']);
    expect(fixture.nativeElement.querySelector('.status-badge--done')).toBeTruthy();
  });

  it('⚠️ le badge n’évince rien : indicateur de remplissage, vote et compte-rendu restent rendus', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      inscription: { min: 2, max: 4, inscrits: [], dateValidee: null },
    };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isMj: false, isEpisodique: true },
    );
    expect(badges(fixture)).toEqual(['Inscriptions ouvertes']);
    expect(fixture.nativeElement.querySelector('app-fill-indicator')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['scenarios.seances_compte_rendu_empty'],
    );
  });
});

// Story 53.3 — « Ma situation » juste sous l'en-tête de chaque séance de la fiche. Le calcul est
// celui de `seanceSituation()` (non rejoué ici) : on épingle le CÂBLAGE, la position et les deux
// côtés (joueur / MJ). `seance-list` est partagé par l'éditeur, le dialogue de lecture et l'onglet
// Chapitre d'une quête unique : une seule implémentation, trois surfaces.
describe('SeanceList — « Ma situation » (Story 53.3)', () => {
  const OPEN_POLL: SessionPollDto = {
    ...POLL,
    options: [{ id: 'o1', date: isoInDays(10), slot: 'EVENING', votes: [] }],
  };
  const VOTE = { userId: 'u1', pseudo: 'u1', displayName: 'u1', answer: 'YES' as const };

  function situation(fixture: { nativeElement: HTMLElement }, index = 0) {
    const row = fixture.nativeElement.querySelectorAll('.seance-row')[index] as HTMLElement;
    const line = row.querySelector('.situation-line');
    if (!line) return null;
    return {
      label: (line.querySelector('.situation-line__label')?.textContent ?? '').trim(),
      pill: (line.querySelector('.situation-pill')?.textContent ?? '').trim(),
    };
  }

  it('joueur, vote ouvert non répondu → « Ma situation » + « Vote à faire », sous l’en-tête', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN_POLL };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    expect(situation(fixture)).toEqual({ label: 'Ma situation', pill: 'Vote à faire' });

    // Position : directement après `.seance-row__header` (titre, badge d'état, suppression). Une
    // action est attendue (voter) : la ligne est portée par l'encadré (Story 54.1), en tête.
    const header = fixture.nativeElement.querySelector('.seance-row__header') as HTMLElement;
    const box = header.nextElementSibling as HTMLElement;
    expect(box.tagName.toLowerCase()).toBe('app-seance-situation');
    expect(box.querySelector('.seance-situation')?.firstElementChild?.tagName.toLowerCase()).toBe(
      'app-situation-line',
    );
    expect(header.querySelector('.situation-line')).toBeNull();
  });

  it('joueur, vote ouvert répondu → « J’ai voté »', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: { ...OPEN_POLL, options: OPEN_POLL.options.map((o) => ({ ...o, votes: [VOTE] })) },
    };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    expect(situation(fixture)?.pill).toBe('J’ai voté');
  });

  it('joueur, séance datée à venir → « Je participe » ; passée → « J’y étais »', async () => {
    const future: SeanceDto = { ...SEANCE_NO_POLL, id: 'f', dateValidee: isoInDays(10) };
    const past: SeanceDto = { ...SEANCE_NO_POLL, id: 'p', dateValidee: isoInDays(-10) };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [future, past] });
    expect(situation(fixture, 0)?.pill).toBe('Je participe');
    expect(situation(fixture, 1)?.pill).toBe('J’y étais');
  });

  it('joueur, inscription ouverte non inscrit → « Pas inscrit·e »', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      dateValidee: isoInDays(10),
      inscription: { min: 2, max: 4, inscrits: [], dateValidee: isoInDays(10) },
    };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isEpisodique: true },
    );
    expect(situation(fixture)?.pill).toBe('Pas inscrit·e');
  });

  it('joueur, séance sans date ni vote → aucune ligne (le badge seul)', async () => {
    const { fixture } = await createComponent({ ...SCENARIO, seances: [SEANCE_NO_POLL] });
    expect(situation(fixture)).toBeNull();
    expect(fixture.nativeElement.querySelector('.seance-row .status-badge')).toBeTruthy();
  });

  it('MJ → « Je mène » sur chaque séance', async () => {
    const seance2: SeanceDto = { ...SEANCE_NO_POLL, id: 'seance2', poll: OPEN_POLL };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL, seance2] },
      { isMj: true },
    );
    expect(situation(fixture, 0)?.pill).toBe('Je mène');
    expect(situation(fixture, 1)?.pill).toBe('Je mène');
  });

  it('texte seul, et jamais « Réponds au vote » dans la fiche', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN_POLL };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    const line = fixture.nativeElement.querySelector('.situation-line') as HTMLElement;
    expect(line.querySelector('button, a, input, [role="button"], [tabindex]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Réponds au vote');
  });
});

// Story 53.3 (boucle 1) — `situationIsMj` ne règle QUE la ligne « Ma situation » ; `isMj` reste seul
// juge des contrôles MJ (dialogue de lecture : contrôles cachés, mais le MJ lit « Je mène »).
describe('SeanceList — situationIsMj (Story 53.3)', () => {
  const PAST: SeanceDto = { ...SEANCE_NO_POLL, id: 'a', dateValidee: isoInDays(-10) };
  const PAST_2: SeanceDto = { ...PAST, id: 'b' };

  async function create(inputs: { isMj: boolean; situationIsMj?: boolean }) {
    const scenario: ScenarioDto = { ...SCENARIO, seances: [PAST, PAST_2] };
    const created = await createComponent(scenario, { isMj: inputs.isMj });
    if (inputs.situationIsMj !== undefined) {
      created.fixture.componentRef.setInput('situationIsMj', inputs.situationIsMj);
      created.fixture.detectChanges();
    }
    return created.fixture;
  }

  function pills(fixture: { nativeElement: HTMLElement }): string[] {
    return [...fixture.nativeElement.querySelectorAll('.situation-pill')].map((p) =>
      (p.textContent ?? '').trim(),
    );
  }

  it('par défaut, la situation suit isMj (MJ → « Je mène », joueur → « J’y étais »)', async () => {
    expect(pills(await create({ isMj: true }))).toEqual(['Je mène', 'Je mène']);
    TestBed.resetTestingModule();
    expect(pills(await create({ isMj: false }))).toEqual(['J’y étais', 'J’y étais']);
  });

  it('isMj=false + situationIsMj=true → « Je mène », sans aucun contrôle MJ', async () => {
    const fixture = await create({ isMj: false, situationIsMj: true });
    expect(pills(fixture)).toEqual(['Je mène', 'Je mène']);
    expect(fixture.nativeElement.querySelector('.seance-row__delete')).toBeNull();
  });

  it('isMj=true + situationIsMj=false → la situation du joueur, les contrôles MJ restent', async () => {
    const fixture = await create({ isMj: true, situationIsMj: false });
    expect(pills(fixture)).toEqual(['J’y étais', 'J’y étais']);
    expect(fixture.nativeElement.querySelector('.seance-row__delete')).toBeTruthy();
  });
});

// Story 54.1 ⚠️ — l'encadré de situation : l'action attendue, une seule fois, sous l'en-tête.
describe('SeanceList — encadré de situation (Story 54.1)', () => {
  const OPEN: SessionPollDto = {
    ...POLL,
    options: [{ id: 'o1', date: isoInDays(10), slot: 'EVENING', votes: [] }],
  };
  const VOTE = { userId: 'u1', pseudo: 'u1', displayName: 'u1', answer: 'YES' as const };
  const CAPACITY = (inscrits: string[], max = 6): SeanceDto['inscription'] => ({
    min: 2,
    max,
    inscrits: inscrits.map((userId) => ({ userId, pseudo: userId })),
    dateValidee: null,
  });

  function find(root: HTMLElement, label: string): HTMLButtonElement[] {
    return Array.from(root.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement[];
  }

  it('joueur, vote à faire : en-tête puis encadré ; ligne et encadré jamais ensemble', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    const row = fixture.nativeElement.querySelector('.seance-row') as HTMLElement;
    const tags = Array.from(row.children).map((c) => c.tagName.toLowerCase());
    expect(tags[0]).toBe('div');
    expect(tags[1]).toBe('app-seance-situation');
    expect(row.querySelectorAll('.situation-line')).toHaveLength(1);
    expect(row.querySelector('.seance-situation .situation-line')).not.toBeNull();
    expect(row.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['scenarios.seance_situation_vote_open_no_deadline'],
    );
  });

  it('joueur, « Voter dans le calendrier » : la fiche se ferme AVANT la navigation vers guild-calendar?poll=', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN };
    const { fixture, router } = await createComponent({ ...SCENARIO, seances: [seance] });
    const order: string[] = [];
    fixture.componentInstance.leaving.subscribe(() => order.push('leaving'));
    router.navigateByUrl.mockImplementation(() => {
      order.push('navigate');
      return Promise.resolve(true);
    });
    const [btn] = find(fixture.nativeElement, 'Voter dans le calendrier');
    btn.click();
    expect(order).toEqual(['leaving', 'navigate']);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/parties/p1/guild-calendar?poll=poll1');
  });

  it('joueur, échéance passée → la ligne seule, aucun encadré', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: { ...OPEN, expiresAt: isoInDays(-3) },
    };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.situation-line')).toHaveLength(1);
  });

  it('joueur, inscription : « Inscrire mon nom » une seule fois, appelle inscrire', async () => {
    const free: SeanceDto = { ...SEANCE_NO_POLL, inscription: CAPACITY(['u2']) };
    const { fixture, scenariosSvc } = await createComponent(
      { ...SCENARIO, seances: [free] },
      { isEpisodique: true, currentUserId: 'u1' },
    );
    const inscrire = find(fixture.nativeElement, GRIMOIRE_TONE['scenarios.seances_inscrire']);
    expect(inscrire).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.seance-situation__text')?.textContent).toContain(
      GRIMOIRE_TONE['scenarios.seance_situation_not_registered'],
    );
    scenariosSvc.inscrire.mockResolvedValue({ ...SCENARIO, seances: [free] });
    inscrire[0].click();
    expect(scenariosSvc.inscrire).toHaveBeenCalledWith('seance1');
  });

  it('joueur inscrit : « Retirer mon nom » une seule fois, appelle desinscrire', async () => {
    const registered: SeanceDto = { ...SEANCE_NO_POLL, inscription: CAPACITY(['u1']) };
    const { fixture, scenariosSvc } = await createComponent(
      { ...SCENARIO, seances: [registered] },
      { isEpisodique: true, currentUserId: 'u1' },
    );
    const retirer = find(fixture.nativeElement, GRIMOIRE_TONE['scenarios.seances_desinscrire']);
    expect(retirer).toHaveLength(1);
    scenariosSvc.desinscrire.mockResolvedValue({ ...SCENARIO, seances: [registered] });
    retirer[0].click();
    expect(scenariosSvc.desinscrire).toHaveBeenCalledWith('seance1');
  });

  it('joueur, inscription ET vote ouvert, vote à faire → « Voter », même inscrit ou non', async () => {
    const pending: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN, inscription: CAPACITY(['u2']) };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [pending] },
      { isEpisodique: true, currentUserId: 'u1' },
    );
    expect(find(fixture.nativeElement, 'Voter dans le calendrier')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.situation-line')).toHaveLength(1);
  });

  it('joueur, inscription ET vote ouvert, vote répondu → l’inscription décide', async () => {
    const answered: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: { ...OPEN, options: OPEN.options.map((o) => ({ ...o, votes: [VOTE] })) },
      inscription: CAPACITY(['u2']),
    };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [answered] },
      { isEpisodique: true, currentUserId: 'u1' },
    );
    expect(find(fixture.nativeElement, 'Voter dans le calendrier')).toHaveLength(0);
    expect(find(fixture.nativeElement, GRIMOIRE_TONE['scenarios.seances_inscrire'])).toHaveLength(
      1,
    );
  });

  it('joueur, vote clos sans date : le message reste en ligne, sans encadré', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: { ...OPEN, status: 'CLOSED' } };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['common.vote_cloture_sans_date_retenue'],
    );
  });

  it('MJ, sans date ni vote : « Lancer le vote » une seule fois, avec l’icône vote, ouvre ?seanceId=', async () => {
    const { fixture, router } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL] },
      { isMj: true },
    );
    const found = find(fixture.nativeElement, GRIMOIRE_TONE['common.lancer_le_vote']);
    expect(found).toHaveLength(1);
    expect(found[0].querySelector('app-icon[data-icon="vote"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.seance-situation--mj')).not.toBeNull();
    found[0].click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/parties/p1/calendar?seanceId=seance1');
  });

  it('MJ, épisodique : capacité fixée → « Lancer le vote » dans l’encadré', async () => {
    const withCapacity: SeanceDto = { ...SEANCE_NO_POLL, inscription: CAPACITY([], 6) };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [withCapacity] },
      { isMj: true, isEpisodique: true },
    );
    expect(find(fixture.nativeElement, GRIMOIRE_TONE['common.lancer_le_vote'])).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('app-seance-situation')).not.toBeNull();
  });

  it('MJ, épisodique sans capacité : formulaire de capacité seul, aucun encadré', async () => {
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [SEANCE_NO_POLL] },
      { isMj: true, isEpisodique: true },
    );
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
    expect(fixture.nativeElement.querySelector('.capacity-form')).not.toBeNull();
  });

  it('MJ, vote clos sans date : message et « Effacer la date » une seule fois, confirmation puis resetSeanceDate', async () => {
    const closed: SeanceDto = { ...SEANCE_NO_POLL, poll: { ...OPEN, status: 'CLOSED' } };
    const { fixture, scenariosSvc } = await createComponent(
      { ...SCENARIO, seances: [closed] },
      { isMj: true },
    );
    const text = GRIMOIRE_TONE['common.vote_cloture_sans_date_retenue'];
    expect(fixture.nativeElement.textContent.split(text).length - 1).toBe(1);
    const reset = find(fixture.nativeElement, GRIMOIRE_TONE['common.reinitialiser_la_date']);
    expect(reset).toHaveLength(1);
    scenariosSvc.resetSeanceDate.mockResolvedValue({ ...SCENARIO, seances: [SEANCE_NO_POLL] });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    reset[0].click();
    expect(confirm).toHaveBeenCalled();
    expect(scenariosSvc.resetSeanceDate).toHaveBeenCalledWith('seance1');
    confirm.mockRestore();
  });

  it('MJ, vote ouvert sans can.choose : aucun encadré, le résumé du MJ (Story 54.3)', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] }, { isMj: true });
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-poll-status')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.situation-line')).toHaveLength(1);
  });

  it('MJ en lecture seule (isMj faux, situationIsMj vrai) : aucun encadré, « Je mène » en ligne', async () => {
    const { fixture } = await createComponent({ ...SCENARIO, seances: [SEANCE_NO_POLL] });
    fixture.componentRef.setInput('situationIsMj', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
    expect(fixture.nativeElement.querySelector('.situation-pill')?.textContent?.trim()).toBe(
      'Je mène',
    );
  });

  it('pendant une écriture, le bouton de l’encadré est désactivé', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, inscription: CAPACITY(['u2']) };
    const { fixture, scenariosSvc } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isEpisodique: true },
    );
    scenariosSvc.inscrire.mockReturnValue(new Promise(() => undefined));
    const label = GRIMOIRE_TONE['scenarios.seances_inscrire'];
    find(fixture.nativeElement, label)[0].click();
    fixture.detectChanges();
    expect(find(fixture.nativeElement, label)[0].disabled).toBe(true);
  });

  it('temps réel : une réponse reçue après un changed() fait disparaître l’encadré', async () => {
    const pending: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN };
    const answered: SeanceDto = {
      ...pending,
      poll: { ...OPEN, options: OPEN.options.map((o) => ({ ...o, votes: [VOTE] })) },
    };
    const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, seances: [pending] });
    expect(fixture.nativeElement.querySelector('app-seance-situation')).not.toBeNull();

    scenariosSvc.listAll.mockResolvedValue([{ ...SCENARIO, seances: [answered] }]);
    fixture.componentInstance.seanceLinked.subscribe((s) => {
      fixture.componentRef.setInput('scenario', s);
    });
    scenariosSvc.changed.set({ partieId: 'p1' });
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
    expect(fixture.nativeElement.querySelector('.situation-pill')?.textContent?.trim()).toBe(
      'J’ai voté',
    );
  });
});

// Story 54.1 (revue) — deux cas limites trouvés par les relecteurs.
describe('SeanceList — encadré de situation, cas limites (Story 54.1, revue)', () => {
  const CLOSED_POLL: SessionPollDto = { ...POLL, status: 'CLOSED' };

  it('MJ linéaire, vote clos sans date scellée mais date héritée : « Effacer la date » reste, une seule fois', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: CLOSED_POLL,
      dateValidee: isoInDays(10),
    };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] }, { isMj: true });
    const label = GRIMOIRE_TONE['common.reinitialiser_la_date'];
    const resets = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).filter((b) => b.textContent?.trim() === label);
    expect(resets).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
  });

  it('MJ épisodique : « Modifier la capacité » retire l’encadré « Lancer le vote » le temps de la saisie', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      inscription: { min: 2, max: 6, inscrits: [], dateValidee: null },
    };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isMj: true, isEpisodique: true },
    );
    expect(fixture.nativeElement.querySelector('app-seance-situation')).not.toBeNull();
    const edit = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === GRIMOIRE_TONE['scenarios.seances_edit_capacity'],
    );
    edit!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.capacity-form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
  });
});

// Story 54.2 ⚠️ — le vote en résumé côté joueur ; le vote se fait dans la Destinée seulement.
describe('SeanceList — résumé du vote (Story 54.2)', () => {
  const OPEN: SessionPollDto = {
    ...POLL,
    options: [
      { id: 'o1', date: isoInDays(10), slot: 'EVENING', votes: [] },
      { id: 'o2', date: isoInDays(12), slot: 'EVENING', votes: [] },
    ],
  };
  const lines = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('.seance-poll-summary__line')).map((l) =>
      (l.textContent ?? '').trim(),
    );

  it('joueur, vote ouvert : le résumé vient sous l’encadré, plus aucun app-poll-response', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    const row = fixture.nativeElement.querySelector('.seance-row') as HTMLElement;
    const tags = Array.from(row.children).map((c) => c.tagName.toLowerCase());
    expect(tags.indexOf('app-seance-poll-summary')).toBe(tags.indexOf('app-seance-situation') + 1);
    expect(row.querySelector('app-poll-response')).toBeNull();
    expect(lines(row)[0]).toBe('Vos réponses : 0 créneau sur 2');
  });

  it('joueur, épisodique avec inscription et vote ouvert : encadré puis résumé', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: OPEN,
      inscription: { min: 2, max: 6, inscrits: [], dateValidee: null },
    };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isEpisodique: true, currentUserId: 'u1' },
    );
    expect(fixture.nativeElement.querySelector('app-seance-situation')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).not.toBeNull();
  });

  it('séance sans sondage : aucun résumé', async () => {
    const { fixture } = await createComponent({ ...SCENARIO, seances: [SEANCE_NO_POLL] });
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeNull();
  });

  it('date fixée : la date en grand à la place du résumé', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      dateValidee: isoInDays(10),
      poll: { ...OPEN, status: 'CLOSED', chosenDate: isoInDays(10), chosenSlot: 'EVENING' },
    };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeNull();
    const date = fixture.nativeElement.querySelector('.seance-row__chosen-date--big');
    expect(date?.textContent).toContain('Date scellée');
  });

  it('vote clos sans date : le message, ni résumé ni date en grand', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, poll: { ...OPEN, status: 'CLOSED' } };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeNull();
    expect(fixture.nativeElement.querySelector('.seance-row__chosen-date--big')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['common.vote_cloture_sans_date_retenue'],
    );
  });

  it('temps réel : une réponse reçue après un changed() met le résumé à jour', async () => {
    const pending: SeanceDto = { ...SEANCE_NO_POLL, poll: OPEN };
    const answered: SeanceDto = {
      ...SEANCE_NO_POLL,
      poll: {
        ...OPEN,
        options: OPEN.options.map((o, i) => ({
          ...o,
          votes: i === 0 ? [{ userId: 'u1', pseudo: 'u1', displayName: 'u1', answer: 'YES' }] : [],
        })),
      },
    };
    const { fixture, scenariosSvc } = await createComponent({ ...SCENARIO, seances: [pending] });
    expect(lines(fixture.nativeElement)[0]).toBe('Vos réponses : 0 créneau sur 2');

    scenariosSvc.listAll.mockResolvedValue([{ ...SCENARIO, seances: [answered] }]);
    fixture.componentInstance.seanceLinked.subscribe((s) => {
      fixture.componentRef.setInput('scenario', s);
    });
    scenariosSvc.changed.set({ partieId: 'p1' });
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    expect(lines(fixture.nativeElement)[0]).toBe('Vos réponses : 1 créneau sur 2');
  });
});

// Story 54.2 (revue) — la date en grand sur les trois sites joueur.
describe('SeanceList — date en grand côté joueur (Story 54.2, revue)', () => {
  it('séance linéaire datée par héritage, sans vote : date en grand', async () => {
    const seance: SeanceDto = { ...SEANCE_NO_POLL, dateValidee: isoInDays(10) };
    const { fixture } = await createComponent({ ...SCENARIO, seances: [seance] });
    const date = fixture.nativeElement.querySelector('.seance-row__chosen-date--big');
    expect(date?.textContent).toContain('Date scellée');
  });

  it('séance à inscription datée : date en grand', async () => {
    const seance: SeanceDto = {
      ...SEANCE_NO_POLL,
      dateValidee: isoInDays(10),
      inscription: { min: 2, max: 6, inscrits: [], dateValidee: isoInDays(10) },
    };
    const { fixture } = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isEpisodique: true, currentUserId: 'u1' },
    );
    const date = fixture.nativeElement.querySelector('.seance-row__chosen-date--big');
    expect(date?.textContent).toContain('Date scellée');
  });
});

// Story 54.3 ⚠️ — le MJ conclut depuis la fiche : résumé, « Fixer la date… », « Clôturer le vote ».
describe('SeanceList — résumé et « Fixer la date… » côté MJ (Story 54.3)', () => {
  const vote = (userId: string, answer: 'YES' | 'NO' | 'MAYBE') => ({
    userId,
    pseudo: userId,
    displayName: `Nom ${userId}`,
    answer,
  });
  const OPEN: SessionPollDto = {
    ...POLL,
    options: [
      { id: 'o1', date: isoInDays(10), slot: 'EVENING', votes: [vote('lou', 'YES')] },
      { id: 'o2', date: isoInDays(12), slot: 'EVENING', votes: [vote('lou', 'NO')] },
    ],
  };
  const MEMBERS = [
    { userId: 'lou', pseudo: 'lou', displayName: 'Lou', role: 'MEMBER', joinedAt: '' },
    { userId: 'sam', pseudo: 'sam', displayName: 'Sam', role: 'MEMBER', joinedAt: '' },
  ] as never[];
  const CAN = { propose: false, edit: false, choose: true, extend: false };

  async function createGm(seance: SeanceDto, opts: { loaded?: boolean } = {}) {
    const created = await createComponent({ ...SCENARIO, seances: [seance] }, { isMj: true });
    created.fixture.componentRef.setInput('members', MEMBERS);
    created.fixture.componentRef.setInput('membersLoaded', opts.loaded ?? true);
    created.fixture.detectChanges();
    return created;
  }
  const lines = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('.seance-poll-summary__line')).map((l) =>
      (l.textContent ?? '').trim(),
    );
  const find = (root: HTMLElement, label: string) =>
    Array.from(root.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement[];

  it('vote ouvert : le résumé du MJ nomme les absents, plus aucun app-poll-status', async () => {
    const { fixture } = await createGm({ ...SEANCE_NO_POLL, poll: OPEN, can: CAN });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-poll-status')).toBeNull();
    expect(lines(root)).toContain('N’ont pas encore répondu : Sam');
    expect(lines(root)[0]).toBe('Réponses : 1 sur 4 joueurs');
  });

  it('liste des membres non chargée : retombe sur le nombre d’absents', async () => {
    const { fixture } = await createGm(
      { ...SEANCE_NO_POLL, poll: OPEN, can: CAN },
      { loaded: false },
    );
    expect(lines(fixture.nativeElement)).toContain('3 personnes n’ont pas encore répondu');
  });

  it('« Fixer la date… » : une seule fois, dans l’encadré, jamais dans le résumé', async () => {
    const { fixture } = await createGm({ ...SEANCE_NO_POLL, poll: OPEN, can: CAN });
    const root = fixture.nativeElement as HTMLElement;
    expect(find(root, 'Fixer la date…')).toHaveLength(1);
    expect(root.querySelector('.seance-situation')?.textContent).toContain('Fixer la date…');
    expect(root.querySelector('.seance-poll-summary')?.textContent).not.toContain('Fixer la date…');
  });

  it('sans can.choose : pas d’encadré, pas de « Fixer la date… »', async () => {
    const { fixture } = await createGm({
      ...SEANCE_NO_POLL,
      poll: OPEN,
      can: { ...CAN, choose: false },
    });
    expect(find(fixture.nativeElement, 'Fixer la date…')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('app-seance-situation')).toBeNull();
  });

  it('échéance passée : l’encadré dit « Le vote est terminé. » et la date se fixe encore', async () => {
    const { fixture } = await createGm({
      ...SEANCE_NO_POLL,
      poll: { ...OPEN, expiresAt: isoInDays(-3) },
      can: CAN,
    });
    expect(fixture.nativeElement.querySelector('.seance-situation__text')?.textContent).toContain(
      'Le vote est terminé.',
    );
    expect(find(fixture.nativeElement, 'Fixer la date…')).toHaveLength(1);
  });

  describe('« Fixer la date… » ouvre SealConfirmDialog', () => {
    async function open(seance: SeanceDto, afterClosed: unknown) {
      const created = await createGm(seance);
      const dialog = (
        created.fixture.componentInstance as unknown as {
          dialog: { open: (...a: unknown[]) => unknown };
        }
      ).dialog;
      const open = vi
        .spyOn(dialog, 'open')
        .mockReturnValue({ afterClosed: () => afterClosed }) as unknown as {
        mock: { calls: any[][] };
        toString(): string;
      };
      return { ...created, open };
    }

    it('meilleur créneau en tête, libellé du chapitre et de la séance, restoreFocus', async () => {
      const { fixture, open: spy } = await open(
        { ...SEANCE_NO_POLL, poll: OPEN, can: CAN },
        of(false),
      );
      find(fixture.nativeElement, 'Fixer la date…')[0].click();
      await fixture.whenStable();
      const [, config] = spy.mock.calls[0];
      expect(config.data.pollLabel).toBe('Chapitre 1 — Séance 1');
      expect(config.data.slots[0].id).toBe('o1');
      expect(config.restoreFocus).toBe(true);
      expect(config.width).toBe('min(560px, 96vw)');
    });

    it('confirmé : chooseDate puis relecture du scénario ; renoncer : aucun appel', async () => {
      const a = await open({ ...SEANCE_NO_POLL, poll: OPEN, can: CAN }, of(true));
      a.pollSvc.chooseDate.mockResolvedValue(undefined);
      a.scenariosSvc.listAll.mockClear();
      find(a.fixture.nativeElement, 'Fixer la date…')[0].click();
      for (let i = 0; i < 10; i++) await Promise.resolve();
      const [, config] = a.open.mock.calls[0];
      await config.data.confirm('o1');
      expect(a.pollSvc.chooseDate).toHaveBeenCalledWith('p1', 'poll1', { optionId: 'o1' });
      expect(a.scenariosSvc.listAll).toHaveBeenCalledWith('p1');
      TestBed.resetTestingModule();

      const b = await open({ ...SEANCE_NO_POLL, poll: OPEN, can: CAN }, of(false));
      b.scenariosSvc.listAll.mockClear();
      find(b.fixture.nativeElement, 'Fixer la date…')[0].click();
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(b.pollSvc.chooseDate).not.toHaveBeenCalled();
      expect(b.scenariosSvc.listAll).not.toHaveBeenCalled();
    });

    it('double toucher : une seule fenêtre', async () => {
      const { fixture, open: spy } = await open(
        { ...SEANCE_NO_POLL, poll: OPEN, can: CAN },
        new Subject<boolean>(),
      );
      const [btn] = find(fixture.nativeElement, 'Fixer la date…');
      btn.click();
      btn.click();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  it('« Voir dans le calendrier → » ouvre la Destinée du MJ sur ce vote', async () => {
    const { fixture, router } = await createGm({ ...SEANCE_NO_POLL, poll: OPEN, can: CAN });
    find(fixture.nativeElement, 'Voir dans le calendrier →')[0].click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/parties/p1/calendar?poll=poll1');
  });

  it('« Clôturer le vote » : confirmé → closePoll ; renoncer → vote ouvert, aucun appel', async () => {
    const a = await createGm({ ...SEANCE_NO_POLL, poll: OPEN, can: CAN });
    const summary = a.fixture.nativeElement.querySelector('app-seance-poll-summary');
    expect(summary).not.toBeNull();
    // La confirmation vit dans le résumé (testée dans seance-poll-summary.spec) ; ici, la sortie.
    const comp = a.fixture.componentInstance as unknown as {
      onClosePoll(id: string): Promise<void>;
    };
    await comp.onClosePoll('poll1');
    expect(a.pollSvc.closePoll).toHaveBeenCalledWith('p1', 'poll1');
  });

  it('vote clos sans date : le résumé laisse place à l’encadré, sans répéter le message', async () => {
    const { fixture } = await createGm({
      ...SEANCE_NO_POLL,
      poll: { ...OPEN, status: 'CLOSED' },
      can: CAN,
    });
    expect(fixture.nativeElement.querySelector('app-seance-poll-summary')).toBeNull();
    const text = GRIMOIRE_TONE['common.vote_cloture_sans_date_retenue'];
    expect(fixture.nativeElement.textContent.split(text).length - 1).toBe(1);
  });

  it('temps réel : une réponse reçue après un changed() met à jour les absents', async () => {
    const answered: SeanceDto = {
      ...SEANCE_NO_POLL,
      can: CAN,
      poll: {
        ...OPEN,
        options: OPEN.options.map((o) => ({ ...o, votes: [...o.votes, vote('sam', 'YES')] })),
      },
    };
    const { fixture, scenariosSvc } = await createGm({ ...SEANCE_NO_POLL, poll: OPEN, can: CAN });
    expect(lines(fixture.nativeElement)).toContain('N’ont pas encore répondu : Sam');
    scenariosSvc.listAll.mockResolvedValue([{ ...SCENARIO, seances: [answered] }]);
    fixture.componentInstance.seanceLinked.subscribe((s) => {
      fixture.componentRef.setInput('scenario', s);
    });
    scenariosSvc.changed.set({ partieId: 'p1' });
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
    expect(lines(fixture.nativeElement).some((l) => l.startsWith('N’ont pas encore'))).toBe(false);
  });
});

// Story 54.3 (revue) — câblage de la branche épisodique, clic réel sur « Clôturer le vote », classement des créneaux.
describe('SeanceList — câblage du résumé du MJ, cas de la revue (Story 54.3)', () => {
  const vote = (userId: string, answer: 'YES' | 'NO') => ({
    userId,
    pseudo: userId,
    displayName: `Nom ${userId}`,
    answer,
  });
  const POLL_OPEN: SessionPollDto = {
    ...POLL,
    options: [
      { id: 'o1', date: isoInDays(10), slot: 'EVENING', votes: [vote('lou', 'NO')] },
      { id: 'o2', date: isoInDays(12), slot: 'EVENING', votes: [vote('lou', 'YES')] },
    ],
  };
  const CAN = { propose: false, edit: false, choose: true, extend: false };
  const EPISODIC: SeanceDto = {
    ...SEANCE_NO_POLL,
    can: CAN,
    poll: POLL_OPEN,
    inscription: { min: 2, max: 6, inscrits: [], dateValidee: null },
  };
  const MEMBERS = [
    { userId: 'lou', pseudo: 'lou', displayName: 'Lou', role: 'MEMBER', joinedAt: '' },
    { userId: 'sam', pseudo: 'sam', displayName: 'Sam', role: 'MEMBER', joinedAt: '' },
  ] as never[];

  async function create(seance: SeanceDto, opts: { episodic?: boolean } = {}) {
    const created = await createComponent(
      { ...SCENARIO, seances: [seance] },
      { isMj: true, isEpisodique: opts.episodic ?? false },
    );
    created.fixture.componentRef.setInput('members', MEMBERS);
    created.fixture.componentRef.setInput('membersLoaded', true);
    created.fixture.detectChanges();
    return created;
  }
  const find = (root: HTMLElement, label: string) =>
    Array.from(root.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement[];

  it('séance épisodique, vote ouvert : absents nommés et « Voir dans le calendrier → » câblés', async () => {
    const { fixture, router } = await create(EPISODIC, { episodic: true });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-fill-indicator')).not.toBeNull();
    expect(root.textContent).toContain('N’ont pas encore répondu : Sam');
    find(root, 'Voir dans le calendrier →')[0].click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/parties/p1/calendar?poll=poll1');
  });

  it('« Clôturer le vote » (clic réel) : confirmer appelle closePoll, « Renoncer » n’appelle rien', async () => {
    const a = await create({ ...SEANCE_NO_POLL, can: CAN, poll: POLL_OPEN });
    const dialog = TestBed.inject(MatDialog);
    const open = vi.spyOn(dialog, 'open').mockReturnValue({ afterClosed: () => of(true) } as never);
    a.pollSvc.closePoll.mockResolvedValue(undefined);
    find(a.fixture.nativeElement, 'Clore le conseil')[0].click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
    expect(a.pollSvc.closePoll).toHaveBeenCalledWith('p1', 'poll1');
    TestBed.resetTestingModule();

    const b = await create({ ...SEANCE_NO_POLL, can: CAN, poll: POLL_OPEN });
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(false),
    } as never);
    find(b.fixture.nativeElement, 'Clore le conseil')[0].click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(b.pollSvc.closePoll).not.toHaveBeenCalled();
  });

  it('« Fixer la date… » : le meilleur créneau passe en tête même s’il n’est pas le premier servi', async () => {
    const { fixture } = await create({ ...SEANCE_NO_POLL, can: CAN, poll: POLL_OPEN });
    const dialog = (
      fixture.componentInstance as unknown as { dialog: { open: (...a: unknown[]) => unknown } }
    ).dialog;
    const open = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(false) }) as unknown as {
      mock: { calls: any[][] };
    };
    find(fixture.nativeElement, 'Fixer la date…')[0].click();
    await fixture.whenStable();
    const slots = open.mock.calls[0][1].data.slots;
    // `o2` (un « oui ») est servi APRÈS `o1` (un « non ») et pourtant classé premier.
    expect(slots.map((s: { id: string }) => s.id)).toEqual(['o2', 'o1']);
  });
});
