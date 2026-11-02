import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import type { AuthUser } from '@master-jdr/shared';
import { CALENDAR_LAYER_KEYS } from '@master-jdr/shared';
import { Account } from './account';
import { AuthService } from '../../core/auth/auth.service';
import { AccountService } from '../../core/account/account.service';
import { ThemeToneService } from '../../core/theme/theme-tone.service';
import { TONE_MAP } from '../../core/theme/tones';
import { MatDialog } from '@angular/material/dialog';
import { DeleteAccountDialog } from './delete-account-dialog/delete-account-dialog';
import { ContextualNavService } from '../../core/navigation/contextual-nav.service';
import { BoardGamesService } from '../../core/board-games/board-games.service';

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'alice@b.c',
    pseudo: 'alice',
    displayName: 'alice',
    role: 'USER',
    createdAt: '2026-01-01T00:00:00.000Z',
    theme: 'grimoire-emeraude',
    hideFinishedParties: false,
    partiesSort: 'urgence',
    partiesViewMode: 'medium',
    charactersViewMode: 'medium',
    charactersSort: 'partie',
    defaultCalendarLayers: [
      'mes-indisponibilites',
      'mes-disponibilites',
      'mes-seances',
      'votes-en-cours',
      'inscriptions-ouvertes',
      'disponibilite-groupe',
    ],
    ...overrides,
  };
}

function makeThemeService() {
  return {
    tone: () => ({
      'account.title': 'Mon grimoire personnel',
      'characters_sheet.field_edit_aria': 'Modifier {label}',
      'account.pseudo_label': 'Signe de reconnaissance',
      'account.email_label': 'Sceau de correspondance',
      'account.display_name_label': 'Nom affiché',
      'account.cancel_btn': 'Renoncer',
      'account.saved': 'Le grimoire a retenu ce nom.',
      'account.error': "Le grimoire n'a pas pu retenir ce changement. Réessayez.",
      'account.password_title': 'Changer de mot de passe',
      'account.current_password_label': 'Mot de passe actuel',
      'account.new_password_label': 'Nouveau mot de passe',
      'account.password_save_btn': 'Changer',
      'account.password_saved': 'Le mot de passe a été changé.',
      'account.password_wrong_current': 'Mot de passe actuel incorrect.',
      'account.password_error': 'Le changement a échoué. Réessayez.',
      'account.current_password_for_email_label': 'Mot de passe actuel',
      'account.new_email_label': 'Nouvelle adresse e-mail',
      'account.email_change_save_btn': 'Envoyer la demande',
      'account.email_change_saved': 'Vérifiez votre nouvelle boîte mail pour confirmer.',
      'account.email_change_wrong_current': 'Mot de passe actuel incorrect.',
      'account.email_change_taken': 'Cette adresse est déjà utilisée par un autre compte.',
      'account.email_change_error': 'La demande a échoué. Réessayez.',
      'account.calendar_layers_title': 'Ce que révèle mon calendrier',
      'account.calendar_layer.mes-indisponibilites': 'Mes indisponibilités',
      'account.calendar_layer.mes-disponibilites': 'Mes disponibilités',
      'account.calendar_layer.mes-seances': 'Mes séances confirmées',
      'account.calendar_layer.votes-en-cours': 'Les votes en cours',
      'account.calendar_layer.inscriptions-ouvertes': 'Les inscriptions ouvertes',
      'account.calendar_layer.disponibilite-groupe': 'La disponibilité du groupe',
      // Story 36.14 — les quatre intentions remplacent les six clés techniques à l'écran ; les
      // `account.calendar_layer.*` restent au-dessus, encore utilisées par le panneau du calendrier.
      'account.calendar_intents_subtitle': 'Ce que je veux voir en arrivant sur un calendrier.',
      'account.calendar_intent.disponibilites': 'Mes disponibilités & indisponibilités',
      'account.calendar_intent.seances': 'Mes séances confirmées',
      'account.calendar_intent.votes': 'Les votes en cours',
      'account.calendar_intent.groupe': 'La disponibilité du groupe',
      'nav.logout': 'Fermer le grimoire',
      // Story 35.2 — textes ex-codés en dur (libellé de section du sélecteur, libellé commun).
      'account.appearance_label': 'Apparence',
      'common.modifier': 'Modifier',
      // Story 34.2 — libellés du bouton de révélation du mot de passe.
      'auth.password_show': 'Afficher le mot de passe',
      'auth.password_hide': 'Masquer le mot de passe',
      // Story 48.1 — ligne vers la Ludothèque.
      'board_games.title': 'Mon cabinet de reliques',
      'board_games.visibility':
        'Visible par les membres de vos groupes et les invités de vos conjonctions.',
      'board_games.count_one': '{n} jeu',
      'board_games.count_many': '{n} jeux',
    }),
    // ThemeSelector (intégré à l'écran de compte, Story 28.4) a besoin de ces membres.
    activeTheme: signal('grimoire-emeraude'),
    themes: ['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'],
    themeNames: {
      'grimoire-emeraude': 'Grimoire Émeraude',
      'foret-ancienne': 'Forêt Ancienne',
      'atelier-cuivre': 'Atelier Cuivré',
    },
    setTheme: vi.fn(),
  };
}

/** Story 48.1 : la ligne du compte lit le décompte de ma Ludothèque à l'ouverture. */
function makeBoardGamesService(list = vi.fn().mockResolvedValue([])) {
  return { list, changed: signal(0), notifyChanged: vi.fn() };
}

async function createFixture(
  currentUser = makeUser(),
  accountSvc: Record<string, ReturnType<typeof vi.fn>> = {
    updateDisplayName: vi.fn(),
    setTheme: vi.fn(),
    changePassword: vi.fn(),
    requestEmailChange: vi.fn(),
    updatePreferences: vi.fn(),
  },
  boardGamesSvc = makeBoardGamesService(),
) {
  const currentUserSignal = signal<AuthUser | null>(currentUser);
  const authSvc = { currentUser: currentUserSignal, logout: vi.fn().mockResolvedValue(undefined) };
  await TestBed.configureTestingModule({
    imports: [Account],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authSvc },
      { provide: AccountService, useValue: accountSvc },
      { provide: ThemeToneService, useValue: makeThemeService() },
      { provide: BoardGamesService, useValue: boardGamesSvc },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Account);
  fixture.detectChanges();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, currentUserSignal, accountSvc, authSvc };
}

describe('Account — nom affiché (crayon d’édition, revue de code)', () => {
  it('affiche le pseudo et le nom affiché en lecture seule (avec crayon)', async () => {
    const { fixture } = await createFixture(
      makeUser({ pseudo: 'alice', displayName: 'Alice au pays' }),
    );
    const component = fixture.componentInstance as any;
    expect(component.pseudo).toBe('alice');
    expect(component.displayName).toBe('Alice au pays');
    expect(fixture.nativeElement.querySelector('app-field-edit-pencil')).not.toBeNull();
  });

  it('aucun champ ne permet de modifier le pseudo', async () => {
    const { fixture } = await createFixture();
    const readonlyPseudoInput = fixture.nativeElement.querySelector(
      'input[formControlName="pseudo"]',
    );
    expect(readonlyPseudoInput).toBeNull();
  });

  it('onDisplayNameConfirm() appelle AccountService.updateDisplayName() puis met à jour AuthService.currentUser', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn().mockResolvedValue(makeUser({ displayName: 'Nouveau nom' })),
    };
    const { fixture, currentUserSignal } = await createFixture(
      makeUser({ displayName: 'alice' }),
      accountSvc,
    );
    const component = fixture.componentInstance as any;

    await component.onDisplayNameConfirm('Nouveau nom');

    expect(accountSvc.updateDisplayName).toHaveBeenCalledWith('Nouveau nom');
    expect(currentUserSignal()?.displayName).toBe('Nouveau nom');
    expect(component.saved()).toBe(true);
  });

  it('valeur vide → error() renseigné, service jamais appelé', async () => {
    const accountSvc = { updateDisplayName: vi.fn() };
    const { fixture } = await createFixture(makeUser({ displayName: 'alice' }), accountSvc);
    const component = fixture.componentInstance as any;

    await component.onDisplayNameConfirm('   ');

    expect(accountSvc.updateDisplayName).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('valeur > 60 caractères → error() renseigné, service jamais appelé', async () => {
    const accountSvc = { updateDisplayName: vi.fn() };
    const { fixture } = await createFixture(makeUser({ displayName: 'alice' }), accountSvc);
    const component = fixture.componentInstance as any;

    await component.onDisplayNameConfirm('x'.repeat(61));

    expect(accountSvc.updateDisplayName).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('les espaces en début/fin sont retirés avant l’appel au service', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn().mockResolvedValue(makeUser({ displayName: 'Nom valide' })),
    };
    const { fixture } = await createFixture(makeUser({ displayName: 'alice' }), accountSvc);
    const component = fixture.componentInstance as any;

    await component.onDisplayNameConfirm('  Nom valide  ');

    expect(accountSvc.updateDisplayName).toHaveBeenCalledWith('Nom valide');
  });

  it('échec de la soumission → error() renseigné, currentUser inchangé', async () => {
    const accountSvc = { updateDisplayName: vi.fn().mockRejectedValue(new Error('500')) };
    const { fixture, currentUserSignal } = await createFixture(
      makeUser({ displayName: 'alice' }),
      accountSvc,
    );
    const component = fixture.componentInstance as any;

    await component.onDisplayNameConfirm('Nouveau nom');

    expect(component.error()).toBeTruthy();
    expect(currentUserSignal()?.displayName).toBe('alice');
  });
});

describe('Account — changement de mot de passe (page sobre, revue de code)', () => {
  it('par défaut, aucun champ de mot de passe visible — seulement un bouton', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;

    expect(component.editingPassword()).toBe(false);
    expect(fixture.nativeElement.querySelector('input[formControlName="newPassword"]')).toBeNull();
  });

  it('startPasswordEdit() révèle les champs', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;

    component.startPasswordEdit();
    fixture.detectChanges();

    expect(component.editingPassword()).toBe(true);
  });

  it('cancelPasswordEdit() réinitialise le formulaire et referme la section', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;

    component.startPasswordEdit();
    component.passwordForm.setValue({ currentPassword: 'a', newPassword: 'newpassword123' });
    component.cancelPasswordEdit();

    expect(component.editingPassword()).toBe(false);
    expect(component.passwordForm.value.currentPassword).toBeFalsy();
  });

  it('soumission valide → AccountService.changePassword appelé, formulaire réinitialisé, succès affiché, section repliée', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startPasswordEdit();
    component.passwordForm.setValue({
      currentPassword: 'oldpw',
      newPassword: 'newpassword123',
    });
    await component.submitPassword();

    expect(accountSvc.changePassword).toHaveBeenCalledWith('oldpw', 'newpassword123');
    expect(component.passwordForm.value.currentPassword).toBeFalsy();
    expect(component.passwordForm.value.newPassword).toBeFalsy();
    expect(component.passwordSaved()).toBe(true);
    expect(component.editingPassword()).toBe(false);
  });

  it('mot de passe courant incorrect (401) → message spécifique, formulaire non réinitialisé, section reste ouverte', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 401 })),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startPasswordEdit();
    component.passwordForm.setValue({
      currentPassword: 'wrongpw',
      newPassword: 'newpassword123',
    });
    await component.submitPassword();

    expect(component.passwordError()).toBe('Mot de passe actuel incorrect.');
    expect(component.passwordForm.value.currentPassword).toBe('wrongpw');
    expect(component.editingPassword()).toBe(true);
  });

  it('échec réseau/serveur (non 401) → message générique', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 500 })),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startPasswordEdit();
    component.passwordForm.setValue({
      currentPassword: 'oldpw',
      newPassword: 'newpassword123',
    });
    await component.submitPassword();

    expect(component.passwordError()).toBe('Le changement a échoué. Réessayez.');
  });

  it('newPassword < 8 caractères → formulaire invalide, service jamais appelé', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startPasswordEdit();
    component.passwordForm.setValue({ currentPassword: 'oldpw', newPassword: 'short' });
    expect(component.passwordForm.invalid).toBe(true);
    await component.submitPassword();

    expect(accountSvc.changePassword).not.toHaveBeenCalled();
  });

  it('ne met jamais à jour AuthService.currentUser (rien dans AuthUser ne change)', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { fixture, currentUserSignal } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;
    const before = currentUserSignal();

    component.startPasswordEdit();
    component.passwordForm.setValue({
      currentPassword: 'oldpw',
      newPassword: 'newpassword123',
    });
    await component.submitPassword();

    expect(currentUserSignal()).toBe(before);
  });
});

describe('Account — changement d’adresse e-mail (crayon d’édition, revue de code)', () => {
  it('par défaut, l’adresse est en lecture seule avec un crayon, pas de champ visible', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;

    expect(component.editingEmail()).toBe(false);
    expect(fixture.nativeElement.querySelector('input[formControlName="newEmail"]')).toBeNull();
  });

  it('startEmailEdit() révèle le mot de passe courant ET la nouvelle adresse ensemble', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;

    component.startEmailEdit();
    fixture.detectChanges();

    expect(component.editingEmail()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('input[formControlName="currentPassword"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[formControlName="newEmail"]')).not.toBeNull();
  });

  it('startEmailEdit() pré-remplit newEmail avec l’adresse courante, en place plutôt qu’à ressaisir (revue de code)', async () => {
    const { fixture } = await createFixture(makeUser({ email: 'alice@example.com' }));
    const component = fixture.componentInstance as any;

    component.startEmailEdit();

    expect(component.emailForm.value.newEmail).toBe('alice@example.com');
  });

  it('cancelEmailEdit() réinitialise le formulaire et referme la section', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;

    component.startEmailEdit();
    component.emailForm.setValue({ currentPassword: 'a', newEmail: 'x@y.com' });
    component.cancelEmailEdit();

    expect(component.editingEmail()).toBe(false);
    expect(component.emailForm.value.newEmail).toBeFalsy();
  });

  it('soumission valide → AccountService.requestEmailChange appelé, formulaire réinitialisé, succès affiché, section repliée', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startEmailEdit();
    component.emailForm.setValue({
      currentPassword: 'oldpw',
      newEmail: 'new@example.com',
    });
    await component.submitEmailChange();

    expect(accountSvc.requestEmailChange).toHaveBeenCalledWith('oldpw', 'new@example.com');
    expect(component.emailForm.value.currentPassword).toBeFalsy();
    expect(component.emailForm.value.newEmail).toBeFalsy();
    expect(component.emailSaved()).toBe(true);
    expect(component.editingEmail()).toBe(false);
  });

  it('mot de passe courant incorrect (401) → message spécifique, formulaire non réinitialisé, section reste ouverte', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 401 })),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startEmailEdit();
    component.emailForm.setValue({
      currentPassword: 'wrongpw',
      newEmail: 'new@example.com',
    });
    await component.submitEmailChange();

    expect(component.emailError()).toBe('Mot de passe actuel incorrect.');
    expect(component.emailForm.value.currentPassword).toBe('wrongpw');
    expect(component.editingEmail()).toBe(true);
  });

  it('adresse déjà prise (409) → message dédié, pas le message générique (revue de code)', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 409 })),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startEmailEdit();
    component.emailForm.setValue({
      currentPassword: 'oldpw',
      newEmail: 'new@example.com',
    });
    await component.submitEmailChange();

    expect(component.emailError()).toBe('Cette adresse est déjà utilisée par un autre compte.');
  });

  it('échec réseau/serveur (autre statut) → message générique', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 500 })),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startEmailEdit();
    component.emailForm.setValue({
      currentPassword: 'oldpw',
      newEmail: 'new@example.com',
    });
    await component.submitEmailChange();

    expect(component.emailError()).toBe('La demande a échoué. Réessayez.');
  });

  it('newEmail invalide → formulaire invalide, service jamais appelé', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;

    component.startEmailEdit();
    component.emailForm.setValue({ currentPassword: 'oldpw', newEmail: 'pas-un-email' });
    expect(component.emailForm.invalid).toBe(true);
    await component.submitEmailChange();

    expect(accountSvc.requestEmailChange).not.toHaveBeenCalled();
  });

  it('ne met jamais à jour AuthService.currentUser (l’adresse ne change qu’après confirmation, AC1/AC5)', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn().mockResolvedValue({ ok: true }),
    };
    const { fixture, currentUserSignal } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;
    const before = currentUserSignal();

    component.startEmailEdit();
    component.emailForm.setValue({
      currentPassword: 'oldpw',
      newEmail: 'new@example.com',
    });
    await component.submitEmailChange();

    expect(currentUserSignal()).toBe(before);
  });
});

describe('Account — jeu de couches du calendrier par défaut (Story 30.4, Task 6)', () => {
  it('coche une couche → appelle updatePreferences avec le tableau attendu et met à jour currentUser optimistiquement', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
      updatePreferences: vi.fn().mockResolvedValue(undefined),
    };
    const { fixture, currentUserSignal } = await createFixture(
      makeUser({ defaultCalendarLayers: ['mes-seances'] }),
      accountSvc,
    );
    const component = fixture.componentInstance as any;

    component.onLayerToggle('votes-en-cours', true);
    fixture.detectChanges();

    expect(currentUserSignal()?.defaultCalendarLayers).toEqual(['mes-seances', 'votes-en-cours']);
    expect(accountSvc.updatePreferences).toHaveBeenCalledWith({
      defaultCalendarLayers: ['mes-seances', 'votes-en-cours'],
    });
  });

  it('décoche une couche → retirée du tableau envoyé', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
      updatePreferences: vi.fn().mockResolvedValue(undefined),
    };
    const { fixture, currentUserSignal } = await createFixture(
      makeUser({ defaultCalendarLayers: ['mes-seances', 'votes-en-cours'] }),
      accountSvc,
    );
    const component = fixture.componentInstance as any;

    component.onLayerToggle('mes-seances', false);
    fixture.detectChanges();

    expect(currentUserSignal()?.defaultCalendarLayers).toEqual(['votes-en-cours']);
    expect(accountSvc.updatePreferences).toHaveBeenCalledWith({
      defaultCalendarLayers: ['votes-en-cours'],
    });
  });

  it('échec réseau → restaure la valeur locale précédente (rollback, même patron que Dashboard.onHideFinishedChange())', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
      updatePreferences: vi.fn().mockRejectedValue(new Error('network')),
    };
    const { fixture, currentUserSignal } = await createFixture(
      makeUser({ defaultCalendarLayers: ['mes-seances'] }),
      accountSvc,
    );
    const component = fixture.componentInstance as any;

    component.onLayerToggle('votes-en-cours', true);
    fixture.detectChanges();
    expect(currentUserSignal()?.defaultCalendarLayers).toEqual(['mes-seances', 'votes-en-cours']);

    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(currentUserSignal()?.defaultCalendarLayers).toEqual(['mes-seances']);
  });

  it("revue de code : rollback d'une requête échouée n'écrase pas une bascule plus récente déjà réussie", async () => {
    let rejectFirst!: (e: unknown) => void;
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
      updatePreferences: vi
        .fn()
        .mockImplementationOnce(() => new Promise((_, reject) => (rejectFirst = reject)))
        .mockResolvedValueOnce(undefined),
    };
    const { fixture, currentUserSignal } = await createFixture(
      makeUser({ defaultCalendarLayers: ['mes-seances'] }),
      accountSvc,
    );
    const component = fixture.componentInstance as any;

    component.onLayerToggle('votes-en-cours', true);
    fixture.detectChanges();
    component.onLayerToggle('inscriptions-ouvertes', true);
    fixture.detectChanges();
    expect(currentUserSignal()?.defaultCalendarLayers).toEqual([
      'mes-seances',
      'votes-en-cours',
      'inscriptions-ouvertes',
    ]);

    rejectFirst(new Error('network'));
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(currentUserSignal()?.defaultCalendarLayers).toEqual([
      'mes-seances',
      'votes-en-cours',
      'inscriptions-ouvertes',
    ]);
  });

  /**
   * ⚠️ Story 36.14 — CE TEST A CHANGÉ DE VÉRITÉ, il n'a pas été supprimé. La story 30.4 rendait
   * UNE case par clé (six) ; l'AC7 de la 36.14 impose QUATRE INTENTIONS. Ce qui reste vrai, et
   * que ce test continue de prouver, c'est que l'écran reflète bien `defaultCalendarLayers` :
   * seule la granularité de la présentation a changé, pas le stockage.
   */
  it('rend une case par INTENTION (quatre), reflétant defaultCalendarLayers courant', async () => {
    const { fixture } = await createFixture(makeUser({ defaultCalendarLayers: ['mes-seances'] }));
    const comp = fixture.componentInstance as any;

    expect(fixture.nativeElement.querySelectorAll('.calendar-intents mat-checkbox').length).toBe(4);
    expect(comp.isIntentActive('seances')).toBe(true);
    expect(comp.isIntentActive('votes')).toBe(false);
  });
});

describe('Account — champs de mot de passe révélables (Story 34.2)', () => {
  function passwordFields(root: HTMLElement) {
    return {
      inputs: Array.from(root.querySelectorAll('input[formControlName]')).filter((i) =>
        ['currentPassword', 'newPassword'].includes(i.getAttribute('formControlName')!),
      ) as HTMLInputElement[],
      toggles: Array.from(
        root.querySelectorAll('app-password-toggle button'),
      ) as HTMLButtonElement[],
    };
  }

  it('mot de passe : champs actuel et nouveau indépendants, chacun masqué au départ', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;
    component.startPasswordEdit();
    fixture.detectChanges();

    const { inputs, toggles } = passwordFields(fixture.nativeElement);
    expect(inputs.map((i) => i.type)).toEqual(['password', 'password']);
    expect(toggles.length).toBe(2);

    toggles[1].click();
    fixture.detectChanges();
    expect(inputs.map((i) => i.type)).toEqual(['password', 'text']);
    expect(toggles.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);

    toggles[0].click();
    fixture.detectChanges();
    expect(inputs.map((i) => i.type)).toEqual(['text', 'text']);

    toggles[1].click();
    fixture.detectChanges();
    expect(inputs.map((i) => i.type)).toEqual(['text', 'password']);
  });

  it('mot de passe : la valeur saisie et la validité sont conservées à la bascule', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;
    component.startPasswordEdit();
    fixture.detectChanges();
    component.passwordForm.setValue({ currentPassword: 'oldpw', newPassword: 'newpassword123' });
    fixture.detectChanges();

    passwordFields(fixture.nativeElement).toggles[1].click();
    fixture.detectChanges();

    expect(component.passwordForm.getRawValue()).toEqual({
      currentPassword: 'oldpw',
      newPassword: 'newpassword123',
    });
    expect(component.passwordForm.valid).toBe(true);
  });

  it('formulaire de mot de passe refermé puis rouvert : à nouveau masqué', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;
    component.startPasswordEdit();
    fixture.detectChanges();
    for (const b of passwordFields(fixture.nativeElement).toggles) b.click();
    fixture.detectChanges();
    expect(passwordFields(fixture.nativeElement).inputs.map((i) => i.type)).toEqual([
      'text',
      'text',
    ]);

    component.cancelPasswordEdit();
    fixture.detectChanges();
    component.startPasswordEdit();
    fixture.detectChanges();

    const { inputs, toggles } = passwordFields(fixture.nativeElement);
    expect(inputs.map((i) => i.type)).toEqual(['password', 'password']);
    expect(toggles.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
  });

  it('demande de changement d’e-mail : le mot de passe actuel est révélable, pas le champ e-mail', async () => {
    const { fixture } = await createFixture();
    const component = fixture.componentInstance as any;
    component.startEmailEdit();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const pw = root.querySelector('input[formControlName="currentPassword"]') as HTMLInputElement;
    const email = root.querySelector('input[formControlName="newEmail"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('app-password-toggle button'),
    ) as HTMLButtonElement[];
    expect(toggles.length).toBe(1);
    expect(pw.type).toBe('password');

    toggles[0].click();
    fixture.detectChanges();
    expect(pw.type).toBe('text');
    expect(email.type).toBe('email');
    expect(toggles[0].getAttribute('aria-label')).toBe('Masquer le mot de passe');

    component.cancelEmailEdit();
    fixture.detectChanges();
    component.startEmailEdit();
    fixture.detectChanges();
    const reopened = root.querySelector(
      'input[formControlName="currentPassword"]',
    ) as HTMLInputElement;
    expect(reopened.type).toBe('password');
  });

  it('le bouton de révélation ne soumet pas le formulaire de mot de passe', async () => {
    const accountSvc = {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn().mockResolvedValue({ ok: true }),
      requestEmailChange: vi.fn(),
      updatePreferences: vi.fn(),
    };
    const { fixture } = await createFixture(makeUser(), accountSvc);
    const component = fixture.componentInstance as any;
    component.startPasswordEdit();
    fixture.detectChanges();
    component.passwordForm.setValue({ currentPassword: 'oldpw', newPassword: 'newpassword123' });

    passwordFields(fixture.nativeElement).toggles[0].click();
    fixture.detectChanges();

    expect(accountSvc.changePassword).not.toHaveBeenCalled();
  });
});

describe('Account — déconnexion (Story 29.3, foyer déplacé depuis le menu du Shell)', () => {
  it('un bouton de déconnexion est rendu', async () => {
    const { fixture } = await createFixture();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.some((b) => b.textContent?.includes('Fermer le grimoire'))).toBe(true);
  });

  it('clic sur le bouton de déconnexion appelle AuthService.logout() puis navigue vers /login', async () => {
    const { fixture, authSvc } = await createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const logoutButton = buttons.find((b) => b.textContent?.includes('Fermer le grimoire'));
    logoutButton!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(authSvc.logout).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});

describe('Account — bandeau contextuel (Story 29.4)', () => {
  it("ngOnInit() renseigne ContextualNavService avec le titre de l'écran", async () => {
    await createFixture();

    const contextualNav = TestBed.inject(ContextualNavService);
    expect(contextualNav.title()).toBe('Mon grimoire personnel');
  });
});

// ─── Les quatre intentions (Story 36.14, AC7/AC16, D-3) ───────────────────────────────────────

describe('Account — « Ce que révèle mon calendrier » en intentions (Story 36.14)', () => {
  function makeAccountSvc() {
    return {
      updateDisplayName: vi.fn(),
      setTheme: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
      updatePreferences: vi.fn().mockResolvedValue(undefined),
    };
  }

  async function createWithLayers(defaultCalendarLayers: string[]) {
    const accountSvc = makeAccountSvc();
    const created = await createFixture(makeUser({ defaultCalendarLayers } as any), accountSvc);
    return { ...created, accountSvc };
  }

  function sentLayers(accountSvc: ReturnType<typeof makeAccountSvc>) {
    return accountSvc.updatePreferences.mock.calls[0][0].defaultCalendarLayers as string[];
  }

  it('AC7 — quatre cases d’intention, jamais six clés techniques', async () => {
    const { fixture } = await createWithLayers([...CALENDAR_LAYER_KEYS]);
    const labels = [
      ...fixture.nativeElement.querySelectorAll('.calendar-intents mat-checkbox'),
    ].map((e: any) => e.textContent.trim());

    expect(labels).toEqual([
      'Mes disponibilités & indisponibilités',
      'Mes séances confirmées',
      'Les votes en cours',
      'La disponibilité du groupe',
    ]);
  });

  it('AC7 — « Les inscriptions ouvertes » n’apparaît plus à l’écran', async () => {
    const { fixture } = await createWithLayers([...CALENDAR_LAYER_KEYS]);
    expect(fixture.nativeElement.textContent).not.toContain('Les inscriptions ouvertes');
  });

  it('l’intention de disponibilités écrit LES DEUX clés en UN SEUL appel', async () => {
    const { fixture, accountSvc } = await createWithLayers(['mes-seances']);

    (fixture.componentInstance as any).onIntentToggle('disponibilites', true);

    // Un seul aller-retour : deux appels successifs ouvriraient deux fenêtres de rollback
    // concurrentes sur la même préférence.
    expect(accountSvc.updatePreferences).toHaveBeenCalledTimes(1);
    expect(sentLayers(accountSvc)).toContain('mes-disponibilites');
    expect(sentLayers(accountSvc)).toContain('mes-indisponibilites');
  });

  it('éteindre l’intention de disponibilités retire LES DEUX clés', async () => {
    const { fixture, accountSvc } = await createWithLayers([
      'mes-disponibilites',
      'mes-indisponibilites',
      'mes-seances',
    ]);

    (fixture.componentInstance as any).onIntentToggle('disponibilites', false);

    expect(sentLayers(accountSvc)).toEqual(['mes-seances']);
  });

  /**
   * 🚨 AC16 — LE défaut silencieux que cette tâche pouvait introduire. L'écran n'offre plus de
   * case pour `inscriptions-ouvertes`, mais la clé reste un réglage de compte valide
   * [Source: prd.md:305, addendum.md:83]. Si une écriture d'intention la laissait tomber, une
   * préférence livrée trois jours plus tôt serait effacée par un geste sans rapport — et plus
   * aucun écran ne permettrait de la rétablir.
   */
  it('AC16 — `inscriptions-ouvertes` survit intacte à une écriture d’intention', async () => {
    const { fixture, accountSvc } = await createWithLayers([
      'inscriptions-ouvertes',
      'mes-seances',
    ]);

    (fixture.componentInstance as any).onIntentToggle('votes', true);

    expect(sentLayers(accountSvc)).toContain('inscriptions-ouvertes');
    expect(sentLayers(accountSvc)).toContain('votes-en-cours');
  });

  /**
   * D-3 — l'écran de la story 30.4 offrait les deux disponibilités SÉPARÉMENT : un compte peut
   * donc porter aujourd'hui exactement l'une des deux. Regrouper naïvement (cochée si les deux
   * sont là) ferait disparaître la couche active au premier clic, sans que personne le voie.
   */
  it('D-3 — état mixte hérité → case indéterminée, jamais silencieusement décochée', async () => {
    const { fixture } = await createWithLayers(['mes-disponibilites']);
    const comp = fixture.componentInstance as any;

    expect(comp.isIntentIndeterminate('disponibilites')).toBe(true);
    expect(comp.isIntentActive('disponibilites')).toBe(false);
  });

  it('D-3 — un clic depuis l’état mixte ARME les deux clés', async () => {
    const { fixture, accountSvc } = await createWithLayers(['mes-disponibilites']);

    (fixture.componentInstance as any).onIntentToggle('disponibilites', true);

    expect(sentLayers(accountSvc)).toContain('mes-disponibilites');
    expect(sentLayers(accountSvc)).toContain('mes-indisponibilites');
  });

  it('les deux disponibilités actives → case cochée, non indéterminée', async () => {
    const { fixture } = await createWithLayers(['mes-disponibilites', 'mes-indisponibilites']);
    const comp = fixture.componentInstance as any;

    expect(comp.isIntentActive('disponibilites')).toBe(true);
    expect(comp.isIntentIndeterminate('disponibilites')).toBe(false);
  });

  it('une intention à clé unique reste simple (séances, votes, groupe)', async () => {
    const { fixture } = await createWithLayers(['mes-seances']);
    const comp = fixture.componentInstance as any;

    expect(comp.isIntentActive('seances')).toBe(true);
    expect(comp.isIntentActive('votes')).toBe(false);
    expect(comp.isIntentActive('groupe')).toBe(false);
    expect(comp.isIntentIndeterminate('seances')).toBe(false);
  });

  it('mise à jour optimiste de currentUser, comme la story 30.4', async () => {
    const { fixture, currentUserSignal } = await createWithLayers(['mes-seances']);

    (fixture.componentInstance as any).onIntentToggle('votes', true);

    expect(currentUserSignal()?.defaultCalendarLayers).toContain('votes-en-cours');
  });
});

describe('Account — zone sensible (Story 43.1)', () => {
  const IMPACT = {
    groups: [{ id: 'g1', name: 'La Bande du Jeudi', memberCount: 14, eventCount: 6 }],
    jdrParties: [],
  };

  async function createDangerFixture(
    accountSvc: Record<string, ReturnType<typeof vi.fn>>,
    closedWith: boolean | undefined = undefined,
  ) {
    const dialog = { open: vi.fn(() => ({ afterClosed: () => of(closedWith) })) };
    const currentUser = signal<AuthUser | null>(makeUser({ pseudo: 'alice' }));
    await TestBed.configureTestingModule({
      imports: [Account],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser } },
        { provide: AccountService, useValue: accountSvc },
        { provide: MatDialog, useValue: dialog },
        { provide: BoardGamesService, useValue: makeBoardGamesService() },
        {
          provide: ThemeToneService,
          useValue: {
            tone: signal(TONE_MAP['grimoire-emeraude']),
            activeTheme: signal('grimoire-emeraude'),
            themes: ['grimoire-emeraude', 'foret-ancienne', 'atelier-cuivre'],
            themeNames: {},
            setTheme: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Account);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return { fixture, dialog, currentUser, navigate, el: fixture.nativeElement as HTMLElement };
  }

  const pill = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.danger-pill')!;

  it('la section vient après « Fermer le grimoire », avec son étiquette, sa phrase et la pilule', async () => {
    const { el } = await createDangerFixture({ getDeletionImpact: vi.fn() });

    const zone = el.querySelector('.danger-zone')!;
    expect(zone.textContent).toContain('Zone sensible');
    expect(zone.textContent).toContain(TONE_MAP['grimoire-emeraude']['account.danger_explain']);
    expect(pill(el).textContent).toContain('Effacer mon compte');
    expect(pill(el).querySelector('app-icon')?.getAttribute('data-icon')).toBe('supprimer');
    expect(pill(el).querySelector('mat-icon')).toBeNull();
    const logout = el.querySelector('.logout-row')!;
    expect(logout.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('un clic lit l’aperçu et ouvre la fenêtre avec le pseudo et l’aperçu', async () => {
    const getDeletionImpact = vi.fn().mockResolvedValue(IMPACT);
    const { fixture, dialog, el } = await createDangerFixture({ getDeletionImpact });

    pill(el).click();
    await fixture.whenStable();

    expect(getDeletionImpact).toHaveBeenCalledTimes(1);
    expect(dialog.open).toHaveBeenCalledWith(DeleteAccountDialog, {
      data: { pseudo: 'alice', impact: IMPACT },
    });
  });

  it('l’aperçu est relu à chaque ouverture', async () => {
    const getDeletionImpact = vi.fn().mockResolvedValue(IMPACT);
    const { fixture, el } = await createDangerFixture({ getDeletionImpact });

    pill(el).click();
    await fixture.whenStable();
    pill(el).click();
    await fixture.whenStable();

    expect(getDeletionImpact).toHaveBeenCalledTimes(2);
  });

  it('échec de lecture : aucune fenêtre, un message sous la pilule', async () => {
    const getDeletionImpact = vi.fn().mockRejectedValue(new Error('boom'));
    const { fixture, dialog, el } = await createDangerFixture({ getDeletionImpact });

    pill(el).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(el.querySelector('.danger-zone .error')?.textContent).toContain(
      TONE_MAP['grimoire-emeraude']['account.danger_load_error'],
    );
  });

  it('compte effacé (fenêtre fermée sur true) : utilisateur local oublié, accueil public avec le message de confirmation (Story 43.2)', async () => {
    const getDeletionImpact = vi.fn().mockResolvedValue(IMPACT);
    const { fixture, currentUser, navigate, el } = await createDangerFixture(
      { getDeletionImpact },
      true,
    );

    pill(el).click();
    await fixture.whenStable();

    expect(currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { compte: 'efface' } });
  });

  it('fenêtre refermée sans effacement (Renoncer) : l’utilisateur reste connecté sur la page', async () => {
    const getDeletionImpact = vi.fn().mockResolvedValue(IMPACT);
    const { fixture, currentUser, navigate, el } = await createDangerFixture(
      { getDeletionImpact },
      false,
    );

    pill(el).click();
    await fixture.whenStable();

    expect(currentUser()).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});

// ⚠️ Story 48.1 — la ligne vers la Ludothèque, après « Ce que révèle mon calendrier », avant la zone sensible.
describe('Account — ligne de la Ludothèque (Story 48.1)', () => {
  const GAME = {
    id: 'g',
    name: 'Azul',
    nameKey: 'azul',
    minPlayers: null,
    maxPlayers: null,
    durationMin: null,
    createdAt: '2026-10-29T10:00:00.000Z',
  };
  const row = (el: HTMLElement) => el.querySelector<HTMLAnchorElement>('a.board-games-row')!;

  it('« Mon cabinet de reliques · 0 jeu › » et la phrase de visibilité, lien vers la page', async () => {
    const { fixture } = await createFixture();
    const el = fixture.nativeElement as HTMLElement;

    expect(row(el).querySelector('.board-games-row__title')?.textContent?.trim()).toBe(
      'Mon cabinet de reliques · 0 jeu',
    );
    expect(row(el).querySelector('.board-games-row__visibility')?.textContent?.trim()).toBe(
      'Visible par les membres de vos groupes et les invités de vos conjonctions.',
    );
    expect(row(el).querySelector('.board-games-row__chevron')?.getAttribute('data-icon')).toBe(
      'ouvrir',
    );
    expect(row(el).textContent).not.toContain('›');
    expect(row(el).getAttribute('href')).toBe('/profile/board-games');
  });

  it('placée après les intentions du calendrier et avant la zone sensible', async () => {
    const { fixture } = await createFixture();
    const el = fixture.nativeElement as HTMLElement;

    const intents = el.querySelector('.calendar-intents')!;
    const danger = el.querySelector('.danger-zone')!;
    expect(
      intents.compareDocumentPosition(row(el)) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(row(el).compareDocumentPosition(danger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('pluriel au-delà d’un jeu : « 3 jeux »', async () => {
    const list = vi.fn().mockResolvedValue([GAME, { ...GAME, id: 'h' }, { ...GAME, id: 'i' }]);
    const { fixture } = await createFixture(makeUser(), undefined, makeBoardGamesService(list));

    expect(list).toHaveBeenCalledTimes(1);
    const title = row(fixture.nativeElement as HTMLElement).querySelector(
      '.board-games-row__title',
    );
    expect(title?.textContent).toContain('· 3 jeux');
  });

  it('lecture du décompte en échec : le titre seul, la ligne reste un lien', async () => {
    const list = vi.fn().mockRejectedValue(new Error('boom'));
    const { fixture } = await createFixture(makeUser(), undefined, makeBoardGamesService(list));
    const el = fixture.nativeElement as HTMLElement;

    expect(row(el).querySelector('.board-games-row__title')?.textContent?.trim()).toBe(
      'Mon cabinet de reliques',
    );
    expect(row(el).getAttribute('href')).toBe('/profile/board-games');
  });

  it('story 51.7 : « jeux » en premier (suit le thème), « ouvrir » en dernier, tous deux décoratifs', async () => {
    const { fixture } = await createFixture();
    const el = fixture.nativeElement as HTMLElement;
    const icons = Array.from(row(el).querySelectorAll('app-icon'));

    expect(icons.map((icon) => icon.getAttribute('data-icon'))).toEqual(['jeux', 'ouvrir']);
    expect(row(el).firstElementChild).toBe(icons[0]);
    expect(row(el).lastElementChild).toBe(icons[1]);
    for (const icon of icons) {
      expect(icon.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }

    // « jeux » est une icône de sens : son dessin change avec le thème, « ouvrir » (utilitaire) non.
    const drawing = (icon: Element) => icon.querySelector('svg')?.innerHTML;
    const jeuxGrimoire = drawing(icons[0]);
    const ouvrirGrimoire = drawing(icons[1]);
    (
      TestBed.inject(ThemeToneService) as unknown as { activeTheme: { set(t: string): void } }
    ).activeTheme.set('foret-ancienne');
    fixture.detectChanges();
    expect(drawing(icons[0])).not.toBe(jeuxGrimoire);
    expect(drawing(icons[1])).toBe(ouvrirGrimoire);
  });
});

describe('Account — pictogrammes (story 51.7)', () => {
  it('crayon de l’e-mail : « modifier », nom accessible conservé ; « Fermer le grimoire » porte « quitter » avant son texte', async () => {
    const { fixture } = await createFixture();
    const el = fixture.nativeElement as HTMLElement;

    const pencil = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.field-edit-pencil__button'),
    ).find((b) => b.getAttribute('aria-label')?.includes('Sceau de correspondance'))!;
    expect(pencil.querySelector('app-icon')?.getAttribute('data-icon')).toBe('modifier');
    expect(pencil.textContent).not.toContain('✎');
    expect(pencil.getAttribute('aria-label')).toContain('Sceau de correspondance');

    const logout = el.querySelector<HTMLButtonElement>('.logout-btn')!;
    expect(logout.querySelector('app-icon')?.getAttribute('data-icon')).toBe('quitter');
    // L'icône précède le texte du bouton.
    expect(logout.querySelector('app-icon')!.nextSibling?.textContent?.trim()).toBe(
      'Fermer le grimoire',
    );
    expect(logout.querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(logout.textContent).toContain('Fermer le grimoire');
    expect(el.querySelector('mat-icon')).toBeNull();
  });
});
