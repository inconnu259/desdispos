import { TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { AuthUser } from '@master-jdr/shared';
import { HommeDragonPage } from './homme-dragon-page';
import { HommeDragonSheet } from '../homme-dragon-sheet/homme-dragon-sheet';
import { AuthService } from '../../../core/auth/auth.service';
import { ContextualNavService } from '../../../core/navigation/contextual-nav.service';
import { RealtimeService, userTopic } from '../../../core/realtime/realtime.service';

@Component({ selector: 'app-homme-dragon-sheet', template: '<p class="sheet-stub"></p>' })
class SheetStub {
  readonly hommeDragonId = input.required<string>();
  readonly showCreatedNotice = input(false);
}

async function createPage(
  options: { id?: string | null; userId?: string | null; navigationState?: object } = {},
) {
  const realtime = { connect: vi.fn(), disconnect: vi.fn() };
  const id = options.id === undefined ? 'hd1' : options.id;
  await TestBed.configureTestingModule({
    imports: [HommeDragonPage],
    providers: [
      provideRouter([]),
      { provide: RealtimeService, useValue: realtime },
      {
        provide: AuthService,
        useValue: {
          currentUser: signal(
            options.userId === null ? null : ({ id: options.userId ?? 'mj1' } as AuthUser),
          ),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: new Map(id ? [['id', id]] : []) } },
      },
    ],
  })
    .overrideComponent(HommeDragonPage, {
      remove: { imports: [HommeDragonSheet] },
      add: { imports: [SheetStub] },
    })
    .compileComponents();
  if (options.navigationState) {
    // État de navigation posé par le parcours de création (`router.navigate(…, { state })`).
    vi.spyOn(TestBed.inject(Router), 'currentNavigation').mockReturnValue({
      extras: { state: options.navigationState },
    } as never);
  }
  const fixture = TestBed.createComponent(HommeDragonPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, realtime };
}

describe('HommeDragonPage (Story 33.5, AD-23 / 33.8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('héberge la fiche de l’Homme Dragon désigné par l’URL — aucune lecture de partie, aucune redirection', async () => {
    const { fixture } = await createPage();

    expect(fixture.nativeElement.querySelector('.sheet-stub')).not.toBeNull();
  });

  it('passe l’id de l’URL à la fiche', async () => {
    const { fixture } = await createPage({ id: 'hd42' });
    const stub = fixture.debugElement.query((d) => d.name === 'app-homme-dragon-sheet');

    expect(stub.componentInstance.hommeDragonId()).toBe('hd42');
  });

  it('pose le bandeau contextuel « Homme Dragon »', async () => {
    await createPage();

    expect(TestBed.inject(ContextualNavService).title()).toBe('Homme Dragon');
  });

  it('ouvre user:{id} elle-même, et le ferme à la destruction — aucun canal partie: (AD-23)', async () => {
    const { fixture, realtime } = await createPage({ userId: 'mj1' });

    expect(realtime.connect).toHaveBeenCalledTimes(1);
    expect(realtime.connect).toHaveBeenCalledWith(userTopic('mj1'));
    expect(realtime.disconnect).not.toHaveBeenCalled();

    fixture.destroy();

    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
    expect(realtime.disconnect).toHaveBeenCalledWith(userTopic('mj1'));
    for (const call of [...realtime.connect.mock.calls, ...realtime.disconnect.mock.calls]) {
      expect(String(call[0]).startsWith('partie:')).toBe(false);
    }
  });

  it('état de navigation { justCreated: true } → la fiche reçoit showCreatedNotice === true', async () => {
    const { fixture } = await createPage({ navigationState: { justCreated: true } });
    const stub = fixture.debugElement.query((d) => d.name === 'app-homme-dragon-sheet');

    expect(stub.componentInstance.showCreatedNotice()).toBe(true);
  });

  it('sans état de navigation → la fiche reçoit showCreatedNotice === false', async () => {
    const { fixture } = await createPage();
    const stub = fixture.debugElement.query((d) => d.name === 'app-homme-dragon-sheet');

    expect(stub.componentInstance.showCreatedNotice()).toBe(false);
  });

  it('lien de retour vers « Personnages »', async () => {
    const { fixture } = await createPage();

    const back = fixture.nativeElement.querySelector(
      '.homme-dragon-page__back',
    ) as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/characters');
  });

  it('id absent de l’URL → message « introuvable », fiche jamais rendue', async () => {
    const { fixture } = await createPage({ id: null });

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sheet-stub')).toBeNull();
  });

  it('aucun utilisateur courant → aucune connexion temps réel', async () => {
    const { realtime } = await createPage({ userId: null });

    expect(realtime.connect).not.toHaveBeenCalled();
  });
});
