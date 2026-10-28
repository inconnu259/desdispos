import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { VoteAnswer } from '@master-jdr/shared';
import { VoteAnswerPicker } from './vote-answer-picker';
import type { VoteParticipation } from '../poll-track.utils';

/**
 * Story 36.7 — le sélecteur de réponse de vote.
 *
 * Le composant est de RENDU PUR : il n'injecte aucun service et n'appelle rien. Ces tests
 * n'ont donc besoin d'aucun mock — ils vérifient ce qui est rendu et ce qui est émis.
 */

function vote(over: Partial<VoteParticipation> = {}): VoteParticipation {
  return {
    partieId: 'partie-1',
    pollId: 'poll-1',
    optionId: 'o1',
    yes: 1,
    maybe: 0,
    no: 0,
    total: 4,
    myAnswer: null,
    ...over,
  };
}

async function create(over: Partial<VoteParticipation> = {}, busy = false) {
  const fixture = TestBed.createComponent(VoteAnswerPicker);
  fixture.componentRef.setInput('vote', vote(over));
  fixture.componentRef.setInput('slotLabel', 'ven. 28 août — soir');
  fixture.componentRef.setInput('busy', busy);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function options(fixture: { nativeElement: HTMLElement }): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.opt2--answer')];
}

function withdrawBtn(fixture: { nativeElement: HTMLElement }): HTMLButtonElement | null {
  return fixture.nativeElement.querySelector<HTMLButtonElement>('.opt2--withdraw');
}

describe('VoteAnswerPicker', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [VoteAnswerPicker] }));

  it('AC1 — propose oui, peut-être, non, dans CET ordre', async () => {
    // L'ordre est celui du contrat d'UI (`contrat-ui-calendrier.html:628-631`), et NON celui de
    // `PollResponseComponent.VOTE_OPTIONS` (YES, NO, MAYBE) — deux écrans, deux ordres.
    const fixture = await create();
    expect(options(fixture).map((b) => b.textContent?.trim())).toEqual(['oui', 'peut-être', 'non']);
  });

  it('AC1 — l’entête nomme le jour et le créneau concernés', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('.picker__head')?.textContent).toContain(
      'ven. 28 août — soir',
    );
  });

  it('AC1 — choisir une réponse l’émet, une seule fois', async () => {
    const fixture = await create();
    const emitted: VoteAnswer[] = [];
    fixture.componentInstance.answerChosen.subscribe((a: VoteAnswer) => emitted.push(a));

    options(fixture)[1].click();

    expect(emitted).toEqual(['MAYBE']);
  });

  it('AC2 — ma réponse courante est marquée, et pas seulement par la couleur', async () => {
    const fixture = await create({ myAnswer: 'YES' });
    const [oui, peutEtre, non] = options(fixture);

    expect(oui.classList.contains('sel')).toBe(true);
    expect(oui.getAttribute('aria-checked')).toBe('true');
    expect(peutEtre.getAttribute('aria-checked')).toBe('false');
    expect(non.getAttribute('aria-checked')).toBe('false');
  });

  it('AC2 — « Retirer ma réponse » n’apparaît QUE si j’ai réellement répondu', async () => {
    // Défaut que `PollResponseComponent` avait dû corriger en revue (story 30.1) : proposer un
    // retrait sur une réponse jamais posée n'a rien à retirer.
    expect(withdrawBtn(await create({ myAnswer: null }))).toBeNull();
    expect(withdrawBtn(await create({ myAnswer: 'NO' }))).toBeTruthy();
  });

  it('AC2 — demander le retrait l’émet', async () => {
    const fixture = await create({ myAnswer: 'NO' });
    let count = 0;
    fixture.componentInstance.withdrawRequested.subscribe(() => count++);

    withdrawBtn(fixture)!.click();

    expect(count).toBe(1);
  });

  it('AC11 — pendant une écriture, toutes les entrées sont désactivées', async () => {
    const fixture = await create({ myAnswer: 'YES' }, true);
    expect(options(fixture).every((b) => b.disabled)).toBe(true);
    expect(withdrawBtn(fixture)!.disabled).toBe(true);
  });

  it('AC11 — une entrée désactivée n’émet rien', async () => {
    const fixture = await create({ myAnswer: 'YES' }, true);
    const emitted: VoteAnswer[] = [];
    fixture.componentInstance.answerChosen.subscribe((a: VoteAnswer) => emitted.push(a));

    options(fixture)[0].click();

    expect(emitted).toEqual([]);
  });

  it('AC13 — le sélecteur porte un nom accessible qui dit le jour et le créneau', async () => {
    const fixture = await create();
    const menu = fixture.nativeElement.querySelector('.picker');
    expect(menu?.getAttribute('role')).toBe('menu');
    expect(menu?.getAttribute('aria-label')).toContain('ven. 28 août — soir');
  });

  it('AC13 — chaque choix est un menuitemradio, le retrait un menuitem', async () => {
    const fixture = await create({ myAnswer: 'YES' });
    expect(options(fixture).every((b) => b.getAttribute('role') === 'menuitemradio')).toBe(true);
    expect(withdrawBtn(fixture)!.getAttribute('role')).toBe('menuitem');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 47.5 — plusieurs plages du vote sur le créneau : une ligne par plage
// ─────────────────────────────────────────────────────────────────────────────

describe('VoteAnswerPicker — une ligne par plage (Story 47.5)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [VoteAnswerPicker] }));

  const first = vote({ optionId: 'o1', myAnswer: 'MAYBE' });
  const second = vote({ optionId: 'o2' });
  const lines = [
    { vote: first, range: 'ven. 6 soir → dim. 8 après-midi' },
    { vote: second, range: 'ven. 13 soir → dim. 15 après-midi' },
  ];

  async function createMulti() {
    const fixture = TestBed.createComponent(VoteAnswerPicker);
    fixture.componentRef.setInput('vote', first);
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('slotLabel', 'sam. 14 — après-midi');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('deux plages : deux groupes nommés par leur plage, chacun avec ses trois réponses', async () => {
    const fixture = await createMulti();
    const groups = [...fixture.nativeElement.querySelectorAll('.picker__line')] as HTMLElement[];

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(lines.map((l) => l.range));
    expect(groups.map((g) => g.getAttribute('role'))).toEqual(['group', 'group']);
    for (const g of groups) {
      expect([...g.querySelectorAll('.opt2--answer')].map((b) => b.textContent?.trim())).toEqual([
        'oui',
        'peut-être',
        'non',
      ]);
    }
  });

  it('la première ligne est la courante : son bouton « peut-être » (ma réponse) prend le focus', async () => {
    const fixture = await createMulti();
    const focused = document.activeElement as HTMLElement | null;
    expect(focused?.dataset['option']).toBe('o1');
    expect(focused?.dataset['answer']).toBe('MAYBE');
  });

  it('répondre sur une ligne NOMME l’option : c’est lineAnswerChosen qui part, pas answerChosen', async () => {
    const fixture = await createMulti();
    const chosen: { vote: VoteParticipation; answer: VoteAnswer }[] = [];
    const plain: VoteAnswer[] = [];
    fixture.componentInstance.lineAnswerChosen.subscribe((e) => chosen.push(e));
    fixture.componentInstance.answerChosen.subscribe((a: VoteAnswer) => plain.push(a));

    const secondYes = fixture.nativeElement.querySelector(
      '.opt2--answer[data-option="o2"][data-answer="YES"]',
    ) as HTMLButtonElement;
    secondYes.click();

    expect(chosen).toEqual([{ vote: second, answer: 'YES' }]);
    expect(plain).toEqual([]);
  });

  it('le retrait n’existe que sur la ligne où une réponse est posée, et nomme son option', async () => {
    const fixture = await createMulti();
    const withdrawn: VoteParticipation[] = [];
    fixture.componentInstance.lineWithdrawn.subscribe((v) => withdrawn.push(v));

    const buttons = [
      ...fixture.nativeElement.querySelectorAll('.opt2--withdraw'),
    ] as HTMLButtonElement[];
    expect(buttons.map((b) => b.dataset['option'])).toEqual(['o1']);
    buttons[0].click();

    expect(withdrawn).toEqual([first]);
  });

  it('une ligne : le sélecteur d’avant, sans groupe ni titre de plage', async () => {
    const fixture = TestBed.createComponent(VoteAnswerPicker);
    fixture.componentRef.setInput('vote', first);
    fixture.componentRef.setInput('lines', [lines[0]]);
    fixture.componentRef.setInput('slotLabel', 'sam. 14 — après-midi');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.picker__line')).toBeNull();
    const emitted: VoteAnswer[] = [];
    fixture.componentInstance.answerChosen.subscribe((a: VoteAnswer) => emitted.push(a));
    (fixture.nativeElement.querySelector('.opt2--answer') as HTMLButtonElement).click();
    expect(emitted).toEqual(['YES']);
  });

  it('occupé : aucune ligne ne répond', async () => {
    const fixture = TestBed.createComponent(VoteAnswerPicker);
    fixture.componentRef.setInput('vote', first);
    fixture.componentRef.setInput('lines', lines);
    fixture.componentRef.setInput('slotLabel', 'x');
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const emitted: unknown[] = [];
    fixture.componentInstance.lineAnswerChosen.subscribe((e) => emitted.push(e));
    const btn = fixture.nativeElement.querySelector('.opt2--answer') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(emitted).toEqual([]);
  });
});
