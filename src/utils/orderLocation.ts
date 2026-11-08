// Rattachement d'un OT importé à son emplacement, d'après le code Zone Coswin (`entity`).
// Fonctions pures (sans Supabase ni React) pour pouvoir les tester.
//
// Pourquoi : Coswin écrit parfois la Zone avec un tiret (BAM-CAS_ST) alors que la table des
// emplacements a un tiret bas (BAM_CAS_ST). L'ancienne comparaison exacte ne trouvait rien et
// l'OT était créé sans emplacement (`location_id` NULL).

/** Code Zone comparable : sans espaces autour ni doublés, sans accents, majuscules, tiret = tiret bas. */
export function normalizeZoneCode(s?: string | null): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/-/g, '_');
}

/**
 * Prépare la recherche une seule fois par import. Si deux emplacements différents donnent le
 * même code une fois normalisé, ce code est AMBIGU : il n'est jamais deviné (résultat undefined).
 */
export function makeOrderLocationResolver(
  codeToId: Map<string, string>
): (entity?: string | null) => string | undefined {
  const index = new Map<string, string | null>();
  codeToId.forEach((id, code) => {
    const key = normalizeZoneCode(code);
    if (!key) return;
    if (!index.has(key)) index.set(key, id);
    else if (index.get(key) !== id) index.set(key, null);
  });
  return (entity) => {
    const key = normalizeZoneCode(entity);
    if (!key) return undefined;
    return index.get(key) ?? undefined;
  };
}

/** Version directe, pour un seul code. */
export function resolveOrderLocationId(
  entity: string | undefined | null,
  codeToId: Map<string, string>
): string | undefined {
  return makeOrderLocationResolver(codeToId)(entity);
}
