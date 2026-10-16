/**
 * Explique en une phrase pourquoi un enregistrement en base a échoué (session expirée, droits,
 * réseau, ligne introuvable…), pour remplacer le message générique « connexion ou droits ».
 * Ne renvoie que du texte : aucune donnée sensible.
 */
export function explainSaveError(err: unknown): string {
  const e = (err ?? {}) as { message?: unknown; code?: unknown; status?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : undefined;
  const lower = message.toLowerCase();

  if (lower.includes('jwt expired') || lower.includes('invalid jwt') || status === 401) {
    return "Ta session a expiré : recharge la page (Ctrl+F5) et reconnecte-toi, puis recommence.";
  }
  if (code === '42501' || lower.includes('permission denied') || lower.includes('row-level security') || status === 403) {
    return "Ton compte n'a pas le droit d'effectuer cette modification.";
  }
  if (code === 'PGRST116' || lower.includes('0 rows') || lower.includes('no rows')) {
    return "Aucune ligne n'a été modifiée (droits insuffisants ou élément supprimé). Recharge la page puis réessaie.";
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed') || lower.includes('load failed')) {
    return "Connexion impossible avec le serveur : vérifie ta connexion internet puis recommence.";
  }
  return "Cause inconnue : recharge la page puis réessaie ; si cela se reproduit, ouvre la console (F12) et note l'erreur affichée en rouge.";
}
