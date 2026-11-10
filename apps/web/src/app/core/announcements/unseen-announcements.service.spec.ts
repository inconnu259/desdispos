import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { AnnouncementDto, AuthUser } from '@desdispos/shared';
import { UnseenAnnouncementsService } from './unseen-announcements.service';
import { AccountService } from '../account/account.service';
import { AuthService } from '../auth/auth.service';

function makeAnnouncement(id: string): AnnouncementDto {
  return {
    id,
    partieId: 'p1',
    scenarioId: null,
    text: `Annonce ${id}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    authorPseudo: 'mj1',
    authorDisplayName: 'Le Meneur',
  };
}

function makeUser(id: string): AuthUser {
  return {
    id,
    email: 'a@b.c',
    pseudo: 'alice',
    displayName: 'alice',
    role: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    theme: 'grimoire-emeraude',
    hideFinishedParties: false,
    availabilityReminder: true,
    partiesSort: 'urgence',
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    defaultCalendarLayers: [],
  };
}

// Harnais minimal : instancier le service dans un contexte de composant permet à `fixture.whenStable()`
// de vider la queue d'effects (`effect()` planifié dans le constructeur du service), même patron que
// open-polls.service.spec.ts.
@Component({ selector: 'app-test-host', template: '', standalone: true })
class TestHost {
  readonly svc = inject(UnseenAnnouncementsService);
}

async function createHarness(
  getUnseenAnnouncements: ReturnType<typeof vi.fn>,
  markAnnouncementRead: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ ok: true }),
) {
  const currentUserSignal = signal<AuthUser | null>(null);
  await TestBed.configureTestingModule({
    imports: [TestHost],
    providers: [
      { provide: AccountService, useValue: { getUnseenAnnouncements, markAnnouncementRead } },
      { provide: AuthService, useValue: { currentUser: currentUserSignal } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TestHost);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return { svc: fixture.componentInstance.svc, currentUserSignal, fixture };
}

describe('UnseenAnnouncementsService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ne déclenche aucun appel tant que currentUser() reste null', async () => {
    const getUnseenAnnouncements = vi.fn().mockResolvedValue([]);
    const { svc } = await createHarness(getUnseenAnnouncements);

    expect(getUnseenAnnouncements).not.toHaveBeenCalled();
    expect(svc.count()).toBe(0);
  });

  it('transition null → utilisateur déclenche un seul appel à getUnseenAnnouncements() (login())', async () => {
    const getUnseenAnnouncements = vi.fn().mockResolvedValue([makeAnnouncement('a1')]);
    const { svc, currentUserSignal, fixture } = await createHarness(getUnseenAnnouncements);

    currentUserSignal.set(makeUser('u1'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getUnseenAnnouncements).toHaveBeenCalledTimes(1);
    expect(svc.count()).toBe(1);
    expect(svc.unseenAnnouncements()).toEqual([makeAnnouncement('a1')]);
  });

  it('transition null → utilisateur déclenche un seul appel même si currentUser() est réécrit plusieurs fois ensuite (ex. syncTheme après login())', async () => {
    const getUnseenAnnouncements = vi.fn().mockResolvedValue([makeAnnouncement('a1')]);
    const { currentUserSignal, fixture } = await createHarness(getUnseenAnnouncements);

    currentUserSignal.set(makeUser('u1'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    currentUserSignal.set({ ...makeUser('u1'), theme: 'foret-ancienne' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getUnseenAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('markRead() retire localement l’annonce du signal sans refetch serveur', async () => {
    const getUnseenAnnouncements = vi
      .fn()
      .mockResolvedValue([makeAnnouncement('a1'), makeAnnouncement('a2')]);
    const markAnnouncementRead = vi.fn().mockResolvedValue({ ok: true });
    const { svc, currentUserSignal, fixture } = await createHarness(
      getUnseenAnnouncements,
      markAnnouncementRead,
    );

    currentUserSignal.set(makeUser('u1'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(svc.count()).toBe(2);

    await svc.markRead('a1');

    expect(markAnnouncementRead).toHaveBeenCalledWith('a1');
    expect(getUnseenAnnouncements).toHaveBeenCalledTimes(1); // pas de refetch
    expect(svc.count()).toBe(1);
    expect(svc.unseenAnnouncements()).toEqual([makeAnnouncement('a2')]);
  });

  it('transition utilisateur → null (logout()) vide le signal local', async () => {
    const getUnseenAnnouncements = vi.fn().mockResolvedValue([makeAnnouncement('a1')]);
    const { svc, currentUserSignal, fixture } = await createHarness(getUnseenAnnouncements);

    currentUserSignal.set(makeUser('u1'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(svc.count()).toBe(1);

    currentUserSignal.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(svc.count()).toBe(0);
  });
});
