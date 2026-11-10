/** Message de refus du serveur (texte français, ou liste de messages de validation), sinon le
 *  libellé de repli du thème (réseau, réponse sans texte). Partagé par la création et la
 *  modification d'une conjonction (Stories 40.1 et 40.2). */
export function refusalMessage(error: unknown, fallback: string): string {
  const message = (error as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const texts = message.filter((m): m is string => typeof m === 'string' && !!m.trim());
    if (texts.length > 0) return texts.join(' ');
  }
  return fallback;
}
