/**
 * Recherche multiple d'OT : permet de coller plusieurs codes d'un coup.
 * - Codes seuls séparés par espace, virgule, point-virgule, retour à la ligne, ou même collés
 *   (« OT-85901 OT-85866 », « 85901,85866 », « OT-85901OT-85866 ») → recherche « l'un OU l'autre ».
 * - Plusieurs termes séparés par virgule, point-virgule ou retour à la ligne → « l'un OU l'autre ».
 * - Sinon, la saisie reste un seul terme (« onduleur n2 » garde son comportement habituel).
 */
export function parseSearchGroups(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  if (/^(?:[\s,;]*(?:OT-?)?\d{3,}[\s,;]*)+$/i.test(s)) {
    const codes = s.match(/(?:OT-?)?\d{3,}/gi);
    if (codes && codes.length > 1) return codes.map(c => c.toLowerCase());
  }
  const parts = s.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts.map(p => p.toLowerCase()) : [s.toLowerCase()];
}
