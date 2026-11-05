/**
 * Story 52.1 (AR AD-7) — l'outil que le calendrier a allumé, UN seul à la fois.
 *
 * - `lecture` : le calendrier tel qu'on l'ouvre (un tap lit, l'appui long ou le glissement ouvrent la sélection).
 * - `declaration` : le mode déclaration des dispos (allumé à partir de la Story 52.2).
 * - `composer` : la composition des créneaux d'un vote (Story 36.10).
 * - `destinee` : le mode Destinée, centré sur un vote (Story 36.9).
 *
 * Le nom `mode` désigne déjà, sur `calendar-view`, le calendrier personnel ou celui du MJ.
 */
export type CalendarInteraction = 'lecture' | 'declaration' | 'composer' | 'destinee';
