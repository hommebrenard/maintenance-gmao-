import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { WorkOrdersView } from './components/views/WorkOrdersView';
import { RequestsView } from './components/views/RequestsView';
import { MessagesView } from './components/views/MessagesView';
import { ReportsView } from './components/views/ReportsView';
import { AutomationsView } from './components/views/AutomationsView';
import { MetersView } from './components/views/MetersView';
import { EquipmentView } from './components/views/EquipmentView';
import { HealthRecordsView } from './components/views/HealthRecordsView';
import { parseHealthRecordsHash } from './utils/deepLink';
import { InventoryView } from './components/views/InventoryView';
import { PreventiveView } from './components/views/PreventiveView';
import { TemplatesView } from './components/views/TemplatesView';
import { ProceduresView } from './components/views/ProceduresView';
import { TagsView } from './components/views/TagsView';
import { LocationsView } from './components/views/LocationsView';
import { UsersView } from './components/views/UsersView';
import { SuppliersView } from './components/views/SuppliersView';
import { ClientsView } from './components/views/ClientsView';
import { fetchEquipment, updateEquipment, createEquipment, createEquipmentBulk } from './lib/queries/equipment';
import { buildNewEquipmentsFromImport } from './utils/importEquipment';
import { fetchWorkOrders, updateWorkOrder, createWorkOrder, createWorkOrdersBulk, backfillWorkOrderIdentity } from './lib/queries/work_orders';
import { mergeWorkOrderWithLocalExtras, computeLocalBackfillPatch, computeIdentityBackfillPatch } from './utils/workOrderExtras';
import { fetchLocations, createLocation, updateLocation, deleteLocation, fetchLocationCodeMap } from './lib/queries/locations';


import {
  INITIAL_WORK_ORDERS,
  INITIAL_REQUESTS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_EQUIPMENT,
  INITIAL_INVENTORY,
  INITIAL_AUTOMATIONS,
  INITIAL_METERS,
  INITIAL_TEMPLATES,
  INITIAL_PROCEDURES,
  INITIAL_TAGS,
  INITIAL_USERS,
  INITIAL_SUPPLIERS,
  INITIAL_CLIENTS
} from './data/mockData';

import {
  NavigationItem,
  WorkOrder,
  MaintenanceRequest,
  Conversation,
  Message,
  Equipment,
  InventoryItem,
  AutomationRule,
  Meter,
  WorkOrderTemplate,
  Procedure,
  Tag,
  LocationItem,
  UserItem,
  SupplierItem,
  ClientItem,
  WorkOrderStatus,
  OperationalStatus,
  WorkOrderPatchCandidate,
  Profile
} from './types';
import { fetchProfiles } from './lib/queries/profiles';

// Helper for localStorage state persistence
function getInitialState<T extends { id: string }>(key: string, demoData: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      // Nettoyage automatique : si ce qui est enregistré correspond exactement (mêmes
      // identifiants) aux anciennes données de démonstration AI Studio jamais remplacées
      // par l'utilisateur, on les efface pour repartir sur une liste vide plutôt que de
      // les laisser traîner indéfiniment dans le navigateur.
      if (Array.isArray(parsed) && Array.isArray(demoData) && demoData.length > 0 && parsed.length > 0) {
        const demoIds = new Set(demoData.map(d => d.id));
        const isPureDemo = parsed.every((item: any) => item && demoIds.has(item.id));
        if (isPureDemo) {
          localStorage.removeItem(key);
          return [];
        }
      }
      return parsed;
    }
  } catch (e) {
    console.error(`Erreur chargement ${key} depuis localStorage:`, e);
  }
  return [];
}

// Stockage local pour les champs de WorkOrder pas encore gérés par Supabase.
// Depuis le 20/09/2026, checklist/intervenants/visa/dates-heures sont AUSSI en base,
// et depuis le 21/09/2026 interventionCode/planNumber/entity aussi (la base
// l'emporte, voir mergeWorkOrderWithLocalExtras) : la copie locale n'est gardée
// que comme filet de sécurité, à retirer dans un pas de nettoyage ultérieur.
// `planner` a été retiré de cette liste le 14/09/2026 : colonne Supabase dédiée
// désormais lue/écrite directement (voir lib/queries/work_orders.ts), donc plus
// besoin de le faire transiter par le localStorage du navigateur.
const WO_EXTRAS_KEY = 'gmao_workOrders_extras';
const WO_EXTRA_FIELDS = ['tasks', 'intervenantsLogs', 'visa', 'planNumber',
  'interventionCode', 'entity', 'startDate', 'startTime', 'endDate', 'endTime'] as const;

function loadWorkOrderExtras(): Record<string, Partial<WorkOrder>> {
  try {
    const raw = localStorage.getItem(WO_EXTRAS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

import type { Session } from '@supabase/supabase-js';
import { LogOut } from 'lucide-react';

interface AppProps {
  session: Session;
  onSignOut: () => void;
}

export default function App({ session, onSignOut }: AppProps) {
  // Support du lien profond depuis le QR code (format et règles : utils/deepLink.ts) :
  //   #health-records/<equipmentId>                  -> fiche du Carnet de santé
  //   #health-records/<equipmentId>/nouvelle-entree  -> idem, formulaire d'ajout déplié
  // Pas de React Router dans l'app : on lit le hash au chargement et à chaque
  // changement (un lien ouvert dans un onglet déjà chargé fonctionne aussi).
  // `key` change à chaque lien reçu pour que la vue le réapplique même si
  // l'équipement demandé est le même.
  const [deepLink, setDeepLink] = useState<{ equipmentId: string; openAddForm: boolean; key: number } | null>(() => {
    const parsed = parseHealthRecordsHash(window.location.hash);
    return parsed ? { ...parsed, key: 0 } : null;
  });
  const [currentTab, setCurrentTab] = useState<NavigationItem>(
    deepLink ? 'health-records' : 'work-orders'
  );
  // Tiroir mobile du menu (étape 2 bis, 25/09) : masqué par défaut sous `md`,
  // ouvert via le bouton ☰ ci-dessous ; ignoré à partir de `md` (menu toujours
  // visible, comme avant).
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHealthRecordsHash(window.location.hash);
      if (parsed) {
        setDeepLink(prev => ({ ...parsed, key: (prev?.key ?? 0) + 1 }));
        setCurrentTab('health-records');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // App Centralized State with localStorage persistence
 const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(true);
  const [requests, setRequests] = useState<MaintenanceRequest[]>(() =>
    getInitialState('gmao_requests', INITIAL_REQUESTS)
  );
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getInitialState('gmao_conversations', INITIAL_CONVERSATIONS)
  );
  const [messages, setMessages] = useState<Message[]>(() =>
    getInitialState('gmao_messages', INITIAL_MESSAGES)
  );
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
const [isLoadingEquipment, setIsLoadingEquipment] = useState(true);
  // Ajouté le 26/09/2026 — profils réels (table `profiles`), pour le
  // sélecteur d'assignation d'OT et savoir si l'utilisateur connecté est
  // manager (rôle 'responsable') ou technicien.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    getInitialState('gmao_inventory', INITIAL_INVENTORY)
  );
  const [automations, setAutomations] = useState<AutomationRule[]>(() =>
    getInitialState('gmao_automations', INITIAL_AUTOMATIONS)
  );
  const [meters, setMeters] = useState<Meter[]>(() =>
    getInitialState('gmao_meters', INITIAL_METERS)
  );
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>(() =>
    getInitialState('gmao_templates', INITIAL_TEMPLATES)
  );
  const [procedures, setProcedures] = useState<Procedure[]>(() =>
    getInitialState('gmao_procedures', INITIAL_PROCEDURES)
  );
  const [tags, setTags] = useState<Tag[]>(() =>
    getInitialState('gmao_tags', INITIAL_TAGS)
  );
  // Sites/emplacements : liste maîtresse persistée dans Supabase (`locations`)
  // depuis le 13/09/2026 — avant cette date, plus de mock local synchronisé
  // via localStorage (voir handlers plus bas pour le CRUD Supabase).
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>(() =>
    getInitialState('gmao_users', INITIAL_USERS)
  );
  const [suppliers, setSuppliers] = useState<SupplierItem[]>(() =>
    getInitialState('gmao_suppliers', INITIAL_SUPPLIERS)
  );
  const [clients, setClients] = useState<ClientItem[]>(() =>
    getInitialState('gmao_clients', INITIAL_CLIENTS)
  );
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Auto Sync to localStorage
  React.useEffect(() => {
    fetchWorkOrders()
      .then(fetched => {
        const extras = loadWorkOrderExtras();
        // Depuis le 20/09/2026, checklist/visa/intervenants/dates-heures sont en
        // base : la valeur Supabase l'emporte, la valeur locale ne sert que
        // quand la base n'a encore rien pour cet OT.
        const merged = fetched.map(wo => mergeWorkOrderWithLocalExtras(wo, extras[wo.id]));
        setWorkOrders(merged);

        // Rattrapage ponctuel (20/09/2026), sur le modèle du backfill `planner` :
        // le travail déjà saisi dans CE navigateur (checklist cochée, visa,
        // temps, intervenants) et absent de la base y est envoyé une seule fois,
        // OT par OT et jamais en écrasement. Séquentiel pour ne pas saturer.
        (async () => {
          for (const wo of fetched) {
            const patch = computeLocalBackfillPatch(wo, extras[wo.id]);
            if (Object.keys(patch).length === 0) continue;
            try {
              await updateWorkOrder(wo.id, patch);
            } catch (err) {
              console.error(`Erreur rattrapage checklist/visa/temps pour l'OT ${wo.code}:`, err);
            }
          }
        })();

        // Rattrapage ponctuel (21/09/2026) de interventionCode / planNumber / entity :
        // pour les OT importés avant l'existence des colonnes, la valeur ne vit que
        // dans le localStorage de CE navigateur. Envoi par lots de 10 (des centaines
        // d'OT), en arrière-plan, uniquement quand la base est encore vide pour la
        // colonne (voir backfillWorkOrderIdentity : jamais d'écrasement). Les
        // valeurs sont déjà dans `merged` (l'écran ne change pas).
        (async () => {
          const todo = fetched
            .map(wo => ({ wo, patch: computeIdentityBackfillPatch(wo, extras[wo.id]) }))
            .filter(item => Object.keys(item.patch).length > 0);
          if (todo.length === 0) return;
          const BATCH = 10;
          let sent = 0;
          for (let i = 0; i < todo.length; i += BATCH) {
            const results = await Promise.allSettled(
              todo.slice(i, i + BATCH).map(({ wo, patch }) => backfillWorkOrderIdentity(wo.id, patch))
            );
            results.forEach((r, idx) => {
              if (r.status === 'fulfilled') sent += 1;
              else console.error(`Erreur rattrapage code d'intervention/n° de plan/entité pour l'OT ${todo[i + idx].wo.code}:`, r.reason);
            });
          }
          console.info(`${sent}/${todo.length} OT : code d'intervention / n° de plan / entité envoyés en base.`);
        })();

        // Backfill ponctuel (14/09/2026) : avant l'ajout de la colonne Supabase
        // `planner`, ce champ ne vivait qu'en localStorage. Le prochain cycle de
        // sauvegarde va réécrire ce localStorage SANS `planner` (retiré de
        // WO_EXTRA_FIELDS ci-dessus) — on pousse donc une fois vers Supabase
        // toute valeur encore uniquement locale, pour ne rien perdre.
        merged.forEach(wo => {
          const alreadyInSupabase = fetched.find(f => f.id === wo.id)?.planner;
          if (wo.planner && !alreadyInSupabase) {
            updateWorkOrder(wo.id, { planner: wo.planner }).catch(err =>
              console.error(`Erreur backfill planner pour l'OT ${wo.code}:`, err)
            );
          }
        });
      })
      .catch(err => console.error('Erreur chargement OT:', err))
      .finally(() => setIsLoadingWorkOrders(false));
  }, []);

  // Sauvegarde des champs pas encore gérés par Supabase (checklist, intervenants, visa,
  // planner, planNumber, interventionCode, entity, startDate/startTime/endDate/endTime).
    React.useEffect(() => {
       if (isLoadingWorkOrders) return;
    // Fusionne avec ce qui existe déjà, pour ne jamais effacer les OT
    // absents de l'état courant (ex. après un "Vider et remplacer" partiel).
    const extras: Record<string, Partial<WorkOrder>> = { ...loadWorkOrderExtras() };
    workOrders.forEach(wo => {
      const entry: Partial<WorkOrder> = {};
      WO_EXTRA_FIELDS.forEach(field => {
        if (wo[field] !== undefined) (entry as any)[field] = wo[field];
      });
      extras[wo.id] = entry;
    });
    localStorage.setItem(WO_EXTRAS_KEY, JSON.stringify(extras));
  }, [workOrders, isLoadingWorkOrders]);

  React.useEffect(() => {
    localStorage.setItem('gmao_requests', JSON.stringify(requests));
  }, [requests]);

  React.useEffect(() => {
  fetchEquipment()
    .then(setEquipmentList)
    .catch(err => console.error('Erreur chargement équipements:', err))
    .finally(() => setIsLoadingEquipment(false));
}, []);

  React.useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch(err => console.error('Erreur chargement profils:', err));
  }, []);

  React.useEffect(() => {
    fetchLocations()
      .then(setLocations)
      .catch(err => console.error('Erreur chargement sites/emplacements:', err));
  }, []);

  React.useEffect(() => {
    localStorage.setItem('gmao_inventory', JSON.stringify(inventory));
  }, [inventory]);

  // Handlers - Work Orders
  const handleCreateWorkOrder = (woData: Omit<WorkOrder, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => {
    const tempId = `wo-${Date.now()}`;
    const newCode = `OT-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newWO: WorkOrder = {
      ...woData,
      id: tempId,
      code: newCode,
      createdAt: now,
      updatedAt: now
    };
    setWorkOrders(prev => [newWO, ...prev]);

    createWorkOrder(newWO, session.user.id)
      .then(created => {
        setWorkOrders(prev => prev.map(wo => wo.id === tempId ? { ...newWO, ...created } : wo));
      })
      .catch(err => {
        console.error('Erreur création OT:', err);
        setWorkOrders(prev => prev.filter(wo => wo.id !== tempId));
        alert("L'ordre de travail n'a pas pu être créé dans Supabase.");
      });
  };

  const handleUpdateWOStatus = (id: string, status: WorkOrderStatus) => {
  const previous = workOrders;
  setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status, updatedAt: new Date().toISOString() } : wo));

  // 🛡️ Garde-fou : si l'id n'est pas un UUID Supabase valide, on évite
  // d'envoyer un PATCH qui planterait avec l'erreur 22P02.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) {
    console.warn(`OT ${id} sans UUID Supabase — mise à jour locale uniquement.`);
    alert("Cet ordre de travail n'a pas encore été enregistré côté serveur. La modification sera perdue au prochain rechargement.");
    return;
  }

  updateWorkOrder(id, { status }).catch(err => {
    console.error('Erreur mise à jour statut OT:', err);
    setWorkOrders(previous);
    alert("Le changement de statut n'a pas pu être enregistré. Vérifie ta connexion ou tes droits.");
  });
};

  const handleDeleteWorkOrder = (id: string) => {
    setWorkOrders(prev => prev.filter(wo => wo.id !== id));
  };

  const handleBulkImportWorkOrders = (newOrders: WorkOrder[], replaceExisting?: boolean, patchCandidates?: WorkOrderPatchCandidate[]) => {
    if (replaceExisting) {
      setWorkOrders(newOrders);
      // Depuis le 13/09/2026 : `locations` est une liste maîtresse persistée
      // dans Supabase, indépendante des imports d'OT — on ne l'écrase plus
      // ici (voir fetchLocations/createLocation/etc. et LocationsView.tsx).
    } else {
      setWorkOrders(prev => [...newOrders, ...prev]);
    }

       // Écriture Supabase en arrière-plan : équipements manquants d'abord, puis les OT liés
    const BATCH_SIZE = 500;
    const candidates = patchCandidates || [];

    (async () => {
      try {
        // 0) Correspondance code Zone -> id de site, récupérée une seule fois et
        // réutilisée à la fois pour les équipements auto-créés (1-2) et pour les
        // OT eux-mêmes (4bis). Tant que `locations.code` n'est pas renseigné pour
        // un site donné, la résolution reste sans effet (comportement inchangé
        // pour les sites pas encore configurés dans "Emplacements").
        const locationCodeMap = await fetchLocationCodeMap();

        // 1) Détecter les codes équipement présents dans cet import (nouveaux OT
        // ET OT à compléter) mais absents de la bibliothèque.
        const allIncomingRows = [...newOrders, ...candidates.map(c => c.row)];
        const existingCodes = new Set(equipmentList.map(e => e.code));
        const now = new Date().toISOString();
        // Correctif du 21/09/2026 : `w.location` est ici le NOM du site (résolu à l'analyse du
        // fichier) et non le code Zone brut, qui est dans `w.entity`. La résolution passe donc
        // par le code Zone d'abord, puis par le nom (voir src/utils/importEquipment.ts) ; avant,
        // les équipements créés par un import restaient sans emplacement.
        const locationNameToId = new Map(locations.map(l => [l.name, l.id] as [string, string]));
        const newEquipments: Equipment[] = buildNewEquipmentsFromImport(
          allIncomingRows,
          existingCodes,
          locationCodeMap,
          locationNameToId,
          now
        );

        // 2) Créer ces équipements dans Supabase avant les OT, pour pouvoir les lier tout de suite
        let createdEquipments: Equipment[] = [];
        if (newEquipments.length > 0) {
          createdEquipments = await createEquipmentBulk(newEquipments, session.user.id);
          setEquipmentList(prev => [...createdEquipments, ...prev]);
        }

        // 3) Correspondance code équipement -> id (existants + nouvellement créés)
        const codeToId = new Map<string, string>();
        equipmentList.forEach(e => codeToId.set(e.code, e.id));
        createdEquipments.forEach(e => codeToId.set(e.code, e.id));

        // Résolution equipmentId/locationId commune aux nouveaux OT ET aux
        // candidats de complément (même logique, réutilisée telle quelle).
        const resolveIds = (w: WorkOrder): WorkOrder => {
          let resolved = w;
          if (w.equipmentCode && codeToId.has(w.equipmentCode)) {
            resolved = { ...resolved, equipmentId: codeToId.get(w.equipmentCode) };
          }
          if (w.entity && locationCodeMap.has(w.entity)) {
            resolved = { ...resolved, locationId: locationCodeMap.get(w.entity) };
          }
          return resolved;
        };

        // 4) Attacher equipmentId/locationId à chaque nouvel OT avant de l'enregistrer dans Supabase
        const ordersWithLocationId = newOrders.map(resolveIds);

        const batches: WorkOrder[][] = [];
        for (let i = 0; i < ordersWithLocationId.length; i += BATCH_SIZE) batches.push(ordersWithLocationId.slice(i, i + BATCH_SIZE));

        const createdAll: WorkOrder[] = [];
        for (const batch of batches) {
          createdAll.push(...(await createWorkOrdersBulk(batch, session.user.id)));
        }
        const createdByCode = new Map(createdAll.map(c => [c.code, c]));

        // 5) Compléter les OT déjà en base — UNIQUEMENT les champs cœur restés
        // vides côté base (equipment_id/location_id/planner). Ajouté le
        // 18/09/2026 suite au cas réel OT-106146 (Meknès) : un réimport avec
        // le même N° d'OT ne doit plus être silencieusement ignoré quand le
        // fichier apporte des données que la version en base n'a jamais eues,
        // mais ne doit JAMAIS écraser une valeur déjà présente (import
        // antérieur ou édition manuelle via handleEditWorkOrder).
        const patchResults = new Map<string, Partial<WorkOrder>>();
        if (candidates.length > 0) {
          await Promise.all(candidates.map(async (c) => {
            const resolvedRow = resolveIds(c.row);
            const patch: Partial<WorkOrder> = {};
            if (!c.existing.equipmentId && resolvedRow.equipmentId) patch.equipmentId = resolvedRow.equipmentId;
            if (!c.existing.locationId && resolvedRow.locationId) patch.locationId = resolvedRow.locationId;
            if (!c.existing.planner && resolvedRow.planner) patch.planner = resolvedRow.planner;
            // Depuis le 21/09/2026 : code d'intervention / n° de plan / entité,
            // uniquement s'ils sont encore vides en base (même règle, jamais d'écrasement).
            Object.assign(patch, computeIdentityBackfillPatch(c.existing, resolvedRow));
            if (Object.keys(patch).length === 0) return;
            try {
              await updateWorkOrder(c.existingId, patch);
              patchResults.set(c.existingId, patch);
            } catch (err) {
              console.error(`Erreur complément OT ${c.row.code} :`, err);
            }
          }));
        }

        setWorkOrders(prev => prev.map(wo => {
          const created = createdByCode.get(wo.code);
          if (created) return { ...wo, ...created };
          const patch = patchResults.get(wo.id);
          return patch ? { ...wo, ...patch } : wo;
        }));

        if (patchResults.size > 0) {
          console.info(`${patchResults.size} OT déjà en base complété(s) (champs vides uniquement) suite à cet import.`);
        }
      } catch (err) {
        console.error('Erreur import Supabase (OT) :', err);
        alert("L'import a fonctionné localement mais N'A PAS pu être enregistré dans Supabase — les données seront perdues au prochain rechargement de la page. Réessaie l'import.");
      }
    })();
  };

  const handleClearAllWorkOrders = () => {
    setWorkOrders([]);
  };

   const handleEditWorkOrder = (id: string, updated: Partial<WorkOrder>) => {
    const previous = workOrders;
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, ...updated, updatedAt: new Date().toLocaleString('fr-FR') } : wo));

    // 🛡️ Garde-fou : si l'id n'est pas un UUID Supabase valide, on évite
    // d'envoyer un PATCH qui planterait avec l'erreur 22P02 (même garde-fou
    // que handleUpdateWOStatus).
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      console.warn(`OT ${id} sans UUID Supabase — mise à jour locale uniquement.`);
      alert("Cet ordre de travail n'a pas encore été enregistré côté serveur. La modification sera perdue au prochain rechargement.");
      return;
    }

    // `location` est un nom saisi dans le formulaire (pas un id) : on le
    // résout via la liste `locations` déjà chargée, même principe que dans
    // handleSyncEquipmentFromWorkOrders.
    const locationNameToId = new Map(locations.map(l => [l.name, l.id]));

    // Champs envoyés à Supabase : champs cœur (voir workOrderToRow) + depuis le
    // 20/09/2026 checklist, intervenants, visa et dates/heures (voir
    // src/utils/workOrderExtras.ts). `assignee` reste en localStorage pour
    // l'instant ; interventionCode/planNumber/entity (depuis le 21/09/2026 en
    // base) ne sont pas modifiables dans le formulaire, donc absents de ce patch.
    const corePatch: Partial<WorkOrder> = {};
    if (updated.title !== undefined) corePatch.title = updated.title;
    if (updated.description !== undefined) corePatch.description = updated.description;
    if (updated.priority !== undefined) corePatch.priority = updated.priority;
    if (updated.type !== undefined) corePatch.type = updated.type;
    if (updated.status !== undefined) corePatch.status = updated.status;
    if (updated.dueDate !== undefined) corePatch.dueDate = updated.dueDate;
    if (updated.equipmentId !== undefined) corePatch.equipmentId = updated.equipmentId;
    if (updated.planner !== undefined) corePatch.planner = updated.planner;
    // Ajouté le 26/09/2026 — oubli initial : `assignedToId` (vrai uuid technicien)
    // n'était pas dans cette liste blanche, donc jamais envoyé à Supabase malgré
    // le nouveau sélecteur dans WorkOrdersView (mise à jour locale seulement,
    // silencieusement perdue au rechargement — bug corrigé ici).
    if (updated.assignedToId !== undefined) corePatch.assignedToId = updated.assignedToId;
    if (updated.tasks !== undefined) corePatch.tasks = updated.tasks;
    if (updated.intervenantsLogs !== undefined) corePatch.intervenantsLogs = updated.intervenantsLogs;
    if (updated.visa !== undefined) corePatch.visa = updated.visa;
    if (updated.startDate !== undefined) corePatch.startDate = updated.startDate;
    if (updated.startTime !== undefined) corePatch.startTime = updated.startTime;
    if (updated.endDate !== undefined) corePatch.endDate = updated.endDate;
    if (updated.endTime !== undefined) corePatch.endTime = updated.endTime;
    if (updated.location !== undefined && locationNameToId.has(updated.location)) {
      corePatch.locationId = locationNameToId.get(updated.location);
    }

    if (Object.keys(corePatch).length === 0) return;

    updateWorkOrder(id, corePatch).catch(err => {
      console.error('Erreur mise à jour OT:', err);
      setWorkOrders(previous);
      alert("La modification n'a pas pu être enregistrée dans Supabase. Vérifie ta connexion ou tes droits.");
    });
  };

  // Handlers - Requests
  const handleAddRequest = (reqData: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'status'>) => {
    const newReq: MaintenanceRequest = {
      ...reqData,
      id: `req-${Date.now()}`,
      status: 'En attente',
      createdAt: new Date().toLocaleString('fr-FR')
    };
    setRequests(prev => [newReq, ...prev]);
  };

  const handleApproveRequest = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'Approuvée' } : r));

    handleCreateWorkOrder({
      title: req.title,
      description: req.description,
      priority: req.priority,
      status: 'Ouvert',
      type: 'Corrective',
      equipmentName: req.equipmentName,
      location: req.location || 'Atelier Principal',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      assignee: 'Équipe Maintenance'
    });
  };

  const handleRejectRequest = (reqId: string) => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'Rejetée' } : r));
  };

  // Handlers - Messages
  const handleSendMessage = (conversationId: string, content: string) => {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'user-self',
      senderName: 'Moi',
      senderInitials: 'C',
      content,
      timestamp: new Date().toLocaleString('fr-FR'),
      isSelf: true
    };
    setMessages(prev => [...prev, newMsg]);

    setConversations(prev => prev.map(c => c.id === conversationId ? {
      ...c,
      lastMessage: content,
      lastMessageTime: 'À l\'instant'
    } : c));
  };

  const handleAddConversation = (name: string) => {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'EQ';
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      name,
      initials,
      lastMessage: 'Conversation créée',
      lastMessageTime: 'À l\'instant'
    };
    setConversations(prev => [newConv, ...prev]);
  };

  // Handlers - Automations
  const handleToggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const handleAddAutomation = (rule: Omit<AutomationRule, 'id'>) => {
    setAutomations(prev => [...prev, { ...rule, id: `auto-${Date.now()}` }]);
  };

  // Handlers - Meters
  const handleAddMeter = (meter: Omit<Meter, 'id' | 'lastReadingDate'>) => {
    setMeters(prev => [...prev, {
      ...meter,
      id: `meter-${Date.now()}`,
      lastReadingDate: new Date().toLocaleDateString('fr-FR')
    }]);
  };

  const handleUpdateMeterReading = (id: string, value: number) => {
    setMeters(prev => prev.map(m => m.id === id ? {
      ...m,
      currentValue: value,
      lastReadingDate: new Date().toLocaleDateString('fr-FR')
    } : m));
  };

  // Handlers - Equipment
  const handleAddEquipment = (eq: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt' | 'workOrdersCount'>) => {
    const tempId = `eq-${Date.now()}`;
    const now = new Date().toISOString();
    const newEq: Equipment = {
      ...eq,
      id: tempId,
      createdAt: now,
      updatedAt: now,
      workOrdersCount: 0
    };
    setEquipmentList(prev => [newEq, ...prev]);

    createEquipment(newEq, session.user.id)
      .then(created => {
        setEquipmentList(prev => prev.map(e => e.id === tempId ? { ...newEq, ...created } : e));
      })
      .catch(err => {
        console.error('Erreur création équipement:', err);
        setEquipmentList(prev => prev.filter(e => e.id !== tempId));
        alert("L'équipement n'a pas pu être créé dans Supabase.");
      });
  };

  // Crée une fiche équipement pour chaque code équipement présent dans les OT importés
  // mais absent de la bibliothèque Équipements (utile car l'import de planning/gamme
  // ne crée jamais automatiquement de fiche équipement dédiée).
  const handleSyncEquipmentFromWorkOrders = () => {
    const existingCodes = new Set(equipmentList.map(e => e.code));
    const seen = new Map<string, { code: string; name: string; location?: string }>();
    workOrders.forEach(w => {
      if (w.equipmentCode && !existingCodes.has(w.equipmentCode) && !seen.has(w.equipmentCode)) {
        seen.set(w.equipmentCode, {
          code: w.equipmentCode,
          name: w.equipmentName || w.equipmentCode,
          location: w.location
        });
      }
    });
    const now = new Date().toISOString();
    // Ici `w.location` est le NOM déjà résolu par la jointure Supabase (l'OT est
    // déjà en base), contrairement à handleBulkImportWorkOrders où c'est encore
    // le code Zone brut du CSV — d'où une correspondance par nom, à partir de la
    // liste "Emplacements" déjà chargée en mémoire.
    const locationNameToId = new Map(locations.map(l => [l.name, l.id]));
    const newEquipments: Equipment[] = Array.from(seen.values()).map(e => ({
      id: `eq-${e.code}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      code: e.code,
      name: e.name,
      status: 'En service',
      criticality: 'Normal',
      location: e.location || '',
      locationId: e.location ? locationNameToId.get(e.location) : undefined,
      supplier: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      createdAt: now,
      updatedAt: now,
      description: '',
      workOrdersCount: 0
    }));
    if (newEquipments.length > 0) {
      setEquipmentList(prev => [...newEquipments, ...prev]);

      createEquipmentBulk(newEquipments, session.user.id)
        .then(created => {
          const createdByCode = new Map(created.map(c => [c.code, c]));
          setEquipmentList(prev => prev.map(e => {
            const c = createdByCode.get(e.code);
            return c ? { ...e, ...c } : e;
          }));
        })
        .catch(err => {
          console.error('Erreur création équipements (sync import) :', err);
          alert("Les fiches équipement créées automatiquement n'ont pas pu être enregistrées dans Supabase.");
        });
    }
  };

  const handleUpdateEquipmentStatus = (id: string, status: OperationalStatus) => {
    const previous = equipmentList;
    setEquipmentList(prev => prev.map(e => e.id === id ? { ...e, status, updatedAt: new Date().toISOString() } : e));
    updateEquipment(id, { status }).catch(err => {
      console.error('Erreur mise à jour statut équipement:', err);
      setEquipmentList(previous);
      alert("Le changement de statut n'a pas pu être enregistré. Vérifie ta connexion ou tes droits.");
    });
  };

  const handleDeleteEquipment = (id: string) => {
    setEquipmentList(prev => prev.filter(e => e.id !== id));
  };

  // Depuis le 20/09/2026, la modification d'un équipement est enregistrée en base
  // (avant : état local uniquement, perdue au rechargement). Champs directs +
  // emplacement ; le fournisseur et le code ne sont pas modifiables ici.
  const handleEditEquipment = (id: string, updated: Partial<Equipment>) => {
    const previous = equipmentList;
    setEquipmentList(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));

    // Garde-fou : un équipement encore sans UUID Supabase (création en cours)
    // ne peut pas être mis à jour côté serveur.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      console.warn(`Équipement ${id} sans UUID Supabase — mise à jour locale uniquement.`);
      alert("Cet équipement n'a pas encore été enregistré côté serveur. La modification sera perdue au prochain rechargement.");
      return;
    }

    const dbPatch: Partial<Equipment> = {};
    if (updated.name !== undefined) dbPatch.name = updated.name;
    if (updated.description !== undefined) dbPatch.description = updated.description;
    if (updated.manufacturer !== undefined) dbPatch.manufacturer = updated.manufacturer;
    if (updated.model !== undefined) dbPatch.model = updated.model;
    if (updated.serialNumber !== undefined) dbPatch.serialNumber = updated.serialNumber;
    if (updated.criticality !== undefined) dbPatch.criticality = updated.criticality;
    if (updated.status !== undefined) dbPatch.status = updated.status;
    if (updated.locationId) dbPatch.locationId = updated.locationId;
    if (Object.keys(dbPatch).length === 0) return;

    updateEquipment(id, dbPatch)
      .then(saved => {
        setEquipmentList(prev => prev.map(e => e.id === id ? { ...e, ...saved } : e));
      })
      .catch(err => {
        console.error('Erreur mise à jour équipement:', err);
        setEquipmentList(previous);
        alert("La modification de l'équipement n'a pas pu être enregistrée dans Supabase. Vérifie ta connexion ou tes droits.");
      });
  };

  // Handlers - Inventory
  const handleAddInventoryPart = (part: Omit<InventoryItem, 'id'>) => {
    setInventory(prev => [...prev, { ...part, id: `part-${Date.now()}` }]);
  };

  const handleUpdateInventoryQty = (id: string, delta: number) => {
    setInventory(prev => prev.map(p => p.id === id ? {
      ...p,
      quantity: Math.max(0, p.quantity + delta)
    } : p));
  };

  // Handlers - Templates, Procedures, Tags, Locations, Users, Suppliers, Clients
  const handleAddTemplate = (tmpl: Omit<WorkOrderTemplate, 'id'>) => {
    setTemplates(prev => [...prev, { ...tmpl, id: `tmpl-${Date.now()}` }]);
  };

  const handleAddProcedure = (proc: Omit<Procedure, 'id' | 'createdAt'>) => {
    setProcedures(prev => [...prev, {
      ...proc,
      id: `proc-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('fr-FR')
    }]);
  };

  const handleAddTag = (tag: Omit<Tag, 'id'>) => {
    setTags(prev => [...prev, { ...tag, id: `tag-${Date.now()}` }]);
  };

   // Sites/emplacements (Supabase depuis le 13/09/2026, voir aussi useEffect
  // de chargement plus haut). Écriture optimiste + retour arrière si l'appel
  // Supabase échoue, comme pour workOrders/equipment.
  const handleAddLocation = (loc: Omit<LocationItem, 'id'>) => {
    const tempId = `loc-temp-${Date.now()}`;
    setLocations(prev => [...prev, { ...loc, id: tempId }]);
    createLocation({ name: loc.name, code: loc.code, type: loc.type })
      .then(created => {
        setLocations(prev => prev.map(l => (l.id === tempId ? created : l)));
      })
      .catch(err => {
        console.error('Erreur création site:', err);
        setLocations(prev => prev.filter(l => l.id !== tempId));
        alert("Le site n'a pas pu être enregistré. Vérifie ta connexion ou tes droits.");
      });
  };

  const handleDeleteLocation = (id: string) => {
    const previous = locations;
    setLocations(prev => prev.filter(l => l.id !== id));
    deleteLocation(id).catch(err => {
      console.error('Erreur suppression site:', err);
      setLocations(previous);
      alert("Le site n'a pas pu être supprimé. Vérifie ta connexion ou tes droits.");
    });
  };

  const handleClearAllLocations = () => {
    const previous = locations;
    setLocations([]);
    Promise.all(previous.map(l => deleteLocation(l.id))).catch(err => {
      console.error('Erreur suppression des sites:', err);
      setLocations(previous);
      alert("La suppression n'a pas pu être enregistrée intégralement. Vérifie ta connexion ou tes droits, puis réessaie.");
    });
  };

  const handleAddUser = (user: Omit<UserItem, 'id'>) => {
    setUsers(prev => [...prev, { ...user, id: `usr-${Date.now()}` }]);
  };

  const handleAddSupplier = (supplier: Omit<SupplierItem, 'id'>) => {
    setSuppliers(prev => [...prev, { ...supplier, id: `sup-${Date.now()}` }]);
  };

  const handleAddClient = (client: Omit<ClientItem, 'id'>) => {
    setClients(prev => [...prev, { ...client, id: `cli-${Date.now()}` }]);
  };

  // Render view router based on currentTab
  const renderCurrentView = () => {
    switch (currentTab) {
      case 'work-orders':
        return (
          <WorkOrdersView
            workOrders={workOrders}
            equipmentList={equipmentList}
            locations={locations}
            profiles={profiles}
            currentUserId={session.user.id}
            onAddWorkOrder={handleCreateWorkOrder}
            onUpdateStatus={handleUpdateWOStatus}
            onDeleteWorkOrder={handleDeleteWorkOrder}
            onEditWorkOrder={handleEditWorkOrder}
            onBulkImportWorkOrders={handleBulkImportWorkOrders}
            onClearAllWorkOrders={handleClearAllWorkOrders}
          />
        );
      case 'requests':
        return (
          <RequestsView
            requests={requests}
            equipmentList={equipmentList}
            onAddRequest={handleAddRequest}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
          />
        );
      case 'messages':
        return (
          <MessagesView
            conversations={conversations}
            messages={messages}
            onSendMessage={handleSendMessage}
            onAddConversation={handleAddConversation}
          />
        );
      case 'reports':
        return (
          <ReportsView
            workOrders={workOrders}
            equipmentList={equipmentList}
          />
        );
      case 'automations':
        return (
          <AutomationsView
            automations={automations}
            onToggleRule={handleToggleAutomation}
            onAddRule={handleAddAutomation}
          />
        );
      case 'meters':
        return (
          <MetersView
            meters={meters}
            onAddMeter={handleAddMeter}
            onUpdateReading={handleUpdateMeterReading}
          />
        );
      case 'equipment':
        return (
          <EquipmentView
            equipmentList={equipmentList}
            workOrders={workOrders}
            locations={locations}
            onAddEquipment={handleAddEquipment}
            onUpdateStatus={handleUpdateEquipmentStatus}
            onDeleteEquipment={handleDeleteEquipment}
            onEditEquipment={handleEditEquipment}
            onSyncFromWorkOrders={handleSyncEquipmentFromWorkOrders}
          />
        );
      case 'health-records':
        return <HealthRecordsView equipmentList={equipmentList} workOrders={workOrders} currentUserId={session.user.id} initialEquipmentId={deepLink?.equipmentId ?? null} initialOpenAddForm={deepLink?.openAddForm ?? false} deepLinkKey={deepLink?.key ?? 0} />;
      case 'inventory':
        return (
          <InventoryView
            inventory={inventory}
            onAddPart={handleAddInventoryPart}
            onUpdateQuantity={handleUpdateInventoryQty}
          />
        );
      case 'preventive':
        return <PreventiveView />;
      case 'templates':
        return (
          <TemplatesView
            templates={templates}
            onAddTemplate={handleAddTemplate}
          />
        );
      case 'procedures':
        return (
          <ProceduresView
            procedures={procedures}
            onAddProcedure={handleAddProcedure}
          />
        );
      case 'tags':
        return (
          <TagsView
            tags={tags}
            onAddTag={handleAddTag}
          />
        );
       case 'locations':
        return (
          <LocationsView
            locations={locations}
            workOrders={workOrders}
            onAddLocation={handleAddLocation}
            onDeleteLocation={handleDeleteLocation}
            onClearAllLocations={handleClearAllLocations}
          />
        );
      case 'users':
        return (
          <UsersView
            users={users}
            onAddUser={handleAddUser}
          />
        );
      case 'suppliers':
        return (
          <SuppliersView
            suppliers={suppliers}
            onAddSupplier={handleAddSupplier}
          />
        );
      case 'clients':
        return (
          <ClientsView
            clients={clients}
            onAddClient={handleAddClient}
          />
        );
      default:
        return (
          <WorkOrdersView
            workOrders={workOrders}
            equipmentList={equipmentList}
            locations={locations}
            profiles={profiles}
            currentUserId={session.user.id}
            onAddWorkOrder={handleCreateWorkOrder}
            onUpdateStatus={handleUpdateWOStatus}
            onDeleteWorkOrder={handleDeleteWorkOrder}
            onEditWorkOrder={handleEditWorkOrder}
            onBulkImportWorkOrders={handleBulkImportWorkOrders}
            onClearAllWorkOrders={handleClearAllWorkOrders}
          />
        );
    }
  };

  return (
    <div className="print:bg-white flex flex-col h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden antialiased">
      {/* Bandeau utilisateur connecté */}
      <div className="print:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-1.5 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="md:hidden p-1 -ml-1 text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-gray-500">
            Connecté en tant que : <span className="font-medium text-gray-700">{session.user.email}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
        >
          Se déconnecter
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Navigation Sidebar */}
        <div className="print:hidden contents">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenHelp={() => setIsHelpModalOpen(true)}
          pendingRequestsCount={requests.filter(r => r.status === 'En attente').length}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {renderCurrentView()}
        </main>
      </div>

      {/* Help Modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <span>Center d'aide & Documentation GMAO</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <p className="font-semibold text-gray-800">
                Bienvenue dans votre système de Gestion de Maintenance Assistée par Ordinateur (GMAO).
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Ordres de Travail :</strong> Créez, filtrez, modifiez ou supprimez vos interventions préventives et correctives.</li>
                <li><strong>Sites & Équipements :</strong> Gérez vos emplacements et arborescences d'équipements.</li>
                <li><strong>Réinitialisation des sites :</strong> En cas de présence de noms de sites invalides importés, utilisez le bouton de réinitialisation pour restaurer la liste officielle.</li>
              </ul>
              <p className="pt-2 text-gray-500">
                Pour toute assistance complémentaire, contactez le support technique de votre établissement.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
