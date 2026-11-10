import { Logger } from '@nestjs/common';
import type { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let mailer: { sendMail: jest.Mock };

  beforeEach(() => {
    mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };
    service = new EmailService(mailer as unknown as MailerService);
  });

  it('transmet to/template/context à MailerService et renvoie { ok: true }', async () => {
    const result = await service.sendMail('invitation', 'ami@example.com', {
      partieName: 'La Forêt Ancienne',
      link: 'https://jdr-master.local/invite/abc',
    });

    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'ami@example.com',
      subject: 'Invitation à rejoindre {{partieName}}',
      template: 'invitation',
      context: {
        partieName: 'La Forêt Ancienne',
        link: 'https://jdr-master.local/invite/abc',
        actionLabel: 'Rejoindre la partie',
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("ajoute le libellé du bouton d'action au contexte, et aucun pour un e-mail sans action", async () => {
    await service.sendMail('password-reset', 'joueur@example.com', { link: 'https://x/y' });
    expect(mailer.sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        context: { link: 'https://x/y', actionLabel: 'Choisir un nouveau mot de passe' },
      }),
    );

    await service.sendMail('password-changed', 'joueur@example.com', {});
    expect(mailer.sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({ context: { actionLabel: null } }),
    );
  });

  it('soiree-invitation : sujet « <invitant> vous invite : « <soirée> » » et bouton « Accepter ou décliner » (Story 41.3)', async () => {
    const data = {
      inviterName: 'Marc',
      eventTitle: 'Marathon Pandémie',
      dateLine: 'date à fixer',
      link: 'https://example.com/',
    };
    await service.sendMail('soiree-invitation', 'ami@example.com', data);
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ami@example.com',
        subject: '{{inviterName}} vous invite : « {{eventTitle}} »',
        template: 'soiree-invitation',
        context: { ...data, actionLabel: 'Accepter ou décliner' },
      }),
    );
  });

  it('group-invitation : sujet neutre « <invitant> vous invite à rejoindre « <groupe> » » et bouton « Rejoindre le groupe » (Story 39.3)', async () => {
    await service.sendMail('group-invitation', 'ami@example.com', {
      inviterName: 'Marc',
      partieName: 'Les Fidèles',
      link: 'https://x/join/abc',
    });
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'ami@example.com',
      subject: '{{inviterName}} vous invite à rejoindre « {{partieName}} »',
      template: 'group-invitation',
      context: {
        inviterName: 'Marc',
        partieName: 'Les Fidèles',
        link: 'https://x/join/abc',
        actionLabel: 'Rejoindre le groupe',
      },
    });
  });

  it('conjonction-reminder : sujet neutre « Demain : « <titre> » » et bouton « Voir la rencontre » (Story 40.3)', async () => {
    await service.sendMail('conjonction-reminder', 'ami@example.com', {
      eventTitle: 'Catane',
      sessionDate: 'samedi 24 octobre (soir)',
      link: 'https://x/parties/p1',
    });
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'ami@example.com',
      subject: 'Demain : « {{eventTitle}} »',
      template: 'conjonction-reminder',
      context: {
        eventTitle: 'Catane',
        sessionDate: 'samedi 24 octobre (soir)',
        link: 'https://x/parties/p1',
        actionLabel: 'Voir la rencontre',
      },
    });
  });

  it('conjonction-reservation : sujet neutre « <hôte> vous a réservé une place : « <titre> » » et bouton « Répondre » (Story 40.4)', async () => {
    await service.sendMail('conjonction-reservation', 'ami@example.com', {
      hostName: 'Léa',
      eventTitle: 'Catane',
      sessionDate: 'samedi 24 octobre (soir)',
      link: 'https://x/parties/p1',
    });
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'ami@example.com',
      subject: '{{hostName}} vous a réservé une place : « {{eventTitle}} »',
      template: 'conjonction-reservation',
      context: {
        hostName: 'Léa',
        eventTitle: 'Catane',
        sessionDate: 'samedi 24 octobre (soir)',
        link: 'https://x/parties/p1',
        actionLabel: 'Répondre',
      },
    });
  });

  it('conjonction-date-fixee : sujet neutre « C’est fixé : « <titre> », <date> » et bouton « Voir la rencontre » (Story 40.6)', async () => {
    await service.sendMail('conjonction-date-fixee', 'ami@example.com', {
      eventTitle: 'Catane',
      sessionDate: 'samedi 24 octobre (soir)',
      lieu: 'Chez Léa',
      link: 'https://x/parties/p1',
    });
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'ami@example.com',
      subject: "C'est fixé : « {{eventTitle}} », {{sessionDate}}",
      template: 'conjonction-date-fixee',
      context: {
        eventTitle: 'Catane',
        sessionDate: 'samedi 24 octobre (soir)',
        lieu: 'Chez Léa',
        link: 'https://x/parties/p1',
        actionLabel: 'Voir la rencontre',
      },
    });
  });

  it('conjonction-annulee : sujet neutre « Annulée : « <titre> » » et bouton « Voir » (Story 42.1)', async () => {
    await service.sendMail('conjonction-annulee', 'ami@example.com', {
      eventTitle: 'Catane',
      actorName: 'Léa',
      sessionDate: 'samedi 24 octobre (soir)',
      link: 'https://x/parties/p1',
    });
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'ami@example.com',
      subject: 'Annulée : « {{eventTitle}} »',
      template: 'conjonction-annulee',
      context: {
        eventTitle: 'Catane',
        actorName: 'Léa',
        sessionDate: 'samedi 24 octobre (soir)',
        link: 'https://x/parties/p1',
        actionLabel: 'Voir',
      },
    });
  });

  it('conjonction-relance : sujet neutre « Plus qu’un jour pour voter : « <titre> » » et bouton « Voter dans le calendrier » (Story 40.7)', async () => {
    await service.sendMail('conjonction-relance', 'ami@example.com', {
      eventTitle: 'Catane',
      deadline: 'samedi 24 octobre',
      link: 'https://x/parties/p1/guild-calendar',
    });
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'ami@example.com',
      subject: "Plus qu'un jour pour voter : « {{eventTitle}} »",
      template: 'conjonction-relance',
      context: {
        eventTitle: 'Catane',
        deadline: 'samedi 24 octobre',
        link: 'https://x/parties/p1/guild-calendar',
        actionLabel: 'Voter dans le calendrier',
      },
    });
  });

  it('sujet correct par gabarit (session-reminder, password-reset)', async () => {
    await service.sendMail('session-reminder', 'joueur@example.com', {});
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Rappel : séance de {{partieName}} demain',
      }),
    );

    await service.sendMail('password-reset', 'joueur@example.com', {});
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Réinitialisation de votre mot de passe',
      }),
    );

    await service.sendMail('level-up', 'joueur@example.com', {});
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Nouveau niveau disponible pour {{characterName}}',
      }),
    );
  });

  it("catch une erreur d'envoi, la logge, et renvoie { ok: false } sans relancer", async () => {
    const error = new Error('ECONNREFUSED');
    mailer.sendMail.mockRejectedValue(error);
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await service.sendMail('invitation', 'ami@example.com', {});

    expect(result).toEqual({ ok: false });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('invitation'),
      expect.any(String),
    );

    loggerSpy.mockRestore();
  });
});
