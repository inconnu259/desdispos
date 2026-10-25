import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import type { AvailKind, DaySlot } from '@master-jdr/shared';
import type { AgendaSealRequest } from '../calendar-agenda-view/calendar-agenda-view';
import { SelectionBar } from './selection-bar';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

const SEAL_CANDIDATE: AgendaSealRequest = {
  partieId: 'p1',
  pollId: 'poll1',
  optionId: 'opt1',
  dateLabel: 'ven. 28 août, soir',
  pollLabel: 'Les Cendres d’Ashal',
};

describe('SelectionBar', () => {
  let fixture: ComponentFixture<SelectionBar>;
  let el: HTMLElement;

  function create(
    count: number,
    rangeLabel: string | null = null,
    scope: DaySlot = 'FULL_DAY',
    armedKind: AvailKind = 'UNAVAILABLE',
    sealCandidate: AgendaSealRequest | null = null,
  ): void {
    fixture = TestBed.createComponent(SelectionBar);
    fixture.componentRef.setInput('count', count);
    fixture.componentRef.setInput('rangeLabel', rangeLabel);
    fixture.componentRef.setInput('scope', scope);
    fixture.componentRef.setInput('armedKind', armedKind);
    fixture.componentRef.setInput('sealCandidate', sealCandidate);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  function buttonByText(text: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    ) as HTMLButtonElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SelectionBar] });
  });

  it('affiche le nombre de créneaux sélectionnés', () => {
    create(4, 'mar. → ven., soirée');
    expect(el.textContent).toContain(
      fillTone(GRIMOIRE_TONE['calendar.selbar_count_many'], { n: 4 }),
    );
    expect(el.textContent).toContain('mar. → ven., soirée');
  });

  it('un seul créneau → singulier', () => {
    create(1);
    expect(el.textContent).toContain(
      fillTone(GRIMOIRE_TONE['calendar.selbar_count_one'], { n: 1 }),
    );
    expect(el.textContent).not.toContain(
      fillTone(GRIMOIRE_TONE['calendar.selbar_count_many'], { n: 1 }),
    );
  });

  it('clic sur Disponible émet markAvailable', () => {
    create(2);
    const spy = vi.fn();
    fixture.componentInstance.markAvailable.subscribe(spy);
    buttonByText('Disponible').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clic sur Indisponible émet markUnavailable', () => {
    create(2);
    const spy = vi.fn();
    fixture.componentInstance.markUnavailable.subscribe(spy);
    buttonByText('Indisponible').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clic sur Annuler émet cancelled', () => {
    create(2);
    const spy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(spy);
    buttonByText(GRIMOIRE_TONE['common.annuler']).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ─── Story 36.3 ───────────────────────────────────────────────────────────

  it('AC2 — propose les quatre portées dans l’ordre du contrat d’UI', () => {
    create(3);
    const labels = Array.from(el.querySelectorAll('.scope-seg')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Journée', 'Matin', 'Après-m.', 'Soir']);
  });

  it('AC2 — clic sur un segment de portée émet scopeChange', () => {
    create(3);
    const spy = vi.fn();
    fixture.componentInstance.scopeChange.subscribe(spy);
    (buttonByText('Soir') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith('EVENING');
  });

  it('AC13/AC14 — le groupe de portée est un radiogroup, la portée retenue porte aria-checked', () => {
    create(3, null, 'EVENING');
    const group = el.querySelector('.selection-bar__scope')!;
    expect(group.getAttribute('role')).toBe('radiogroup');
    // Un seul arrêt de tabulation pour les quatre segments (AC13).
    expect(group.getAttribute('tabindex')).toBe('0');
    const segs = Array.from(el.querySelectorAll('.scope-seg'));
    expect(segs.every((s) => s.getAttribute('tabindex') === '-1')).toBe(true);
    const checked = segs.filter((s) => s.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent?.trim()).toBe('Soir');
  });

  it('AC13 — les flèches circulent dans le groupe de portée', () => {
    create(3, null, 'FULL_DAY');
    const spy = vi.fn();
    fixture.componentInstance.scopeChange.subscribe(spy);
    const group = el.querySelector('.selection-bar__scope') as HTMLElement;

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(spy).toHaveBeenLastCalledWith('MORNING');

    // Enroulement : depuis la première option, la flèche gauche va à la dernière.
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(spy).toHaveBeenLastCalledWith('EVENING');
  });

  it('AC4 — clic sur « Autre… » émet otherRequested', () => {
    create(2);
    const spy = vi.fn();
    fixture.componentInstance.otherRequested.subscribe(spy);
    buttonByText(GRIMOIRE_TONE['calendar.selbar_other']).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('AC6/AC14 — l’intention armée est marquée par aria-pressed ET par une forme, pas la couleur seule', () => {
    create(2, null, 'FULL_DAY', 'UNAVAILABLE');
    expect(buttonByText('Indisponible').getAttribute('aria-pressed')).toBe('true');
    expect(buttonByText('Indisponible').hasAttribute('mat-flat-button')).toBe(true);
    expect(buttonByText('Disponible').getAttribute('aria-pressed')).toBe('false');
    expect(buttonByText('Disponible').hasAttribute('mat-stroked-button')).toBe(true);
  });

  it('AC6 — prendre le focus sur un bouton arme son intention', () => {
    create(2);
    const spy = vi.fn();
    fixture.componentInstance.armedKindChange.subscribe(spy);
    buttonByText('Disponible').dispatchEvent(new FocusEvent('focus'));
    expect(spy).toHaveBeenCalledWith('AVAILABLE');
  });

  it('AC14 — la portée et l’intention armée sont annoncées en toutes lettres', () => {
    create(2, null, 'AFTERNOON', 'AVAILABLE');
    const live = el.querySelector('.visually-hidden[aria-live]')!;
    expect(live.textContent).toContain('Après-midi');
    expect(live.textContent).toContain('Disponible');
  });

  // ─── Story 36.15 ──────────────────────────────────────────────────────────

  it('AC1/AC2 — aucun bouton Sceller quand sealCandidate est null', () => {
    create(1, null, 'FULL_DAY', 'UNAVAILABLE', null);
    expect(el.querySelector('.seal-btn')).toBeNull();
  });

  it('AC1 — le bouton Sceller apparaît quand sealCandidate est renseigné, thématisé', () => {
    create(1, null, 'FULL_DAY', 'UNAVAILABLE', SEAL_CANDIDATE);
    const btn = el.querySelector('.seal-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent?.trim()).toBe('Sceller');
    expect(btn.getAttribute('aria-label')).toBe(
      'Sceller — Les Cendres d’Ashal — ven. 28 août, soir',
    );
  });

  it('AC5 — clic sur Sceller émet sealRequested avec le candidat exact, aucun appel réseau ici', () => {
    create(1, null, 'FULL_DAY', 'UNAVAILABLE', SEAL_CANDIDATE);
    const spy = vi.fn();
    fixture.componentInstance.sealRequested.subscribe(spy);
    (el.querySelector('.seal-btn') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith(SEAL_CANDIDATE);
  });

  // ── Story 45.3 — la barre en version composition ──

  describe('version composition (Story 45.3)', () => {
    function createCompose(scope: DaySlot | null = 'EVENING', fullDayAllowed = true): void {
      fixture = TestBed.createComponent(SelectionBar);
      fixture.componentRef.setInput('count', 3);
      fixture.componentRef.setInput('scope', scope);
      fixture.componentRef.setInput('composeMode', true);
      fixture.componentRef.setInput('fullDayAllowed', fullDayAllowed);
      // Un candidat à sceller ne doit JAMAIS s'afficher en composition.
      fixture.componentRef.setInput('sealCandidate', SEAL_CANDIDATE);
      fixture.detectChanges();
      el = fixture.nativeElement;
    }

    it('perd Sceller, Disponible, Indisponible et « Autre… » ; garde le compte, la portée et Annuler', () => {
      createCompose();
      expect(el.querySelector('.seal-btn')).toBeNull();
      expect(el.querySelector('.kind-btn')).toBeNull();
      expect(el.querySelector('.other-btn')).toBeNull();
      expect(el.querySelectorAll('.scope-seg')).toHaveLength(4);
      expect(buttonByText(GRIMOIRE_TONE['common.annuler'])).toBeTruthy();
    });

    it('« Ajouter au vote » et « Retirer » émettent composeAdd et composeRemove', () => {
      createCompose();
      const add = vi.fn();
      const remove = vi.fn();
      fixture.componentInstance.composeAdd.subscribe(add);
      fixture.componentInstance.composeRemove.subscribe(remove);

      buttonByText(GRIMOIRE_TONE['calendar.selbar_compose_add']).click();
      buttonByText(GRIMOIRE_TONE['calendar.selbar_compose_remove']).click();

      expect(add).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('« Annuler » émet cancelled (la sélection, pas le composer)', () => {
      createCompose();
      const cancelled = vi.fn();
      fixture.componentInstance.cancelled.subscribe(cancelled);
      buttonByText(GRIMOIRE_TONE['common.annuler']).click();
      expect(cancelled).toHaveBeenCalledTimes(1);
    });

    it('sans journée entière (groupe, soirée) : le segment « Journée » n’est pas proposé', () => {
      createCompose('EVENING', false);
      const labels = Array.from(el.querySelectorAll('.scope-seg')).map((b) =>
        b.textContent!.trim(),
      );
      expect(labels).toEqual(['Matin', 'Après-m.', 'Soir']);
    });

    it('sans journée entière et portée « journée » : « Ajouter au vote » est désactivé et la raison est ÉCRITE', () => {
      createCompose('FULL_DAY', false);
      const add = buttonByText(GRIMOIRE_TONE['calendar.selbar_compose_add']);
      expect(add.disabled).toBe(true);
      expect(el.querySelector('.selection-bar__hint')?.textContent?.trim()).toBe(
        GRIMOIRE_TONE['calendar.selbar_compose_pick_moment'],
      );
      expect(add.getAttribute('aria-describedby')).toBe('selbar-compose-hint');
    });

    it('en JDR (journée permise), « Journée » est proposée et « Ajouter » reste actif', () => {
      createCompose('FULL_DAY', true);
      expect(el.querySelectorAll('.scope-seg')).toHaveLength(4);
      expect(buttonByText(GRIMOIRE_TONE['calendar.selbar_compose_add']).disabled).toBe(false);
      expect(el.querySelector('.selection-bar__hint')).toBeNull();
    });

    it('les flèches ne circulent que sur les portées proposées', () => {
      createCompose('EVENING', false);
      const changed: DaySlot[] = [];
      fixture.componentInstance.scopeChange.subscribe((s) => changed.push(s));
      el.querySelector('.selection-bar__scope')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
      expect(changed).toEqual(['MORNING']);
    });
  });
});
