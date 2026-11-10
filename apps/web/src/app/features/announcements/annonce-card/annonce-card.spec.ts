import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { AnnouncementDto } from '@desdispos/shared';
import { AnnonceCard } from './annonce-card';

function makeAnnouncement(overrides: Partial<AnnouncementDto> = {}): AnnouncementDto {
  return {
    id: 'ann1',
    partieId: 'p1',
    scenarioId: null,
    text: 'Une annonce importante',
    createdAt: '2026-07-15T00:00:00.000Z',
    authorPseudo: 'le-mj',
    authorDisplayName: 'Le Grand MJ',
    ...overrides,
  };
}

async function createComponent(announcement: AnnouncementDto, scopeLabel: string, unseen = false) {
  await TestBed.configureTestingModule({ imports: [AnnonceCard] }).compileComponents();
  const fixture = TestBed.createComponent(AnnonceCard);
  fixture.componentRef.setInput('announcement', announcement);
  fixture.componentRef.setInput('scopeLabel', scopeLabel);
  fixture.componentRef.setInput('unseen', unseen);
  fixture.detectChanges();
  return fixture;
}

describe('AnnonceCard', () => {
  it("AC1/AC2 : affiche le texte de l'annonce", async () => {
    const fixture = await createComponent(
      makeAnnouncement({ text: 'Une annonce importante' }),
      'Toute la campagne',
    );

    expect(fixture.nativeElement.textContent).toContain('Une annonce importante');
  });

  it("affiche le nom affiché de l'auteur (le MJ) via IdentityLabel", async () => {
    const fixture = await createComponent(
      makeAnnouncement({ authorDisplayName: 'Le Grand MJ' }),
      'Toute la campagne',
    );

    expect(fixture.nativeElement.textContent).toContain('Le Grand MJ');
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });

  it('AC4/AC5 : le libellé de portée est un texte visible dans le DOM, pas seulement un style', async () => {
    const fixture = await createComponent(makeAnnouncement(), 'Ce scénario');

    expect(fixture.nativeElement.textContent).toContain('Ce scénario');
  });

  it('affiche la date formatée', async () => {
    const fixture = await createComponent(
      makeAnnouncement({ createdAt: '2026-07-15T00:00:00.000Z' }),
      'Toute la campagne',
    );

    // Format court localisé (DatePipe) — on vérifie juste la présence d'un fragment de date
    // plausible (jour/mois/année séparés par '/'), pas le format exact (dépend de la locale du runner).
    expect(fixture.nativeElement.textContent).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });

  it("Revue de code (2026-08-06) : le badge « MJ » est toujours affiché — l'auteur d'une annonce est toujours le MJ, identifiable sans recours au pseudo", async () => {
    const fixture = await createComponent(makeAnnouncement(), 'Toute la campagne');

    const badge = fixture.nativeElement.querySelector('.annonce-card__mj-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent.trim()).toBe('MJ');
  });

  describe('Story 29.13 (révision) : marquage « vue » sur clic explicite', () => {
    it('non-vue → indicateur visible dans le DOM, pas seulement une couleur (AC4/AC5)', async () => {
      const fixture = await createComponent(makeAnnouncement(), 'Toute la campagne', true);

      const article = fixture.nativeElement.querySelector('article');
      expect(article.classList.contains('annonce-card--unseen')).toBe(true);
      expect(fixture.nativeElement.querySelector('.annonce-card__unseen-label')).toBeTruthy();
    });

    it('déjà vue → aucun indicateur, pas de rôle/tabindex interactif', async () => {
      const fixture = await createComponent(makeAnnouncement(), 'Toute la campagne', false);

      const article = fixture.nativeElement.querySelector('article');
      expect(article.classList.contains('annonce-card--unseen')).toBe(false);
      expect(fixture.nativeElement.querySelector('.annonce-card__unseen-label')).toBeNull();
      expect(article.getAttribute('role')).toBeNull();
      expect(article.getAttribute('tabindex')).toBeNull();
    });

    it('non-vue : un clic émet opened()', async () => {
      const fixture = await createComponent(makeAnnouncement(), 'Toute la campagne', true);
      const opened = vi.fn();
      fixture.componentInstance.opened.subscribe(opened);

      fixture.nativeElement.querySelector('article').click();

      expect(opened).toHaveBeenCalledTimes(1);
    });

    it('déjà vue : un clic n’émet jamais opened()', async () => {
      const fixture = await createComponent(makeAnnouncement(), 'Toute la campagne', false);
      const opened = vi.fn();
      fixture.componentInstance.opened.subscribe(opened);

      fixture.nativeElement.querySelector('article').click();

      expect(opened).not.toHaveBeenCalled();
    });

    it('non-vue : Entrée au clavier émet opened() (accessibilité, role="button")', async () => {
      const fixture = await createComponent(makeAnnouncement(), 'Toute la campagne', true);
      const opened = vi.fn();
      fixture.componentInstance.opened.subscribe(opened);

      const article = fixture.nativeElement.querySelector('article');
      article.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(opened).toHaveBeenCalledTimes(1);
    });
  });
});
