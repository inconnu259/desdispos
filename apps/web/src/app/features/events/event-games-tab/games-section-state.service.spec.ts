import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GamesSectionStateService } from './games-section-state.service';

const LS_KEY = 'master-jdr.event-games.collapsed-sections';

describe('GamesSectionStateService (Story 49.1)', () => {
  beforeEach(() => {
    localStorage.removeItem(LS_KEY);
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.removeItem(LS_KEY);
    vi.restoreAllMocks();
  });

  it('tout est déplié au départ', () => {
    expect(TestBed.inject(GamesSectionStateService).isCollapsed('host')).toBe(false);
  });

  it('replier puis déplier une section la retient, section par section', () => {
    const service = TestBed.inject(GamesSectionStateService);

    service.toggle('host');
    expect(service.isCollapsed('host')).toBe(true);
    expect(service.isCollapsed('brought')).toBe(false);
    expect(JSON.parse(localStorage.getItem(LS_KEY) ?? 'null')).toEqual(['host']);

    service.toggle('host');
    expect(service.isCollapsed('host')).toBe(false);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('l’état retenu est relu par une nouvelle instance (rechargement de la page)', () => {
    TestBed.inject(GamesSectionStateService).toggle('host');
    TestBed.resetTestingModule();

    expect(TestBed.inject(GamesSectionStateService).isCollapsed('host')).toBe(true);
  });

  it.each(['pas du json', '{"host":true}', '[1,null,"host"]'])(
    'un contenu illisible (%s) est ignoré ou nettoyé, sans lever',
    (raw) => {
      localStorage.setItem(LS_KEY, raw);

      const service = TestBed.inject(GamesSectionStateService);

      expect(service.isCollapsed('1')).toBe(false);
      expect(service.isCollapsed('host')).toBe(raw === '[1,null,"host"]');
    },
  );

  it('un stockage qui refuse la lecture ou l’écriture ne casse rien', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('refusé');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('plein');
    });
    const service = TestBed.inject(GamesSectionStateService);

    expect(service.isCollapsed('host')).toBe(false);
    expect(() => service.toggle('host')).not.toThrow();
    expect(service.isCollapsed('host')).toBe(true);
  });
});
