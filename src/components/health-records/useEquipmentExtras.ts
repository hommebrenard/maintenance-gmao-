import React, { useEffect, useState } from 'react';
import type { EquipmentDocument, EquipmentPart, MaintenanceSchedule, ScheduleControl } from '../../types';
import { fetchEquipmentDocuments } from '../../lib/queries/equipmentDocuments';
import { fetchMaintenanceSchedules } from '../../lib/queries/maintenanceSchedules';
import { fetchEquipmentParts } from '../../lib/queries/equipmentParts';
import { fetchScheduleControls } from '../../lib/queries/scheduleControls';

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

function useLoader<T>(
  equipmentId: string | undefined,
  load: (id: string) => Promise<T[]>
): [ExtraState<T>, React.Dispatch<React.SetStateAction<ExtraState<T>>>] {
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
  return [state, setState];
}

/**
 * Échéances, pièces, documents et contrôles réalisés de l'équipement sélectionné.
 * Quatre chargements indépendants : l'échec de l'un n'empêche pas l'affichage des autres.
 */
export function useEquipmentExtras(equipmentId: string | undefined) {
  const [schedules, setSchedulesState] = useLoader<MaintenanceSchedule>(equipmentId, fetchMaintenanceSchedules);
  const [parts, setPartsState] = useLoader<EquipmentPart>(equipmentId, fetchEquipmentParts);
  const [documents, setDocumentsState] = useLoader<EquipmentDocument>(equipmentId, fetchEquipmentDocuments);
  const [controls, setControlsState] = useLoader<ScheduleControl>(equipmentId, fetchScheduleControls);
  // Mise à jour locale après une écriture réussie (évite un rechargement complet).
  const changeSchedules = (fn: (items: MaintenanceSchedule[]) => MaintenanceSchedule[]) =>
    setSchedulesState(prev => ({ ...prev, items: fn(prev.items) }));
  const changeParts = (fn: (items: EquipmentPart[]) => EquipmentPart[]) =>
    setPartsState(prev => ({ ...prev, items: fn(prev.items) }));
  const changeDocuments = (fn: (items: EquipmentDocument[]) => EquipmentDocument[]) =>
    setDocumentsState(prev => ({ ...prev, items: fn(prev.items) }));
  const changeControls = (fn: (items: ScheduleControl[]) => ScheduleControl[]) =>
    setControlsState(prev => ({ ...prev, items: fn(prev.items) }));
  return { schedules, parts, documents, controls, changeSchedules, changeParts, changeDocuments, changeControls };
}
