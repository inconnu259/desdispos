import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { PartieDto } from '@master-jdr/shared';
import { CoverUpload, MAX_COVER_SIZE, coverRefusal } from './cover-upload';
import { PartiesService } from './parties.service';

const UPDATED = { id: 'p1', coverImageVersion: 'v2' } as PartieDto;

const image = (type = 'image/jpeg') => new File(['bytes'], 'cover.jpg', { type });

function setup() {
  const partiesSvc = {
    setCoverImage: vi.fn().mockResolvedValue(UPDATED),
    removeCoverImage: vi.fn().mockResolvedValue({ ...UPDATED, coverImageVersion: null }),
  };
  TestBed.configureTestingModule({
    providers: [CoverUpload, { provide: PartiesService, useValue: partiesSvc }],
  });
  return { cover: TestBed.inject(CoverUpload), partiesSvc };
}

/** Une promesse réglée à la main : garde un envoi « en vol ». */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('coverRefusal', () => {
  it('accepte jpeg, png et webp', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(coverRefusal({ type, size: 10 })).toBeNull();
    }
  });

  it('refuse un type non accepté par la clé de type', () => {
    expect(coverRefusal({ type: 'application/pdf', size: 10 })).toBe('partie.cover_reject_type');
    expect(coverRefusal({ type: 'image/gif', size: 10 })).toBe('partie.cover_reject_type');
  });

  it('refuse au-delà du plafond, accepte exactement le plafond', () => {
    expect(coverRefusal({ type: 'image/png', size: MAX_COVER_SIZE })).toBeNull();
    expect(coverRefusal({ type: 'image/png', size: MAX_COVER_SIZE + 1 })).toBe(
      'partie.cover_reject_size',
    );
  });

  it('le plafond est de 5 Mo', () => {
    expect(MAX_COVER_SIZE).toBe(5 * 1024 * 1024);
  });
});

describe('CoverUpload', () => {
  it('refusal() suit coverRefusal()', () => {
    const { cover } = setup();
    expect(cover.refusal(image('application/pdf'))).toBe('partie.cover_reject_type');
    expect(cover.refusal(image())).toBeNull();
  });

  it('change() : un fichier refusé n’envoie rien', async () => {
    const { cover, partiesSvc } = setup();

    expect(await cover.change('p1', image('application/pdf'))).toBeNull();

    const big = image();
    Object.defineProperty(big, 'size', { value: MAX_COVER_SIZE + 1 });
    expect(await cover.change('p1', big)).toBeNull();

    expect(partiesSvc.setCoverImage).not.toHaveBeenCalled();
    expect(cover.saving()).toBe(false);
  });

  it('change() : dépose le fichier et renvoie la partie mise à jour', async () => {
    const { cover, partiesSvc } = setup();
    const file = image();

    expect(await cover.change('p1', file)).toBe(UPDATED);

    expect(partiesSvc.setCoverImage).toHaveBeenCalledWith('p1', file);
    expect(cover.saving()).toBe(false);
  });

  it('remove() : retire la couverture et renvoie la partie mise à jour', async () => {
    const { cover, partiesSvc } = setup();

    const updated = await cover.remove('p1');

    expect(partiesSvc.removeCoverImage).toHaveBeenCalledWith('p1');
    expect(updated?.coverImageVersion).toBeNull();
    expect(cover.saving()).toBe(false);
  });

  it('saving() est vrai pendant un dépôt, faux après', async () => {
    const { cover, partiesSvc } = setup();
    const pending = deferred<PartieDto>();
    partiesSvc.setCoverImage.mockReturnValueOnce(pending.promise);

    const sent = cover.change('p1', image());
    expect(cover.saving()).toBe(true);

    pending.resolve(UPDATED);
    await sent;
    expect(cover.saving()).toBe(false);
  });

  it('un second change() pendant un envoi est ignoré (pas de seconde image envoyée)', async () => {
    const { cover, partiesSvc } = setup();
    const pending = deferred<PartieDto>();
    partiesSvc.setCoverImage.mockReturnValueOnce(pending.promise);

    const first = cover.change('p1', image());
    const second = await cover.change('p1', image());

    expect(second).toBeNull();
    expect(partiesSvc.setCoverImage).toHaveBeenCalledTimes(1);

    pending.resolve(UPDATED);
    expect(await first).toBe(UPDATED);
  });

  it('un remove() pendant un dépôt est ignoré, et inversement', async () => {
    const { cover, partiesSvc } = setup();
    const pending = deferred<PartieDto>();
    partiesSvc.setCoverImage.mockReturnValueOnce(pending.promise);

    const first = cover.change('p1', image());
    expect(await cover.remove('p1')).toBeNull();
    expect(partiesSvc.removeCoverImage).not.toHaveBeenCalled();

    pending.resolve(UPDATED);
    await first;

    const removing = deferred<PartieDto>();
    partiesSvc.removeCoverImage.mockReturnValueOnce(removing.promise);
    const removal = cover.remove('p1');
    expect(await cover.change('p1', image())).toBeNull();
    expect(partiesSvc.setCoverImage).toHaveBeenCalledTimes(1);
    removing.resolve(UPDATED);
    await removal;
  });

  it('un échec remonte à l’appelant et libère saving()', async () => {
    const { cover, partiesSvc } = setup();
    partiesSvc.setCoverImage.mockRejectedValueOnce(new Error('boom'));

    await expect(cover.change('p1', image())).rejects.toThrow('boom');
    expect(cover.saving()).toBe(false);

    // Libéré : un nouvel envoi part.
    expect(await cover.change('p1', image())).toBe(UPDATED);
    expect(partiesSvc.setCoverImage).toHaveBeenCalledTimes(2);
  });

  it('un échec de retrait remonte aussi et libère saving()', async () => {
    const { cover, partiesSvc } = setup();
    partiesSvc.removeCoverImage.mockRejectedValueOnce(new Error('boom'));

    await expect(cover.remove('p1')).rejects.toThrow('boom');
    expect(cover.saving()).toBe(false);
  });
});
