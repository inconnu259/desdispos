import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { RankedPollSlot } from '../../events/event-card.util';
import { SealConfirmDialog, type SealConfirmData, type SealSlotsData } from './seal-confirm-dialog';

const slot = (id: string, date: string, yes: number, over: Partial<RankedPollSlot> = {}) => ({
  id,
  date,
  slot: 'EVENING' as const,
  label: `${date} · soir`,
  yes,
  maybe: 0,
  no: 0,
  past: false,
  ...over,
});

async function create(data: SealConfirmData | SealSlotsData) {
  const close = vi.fn();
  const ref = { close, disableClose: false };
  await TestBed.configureTestingModule({
    imports: [SealConfirmDialog],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SealConfirmDialog);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, root, close };
}

const settle = async (fixture: { detectChanges: () => void }) => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
};

describe('SealConfirmDialog — mode Agenda (Story 36.12, inchangé)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('nomme le créneau et ferme par true à la confirmation, sans liste de créneaux', async () => {
    const { root, close } = await create({
      dateLabel: 'ven. 28 août, soir',
      pollLabel: 'Séance 1',
    });
    expect(root.textContent).toContain('Séance 1');
    expect(root.textContent).toContain('ven. 28 août, soir');
    expect(root.querySelector('input[type="radio"]')).toBeNull();

    const buttons = root.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button');
    buttons[1].click();
    expect(close).toHaveBeenCalledWith(true);
  });
});

describe('SealConfirmDialog — liste de créneaux (Story 44.6)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const data = (over: Partial<SealSlotsData> = {}): SealSlotsData => ({
    pollLabel: 'Chapitre 4',
    todayKey: '2030-03-01',
    slots: [slot('a', '2030-03-08', 3), slot('b', '2030-03-06', 1), slot('c', '2030-03-04', 0)],
    confirm: vi.fn().mockResolvedValue(undefined),
    ...over,
  });

  it('liste les créneaux avec leurs réponses, le meilleur présélectionné', async () => {
    const { root } = await create(data());
    const radios = root.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios).toHaveLength(3);
    expect(Array.from(radios).map((r) => r.checked)).toEqual([true, false, false]);
    expect(root.querySelector('.sfd__counts')!.textContent).toContain('3 oui');
  });

  it('sans aucun « oui », rien n’est présélectionné et confirmer est bloqué', async () => {
    const { root, fixture } = await create(
      data({ slots: [slot('a', '2030-03-08', 0), slot('b', '2030-03-06', 0)] }),
    );
    const confirm = root.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')[1];
    expect(confirm.disabled).toBe(true);

    root.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
    fixture.detectChanges();
    expect(confirm.disabled).toBe(false);
  });

  it('un jour passé ne se choisit pas', async () => {
    const { root } = await create(
      data({ slots: [slot('a', '2030-02-01', 0, { past: true }), slot('b', '2030-03-06', 0)] }),
    );
    expect(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0].disabled).toBe(true);
    expect(root.querySelector('.sfd__past')).not.toBeNull();
  });

  it('confirmer écrit le créneau choisi puis ferme par true', async () => {
    const d = data();
    const { root, fixture, close } = await create(d);
    root.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')[1].click();
    await settle(fixture);

    expect(d.confirm).toHaveBeenCalledWith('a');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('un refus du serveur reste affiché, la fenêtre reste ouverte', async () => {
    const d = data({
      confirm: vi.fn().mockRejectedValue({ error: { message: 'Seul le MJ peut sceller.' } }),
    });
    const { root, fixture, close } = await create(d);
    root.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')[1].click();
    await settle(fixture);

    expect(root.querySelector('.sfd__error')!.textContent).toContain('Seul le MJ peut sceller.');
    expect(close).not.toHaveBeenCalled();
  });

  it('renoncer ne fait rien d’autre que fermer par false', async () => {
    const d = data();
    const { root, close } = await create(d);
    root.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')[0].click();
    expect(close).toHaveBeenCalledWith(false);
    expect(d.confirm).not.toHaveBeenCalled();
  });
});
