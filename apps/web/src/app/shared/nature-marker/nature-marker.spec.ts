import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NatureMarker } from './nature-marker';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../core/theme/tones';
import { THEMES } from '@desdispos/shared';

async function createFixture(
  compact: boolean,
  theme: (typeof THEMES)[number] = 'grimoire-emeraude',
) {
  await TestBed.configureTestingModule({
    imports: [NatureMarker],
    providers: [{ provide: ThemeToneService, useValue: { tone: signal(TONE_MAP[theme]) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(NatureMarker);
  fixture.componentRef.setInput('compact', compact);
  fixture.detectChanges();
  return fixture;
}

describe('NatureMarker (Story 33.5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('affichage moyen/grand : icône + mot « Homme Dragon », sans aria-label redondant', async () => {
    const fixture = await createFixture(false);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('.nature-marker__label')?.textContent?.trim()).toBe('Homme Dragon');
    expect(el.querySelector('.nature-marker')?.getAttribute('aria-label')).toBeNull();
  });

  it('mode compact : icône seule, le mot passe dans aria-label', async () => {
    const fixture = await createFixture(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('.nature-marker__label')).toBeNull();
    const marker = el.querySelector('.nature-marker');
    expect(marker?.getAttribute('role')).toBe('img');
    expect(marker?.getAttribute('aria-label')).toBe('Homme Dragon');
  });

  for (const theme of THEMES) {
    it(`${theme} : « Homme Dragon » n'est jamais thématisé`, async () => {
      const fixture = await createFixture(false, theme);
      expect(fixture.nativeElement.textContent).toContain('Homme Dragon');
    });
  }
});
