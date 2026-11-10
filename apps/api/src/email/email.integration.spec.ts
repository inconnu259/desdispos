import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';

// Test d'intégration réel : envoie un e-mail via le transport SMTP configuré (Mailpit en
// dev/test) et vérifie via l'API HTTP de Mailpit que le layout, le sujet interpolé et le lien
// arrivent bien. Un test unitaire mocké (email.service.spec.ts) ne peut pas attraper une
// régression sur la config du transport/du layout — ce test l'aurait fait pendant cette story
// (deux bugs réels n'ont été trouvés que par vérification manuelle : import HandlebarsAdapter,
// placement de l'option `layout`).
//
// Ignoré gracieusement si Mailpit n'est pas joignable (ex. exécution hors `docker compose up`).
const MAILPIT_API = `http://${process.env.MAIL_HOST ?? 'mailpit'}:8025`;

async function isMailpitReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${MAILPIT_API}/api/v1/messages?limit=1`);
    return res.ok;
  } catch {
    return false;
  }
}

@Module({ imports: [EmailModule] })
class TestAppModule {}

describe('EmailModule (intégration réelle via Mailpit)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await isMailpitReachable();
    if (!reachable) {
      console.warn(
        `Mailpit injoignable sur ${MAILPIT_API} — test d'intégration ignoré (lancer via "docker compose up").`,
      );
    }
  });

  it('envoie un e-mail réel, retrouvé dans Mailpit avec sujet interpolé, layout et lien', async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, {
      logger: false,
    });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}@example.com`;

    try {
      const result = await email.sendMail('invitation', to, {
        partieName: 'Test Intégration',
        link: 'https://example.com/invite/test',
      });
      expect(result).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as {
        messages: Array<{ ID: string }>;
      };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as {
        Subject: string;
        HTML: string;
      };
      expect(message.Subject).toBe('Invitation à rejoindre Test Intégration');
      // Story 39.2 : gabarit commun — pied « Dés Dispos » (plus « jdr-master ») et vrai bouton vert
      // plein (le lien porte le libellé de l'action et le fond vert), pas un simple lien souligné.
      expect(message.HTML).toContain('Dés Dispos');
      expect(message.HTML).not.toContain('jdr-master');
      expect(message.HTML).toMatch(
        /<a href="https:\/\/example\.com\/invite\/test"[^>]*>Rejoindre la partie<\/a>/,
      );
      expect(message.HTML).toContain('background:#2e7d5a');
    } finally {
      await app.close();
    }
  });

  // Story 39.2 (revue) : l'invariant « link + libellé ⇒ bouton » traverse le vrai layout pour CHAQUE
  // gabarit à action, pas seulement `invitation` — un libellé oublié ou un `link` mal nommé ferait
  // disparaître le bouton sans aucune erreur.
  it.each([
    ['invitation', 'Rejoindre la partie'],
    ['group-invitation', 'Rejoindre le groupe'],
    ['soiree-invitation', 'Accepter ou décliner'],
    ['session-reminder', 'Voir la partie'],
    ['conjonction-reminder', 'Voir la rencontre'],
    ['conjonction-reservation', 'Répondre'],
    ['conjonction-date-fixee', 'Voir la rencontre'],
    ['conjonction-relance', 'Voter dans le calendrier'],
    ['conjonction-annulee', 'Voir'],
    ['password-reset', 'Choisir un nouveau mot de passe'],
    ['level-up', 'Voir la fiche'],
    ['email-change-confirm', 'Confirmer cette nouvelle adresse'],
    ['email-change-rollback-available', 'Annuler ce changement et restaurer mon adresse'],
    ['email-change-rolled-back', 'Réinitialiser mon mot de passe'],
  ] as const)('le gabarit « %s » rend un bouton « %s » vers son lien', async (template, label) => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-${template}@example.com`;
    const link = `https://example.com/${template}/abc.def`;

    try {
      expect(
        await email.sendMail(template, to, {
          link,
          partieName: 'P',
          characterName: 'C',
          inviterName: 'I',
        }),
      ).toEqual({
        ok: true,
      });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { HTML: string };
      expect(message.HTML).toContain(`href="${link}"`);
      expect(message.HTML).toContain(`>${label}</a>`);
      expect(message.HTML).toContain('Dés Dispos');
    } finally {
      await app.close();
    }
  });

  // Story 39.3 : e-mail de groupe — sujet « Marc vous invite à rejoindre « Groupe » » (apostrophes et
  // guillemets inclus, sans échappement HTML), bouton « Rejoindre le groupe », aucun mot de JDR.
  it('group-invitation : sujet interpolé sans échappement, corps neutre, bouton « Rejoindre le groupe »', async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-groupe@example.com`;
    const link = 'https://example.com/join/abc.def';

    try {
      expect(
        await email.sendMail('group-invitation', to, {
          inviterName: "Marc d'Aubigné",
          partieName: "Les Fidèles de l'Aube",
          link,
        }),
      ).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { Subject: string; HTML: string };
      expect(message.Subject).toBe(
        "Marc d'Aubigné vous invite à rejoindre « Les Fidèles de l'Aube »",
      );
      expect(message.HTML).toContain('sur Dés Dispos, pour organiser vos rencontres entre amis.');
      expect(message.HTML).toContain('>Rejoindre le groupe</a>');
      for (const mot of ['partie', 'MJ', 'grimoire', 'campagne', 'joueur']) {
        expect(message.HTML).not.toContain(mot);
      }
    } finally {
      await app.close();
    }
  });

  // Story 40.3 : rappel de la veille d'une conjonction — sujet « Demain : « Titre » », date · lieu,
  // bouton « Voir la rencontre », aucun mot de JDR.
  it('conjonction-reminder : sujet interpolé, date · lieu, bouton « Voir la rencontre », corps neutre', async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-conjonction@example.com`;
    const link = 'https://example.com/g/abc.def';

    try {
      expect(
        await email.sendMail('conjonction-reminder', to, {
          eventTitle: "Catane d'automne",
          sessionDate: 'samedi 24 octobre (soir)',
          lieu: 'Chez Léa',
          link,
        }),
      ).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { Subject: string; HTML: string };
      expect(message.Subject).toBe("Demain : « Catane d'automne »");
      expect(message.HTML).toContain('samedi 24 octobre (soir) · Chez Léa');
      expect(message.HTML).toContain(`href="${link}"`);
      expect(message.HTML).toContain('>Voir la rencontre</a>');
      for (const mot of ['partie', 'MJ', 'grimoire', 'campagne', 'joueur', 'séance']) {
        expect(message.HTML).not.toContain(mot);
      }
    } finally {
      await app.close();
    }
  });

  // Story 40.4 : place réservée par l'hôte — sujet « <hôte> vous a réservé une place : « Titre » »,
  // bouton « Répondre » vers la page du groupe, aucun mot de JDR.
  it('conjonction-reservation : sujet interpolé, hôte et titre, bouton « Répondre », corps neutre', async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-reservation@example.com`;
    const link = 'https://example.com/g/abc.def';

    try {
      expect(
        await email.sendMail('conjonction-reservation', to, {
          hostName: 'Léa',
          eventTitle: "Catane d'automne",
          sessionDate: 'samedi 24 octobre (soir)',
          lieu: 'Chez Léa',
          link,
        }),
      ).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { Subject: string; HTML: string };
      expect(message.Subject).toBe("Léa vous a réservé une place : « Catane d'automne »");
      expect(message.HTML).toContain('samedi 24 octobre (soir) · Chez Léa');
      expect(message.HTML).toContain(`href="${link}"`);
      expect(message.HTML).toContain('>Répondre</a>');
      for (const mot of ['partie', 'MJ', 'grimoire', 'campagne', 'joueur', 'séance']) {
        expect(message.HTML).not.toContain(mot);
      }
    } finally {
      await app.close();
    }
  });

  // Story 40.6 : date fixée par l'hôte — sujet « C'est fixé : « Titre », <date> », date · lieu, bouton
  // « Voir la rencontre » vers la page du groupe, aucun mot de JDR.
  it('conjonction-date-fixee : sujet interpolé, date · lieu, bouton « Voir la rencontre », corps neutre', async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-date-fixee@example.com`;
    const link = 'https://example.com/g/abc.def';

    try {
      expect(
        await email.sendMail('conjonction-date-fixee', to, {
          eventTitle: "Catane d'automne",
          sessionDate: 'samedi 24 octobre (soir)',
          lieu: 'Chez Léa',
          link,
        }),
      ).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { Subject: string; HTML: string };
      expect(message.Subject).toBe("C'est fixé : « Catane d'automne », samedi 24 octobre (soir)");
      expect(message.HTML).toContain('samedi 24 octobre (soir) · Chez Léa');
      expect(message.HTML).toContain(`href="${link}"`);
      expect(message.HTML).toContain('>Voir la rencontre</a>');
      for (const mot of ['partie', 'MJ', 'grimoire', 'campagne', 'joueur', 'séance']) {
        expect(message.HTML).not.toContain(mot);
      }
    } finally {
      await app.close();
    }
  });

  // Story 42.1 : annulation d'une conjonction (e-mail n° 7) — sujet « Annulée : « Titre » », qui a annulé,
  // « Vous n'avez rien à faire. », bouton « Voir », aucun mot de JDR.
  it("conjonction-annulee : sujet interpolé, auteur de l'annulation, bouton « Voir », corps neutre", async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-annulee@example.com`;
    const link = 'https://example.com/g/abc.def';

    try {
      expect(
        await email.sendMail('conjonction-annulee', to, {
          eventTitle: "Catane d'automne",
          actorName: 'Léa',
          sessionDate: 'samedi 24 octobre (soir)',
          link,
        }),
      ).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { Subject: string; HTML: string };
      expect(message.Subject).toBe("Annulée : « Catane d'automne »");
      expect(message.HTML).toContain('Léa');
      expect(message.HTML).toContain('rien à faire');
      expect(message.HTML).toContain(`href="${link}"`);
      expect(message.HTML).toContain('>Voir</a>');
      for (const mot of ['partie', 'MJ', 'grimoire', 'campagne', 'joueur', 'séance']) {
        expect(message.HTML).not.toContain(mot);
      }
    } finally {
      await app.close();
    }
  });

  // Story 40.7 : relance de la veille de l'échéance — sujet « Plus qu'un jour pour voter : « Titre » », bouton
  // « Voter dans le calendrier » vers le calendrier du groupe, aucun mot de JDR.
  it('conjonction-relance : sujet interpolé, bouton « Voter dans le calendrier », corps neutre', async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-relance@example.com`;
    const link = 'https://example.com/g/abc.def/guild-calendar';

    try {
      expect(
        await email.sendMail('conjonction-relance', to, {
          eventTitle: "Catane d'automne",
          deadline: 'samedi 24 octobre',
          link,
        }),
      ).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { Subject: string; HTML: string };
      expect(message.Subject).toBe("Plus qu'un jour pour voter : « Catane d'automne »");
      expect(message.HTML).toContain(`href="${link}"`);
      expect(message.HTML).toContain('se termine le samedi 24 octobre.');
      expect(message.HTML).toContain('>Voter dans le calendrier</a>');
      for (const mot of ['partie', 'MJ', 'grimoire', 'campagne', 'joueur', 'séance']) {
        expect(message.HTML).not.toContain(mot);
      }
    } finally {
      await app.close();
    }
  });

  it("un e-mail sans action (mot de passe modifié) garde le pied « Dés Dispos » mais n'a pas de bouton", async () => {
    if (!reachable) return;

    const app = await NestFactory.createApplicationContext(TestAppModule, {
      logger: false,
    });
    const email = app.get(EmailService);
    const to = `integration-test-${Date.now()}-sans-bouton@example.com`;

    try {
      expect(await email.sendMail('password-changed', to, {})).toEqual({ ok: true });

      const searchRes = await fetch(
        `${MAILPIT_API}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
      );
      const search = (await searchRes.json()) as { messages: Array<{ ID: string }> };
      expect(search.messages.length).toBeGreaterThan(0);

      const messageRes = await fetch(`${MAILPIT_API}/api/v1/message/${search.messages[0].ID}`);
      const message = (await messageRes.json()) as { HTML: string };
      expect(message.HTML).toContain('Dés Dispos');
      expect(message.HTML).not.toContain('background:#2e7d5a');
    } finally {
      await app.close();
    }
  });
});
