import { TestBed } from '@angular/core/testing';
import { ChoiceCard } from './choice-card';

describe('ChoiceCard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AC7 — affiche le label ET le sous-titre visible, relié par aria-describedby', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', {
      key: 'chasseur',
      label: 'Chasseur',
      detail: 'Pistage, Camouflage, Piège',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent).toContain('Chasseur');
    const detail: HTMLElement = fixture.nativeElement.querySelector('.choice-card__detail');
    expect(detail.textContent).toContain('Pistage, Camouflage, Piège');
    expect(button.getAttribute('aria-describedby')).toBe(detail.id);
    // Le nom accessible est le label seul : le sous-titre visible ne doit pas être dupliqué dedans.
    expect(button.getAttribute('aria-label')).toBe('Chasseur');
  });

  it('AC7 — pas de texte ⇒ pas de ligne : aucun sous-titre, aucun aria-describedby', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', { key: 'printemps', label: 'Printemps', detail: '  ' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.choice-card__detail')).toBeNull();
    expect(fixture.nativeElement.querySelector('button').hasAttribute('aria-describedby')).toBe(
      false,
    );
  });

  it('émet selectedOption avec la clé au clic', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', { key: 'chasseur', label: 'Chasseur' });
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[] = [];
    fixture.componentInstance.selectedOption.subscribe((key: string) => emitted.push(key));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();

    expect(emitted).toEqual(['chasseur']);
  });

  it('applique la classe --selected quand selected=true', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', { key: 'chasseur', label: 'Chasseur' });
    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.classList.contains('choice-card--selected')).toBe(true);
    expect(button.getAttribute('aria-checked')).toBe('true');
  });

  it('expose la sémantique role="radio" (groupe à choix unique, cf. RadioGroupNavDirective)', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', { key: 'chasseur', label: 'Chasseur' });
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('role')).toBe('radio');
    expect(button.getAttribute('aria-checked')).toBe('false');
  });

  it('rendu par défaut inchangé : ni gemme, ni étiquette, ni classe teintée', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', { key: 'chasseur', label: 'Chasseur' });
    // L'étiquette fournie sans `tint` ne doit rien rendre.
    fixture.componentRef.setInput('badge', 'Vert');
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.classList).not.toContain('choice-card--tint');
    expect(fixture.nativeElement.querySelector('.choice-card__gem')).toBeNull();
    expect(fixture.nativeElement.querySelector('.choice-card__badge')).toBeNull();
    expect(fixture.nativeElement.querySelector('.choice-card__head')).toBeNull();
    expect(button.querySelector('.choice-card__label')!.textContent).toBe('Chasseur');
  });

  it('variante teintée : gemme décorative + étiquette, nom accessible = libellé seul', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', {
      key: 'DRAGON_VERT',
      label: 'Dragon Vert',
      detail: 'Le goût du voyage.',
    });
    fixture.componentRef.setInput('tint', true);
    fixture.componentRef.setInput('badge', 'Vert');
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.classList).toContain('choice-card--tint');
    expect(
      fixture.nativeElement.querySelector('.choice-card__gem').getAttribute('aria-hidden'),
    ).toBe('true');
    expect(fixture.nativeElement.querySelector('.choice-card__badge').textContent).toContain(
      'Vert',
    );
    expect(fixture.nativeElement.querySelector('.choice-card__detail').textContent).toContain(
      'Le goût du voyage.',
    );
    expect(button.getAttribute('aria-label')).toBe('Dragon Vert');
  });

  it('sous-titre complet : classe posée seulement si fullDetail est demandé', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', { key: 'a', label: 'A', detail: 'Un long texte.' });
    fixture.detectChanges();
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.classList).not.toContain('choice-card--full-detail');

    fixture.componentRef.setInput('fullDetail', true);
    fixture.detectChanges();
    expect(button.classList).toContain('choice-card--full-detail');
  });

  it('carte DÉPLOYÉE : pas de sous-titre, l’indication remplace, et le nom accessible reste le libellé', async () => {
    TestBed.configureTestingModule({ imports: [ChoiceCard] });
    const fixture = TestBed.createComponent(ChoiceCard);
    fixture.componentRef.setInput('option', {
      key: 'chasseur',
      label: 'Chasseur',
      detail: 'Une phrase.',
    });
    fixture.componentRef.setInput('selected', true);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('expandedHint', 'Toucher pour désélectionner');
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.classList).toContain('choice-card--expanded');
    expect(fixture.nativeElement.querySelector('.choice-card__detail')).toBeNull();
    expect(fixture.nativeElement.querySelector('.choice-card__hint').textContent).toContain(
      'Toucher pour désélectionner',
    );
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Chasseur');
  });
});
