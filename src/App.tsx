import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { WorkOrdersView } from './components/views/WorkOrdersView';
import { RequestsView } from './components/views/RequestsView';
import { MessagesView } from './components/views/MessagesView';
import { ReportsView } from './components/views/ReportsView';
import { AutomationsView } from './components/views/AutomationsView';
import { MetersView } from './components/views/MetersView';
import { EquipmentView } from './components/views/EquipmentView';
import { InventoryView } from './components/views/InventoryView';
import { PreventiveView } from './components/views/PreventiveView';
import { TemplatesView } from './components/views/TemplatesView';
import { ProceduresView } from './components/views/ProceduresView';
import { TagsView } from './components/views/TagsView';
import { LocationsView } from './components/views/LocationsView';
import { UsersView } from './components/views/UsersView';
import { SuppliersView } from './components/views/SuppliersView';
import { ClientsView } from './components/views/ClientsView';

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
  INITIAL_LOCATIONS,
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
  OperationalStatus
} from './types';

// Helper for localStorage state persistence
function getInitialState<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error(`Erreur chargement ${key} depuis localStorage:`, e);
  }
  return fallback;
}

import type { Session } from '@supabase/supabase-js';
import { LogOut } from 'lucide-react';

interface AppProps {
  session: Session;
  onSignOut: () => void;
}

export default function App({ session, onSignOut }: AppProps) {
  const [currentTab, setCurrentTab] = useState<NavigationItem>('work-orders');

  // App Centralized State with localStorage persistence
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() =>
    getInitialState('gmao_workOrders', INITIAL_WORK_ORDERS)
  );
  const [requests, setRequests] = useState<MaintenanceRequest[]>(() =>
    getInitialState('gmao_requests', INITIAL_REQUESTS)
  );
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getInitialState('gmao_conversations', INITIAL_CONVERSATIONS)
  );
  const [messages, setMessages] = useState<Message[]>(() =>
    getInitialState('gmao_messages', INITIAL_MESSAGES)
  );
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(() =>
    getInitialState('gmao_equipment', INITIAL_EQUIPMENT)
  );
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
  const [locations, setLocations] = useState<LocationItem[]>(() =>
    getInitialState('gmao_locations', INITIAL_LOCATIONS)
  );
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
    localStorage.setItem('gmao_workOrders', JSON.stringify(workOrders));
  }, [workOrders]);

  React.useEffect(() => {
    localStorage.setItem('gmao_requests', JSON.stringify(requests));
  }, [requests]);

  React.useEffect(() => {
    localStorage.setItem('gmao_equipment', JSON.stringify(equipmentList));
  }, [equipmentList]);

  React.useEffect(() => {
    localStorage.setItem('gmao_locations', JSON.stringify(locations));
  }, [locations]);

  React.useEffect(() => {
    localStorage.setItem('gmao_inventory', JSON.stringify(inventory));
  }, [inventory]);

  // Handlers - Work Orders
  const handleCreateWorkOrder = (woData: Omit<WorkOrder, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => {
    const newId = `wo-${Date.now()}`;
    const newCode = `OT-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toLocaleString('fr-FR');
    const newWO: WorkOrder = {
      ...woData,
      id: newId,
      code: newCode,
      createdAt: now,
      updatedAt: now
    };
    setWorkOrders(prev => [newWO, ...prev]);
  };

  const handleUpdateWOStatus = (id: string, status: WorkOrderStatus) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status, updatedAt: new Date().toLocaleString('fr-FR') } : wo));
  };

  const handleDeleteWorkOrder = (id: string) => {
    setWorkOrders(prev => prev.filter(wo => wo.id !== id));
  };

  const handleBulkImportWorkOrders = (newOrders: WorkOrder[], replaceExisting?: boolean) => {
    if (replaceExisting) {
      setWorkOrders(newOrders);
      // Update locations state to match only the imported sites
      const importedSites = Array.from(
        new Set(newOrders.flatMap(w => [w.location, w.entity]).filter((s): s is string => Boolean(s) && s.trim().length > 0))
      );
      if (importedSites.length > 0) {
        setLocations(
          importedSites.map((name, idx) => ({
            id: `loc-imp-${Date.now()}-${idx}`,
            name,
            type: 'Site',
            equipmentCount: newOrders.filter(w => w.location === name || w.entity === name).length
          }))
        );
      } else {
        setLocations([]);
      }
    } else {
      setWorkOrders(prev => [...newOrders, ...prev]);
    }
  };

  const handleClearAllWorkOrders = () => {
    setWorkOrders([]);
  };

  const handleRestoreDemoWorkOrders = () => {
    setWorkOrders(INITIAL_WORK_ORDERS);
  };

  const handleEditWorkOrder = (id: string, updated: Partial<WorkOrder>) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, ...updated, updatedAt: new Date().toLocaleString('fr-FR') } : wo));
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
    const newEq: Equipment = {
      ...eq,
      id: `eq-${Date.now()}`,
      createdAt: new Date().toLocaleString('fr-FR'),
      updatedAt: new Date().toLocaleString('fr-FR'),
      workOrdersCount: 0
    };
    setEquipmentList(prev => [newEq, ...prev]);
  };

  const handleUpdateEquipmentStatus = (id: string, status: OperationalStatus) => {
    setEquipmentList(prev => prev.map(e => e.id === id ? {
      ...e,
      status,
      updatedAt: new Date().toLocaleString('fr-FR')
    } : e));
  };

  const handleDeleteEquipment = (id: string) => {
    setEquipmentList(prev => prev.filter(e => e.id !== id));
  };

  const handleEditEquipment = (id: string, updated: Partial<Equipment>) => {
    setEquipmentList(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
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

  const handleAddLocation = (loc: Omit<LocationItem, 'id'>) => {
    setLocations(prev => [...prev, { ...loc, id: `loc-${Date.now()}` }]);
  };

  const handleDeleteLocation = (id: string) => {
    setLocations(prev => prev.filter(l => l.id !== id));
  };

  const handleClearAllLocations = () => {
    setLocations([]);
  };

  const handleResetLocations = () => {
    const currentSites = Array.from(
      new Set(workOrders.flatMap(w => [w.location, w.entity]).filter((s): s is string => Boolean(s) && s.trim().length > 0))
    );
    if (currentSites.length > 0) {
      setLocations(
        currentSites.map((name, idx) => ({
          id: `loc-${idx}`,
          name,
          type: 'Site',
          equipmentCount: workOrders.filter(w => w.location === name || w.entity === name).length
        }))
      );
    } else {
      setLocations([]);
    }
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
            onAddWorkOrder={handleCreateWorkOrder}
            onUpdateStatus={handleUpdateWOStatus}
            onDeleteWorkOrder={handleDeleteWorkOrder}
            onEditWorkOrder={handleEditWorkOrder}
            onBulkImportWorkOrders={handleBulkImportWorkOrders}
            onClearAllWorkOrders={handleClearAllWorkOrders}
            onRestoreDemoWorkOrders={handleRestoreDemoWorkOrders}
            onResetLocations={handleResetLocations}
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
            onAddEquipment={handleAddEquipment}
            onUpdateStatus={handleUpdateEquipmentStatus}
            onDeleteEquipment={handleDeleteEquipment}
            onEditEquipment={handleEditEquipment}
          />
        );
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
            onAddLocation={handleAddLocation}
            onDeleteLocation={handleDeleteLocation}
            onClearAllLocations={handleClearAllLocations}
            onResetLocations={handleResetLocations}
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
    <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden antialiased">
      {/* Bandeau utilisateur connecté */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-1.5 text-xs shrink-0">
        <span className="text-gray-500">
          Connecté en tant que : <span className="font-medium text-gray-700">{session.user.email}</span>
        </span>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
        >
          <LogOut size={13} />
          Se déconnecter
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenHelp={() => setIsHelpModalOpen(true)}
          pendingRequestsCount={requests.filter(r => r.status === 'En attente').length}
        />

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
