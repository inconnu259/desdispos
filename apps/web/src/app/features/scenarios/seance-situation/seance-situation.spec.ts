import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { THEMES } from '@master-jdr/shared';
import { ThemeToneService } from '../../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../../core/theme/tones';
import type { SituationValue } from '../../../core/status/status-derivation';
import { SeanceSituationComponent } from './seance-situation';
import type { SeanceSituationBox } from './seance-situation-box';

async function create(
  box: SeanceSituationBox,
  {
    theme = 'grimoire-emeraude' as (typeof THEMES)[number],
    situation = null as SituationValue | null,
    expiresAt = null as string | null,
    busy = false,
  } = {},
) {
  await TestBed.configureTestingModule({
    imports: [SeanceSituationComponent],
    providers: [
      {
        provide: ThemeToneService,
        useValue: { tone: signal(TONE_MAP[theme]), activeTheme: signal(theme) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SeanceSituationComponent);
  fixture.componentRef.setInput('box', box);
  fixture.componentRef.setInput('situation', situation);
  fixture.componentRef.setInput('expiresAt', expiresAt);
  fixture.componentRef.setInput('todayKey', '2026-11-07');
  fixture.componentRef.setInput('busy', busy);
  const onAction = vi.fn();
  fixture.componentInstance.action.subscribe(onAction);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, onAction };
}

// Story 54.1 — l'encadré de situation : ligne « Ma situation » en tête, texte, action.
describe('SeanceSituationComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('joueur : bordure --jdr-status-todo ; MJ : bordure --jdr-accent-1', async () => {
    const player = await create('voter');
    expect(player.el.querySelector('.seance-situation--mj')).toBeNull();
    TestBed.resetTestingModule();
    const mj = await create('lancer_le_vote');
    expect(mj.el.querySelector('.seance-situation--mj')).not.toBeNull();
  });

  it('la ligne « Ma situation » est en tête, avant le texte, et n’apparaît qu’une fois', async () => {
    const { el } = await create('voter', { situation: 'vote_a_faire' });
    const box = el.querySelector('.seance-situation') as HTMLElement;
    expect(box.firstElementChild?.tagName.toLowerCase()).toBe('app-situation-line');
    expect(el.querySelectorAll('.situation-line')).toHaveLength(1);
    expect(el.querySelector('.situation-pill')?.textContent?.trim()).toBe('Vote à faire');
  });

  it('voter : texte avec l’échéance, action émise', async () => {
    const { el, onAction } = await create('voter', {
      situation: 'vote_a_faire',
      expiresAt: '2026-11-12T21:59:59.000Z',
    });
    expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
      'Le vote est ouvert jusqu’à jeudi.',
    );
    const btn = el.querySelector('button') as HTMLButtonElement;
    expect(btn.textContent?.trim()).toBe('Voter dans le calendrier');
    btn.click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('voter sans échéance : « Le vote est ouvert. »', async () => {
    const { el } = await create('voter');
    expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
      'Le vote est ouvert.',
    );
  });

  it('désactivée pendant une écriture : le clic n’émet rien', async () => {
    const { el, onAction } = await create('participer', { busy: true });
    const btn = el.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('« Lancer le vote » porte l’icône de sens `vote`, décorative ; aucun autre bouton n’en a', async () => {
    const mj = await create('lancer_le_vote');
    const icon = mj.el.querySelector('button app-icon[data-icon="vote"]');
    expect(icon).not.toBeNull();
    expect(icon?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    TestBed.resetTestingModule();
    const player = await create('voter');
    expect(player.el.querySelector('app-icon')).toBeNull();
  });

  it('aucun rôle d’annonce ; texte et action écrits', async () => {
    const { el } = await create('reinitialiser_la_date');
    expect(el.querySelector('[role="status"], [aria-live]')).toBeNull();
    expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
      TONE_MAP['grimoire-emeraude']['common.vote_cloture_sans_date_retenue'],
    );
    expect(el.querySelector('button')?.textContent?.trim()).toBe(
      TONE_MAP['grimoire-emeraude']['common.reinitialiser_la_date'],
    );
  });

  const CASES: [SeanceSituationBox, string, string][] = [
    ['participer', 'scenarios.seance_situation_not_registered', 'scenarios.seances_inscrire'],
    ['se_desinscrire', 'scenarios.seance_situation_registered', 'scenarios.seances_desinscrire'],
    ['lancer_le_vote', 'scenarios.seance_situation_no_date', 'common.lancer_le_vote'],
    [
      'reinitialiser_la_date',
      'common.vote_cloture_sans_date_retenue',
      'common.reinitialiser_la_date',
    ],
  ];
  for (const theme of THEMES) {
    for (const [box, textKey, actionKey] of CASES) {
      it(`${theme} / ${box} : textes du thème`, async () => {
        const { el } = await create(box, { theme });
        expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
          TONE_MAP[theme][textKey],
        );
        expect(el.querySelector('button')?.textContent?.trim()).toBe(TONE_MAP[theme][actionKey]);
      });
    }
  }

  it('Forêt : « Tu participes. » (tutoiement)', async () => {
    const { el } = await create('se_desinscrire', { theme: 'foret-ancienne' });
    expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe('Tu participes.');
  });
});

// Story 54.3 — l'encadré « Fixer la date… » du MJ.
describe('SeanceSituationComponent — fixer_la_date (Story 54.3)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('bordure du MJ, texte du vote ouvert avec son échéance, bouton plein « Fixer la date… » sans icône', async () => {
    const { el, onAction } = await create('fixer_la_date', {
      situation: 'je_mene',
      expiresAt: '2026-11-12T21:59:59.000Z',
    });
    expect(el.querySelector('.seance-situation--mj')).not.toBeNull();
    expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
      'Le vote est ouvert jusqu’à jeudi.',
    );
    const btn = el.querySelector('button') as HTMLButtonElement;
    expect(btn.textContent?.trim()).toBe('Fixer la date…');
    expect(btn.querySelector('app-icon')).toBeNull();
    btn.click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('échéance passée : « Le vote est terminé. », la date se fixe encore', async () => {
    const { el } = await create('fixer_la_date', { expiresAt: '2026-10-30T21:59:59.000Z' });
    expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
      'Le vote est terminé.',
    );
    expect(el.querySelector('button')?.textContent?.trim()).toBe('Fixer la date…');
  });

  it('sans échéance : « Le vote est ouvert. »', async () => {
    const { el } = await create('fixer_la_date');
    expect(el.querySelector('.seance-situation__text')?.textContent?.trim()).toBe(
      'Le vote est ouvert.',
    );
  });
});
