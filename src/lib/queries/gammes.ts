import { supabase } from '../supabaseClient';
import type { GammePlan } from '../../types';

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
  const { data, error } = await supabase
    .from('gamme_plans')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as GammePlanRow[]).map(rowToGammePlan);
}

// Upsert par lots de 200 (même précaution que fetchExistingWorkOrderCodes) :
// on ne réécrit jamais un plan qui n'a pas changé, mais on remplace celui
// dont (equipment_code, plan_code) existe déjà, au lieu de le dupliquer.
export async function createGammePlansBulk(plans: GammePlan[]): Promise<GammePlan[]> {
  if (plans.length === 0) return [];

  const rows = plans.map(p => ({
    equipment_code: p.equipmentCode,
    plan_code: p.planCode,
    intervention_title: p.interventionTitle,
    equipment_description: p.equipmentDescription ?? null,
    tasks: p.tasks
  }));

  const results: GammePlan[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { data, error } = await supabase
      .from('gamme_plans')
      .upsert(batch, { onConflict: 'equipment_code,plan_code' })
      .select('*');
    if (error) throw error;
    results.push(...(data as GammePlanRow[]).map(rowToGammePlan));
  }
  return results;
}
