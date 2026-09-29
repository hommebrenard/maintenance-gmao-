import { useEffect, useState } from 'react';
import type { EquipmentDocument, EquipmentPart, MaintenanceSchedule } from '../../types';
import { fetchEquipmentDocuments } from '../../lib/queries/equipmentDocuments';
import { fetchMaintenanceSchedules } from '../../lib/queries/maintenanceSchedules';
import { fetchEquipmentParts } from '../../lib/queries/equipmentParts';

export interface ExtraState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

const loadingState = <T,>(): ExtraState<T> => ({ items: [], loading: true, error: null });

/** Les erreurs Supabase sont parfois des objets simples (pas des Error) : on récupère `message` dans les deux cas. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'Erreur de chargement';
}

function useLoader<T>(equipmentId: string | undefined, load: (id: string) => Promise<T[]>): ExtraState<T> {
  const [state, setState] = useState<ExtraState<T>>(loadingState<T>);
  useEffect(() => {
    if (!equipmentId) return;
    let cancelled = false;
    // Repart de zéro à chaque équipement : jamais les données du précédent à l'écran.
    setState(loadingState<T>());
    load(equipmentId)
      .then(items => {
        if (!cancelled) setState({ items, loading: false, error: null });
      })
      .catch(err => {
        if (!cancelled) setState({ items: [], loading: false, error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
    // `load` est une fonction de module stable : seul l'équipement déclenche un rechargement.
  }, [equipmentId]);
  return state;
}

/**
 * Échéances, pièces et documents de l'équipement sélectionné (tables de la Phase 2).
 * Trois chargements indépendants : l'échec de l'un n'empêche pas l'affichage des autres.
 */
export function useEquipmentExtras(equipmentId: string | undefined) {
  const schedules = useLoader<MaintenanceSchedule>(equipmentId, fetchMaintenanceSchedules);
  const parts = useLoader<EquipmentPart>(equipmentId, fetchEquipmentParts);
  const documents = useLoader<EquipmentDocument>(equipmentId, fetchEquipmentDocuments);
  return { schedules, parts, documents };
}
