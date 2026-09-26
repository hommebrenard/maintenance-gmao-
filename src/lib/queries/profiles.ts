import { supabase } from '../supabaseClient';
import type { Profile } from '../../types';

// ---------------------------------------------------------------------------
// Ajouté le 26/09/2026 — chantier « sélecteur d'assignation réel d'OT ».
// Lecture de la table `profiles` (policy `profiles_select_all_authenticated`,
// SELECT ouvert à tout compte authentifié, vérifié avant d'écrire ce fichier).
// Sert à peupler le sélecteur de technicien (WorkOrdersView) et à déterminer
// si l'utilisateur connecté est un manager (rôle 'responsable').
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
}

function rowToProfile(row: ProfileRow): Profile {
  return { id: row.id, fullName: row.full_name, role: row.role };
}

/** Récupère tous les profils (techniciens + responsables). */
export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, role');
  if (error) throw error;
  return ((data as ProfileRow[]) || []).map(rowToProfile);
}
