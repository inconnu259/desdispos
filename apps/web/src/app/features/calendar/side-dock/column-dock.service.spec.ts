import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ColumnDockService } from './column-dock.service';

const LS_KEY = 'master-jdr.calendar.column-closed';

describe('ColumnDockService (Story 46.1)', () => {
  beforeEach(() => localStorage.removeItem(LS_KEY));
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    localStorage.removeItem(LS_KEY);
  });

  const create = () => TestBed.inject(ColumnDockService);

  it('ouvert par défaut', () => {
    expect(create().closed()).toBe(false);
  });

  it('retient « rangé » sous une seule clé, et la retire en rouvrant', () => {
    const service = create();
    service.toggle();
    expect(service.closed()).toBe(true);
    expect(localStorage.getItem(LS_KEY)).toBe('closed');

    service.toggle();
    expect(service.closed()).toBe(false);
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it('relit l’état retenu à la création ; une valeur inconnue vaut « ouvert »', () => {
    localStorage.setItem(LS_KEY, 'closed');
    expect(create().closed()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem(LS_KEY, 'n’importe quoi');
    expect(create().closed()).toBe(false);
  });

  it('open() rouvre une colonne rangée et ne fait rien sinon', () => {
    const service = create();
    const write = vi.spyOn(Storage.prototype, 'removeItem');
    service.open();
    expect(write).not.toHaveBeenCalled();

    service.set(true);
    service.open();
    expect(service.closed()).toBe(false);
  });

  it('stockage qui jette en lecture comme en écriture : l’état tient pour la page, sans erreur', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('refusé');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('refusé');
    });
    const service = create();
    expect(service.closed()).toBe(false);
    expect(() => service.toggle()).not.toThrow();
    expect(service.closed()).toBe(true);
  });
});
