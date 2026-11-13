import type { GammePlan } from '../types';

// Contrôle des codes équipement d'un fichier de gammes AVANT écriture (13/11/2026, lot 1).
// Contexte : 92 gammes de la base portaient un code équipement qui n'existe pas (codes coupés de 1 à 3
// caractères, ex. « …-ECLIN-0 » pour « …-ECLIN-02 »). Plusieurs équipements tombaient sur la même clé et
// la déduplication n'en gardait qu'un.
//
// Règles (décidées avec l'utilisateur) :
// - fonctions pures : aucun accès à la base, aucune date, aucun fuseau horaire ;
// - le préfixe et le score de description servent à PROPOSER des candidats, jamais à affecter ;
// - le code du fichier n'est jamais modifié ici ;
// - « aucun candidat par préfixe » ne prouve pas que l'équipement n'existe pas (un code coupé au milieu
//   ou mal formé n'est pas retrouvé par un préfixe).

export interface EquipmentRef {
  code: string;
  name: string;
}

export type GammeCodeStatus =
  | 'exact' // le code existe tel quel (casse comprise)
  | 'casse_seule' // existe seulement avec une autre casse (ou des espaces parasites) : à confirmer
  | 'prefixe_unique' // un seul code de la base commence par le code reçu
  | 'prefixe_multiple' // plusieurs codes de la base commencent par le code reçu
  | 'sans_candidat'; // aucun code de la base ne commence par le code reçu

export interface GammeCodeCandidate {
  code: string;
  name: string;
  /** Ressemblance description du fichier / nom de l'équipement, entre 0 et 1. Sert au tri uniquement. */
  score: number;
}

export interface GammeCodeDiagnosis {
  plan: GammePlan;
  /** Position du plan dans la liste analysée. */
  index: number;
  status: GammeCodeStatus;
  /** Au plus MAX_CANDIDATES, triés par score décroissant puis par code. Vide pour « exact » et « sans_candidat ». */
  candidates: GammeCodeCandidate[];
  /** Nombre total de candidats (peut dépasser candidates.length). */
  candidateCount: number;
  /** Vrai si deux candidats ou plus ont un score identique ou presque (écart < 0,03) en tête de liste. */
  ambiguousTop: boolean;
}

export interface GammeCodeCounts {
  exact: number;
  casse_seule: number;
  prefixe_unique: number;
  prefixe_multiple: number;
  sans_candidat: number;
  /** Titres de gamme sans aucune action (information, non bloquant dans ce lot). */
  sansAction: number;
}

export interface GammeCodeReport {
  rows: GammeCodeDiagnosis[];
  counts: GammeCodeCounts;
}

export const MAX_CANDIDATES = 12;
/** Longueur minimale d'un code pour chercher un préfixe : en dessous, tout candidat serait arbitraire. */
export const MIN_PREFIX_LENGTH = 5;
const TIE_GAP = 0.03;
const DISCRIMINANT_PENALTY = 0.35;

/** Pour comparer un code : retire espaces et caractères invisibles aux extrémités et à l'intérieur, passe en majuscules. */
export function normalizeCodeForSearch(code: string): string {
  return (code || '').replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]+/g, '').toUpperCase();
}

/** Pour comparer des descriptions : sans accents, minuscules, ponctuation en espaces. Chiffres et lettres isolées conservés. */
export function normalizeDescription(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const tokensOf = (text: string): string[] => {
  const n = normalizeDescription(text);
  return n ? n.split(' ') : [];
};

// Un jeton « discriminant » contient un chiffre ou n'a qu'une lettre (bloc A / bloc B, N1 / N2, 24V / 230V).
const isDiscriminant = (t: string) => /\d/.test(t) || t.length === 1;

/**
 * Ressemblance de deux descriptions, entre 0 et 1 : coefficient de Dice sur les mots, diminué de 0,35 quand
 * les deux descriptions portent des marqueurs différents (chiffres, lettres isolées). Une description vide
 * donne 0. Valeur de tri, jamais une preuve ni un seuil d'affectation.
 */
export function descriptionScore(a: string, b: string): number {
  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let common = 0;
  sa.forEach(t => { if (sb.has(t)) common += 1; });
  let score = (2 * common) / (sa.size + sb.size);
  const da = [...sa].filter(isDiscriminant).sort().join('|');
  const db = [...sb].filter(isDiscriminant).sort().join('|');
  if (da && db && da !== db) score -= DISCRIMINANT_PENALTY;
  return Math.max(0, Math.min(1, score));
}

function rankCandidates(plan: GammePlan, equipments: EquipmentRef[]): { list: GammeCodeCandidate[]; ambiguousTop: boolean } {
  const desc = plan.equipmentDescription || '';
  const all = equipments
    .map(e => ({ code: e.code, name: e.name, score: descriptionScore(desc, e.name) }))
    .sort((x, y) => (y.score - x.score) || x.code.localeCompare(y.code));
  const ambiguousTop = all.length >= 2 && all[0].score - all[1].score < TIE_GAP;
  return { list: all.slice(0, MAX_CANDIDATES), ambiguousTop };
}

/**
 * Diagnostique le code équipement de chaque gamme par rapport aux équipements de la base.
 * Ne modifie ni les gammes ni la liste d'équipements.
 */
export function analyzeGammeCodes(plans: GammePlan[], equipments: EquipmentRef[]): GammeCodeReport {
  const exactCodes = new Set(equipments.map(e => e.code));
  // Index de recherche construit une seule fois (code normalisé -> équipement), pour les codes absents seulement.
  let searchIndex: { norm: string; eq: EquipmentRef }[] | null = null;
  const index = () => {
    if (!searchIndex) searchIndex = equipments.map(eq => ({ norm: normalizeCodeForSearch(eq.code), eq }));
    return searchIndex;
  };

  const counts: GammeCodeCounts = { exact: 0, casse_seule: 0, prefixe_unique: 0, prefixe_multiple: 0, sans_candidat: 0, sansAction: 0 };
  const rows: GammeCodeDiagnosis[] = plans.map((plan, i) => {
    if ((plan.tasks || []).length === 0) counts.sansAction += 1;
    const code = plan.equipmentCode || '';

    if (exactCodes.has(code)) {
      counts.exact += 1;
      return { plan, index: i, status: 'exact', candidates: [], candidateCount: 0, ambiguousTop: false };
    }

    const norm = normalizeCodeForSearch(code);
    if (norm.length > 0) {
      const sameCode = index().filter(x => x.norm === norm).map(x => x.eq);
      if (sameCode.length > 0) {
        const { list, ambiguousTop } = rankCandidates(plan, sameCode);
        counts.casse_seule += 1;
        return { plan, index: i, status: 'casse_seule', candidates: list, candidateCount: sameCode.length, ambiguousTop };
      }
    }

    if (norm.length >= MIN_PREFIX_LENGTH) {
      const prefixed = index().filter(x => x.norm.length > norm.length && x.norm.startsWith(norm)).map(x => x.eq);
      if (prefixed.length > 0) {
        const { list, ambiguousTop } = rankCandidates(plan, prefixed);
        const status: GammeCodeStatus = prefixed.length === 1 ? 'prefixe_unique' : 'prefixe_multiple';
        counts[status] += 1;
        return { plan, index: i, status, candidates: list, candidateCount: prefixed.length, ambiguousTop };
      }
    }

    counts.sans_candidat += 1;
    return { plan, index: i, status: 'sans_candidat', candidates: [], candidateCount: 0, ambiguousTop: false };
  });

  return { rows, counts };
}

export interface WritableSplit {
  /** Gammes à écrire (code exact), dans l'ordre du fichier. */
  writable: GammePlan[];
  /** Gammes NON écrites, avec leur diagnostic. */
  excluded: GammeCodeDiagnosis[];
}

/**
 * Sépare ce qui peut être écrit de ce qui ne l'est pas.
 * - « exact » : écrit.
 * - « sans_candidat » : écrit seulement si l'utilisateur l'a demandé (équipement pas encore importé).
 * - « casse_seule », « prefixe_unique », « prefixe_multiple » : jamais écrit dans ce lot (code probablement coupé
 *   ou mal saisi) ; le code du fichier n'est jamais remplacé automatiquement.
 */
export function splitWritable(report: GammeCodeReport, options: { includeNoCandidate: boolean }): WritableSplit {
  const writable: GammePlan[] = [];
  const excluded: GammeCodeDiagnosis[] = [];
  for (const row of report.rows) {
    if (row.status === 'exact' || (row.status === 'sans_candidat' && options.includeNoCandidate)) {
      writable.push(row.plan);
    } else {
      excluded.push(row);
    }
  }
  return { writable, excluded };
}

export const GAMME_CODE_STATUS_LABEL: Record<GammeCodeStatus, string> = {
  exact: 'Code existant',
  casse_seule: 'Casse ou espaces différents',
  prefixe_unique: 'Code incomplet : 1 candidat',
  prefixe_multiple: 'Code incomplet : plusieurs candidats',
  sans_candidat: 'Code absent, aucun candidat par préfixe'
};

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** CSV (séparateur « ; ») des gammes non écrites, pour corriger le fichier source. */
export function excludedToCsv(excluded: GammeCodeDiagnosis[]): string {
  const header = ['code_fichier', 'plan', 'titre', 'description_equipement', 'nb_actions', 'diagnostic', 'nb_candidats', 'candidats_meilleurs'];
  const lines = excluded.map(r => [
    r.plan.equipmentCode,
    r.plan.planCode,
    r.plan.interventionTitle,
    r.plan.equipmentDescription || '',
    (r.plan.tasks || []).length,
    GAMME_CODE_STATUS_LABEL[r.status],
    r.candidateCount,
    r.candidates.slice(0, 3).map(c => `${c.code} (${Math.round(c.score * 100)} %)`).join(' | ')
  ].map(csvCell).join(';'));
  return [header.map(csvCell).join(';'), ...lines].join('\r\n');
}
