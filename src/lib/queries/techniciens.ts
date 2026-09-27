import { supabase } from '../supabaseClient';
import type { Technicien } from '../../types';

// ---------------------------------------------------------------------------
// Table `techniciens` (créée le 27/09/2026, chantier B — voir prompt de
// reflexion intervenants vs comptes). Distincte de `profiles` : un technicien
// de terrain réel, pas forcément rattaché à un compte de connexion.
// RLS : lecture ouverte à tout authentifié (techniciens_select_all_authenticated),
// création/modification réservées à is_manager() (techniciens_insert_manager_only,
// techniciens_update_manager_only) — rôle 'responsable' utilisé comme test en
// attendant un rôle admin dédié. Pas de suppression (on désactive : actif=false).
// ---------------------------------------------------------------------------

interface TechnicienRow {
  id: string;
  nom: string;
  zone: string;
  actif: boolean;
  profile_id: string | null;
}

function rowToTechnicien(row: TechnicienRow): Technicien {
  return {
    id: row.id,
    nom: row.nom,
    zone: row.zone as Technicien['zone'],
    actif: row.actif,
    profileId: row.profile_id,
  };
}

/** Récupère tous les techniciens (actifs et inactifs), triés par nom. */
export async function fetchTechniciens(): Promise<Technicien[]> {
  const { data, error } = await supabase
    .from('techniciens')
    .select('id, nom, zone, actif, profile_id')
    .order('nom', { ascending: true });
  if (error) throw error;
  return ((data as TechnicienRow[]) || []).map(rowToTechnicien);
}

/** Crée un technicien. Réservé aux managers (bloqué par la RLS sinon). */
export async function createTechnicien(input: {
  nom: string;
  zone: Technicien['zone'];
  actif?: boolean;
  profileId?: string | null;
}): Promise<Technicien> {
  const { data, error } = await supabase
    .from('techniciens')
    .insert({
      nom: input.nom,
      zone: input.zone,
      actif: input.actif ?? true,
      profile_id: input.profileId ?? null,
    })
    .select('id, nom, zone, actif, profile_id')
    .single();
  if (error) throw error;
  return rowToTechnicien(data as TechnicienRow);
}

/** Modifie un technicien (nom, zone, actif, rattachement). Réservé aux managers. */
export async function updateTechnicien(
  id: string,
  patch: Partial<{ nom: string; zone: Technicien['zone']; actif: boolean; profileId: string | null }>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.nom !== undefined) row.nom = patch.nom;
  if (patch.zone !== undefined) row.zone = patch.zone;
  if (patch.actif !== undefined) row.actif = patch.actif;
  if (patch.profileId !== undefined) row.profile_id = patch.profileId;
  row.updated_at = new Date().toISOString();

  const { error } = await supabase.from('techniciens').update(row).eq('id', id);
  if (error) throw error;
}
