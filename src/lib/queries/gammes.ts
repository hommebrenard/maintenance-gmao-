import { supabase } from '../supabaseClient';
import type { GammePlan } from '../../types';
import { dedupeGammePlans, type GammeSaveResult } from '../../utils/gammeImport';

// ---------------------------------------------------------------------------
// Migration du 14/09/2026 : la Gamme (référentiel des plans de maintenance
// préventive) vivait jusqu'ici UNIQUEMENT dans le localStorage du navigateur
// (clé `gmao_gammesList`), contrairement aux OT/équipements/sites déjà en
// Supabase. Deux incidents concrets ont motivé cette migration :
// 1) `localStorage` est partagé par DOMAINE entier (`hommebrenard.github.io`),
//    pas par dépôt/dossier — un autre onglet ouvert sur une autre version de
//    l'app (voire l'ancienne app HTML) peut écraser silencieusement la
//    gamme fraîchement chargée par un autre onglet.
// 2) Rien n'était partagé entre postes/navigateurs, donc aucune garantie que
//    la gamme d'un site reste disponible pour tout le monde après import.
//
// Table `gamme_plans` : id (uuid), equipment_code (text), plan_code (text),
// intervention_title (text), equipment_description (text, nullable),
// tasks (jsonb — tableau de {id, actionCode, label}), created_at.
// Contrainte unique (equipment_code, plan_code) : un ré-import de la même
// gamme met à jour le plan existant au lieu de le dupliquer indéfiniment
// (contrairement à l'ancien comportement localStorage qui empilait sans fin).
// ---------------------------------------------------------------------------

interface GammePlanRow {
  id: string;
  equipment_code: string;
  plan_code: string;
  intervention_title: string;
  equipment_description: string | null;
  tasks: { id: string; actionCode: string; label: string }[];
  created_at: string;
}

function rowToGammePlan(row: GammePlanRow): GammePlan {
  return {
    id: row.id,
    equipmentCode: row.equipment_code,
    planCode: row.plan_code,
    interventionTitle: row.intervention_title,
    equipmentDescription: row.equipment_description ?? undefined,
    tasks: row.tasks || []
  };
}

export async function fetchGammePlans(): Promise<GammePlan[]> {
  // Pagination par lots de 1000 (plafond Supabase par requête). Sans elle, au-delà du 1000e plan, les plans
  // manquaient silencieusement et des OT tombaient à tort en « à vérifier » / « sans gamme ». Tri secondaire
  // sur `id` pour garder un ordre stable d'une page à l'autre (created_at identique pour un import en lot).
  const PAGE_SIZE = 1000;
  const allRows: GammePlanRow[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('gamme_plans')
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = (data as GammePlanRow[]) || [];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;
    page += 1;
  }

  return allRows.map(rowToGammePlan);
}

// Écriture par lots de 200 (même précaution que fetchExistingWorkOrderCodes).
// Corrigé le 12/11/2026 : l'ancienne version levait l'erreur vers un `.catch` qui ne faisait qu'un
// console.error, alors que l'écran avait déjà affiché « Importation réussie ». On retourne maintenant
// le bilan réel (gammes écrites, ignorées, non écrites, erreur de la base).
//  - insertOnly = true  : `ignoreDuplicates` (ON CONFLICT DO NOTHING) — les couples (equipment_code,
//    plan_code) déjà en base ne sont PAS modifiés ; seuls les couples absents sont ajoutés.
//  - insertOnly = false : upsert — les tâches des couples existants sont remplacées.
// Les couples en double dans le fichier sont retirés avant l'écriture (voir dedupeGammePlans).
// Une erreur sur un lot arrête les lots suivants ; les lots déjà écrits sont comptés.
export async function saveGammePlans(
  plans: GammePlan[],
  options: { insertOnly: boolean }
): Promise<GammeSaveResult> {
  const deduped = dedupeGammePlans(plans);
  const result: GammeSaveResult = {
    total: deduped.plans.length,
    written: [],
    ignoredExisting: 0,
    duplicatesInFile: deduped.duplicates,
    conflictingDuplicates: deduped.conflicting,
    notWritten: 0
  };
  if (deduped.plans.length === 0) return result;

  const rows = deduped.plans.map(p => ({
    equipment_code: p.equipmentCode,
    plan_code: p.planCode,
    intervention_title: p.interventionTitle,
    equipment_description: p.equipmentDescription ?? null,
    tasks: p.tasks
  }));

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { data, error } = await supabase
      .from('gamme_plans')
      .upsert(batch, { onConflict: 'equipment_code,plan_code', ignoreDuplicates: options.insertOnly })
      .select('*');
    if (error) {
      result.error = error.message || String(error);
      result.notWritten = rows.length - i;
      return result;
    }
    const saved = ((data as GammePlanRow[]) || []).map(rowToGammePlan);
    result.written.push(...saved);
    if (options.insertOnly) result.ignoredExisting += batch.length - saved.length;
  }
  return result;
}
