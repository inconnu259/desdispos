/**
 * Sous-titre d'une carte de choix (Story 31.4, DESIGN §7.1) : la première phrase d'un texte du
 * catalogue. Écrite UNE fois, partagée par les étapes classe et type.
 *
 * Une fin de phrase est un `.`/`!`/`?`/`…` suivi d'une majuscule ou de la fin du texte — « etc. »
 * en milieu de phrase suivi d'une minuscule ne coupe donc pas. Le rendu borne de toute façon le
 * résultat à 2 lignes (`-webkit-line-clamp`), la coupe ici n'est qu'un premier filtre.
 *
 * `undefined` quand il n'y a pas de texte : la carte reste compacte (« pas de texte ⇒ pas de
 * ligne »), jamais un sous-titre vide ni un texte de remplacement.
 */
export function firstSentence(text: string | undefined): string | undefined {
  const flat = text?.replace(/\s+/g, ' ').trim();
  if (!flat) return undefined;
  const match = flat.match(/^.*?[.!?…](?=\s+[A-ZÀ-ÝŒ]|$)/);
  return match?.[0] ?? flat;
}
