import type { GammePlan } from '../types';

// Import des gammes (12/11/2026) : fonctions pures, sans accès à la base.
// Contexte : l'import affichait « Importation réussie de N gamme(s) » avant l'écriture en base
// (N = lignes lues) et un échec d'écriture n'était visible que dans la console du navigateur.
// 359 OT du 24/10/2026 sont restés sans gamme sans que rien ne le signale.

export interface GammeSaveResult {
  /** Gammes lues dans le fichier, après retrait des couples en double. */
  total: number;
  /** Gammes réellement écrites (insérées, ou remplacées en mode « remplacer »). */
  written: GammePlan[];
  /** Mode « ajout seul » : couples (équipement, plan) déjà en base, laissés tels quels. */
  ignoredExisting: number;
  /** Couples (équipement, plan) présents plusieurs fois dans le fichier (retirés avant l'écriture). */
  duplicatesInFile: number;
  /** Parmi ces doublons, ceux dont les tâches diffèrent de l'occurrence retenue. */
  conflictingDuplicates: number;
  /** Gammes non tentées après une erreur (les lots suivants ne sont pas écrits). */
  notWritten: number;
  /** Message de la base si un lot a échoué. */
  error?: string;
}

const keyOf = (p: GammePlan) => `${p.equipmentCode}::${p.planCode}`;
const tasksSig = (p: GammePlan) => JSON.stringify((p.tasks || []).map(t => [t.actionCode, t.label]));

/**
 * Retire les couples (équipement, plan) répétés dans le fichier : la DERNIÈRE occurrence est
 * retenue (comme l'upsert par lots successifs). Un doublon dans un même lot est rejeté par
 * PostgreSQL (« cannot affect row a second time »), d'où ce retrait avant l'écriture.
 * Les clés sont comparées telles quelles (casse et espaces inclus), comme en base.
 */
export function dedupeGammePlans(plans: GammePlan[]): { plans: GammePlan[]; duplicates: number; conflicting: number } {
  const last = new Map<string, GammePlan>();
  const order: string[] = [];
  let duplicates = 0;
  let conflicting = 0;
  for (const p of plans) {
    const k = keyOf(p);
    const prev = last.get(k);
    if (prev) {
      duplicates += 1;
      if (tasksSig(prev) !== tasksSig(p)) conflicting += 1;
    } else {
      order.push(k);
    }
    last.set(k, p);
  }
  return { plans: order.map(k => last.get(k)!), duplicates, conflicting };
}

/** Texte affiché à l'utilisateur après l'écriture (nombres réellement enregistrés). */
export function describeGammeSave(r: GammeSaveResult, insertOnly: boolean): { ok: boolean; text: string } {
  const dup = r.duplicatesInFile > 0
    ? ` ${r.duplicatesInFile} doublon(s) (équipement, plan) dans le fichier retiré(s)${r.conflictingDuplicates > 0 ? `, dont ${r.conflictingDuplicates} avec des tâches différentes (la dernière occurrence est retenue)` : ''}.`
    : '';
  if (r.error) {
    return {
      ok: false,
      text: `⚠️ Écriture interrompue : ${r.written.length} gamme(s) enregistrée(s) sur ${r.total}, ${r.notWritten} non écrite(s). Erreur de la base : ${r.error}.${dup} Relancez l'import en mode « ajout seul » : les gammes déjà enregistrées seront ignorées.`
    };
  }
  if (r.written.length === 0 && r.total > 0) {
    return {
      ok: true,
      text: `Aucune gamme écrite : les ${r.total} couple(s) (équipement, plan) du fichier existent déjà en base${insertOnly ? ' (mode « ajout seul » : rien n\'a été remplacé)' : ''}.${dup}`
    };
  }
  const existing = insertOnly && r.ignoredExisting > 0
    ? ` ${r.ignoredExisting} couple(s) déjà en base laissé(s) tel(s) quel(s).`
    : '';
  return {
    ok: true,
    text: `✅ ${r.written.length} gamme(s) enregistrée(s) en base sur ${r.total} lue(s) dans le fichier.${existing}${dup}`
  };
}
