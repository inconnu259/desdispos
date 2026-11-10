import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import type { HommeDragonDto, MyHommeDragonDto } from '@master-jdr/shared';
import { HommeDragonAventurePanel } from './homme-dragon-aventure-panel';
import { HommeDragonService } from '../../../core/homme-dragon/homme-dragon.service';
import { TONE_MAP } from '../../../core/theme/tones';
import { fillTone } from '../../../core/theme/tone-format';

const GRIMOIRE_TONE = TONE_MAP['grimoire-emeraude'];

function makeMine(id: string, nom: string): MyHommeDragonDto {
  return {
    id,
    aventures: [],
    gameSystemId: 'ryuutama',
    nom,
    race: 'DRAGON_VERT',
    createdAt: '2026-07-16T00:00:00.000Z',
  };
}

function makeDto(overrides: Partial<HommeDragonDto> = {}): HommeDragonDto {
  return {
    id: 'hd1',
    userId: 'mj1',
    gameSystemId: 'ryuutama',
    sheetData: { race: 'DRAGON_VERT', artefact: { key: 'lanterne' }, nom: 'Suisen' },
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    aventures: [],
    historique: [],
    derived: { level: 1, PS: 3 },
    eveilPowers: [],
    pendingEveilLevels: [],
    ...overrides,
  };
}

async function createPanel(
  options: {
    linked?: { id: string; nom: string } | null;
    mine?: MyHommeDragonDto[];
    confirm?: boolean;
    loadRejects?: boolean;
  } = {},
) {
  const changed = signal(0);
  const svc = {
    changed,
    findForPartie: options.loadRejects
      ? vi.fn().mockRejectedValue(new Error('500'))
      : vi.fn().mockResolvedValue(options.linked ?? null),
    listMine: vi.fn().mockResolvedValue(options.mine ?? []),
    link: vi.fn().mockResolvedValue(makeDto()),
    unlink: vi.fn().mockResolvedValue(makeDto()),
  };
  const dialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(options.confirm ?? true) }),
  };
  await TestBed.configureTestingModule({
    imports: [HommeDragonAventurePanel],
    providers: [
      provideRouter([]),
      { provide: HommeDragonService, useValue: svc },
      { provide: MatDialog, useValue: dialog },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(HommeDragonAventurePanel);
  fixture.componentRef.setInput('partieId', 'p1');
  fixture.componentRef.setInput('partieName', 'Les Vents du Nord');
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  return { fixture, svc, dialog };
}

describe('HommeDragonAventurePanel (Story 33.8, AD-23)', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('aventure pourvue', () => {
    it('lien vers la fiche /homme-dragons/:id et « Dissocier »', async () => {
      const { fixture } = await createPanel({ linked: { id: 'hd1', nom: 'Suisen' } });
      const el: HTMLElement = fixture.nativeElement;

      const link = el.querySelector('.aventure-panel__link') as HTMLAnchorElement;
      expect(link.textContent?.trim()).toBe('Suisen');
      expect(link.getAttribute('href')).toBe('/homme-dragons/hd1');
      expect(el.querySelector('.aventure-panel__dissociate')?.textContent).toContain(
        GRIMOIRE_TONE['common.dissocier'],
      );
      expect(el.querySelector('.aventure-panel__create')).toBeNull();
    });

    it('« Dissocier » demande d’abord une confirmation courte (le niveau peut baisser)', async () => {
      const { fixture, svc, dialog } = await createPanel({ linked: { id: 'hd1', nom: 'Suisen' } });

      await fixture.componentInstance['onDissociate']();

      expect(dialog.open).toHaveBeenCalledTimes(1);
      const config = dialog.open.mock.calls[0][1] as {
        data: { message: string; confirmLabel: string };
      };
      expect(config.data.message).toContain('Suisen');
      expect(config.data.message).toContain('Les Vents du Nord');
      expect(config.data.message).toContain('niveau');
      expect(config.data.confirmLabel).toBe(GRIMOIRE_TONE['common.dissocier']);
      expect(svc.unlink).toHaveBeenCalledWith('p1', 'hd1');
    });

    it('confirmation acceptée → le panneau passe à « aucun Homme Dragon »', async () => {
      const { fixture } = await createPanel({ linked: { id: 'hd1', nom: 'Suisen' } });

      await fixture.componentInstance['onDissociate']();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.aventure-panel__create')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.aventure-panel__link')).toBeNull();
    });

    it('confirmation refusée → aucun appel, rien changé', async () => {
      const { fixture, svc } = await createPanel({
        linked: { id: 'hd1', nom: 'Suisen' },
        confirm: false,
      });

      await fixture.componentInstance['onDissociate']();
      fixture.detectChanges();

      expect(svc.unlink).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.aventure-panel__link')).not.toBeNull();
    });

    it('échec de la dissociation → message, le lien reste affiché', async () => {
      const { fixture, svc } = await createPanel({ linked: { id: 'hd1', nom: 'Suisen' } });
      svc.unlink.mockRejectedValue(new Error('500'));

      await fixture.componentInstance['onDissociate']();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        GRIMOIRE_TONE['hd.panel_dissociate_error'],
      );
      expect(fixture.nativeElement.querySelector('.aventure-panel__link')).not.toBeNull();
    });
  });

  describe('aventure sans Homme Dragon', () => {
    it('« Créer un Homme Dragon pour <aventure> » mène au parcours de création de cette partie', async () => {
      const { fixture } = await createPanel({ linked: null });

      const create = fixture.nativeElement.querySelector(
        '.aventure-panel__create',
      ) as HTMLAnchorElement;
      expect(create.textContent).toContain(
        fillTone(GRIMOIRE_TONE['hd.panel_create_cta'], { partie: 'Les Vents du Nord' }),
      );
      expect(create.getAttribute('href')).toBe('/parties/p1/homme-dragon');
    });

    it('« Associer un existant » : tous mes Hommes Dragons, y compris ceux qui ont déjà des aventures', async () => {
      const { fixture } = await createPanel({
        mine: [makeMine('hd1', 'Suisen'), makeMine('hd2', 'Braise')],
      });
      const options = Array.from(
        fixture.nativeElement.querySelectorAll('.aventure-panel__associate option'),
      ).map((o) => (o as HTMLElement).textContent?.trim());

      expect(options).toEqual(['—', 'Suisen', 'Braise']);
    });

    it('aucun Homme Dragon à associer → message, pas de sélecteur', async () => {
      const { fixture } = await createPanel({ mine: [] });

      expect(fixture.nativeElement.querySelector('.aventure-panel__associate select')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('.aventure-panel__associate')?.textContent,
      ).toContain('aucun autre Homme Dragon');
    });

    it('associer appelle link(partieId, id) et affiche le lien vers la fiche', async () => {
      const { fixture, svc } = await createPanel({ mine: [makeMine('hd2', 'Braise')] });
      svc.link.mockResolvedValue(
        makeDto({
          id: 'hd2',
          sheetData: { race: 'DRAGON_ROUGE', artefact: { key: 'grande-epee' }, nom: 'Braise' },
        }),
      );

      fixture.componentInstance['selectedId'].set('hd2');
      await fixture.componentInstance['onAssociate']();
      fixture.detectChanges();

      expect(svc.link).toHaveBeenCalledWith('p1', 'hd2');
      const link = fixture.nativeElement.querySelector(
        '.aventure-panel__link',
      ) as HTMLAnchorElement;
      expect(link.textContent?.trim()).toBe('Braise');
      expect(link.getAttribute('href')).toBe('/homme-dragons/hd2');
    });

    it('échec de l’association (409) → message, le panneau reste sur « aucun Homme Dragon »', async () => {
      const { fixture, svc } = await createPanel({ mine: [makeMine('hd2', 'Braise')] });
      svc.link.mockRejectedValue(new Error('409'));

      fixture.componentInstance['selectedId'].set('hd2');
      await fixture.componentInstance['onAssociate']();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        GRIMOIRE_TONE['hd.panel_associate_error'],
      );
      expect(fixture.nativeElement.querySelector('.aventure-panel__create')).not.toBeNull();
    });
  });

  describe('temps réel : HommeDragonService.changed() (user:)', () => {
    const tick = async (fixture: { detectChanges: () => void }) => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        fixture.detectChanges();
      }
    };

    it('pas de rechargement au premier passage (le chargement de ngOnInit suffit)', async () => {
      const { svc } = await createPanel({ linked: null });

      expect(svc.findForPartie).toHaveBeenCalledTimes(1);
      expect(svc.listMine).toHaveBeenCalledTimes(1);
    });

    it('changed() incrémenté → lien et liste rechargés (lien posé ou retiré ailleurs)', async () => {
      const { fixture, svc } = await createPanel({ linked: null, mine: [] });
      svc.findForPartie.mockResolvedValue({ id: 'hd1', nom: 'Suisen' });
      svc.listMine.mockResolvedValue([makeMine('hd1', 'Suisen')]);

      svc.changed.update((v) => v + 1);
      await tick(fixture);

      expect(svc.findForPartie).toHaveBeenCalledTimes(2);
      expect(svc.listMine).toHaveBeenCalledTimes(2);
      expect(fixture.nativeElement.querySelector('.aventure-panel__link')?.textContent).toContain(
        'Suisen',
      );
    });

    it('aucun rechargement pendant une action en cours (busy)', async () => {
      const { fixture, svc } = await createPanel({ linked: null });
      fixture.componentInstance['busy'].set(true);

      svc.changed.update((v) => v + 1);
      await tick(fixture);

      expect(svc.findForPartie).toHaveBeenCalledTimes(1);
    });

    it('rechargement en échec → le panneau garde ce qu’il affichait', async () => {
      const { fixture, svc } = await createPanel({ linked: { id: 'hd1', nom: 'Suisen' } });
      svc.findForPartie.mockRejectedValue(new Error('500'));

      svc.changed.update((v) => v + 1);
      await tick(fixture);

      expect(fixture.nativeElement.querySelector('.aventure-panel__link')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    });
  });

  it('lecture en échec → message d’erreur, ni lien ni création', async () => {
    const { fixture } = await createPanel({ loadRejects: true });

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.aventure-panel__create')).toBeNull();
  });
});
