import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { MailerModule, type MailerOptions } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import type { MailDefaults } from 'nodemailer/lib/mailer';
import { EmailService } from './email.service';
import { mailRequireTls } from '../config/env';

// Lit et valide MAIL_HOST/MAIL_PORT/MAIL_FROM au démarrage : une config email cassée doit
// empêcher l'app de démarrer plutôt que d'échouer silencieusement au premier envoi (le
// catch-all d'EmailService masquerait sinon l'erreur réelle derrière un simple { ok: false }).
function readMailConfig() {
  const host = process.env.MAIL_HOST;
  const from = process.env.MAIL_FROM;
  const port = Number(process.env.MAIL_PORT);
  if (!host) throw new Error('MAIL_HOST est requis (variable manquante ou vide)');
  if (!from) throw new Error('MAIL_FROM est requis (variable manquante ou vide)');
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`MAIL_PORT invalide : "${process.env.MAIL_PORT}"`);
  }
  return { host, from, port };
}

// Transport lu directement via process.env (pas de ConfigModule dans ce projet, cf. main.ts/prisma.service.ts).
// Dev/test : MAIL_HOST=mailpit (docker-compose). Prod : mêmes clés pointant vers Brevo — aucun changement de code.
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: () => {
        const { host, from, port } = readMailConfig();
        // Valeurs par défaut des messages, typées par nodemailer 10 (`MailDefaults`). Le mailer
        // (@nestjs-modules/mailer) type encore `defaults` comme des options de TRANSPORT, selon le
        // découpage de @types/nodemailer 8 où les deux étaient fusionnés : décalage de types seulement,
        // nodemailer reçoit ces défauts à l'exécution exactement comme avant.
        const defaults: MailDefaults = { from };
        return {
          transport: {
            host,
            port,
            secure: false,
            // STARTTLS exigé en production (sinon nodemailer retombe en clair si le serveur ne le propose
            // pas, identifiants SMTP compris) ; désactivé en dev, Mailpit ne parle pas TLS.
            requireTLS: mailRequireTls(),
            // undefined (pas `{ user: '', pass: '' }`) : Nodemailer tenterait un AUTH LOGIN avec des
            // identifiants vides sinon. Mailpit n'exige aucune authentification. Les deux variables
            // doivent être renseignées ensemble (un user sans password est une config incomplète).
            auth:
              process.env.MAIL_USER && process.env.MAIL_PASSWORD
                ? {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASSWORD,
                  }
                : undefined,
          },
          defaults: defaults as MailerOptions['defaults'],
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
          },
          // `options.layout` (racine, pas `template.options`) : lu par HandlebarsAdapter.compile() pour
          // envelopper chaque gabarit dans templates/layout.hbs (gabarit visuel neutre unique, cf. Non-Goals PRD).
          options: {
            layout: 'layout',
          },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
