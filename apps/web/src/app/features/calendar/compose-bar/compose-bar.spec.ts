import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ComposeBar } from './compose-bar';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

/** Story 36.10 — la barre persistante du mode de composition. Composant de rendu pur. */
describe('ComposeBar (Story 36.10)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(
    inputs: Partial<{
      count: number;
      targetLabel: string;
      busy: boolean;
      canConfirm: boolean;
      blockedReason: string;
    }> = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [ComposeBar],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ComposeBar);
    fixture.componentRef.setInput('count', inputs.count ?? 0);
    fixture.componentRef.setInput(
      'targetLabel',
      inputs.targetLabel ?? 'Créneaux d’un nouveau vote',
    );
    fixture.componentRef.setInput('canConfirm', inputs.canConfirm ?? true);
    if (inputs.busy !== undefined) fixture.componentRef.setInput('busy', inputs.busy);
    if (inputs.blockedReason !== undefined)
      fixture.componentRef.setInput('blockedReason', inputs.blockedReason);
    fixture.detectChanges();
    return fixture;
  }

  it('AC1 — porte un rôle de barre d’outils nommée', async () => {
    const fixture = await render();
    const bar = fixture.nativeElement.querySelector('.compose-bar');
    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-label')).toBeTruthy();
  });

  it('AC1 — rendue même à zéro créneau : c’est la seule sortie visible du mode', async () => {
    const fixture = await render({ count: 0 });
    expect(fixture.nativeElement.querySelector('.compose-bar')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      GRIMOIRE_TONE['calendar.compose_count_none'],
    );
  });

  it('AC16 — le compte est annoncé, et accordé au singulier comme au pluriel', async () => {
    const one = await render({ count: 1 });
    const live = one.nativeElement.querySelector('[aria-live="polite"]');
    expect(live.textContent.trim()).toBe(
      fillTone(GRIMOIRE_TONE['calendar.compose_count_one'], { n: 1 }),
    );

    TestBed.resetTestingModule();
    const many = await render({ count: 3 });
    expect(many.nativeElement.querySelector('[aria-live="polite"]').textContent.trim()).toBe(
      fillTone(GRIMOIRE_TONE['calendar.compose_count_many'], { n: 3 }),
    );
  });

  it('nomme ce que la composition vise', async () => {
    const fixture = await render({ targetLabel: 'Créneaux du vote : Chapitre 1' });
    expect(fixture.nativeElement.textContent).toContain('Créneaux du vote : Chapitre 1');
  });

  it('AC1 — validation impossible : bouton désactivé ET raison affichée, jamais inerte en silence', async () => {
    const fixture = await render({
      canConfirm: false,
      blockedReason: 'Un vote demande au moins deux créneaux.',
    });
    const confirm: HTMLButtonElement = fixture.nativeElement.querySelector('.compose-bar__confirm');
    expect(confirm.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.compose-bar__blocked').textContent).toContain(
      'au moins deux',
    );
  });

  it('busy désactive les DEUX boutons (pas de double validation, pas de sortie en cours d’écriture)', async () => {
    const fixture = await render({ busy: true, count: 2 });
    // Story 47.4 — les boutons du compteur de durée (« Raccourcir » / « Allonger ») ne sont pas ceux de la barre.
    const buttons = [
      ...fixture.nativeElement.querySelectorAll('.compose-bar > button'),
    ] as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('émet `confirmed` et `cancelled`, et n’écrit rien lui-même', async () => {
    const fixture = await render({ count: 2 });
    const confirmed = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);

    fixture.nativeElement.querySelector('.compose-bar__confirm').click();
    [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent?.trim() === GRIMOIRE_TONE['common.annuler'])!
      .click();

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});

/** Story 45.4 — la fin du vote dans la barre : un texte au crayon, la date native à l'édition. */
describe('ComposeBar — fin du vote (Story 45.4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(inputs: Record<string, unknown> = {}) {
    await TestBed.configureTestingModule({
      imports: [ComposeBar],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ComposeBar);
    fixture.componentRef.setInput('count', 2);
    fixture.componentRef.setInput('targetLabel', 'Plages d’un nouveau vote');
    fixture.componentRef.setInput('canConfirm', true);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  it('sans jour (conjonction à créer) : aucun champ', async () => {
    const f = await render({ deadlineDay: null });
    expect(el(f).querySelector('.compose-bar__deadline')).toBeNull();
  });

  it('écrit « Fin du vote : {jour} » en lettres — jamais l’ISO brut — avec l’explication du défaut', async () => {
    const f = await render({
      deadlineDay: '2026-11-06',
      deadlineHint: GRIMOIRE_TONE['calendar.compose_deadline_hint_14'],
    });
    const text = el(f)
      .querySelector('.compose-bar__deadline-btn')!
      .textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Fin du vote : ven. 6 nov');
    expect(text).not.toContain('2026-11-06');
    expect(el(f).querySelector('.compose-bar__deadline-hint')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['calendar.compose_deadline_hint_14'],
    );
  });

  it('une fin passée est marquée « passée » en toutes lettres', async () => {
    const f = await render({ deadlineDay: '2020-01-01', deadlinePast: true });
    expect(el(f).querySelector('.compose-bar__deadline-tag')?.textContent?.trim()).toBe(
      GRIMOIRE_TONE['calendar.compose_deadline_ended_tag'],
    );
  });

  it('le bouton de la date de fin porte le pictogramme modifier, sans caractère', async () => {
    const f = await render({ deadlineDay: '2026-11-06', deadlineMin: '2026-11-02' });
    const btn = el(f).querySelector('.compose-bar__deadline-btn')!;
    expect(btn.querySelector('app-icon')!.getAttribute('data-icon')).toBe('modifier');
    expect(btn.textContent).not.toContain('✎');
  });

  it('le crayon ouvre la date native (min = aujourd’hui, valeur = le jour) ; choisir un jour l’émet et referme', async () => {
    const f = await render({ deadlineDay: '2026-11-06', deadlineMin: '2026-11-02' });
    const changed = vi.fn();
    f.componentInstance.deadlineChanged.subscribe(changed);

    (el(f).querySelector('.compose-bar__deadline-btn') as HTMLButtonElement).click();
    f.detectChanges();
    const input = el(f).querySelector('.compose-bar__deadline-input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.min).toBe('2026-11-02');
    expect(input.value).toBe('2026-11-06');

    input.value = '2026-11-20';
    input.dispatchEvent(new Event('change'));
    f.detectChanges();

    expect(changed).toHaveBeenCalledWith('2026-11-20');
    expect(el(f).querySelector('.compose-bar__deadline-input')).toBeNull();
    expect(el(f).querySelector('.compose-bar__deadline-btn')).not.toBeNull();
  });

  it('une saisie vide ou invalide n’émet rien', async () => {
    const f = await render({ deadlineDay: '2026-11-06' });
    const changed = vi.fn();
    f.componentInstance.deadlineChanged.subscribe(changed);

    (el(f).querySelector('.compose-bar__deadline-btn') as HTMLButtonElement).click();
    f.detectChanges();
    const input = el(f).querySelector('.compose-bar__deadline-input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('change'));

    expect(changed).not.toHaveBeenCalled();
  });

  it('le crayon est désactivé pendant l’écriture', async () => {
    const f = await render({ deadlineDay: '2026-11-06', busy: true });
    expect((el(f).querySelector('.compose-bar__deadline-btn') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  // ⚠️ Story 47.4 — la ligne « Durée » du composer.
  describe('ligne « Durée » (Story 47.4)', () => {
    async function renderDuration(
      durationSlots: number,
      start: { date: string; slot: 'EVENING' } | null,
    ) {
      await TestBed.configureTestingModule({
        imports: [ComposeBar],
        providers: [provideAnimationsAsync()],
      }).compileComponents();
      const fixture = TestBed.createComponent(ComposeBar);
      fixture.componentRef.setInput('count', 1);
      fixture.componentRef.setInput('targetLabel', 'Créneaux du vote : Week-end');
      fixture.componentRef.setInput('canConfirm', true);
      fixture.componentRef.setInput('durationSlots', durationSlots);
      fixture.componentRef.setInput('durationStart', start);
      fixture.detectChanges();
      return fixture;
    }

    it('toujours présente, à la durée reçue ; la plage s’écrit depuis le premier départ', async () => {
      const f = await renderDuration(6, { date: '2026-11-06', slot: 'EVENING' });
      const root = f.nativeElement as HTMLElement;

      expect(root.querySelector('.compose-bar__duration app-duration-stepper')).not.toBeNull();
      expect(root.querySelector('.ds__value')?.textContent?.trim()).toBe('6 créneaux');
      expect(root.querySelector('.ds__detail')?.textContent?.trim()).toBe(
        'ven. 6 soir → dim. 8 après-midi',
      );
    });

    it('à 1 créneau (cible d’un créneau), la ligne est là, sans plage', async () => {
      const f = await renderDuration(1, null);
      const root = f.nativeElement as HTMLElement;
      expect(root.querySelector('.ds__value')?.textContent?.trim()).toBe('1 créneau');
      expect(root.querySelector('.ds__detail')).toBeNull();
    });

    it('« Allonger » émet la nouvelle durée, sans rien écrire', async () => {
      const f = await renderDuration(2, null);
      const changed = vi.fn();
      f.componentInstance.durationChanged.subscribe(changed);

      (f.nativeElement.querySelector('.ds__step--more') as HTMLButtonElement).click();

      expect(changed).toHaveBeenCalledWith(3);
    });
  });
});
