/**
 * Mots interdits hors JDR (UX-DR17, Story 38.4) : « MJ », « campagne », « scénario », « séance »,
 * « joueur » — plus « quête », mot de la famille JDR. Partagé par les specs du registre de textes
 * et de la page d'un ralliement, pour qu'ils ne divergent jamais. Sans drapeau `g` : réutilisable
 * en toute sécurité par `.test()`.
 */
export const NON_JDR_BANNED_WORDS =
  /(^|[^\p{L}])(MJ|campagnes?|sc[ée]narios?|s[ée]ances?|joueurs?|qu[êe]tes?)(?![\p{L}])/iu;
