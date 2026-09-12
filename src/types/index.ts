export type NavigationItem = 
  | 'work-orders'
  | 'requests'
  | 'messages'
  | 'reports'
  | 'automations'
  | 'meters'
  | 'equipment'
  | 'inventory'
  | 'preventive'
  | 'templates'
  | 'procedures'
  | 'tags'
  | 'locations'
  | 'users'
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

export interface IntervenantLog {
  id: string;
  name: string;
  timeSpent?: string;
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
  dueDate: string;
  createdAt: string;
  updatedAt: string;
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
}

export type RequestStatus = 'En attente' | 'Approuvée' | 'Rejetée';

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: WorkOrderPriority;
  equipmentName?: string;
  location?: string;
  requestedBy: string;
  createdAt: string;
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
  supplier: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  workOrdersCount: number;
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
  parentLocation?: string;
  type: 'Site' | 'Bâtiment' | 'Zone' | 'Atelier';
  equipmentCount: number;
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
