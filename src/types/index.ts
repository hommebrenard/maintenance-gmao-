export type NavigationItem = 
  | 'dashboard'
  | 'work-orders'
  | 'requests'
  | 'messages'
  | 'reports'
  | 'automations'
  | 'meters'
  | 'equipment'
  | 'health-records'
  | 'inventory'
  | 'preventive'
  | 'templates'
  | 'procedures'
  | 'tags'
  | 'locations'
  | 'users'
  | 'techniciens'
  | 'suppliers'
  | 'clients';

export type WorkOrderStatus = 'Ouvert' | 'En cours' | 'En attente' | 'Terminé' | 'Annulé';
export type WorkOrderPriority = 'Faible' | 'Moyenne' | 'Élevée' | 'Urgente';
export type WorkOrderType = 'Corrective' | 'Préventive' | 'Amélioration' | 'Inspection';

export interface WorkOrderTask {
  id: string;
  code: string;
  label: string;
  completed: boolean;
  comment?: string;
  isAnomaly?: boolean;
}

export interface GammeTaskItem {
  id: string;
  actionCode: string;
  label: string;
}

export interface GammePlan {
  id: string;
  equipmentCode: string;
  planCode: string;
  interventionTitle: string;
  equipmentDescription?: string;
  tasks: GammeTaskItem[];
}

export interface GammeItem {
  id: string;
  equipmentCode: string;
  interventionDescription: string;
  actionCode: string;
  actionLabel?: string;
  equipmentDescription?: string;
}

// Ajouté le 26/09/2026 — profil réel (table `profiles`), pour le sélecteur
// d'assignation d'OT (distinct de `UserItem`, écran « Centre de configuration »
// non relié à Supabase). `role` tel qu'en base : 'technicien' | 'responsable'.
export interface Profile {
  id: string;
  fullName: string;
  role: string;
}

// Ajouté le 27/09/2026 — table `techniciens` (chantier B, distinct de
// `profiles`) : un technicien de terrain réel (nom, zone Nord/Sud), pas
// forcément rattaché à un compte de connexion (`profileId` nullable).
export interface Technicien {
  id: string;
  nom: string;
  zone: 'Nord' | 'Sud';
  actif: boolean;
  profileId?: string | null;
}

export interface IntervenantLog {
  id: string;
  name: string;
  timeSpent?: string;
  // Ajouté le 27/09/2026 — chantier B, sélecteur d'intervenant réel. Nullable :
  // les entrées historiques (texte libre) n'ont pas de technicien rattaché.
  technicienId?: string;
}

export interface WorkOrder {
  id: string;
  code: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  type: WorkOrderType;
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;
  location?: string;
  locationId?: string;
  assignee?: string;
  /** uuid réel vers `profiles.id` (colonne `assigned_to`, celle que lit la RLS
   * `wo_update_assigned_or_manager`). Distinct de `assignee` (nom affiché,
   * dérivé de ce même champ via jointure) et de `planner` (texte libre importé,
   * sans lien avec un compte). null = non assigné. Ajouté le 26/09/2026. */
  assignedToId?: string | null;
  dueDate: string;
  createdAt: string;
  /** Date de création en base (ISO), pour les compteurs « ajoutés ces N jours ». */
  createdAtIso?: string;
  updatedAt: string;
  /** Date de clôture ISO, posée UNIQUEMENT par la base (déclencheur trg_wo_closure,
   * 07/10/2026). Jamais écrite par l'app ; absente si l'OT n'est pas « Terminé »
   * ou a été clos avant l'horodatage automatique. */
  closedAt?: string;
  /** 'coswin' = clôturé via l'import Coswin (sans checklist ni visa) ; absent = clôturé dans l'app.
   * Posé uniquement par la fonction SQL close_work_orders_from_coswin. */
  closureSource?: string;
  closureLotId?: string;
  /** Date de régularisation : checklist + visa renseignés après une clôture Coswin (provenance conservée). */
  closureRegularizedAt?: string;
  planner?: string;
  planNumber?: string;
  interventionCode?: string;
  entity?: string;
  tasks?: WorkOrderTask[];
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
   intervenantsLogs?: IntervenantLog[];
  visa?: string;
  // Ajoutés le 16/09/2026 (Phase 1 — écran d'aperçu import) : statut de
  // confiance du rattachement Gamme, calculé au parsing. Usage écran
  // uniquement — jamais envoyés à Supabase (absents de workOrderToRow).
  gammeMatchStatus?: 'exact' | 'plan_type' | 'approximatif' | 'non_trouve' | 'conflit';
  gammeMatchMethod?: string;
  gammeConflictPlanCode?: string;
}

// Ajouté le 18/09/2026 — réimport d'un N° d'OT déjà en base (voir cas
// OT-106146/Meknès) : au lieu d'ignorer silencieusement la ligne, on ne
// comble que les champs cœur restés vides côté base, sans jamais écraser
// une valeur déjà présente (import précédent OU édition manuelle).
export interface WorkOrderPatchCandidate {
  existingId: string;
  existing: {
    equipmentId?: string;
    locationId?: string;
    planner?: string;
    // Ajoutés le 21/09/2026 : colonnes intervention_code / plan_number / entity.
    interventionCode?: string;
    planNumber?: string;
    entity?: string;
  };
  row: WorkOrder;
}

export type RequestStatus = 'En attente' | 'Approuvée' | 'Rejetée';

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: WorkOrderPriority;
  equipmentName?: string;
  /** uuid réel de l'équipement (colonne `equipment_id`). Obligatoire pour une
   * nouvelle demande : sans lui, l'OT créé à l'approbation serait « Sans équipement ». */
  equipmentId?: string;
  locationId?: string;
  location?: string;
  /** Nom du rondier (colonne `requester_name`), le compte technicien étant partagé. */
  requestedBy: string;
  createdAt: string;
  code?: string;
  workOrderId?: string | null;
  /** Date de décision (approbation ou rejet), ISO — colonne `approval_date`. */
  decidedAt?: string;
  /** « coswin » pour une demande importée de Coswin (colonnes ajoutées le 08/10/2026), sinon « app ». */
  origin?: 'app' | 'coswin';
  /** created_at brut (ISO), pour trier et filtrer par date. */
  createdAtIso?: string;
  coswinState?: string;
  interventionType?: string;
  qseType?: string;
  dafNumber?: string;
  declaredAt?: string;
  /** Échéance : date de fin prévue Coswin (DI importée) ou date RETENUE par le manager à l'approbation (demande de l'app). */
  dueDate?: string;
  /** Date de fin prévue PROPOSÉE à la création (colonne `proposed_due_date`), AAAA-MM-JJ. Jamais écrasée par le manager. */
  proposedDueDate?: string;
  priorityCode?: string;
  otNumber?: string;
  otState?: string;
  otStateLabel?: string;
  functionLabel?: string;
  functionCode?: string;
  supervisorName?: string;
  /** Courriel du demandeur (facultatif), colonne `requester_email`. */
  requesterEmail?: string;
  costCenter?: string;
  plannedStart?: string;
  otEndDate?: string;
  coswinCreatedAt?: string;
  visa?: string;
  equipmentCode?: string;
  /** Équipement planifié Coswin (texte) : l'équipement lié (`equipmentId`) suit la règle « planifié d'abord, source en repli ». */
  plannedEquipmentCode?: string;
  interventionCode?: string;
  siteCode?: string;
  /** Motif de rejet / d'annulation (colonne `rejection_reason`) : saisi dans l'application, absent de l'export Coswin. */
  rejectionReason?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  content: string;
  timestamp: string;
  isSelf?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  unreadCount?: number;
  lastMessage: string;
  lastMessageTime: string;
  initials: string;
}

export type OperationalStatus = 'En service' | 'Arrêt planifié' | 'Arrêt non planifié';
export type EquipmentCriticality = 'Faible' | 'Normal' | 'Élevée' | 'Critique';

export interface Equipment {
  id: string;
  code: string;
  name: string;
  status: OperationalStatus;
  criticality: EquipmentCriticality;
  location: string;
  locationId?: string;
  supplier: string;
  supplierId?: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  workOrdersCount: number;
  // Ajoutés le 22/09/2026 (chantier carnet de santé) : colonnes déjà présentes
  // en base (confirmées via le schema visualizer) mais jamais lues/écrites
  // par l'app jusqu'ici. Optionnels pour ne rien casser côté appelants
  // existants (fiche équipement, import, etc.).
  category?: string;
  qrCode?: string;
  photoUrl?: string;
  manualUrl?: string;
  notes?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyEndDate?: string;
  /** Code famille Coswin (ex. « APLC »), colonne `equipment.coswin_family` (24/10/2026). Vide = repli sur la table statique puis sur le code. */
  coswinFamily?: string;
}

export interface HealthRecordEntry {
  id: string;
  equipmentId: string;
  eventDate: string;
  eventType: string;
  description: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Carnet de santé enrichi (chantier AI Studio, Phase 3 — 29/09/2026).
// Correspond aux tables `equipment_documents`, `maintenance_schedules` et
// `equipment_parts` (schéma relu en base le 29/09). Champ optionnel = colonne
// nullable en base : « non renseigné », jamais une valeur inventée.
// ---------------------------------------------------------------------------

export type EquipmentDocumentCategory = 'manual' | 'certificate' | 'diagram' | 'report' | 'procedure';

export interface EquipmentDocument {
  id: string;
  equipmentId: string;
  name: string;
  category?: EquipmentDocumentCategory;
  /** Chemin dans le bucket privé `equipment-files` (equipment/{equipmentId}/...). Absent pour un simple lien GED. */
  storagePath?: string;
  /** Lien vers la GED de l'institution (http/https), à la place ou en plus d'un fichier. */
  externalUrl?: string;
  /** Contrôle réalisé auquel ce document (compte rendu) est rattaché. */
  controlId?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  /** Bucket du fichier : `equipment-files` (par défaut) ou `request-files` pour une pièce jointe de demande liée (sql/26). */
  storageBucket?: 'equipment-files' | 'request-files';
  /** Pièce jointe de demande à l'origine du document lié : le fichier appartient à la demande, pas au carnet. */
  sourceAttachmentId?: string;
}

export type ControlResult = 'conforme' | 'reserves' | 'non_conforme';

/** Un contrôle réalisé (historique des contrôles d'une échéance) — table `schedule_controls`. */
export interface ScheduleControl {
  id: string;
  /** Échéance concernée ; absent si l'échéance a été supprimée (le contrôle est conservé). */
  scheduleId?: string;
  equipmentId: string;
  /** Intitulé de l'échéance au moment du contrôle. */
  title: string;
  /** YYYY-MM-DD */
  performedOn: string;
  inspectionBody?: string;
  /** Verdict du contrôleur ; absent = non renseigné. */
  result?: ControlResult;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type MaintenanceFrequencyType = 'hours' | 'calendar';
export type MaintenanceScheduleStatus = 'ok' | 'due_soon' | 'overdue';

export interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  title: string;
  frequencyLabel?: string;
  frequencyType?: MaintenanceFrequencyType;
  intervalHours?: number;
  intervalMonths?: number;
  /** Dates au format YYYY-MM-DD (colonnes `date`). */
  lastDoneDate?: string;
  nextDueDate?: string;
  legalRequirement: boolean;
  /** id du profil assigné (FK profiles). */
  assignedTo?: string;
  /** Détails du contrôle (ajoutés le 30/09/2026) : organisme / prestataire en saisie libre (ex. APAVE). */
  inspectionBody?: string;
  /** Points de contrôle à réaliser (texte libre, une ligne par point). */
  controlPoints?: string;
  /** Consignes de sécurité / habilitations (texte libre). */
  safetyInstructions?: string;
  /** Durée estimée du contrôle, en minutes. */
  estimatedDurationMinutes?: number;
  /** Recalculé à la lecture depuis nextDueDate quand elle existe (voir utils/maintenanceSchedule.ts). */
  status?: MaintenanceScheduleStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EquipmentPart {
  id: string;
  equipmentId: string;
  code?: string;
  name: string;
  reference?: string;
  manufacturer?: string;
  stock: number;
  minStock: number;
  unit?: string;
  unitPrice?: number;
  location?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  location: string;
  equipment?: string;
}

export interface Meter {
  id: string;
  name: string;
  equipmentName: string;
  currentValue: number;
  unit: string;
  lastReadingDate: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  isPro?: boolean;
}

export interface WorkOrderTemplate {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  priority: WorkOrderPriority;
  tasksCount: number;
}

export interface Procedure {
  id: string;
  title: string;
  description: string;
  stepsCount: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  usedCount: number;
}

export interface LocationItem {
  id: string;
  name: string;
  code?: string;
  parentLocation?: string;
  type: 'Site' | 'Bâtiment' | 'Zone' | 'Atelier';
  equipmentCount: number;
  // Ajouté le 27/09/2026 — zone Nord/Sud du site, pour suggérer les bons
  // techniciens dans le formulaire OT. Nullable : sites pas encore affectés.
  zone?: 'Nord' | 'Sud' | null;
  // État d'intégration du site (`locations.integration_status`). Absent = opérationnel.
  integrationStatus?: 'a_preparer' | 'en_integration' | 'operationnel';
}

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: 'Administrateur' | 'Technicien' | 'Demandeur' | 'Manager';
  teams: string[];
  lastVisit: string;
  avatarInitials: string;
}

export interface SupplierItem {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
}

export interface ClientItem {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  sitesCount: number;
}
