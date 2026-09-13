import { supabase } from '../supabaseClient';
import type { LocationItem } from '../../types';

// ---------------------------------------------------------------------------
// Basé sur le schéma RÉEL de `locations` (confirmé le 13/09/2026 via le
// Table Editor) : id, site_id (FK vers `sites`, jamais renseigné — la table
// `sites` est vide et inutilisée par l'app), parent_id (FK auto-référencée,
// hiérarchie non utilisée pour l'instant, toujours NULL), name, code, type,
// description, qr_code, created_at, updated_at. Pas de colonne `created_by`.
//
// Avant le 13/09/2026, `locations` ne contenait QUE les 3 sites déjà
// backfillés (Kénitra/Meknès/Fès) — ce n'était pas une liste maîtresse
// figée des ~30 sites, juste le sous-produit des imports passés. À partir
// du 13/09/2026, la vue "Emplacements" de l'app devient la façon officielle
// d'ajouter un site à cette liste (voir LocationsView.tsx), pour construire
// progressivement la vraie liste maîtresse et savoir lesquels sont chargés.
// ---------------------------------------------------------------------------

interface LocationRow {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  parent_id: string | null;
}

function rowToLocation(row: LocationRow, equipmentCount = 0): LocationItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    type: (row.type as LocationItem['type']) || 'Site',
    equipmentCount,
  };
}

/** Récupère tous les sites/emplacements (liste maîtresse). */
export async function fetchLocations(): Promise<LocationItem[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, code, type, parent_id')
    .order('name');

  if (error) throw error;
  return (data as LocationRow[]).map(row => rowToLocation(row));
}

/** Crée un nouveau site/emplacement (`name` obligatoire, `code` optionnel). */
export async function createLocation(loc: { name: string; code?: string; type?: string }): Promise<LocationItem> {
  const { data, error } = await supabase
    .from('locations')
    .insert({ name: loc.name, code: loc.code || null, type: loc.type || 'Site' })
    .select('id, name, code, type, parent_id')
    .single();

  if (error) throw error;
  return rowToLocation(data as LocationRow);
}

/** Met à jour un site/emplacement existant. */
export async function updateLocation(id: string, patch: { name?: string; code?: string; type?: string }): Promise<LocationItem> {
  const row: { name?: string; code?: string | null; type?: string } = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.code !== undefined) row.code = patch.code || null;
  if (patch.type !== undefined) row.type = patch.type;

  const { data, error } = await supabase
    .from('locations')
    .update(row)
    .eq('id', id)
    .select('id, name, code, type, parent_id')
    .single();

  if (error) throw error;
  return rowToLocation(data as LocationRow);
}

/** Supprime un site/emplacement. */
export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Retourne une correspondance code Zone -> id de `locations`, en ignorant les
 * lignes dont `code` est vide/NULL (sites pas encore configurés).
 */
export async function fetchLocationCodeMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, code')
    .not('code', 'is', null);

  if (error) throw error;

  const map = new Map<string, string>();
  (data as { id: string; code: string | null }[] | null || []).forEach(row => {
    if (row.code) map.set(row.code, row.id);
  });
  return map;
}
