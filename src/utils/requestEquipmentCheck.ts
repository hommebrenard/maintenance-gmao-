import { norm } from './importRequests';

/**
 * Contrôle préalable à l'import des DI Coswin : repère les DI dont l'équipement indiqué par Coswin ne correspond pas à leur
 * description (ex. « ONDULEUR N3 » rattaché à « ENSEMBLE APPAREILLAGES ELECTRIQUES 1ER ETAGE »). Aucune affectation automatique :
 * le contrôle propose, l'utilisateur décide ligne par ligne avant toute écriture en base.
 */

export interface EquipmentLite { id: string; code: string; name: string; locationId?: string }
export interface EquipmentSuggestion { id: string; code: string; name: string; score: number }
export interface EquipmentSuspect {
  requestCode: string;
  title: string;
  assigned: { id: string; code: string; name: string };
  assignedScore: number;
  suggestions: EquipmentSuggestion[]; // 1 à 3, la meilleure d'abord
  powerNote?: string; // puissance de la DI ≠ puissance de l'équipement proposé
}
export interface CheckableRow { code: string; title: string; equipment_id: string | null; location_id: string | null }

/** Écart de score minimal entre la meilleure proposition et l'équipement de Coswin pour signaler une DI. */
export const SUSPECT_MARGIN = 2;

const STOP = new Set([
  'besoin', 'entretien', 'entrtien', 'preventif', 'preventive', 'curatif', 'pour', 'mois', 'niveau', 'marque', 'puissance', 'remplacement',
  'depoussierage', 'intervention', 'les', 'des', 'aux', 'avec', 'sans', 'sur', 'type', 'bureau', 'janvier', 'fevrier', 'mars', 'avril',
  'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]);

/** Mots significatifs d'un libellé : sans accents, sans mots-outils, « N05 » = « N5 », sans nombres seuls. */
export function significantTokens(text: string): string[] {
  const out = new Set<string>();
  // « 1.4KW » et « 1.4 KW » doivent donner le même mot.
  for (const raw of norm(text.replace(/(\d)\s+(kva|kw)\b/gi, '$1$2')).split(' ')) {
    if (!raw || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    const t = raw.replace(/^n0+(\d)/, 'n$1');
    if (t.length <= 2 && !/\d/.test(t)) continue;
    if (STOP.has(t)) continue;
    out.add(t);
  }
  return [...out];
}

function lev1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

const power = (s: string): { value: number; unit: string } | null => {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(kva|kw)\b/i);
  return m ? { value: parseFloat(m[1].replace(',', '.')), unit: m[2].toUpperCase() } : null;
};

export function findSuspectEquipment(rows: CheckableRow[], equipment: EquipmentLite[]): EquipmentSuspect[] {
  const byId = new Map(equipment.map(e => [e.id, e]));
  const byLocation = new Map<string, { eq: EquipmentLite; tokens: Set<string> }[]>();
  for (const e of equipment) {
    if (!e.locationId) continue;
    const list = byLocation.get(e.locationId) ?? [];
    list.push({ eq: e, tokens: new Set(significantTokens(e.name)) });
    byLocation.set(e.locationId, list);
  }
  const idf = new Map<string, Map<string, number>>();
  const weights = (loc: string) => {
    let w = idf.get(loc);
    if (!w) {
      const list = byLocation.get(loc) ?? [];
      const df = new Map<string, number>();
      for (const c of list) for (const t of c.tokens) df.set(t, (df.get(t) ?? 0) + 1);
      w = new Map([...df].map(([t, n]) => [t, Math.log(1 + list.length / n) * (/^n\d+$/.test(t) ? 1.5 : 1)]));
      idf.set(loc, w);
    }
    return w;
  };

  const suspects: EquipmentSuspect[] = [];
  for (const row of rows) {
    const assigned = row.equipment_id ? byId.get(row.equipment_id) : undefined;
    const loc = assigned?.locationId ?? row.location_id ?? undefined;
    if (!assigned || !loc) continue;
    const candidates = byLocation.get(loc) ?? [];
    const w = weights(loc);
    const titleTokens = significantTokens(row.title);
    const scoreOf = (c: { tokens: Set<string> }): { score: number; hits: number; strong: boolean } => {
      let score = 0, hits = 0, strong = false;
      for (const t of titleTokens) {
        let wt = 0;
        if (c.tokens.has(t)) wt = w.get(t) ?? 0;
        else if (t.length >= 5) for (const u of c.tokens) if (u.length >= 5 && lev1(t, u)) { wt = w.get(u) ?? 0; break; }
        if (wt > 0) { score += wt; hits++; if (!/^n\d+$/.test(t)) strong = true; }
      }
      return { score, hits, strong };
    };
    const scored = candidates.map(c => ({ eq: c.eq, ...scoreOf(c) })).sort((a, b) => b.score - a.score || a.eq.code.localeCompare(b.eq.code));
    const assignedScore = scored.find(s => s.eq.id === assigned.id)?.score ?? 0;
    const best = scored[0];
    if (!best || best.eq.id === assigned.id || best.hits < 2 || !best.strong || best.score - assignedScore < SUSPECT_MARGIN) continue;
    const suggestions = scored
      .filter(s => s.eq.id !== assigned.id && s.score >= best.score * 0.6 && s.hits >= 2 && s.strong)
      .slice(0, 3)
      .map(s => ({ id: s.eq.id, code: s.eq.code, name: s.eq.name, score: Math.round(s.score * 10) / 10 }));
    const dp = power(row.title), ep = power(best.eq.name);
    const powerNote = dp && ep && dp.unit === ep.unit && dp.value !== ep.value
      ? `La DI indique ${dp.value} ${dp.unit}, l'équipement proposé est de ${ep.value} ${ep.unit} : vérifier le numéro dans la description.` : undefined;
    suspects.push({
      requestCode: row.code, title: row.title, assigned: { id: assigned.id, code: assigned.code, name: assigned.name },
      assignedScore: Math.round(assignedScore * 10) / 10, suggestions, powerNote,
    });
  }
  return suspects;
}
