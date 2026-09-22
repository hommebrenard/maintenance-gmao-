import React, { useState } from 'react';
import { 
  ClipboardList, 
  Inbox, 
  MessageSquare, 
  BarChart3, 
  Zap, 
  Gauge, 
  Layers, 
  Package, 
  CalendarClock, 
  Folder, 
  LayoutTemplate, 
  CheckSquare, 
  Tag as TagIcon, 
  MapPin, 
  Users, 
  Truck, 
  Building2, 
  HelpCircle, 
  ChevronDown, 
  ChevronRight,
  Settings,
  HeartPulse
} from 'lucide-react';
import { NavigationItem } from '../types';

interface SidebarProps {
  currentTab: NavigationItem;
  onSelectTab: (tab: NavigationItem) => void;
  onOpenHelp: () => void;
  unreadMessagesCount?: number;
  pendingRequestsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenHelp,
  unreadMessagesCount = 0,
  pendingRequestsCount = 0
}) => {
  const [libraryOpen, setLibraryOpen] = useState(true);

  const isActive = (tab: NavigationItem) => currentTab === tab;

  const getItemClass = (tab: NavigationItem) => {
    return `w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors duration-150 ${
      isActive(tab)
        ? 'bg-blue-50 text-blue-600 font-medium'
        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
    }`;
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none text-gray-800">
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-thumb-gray-200">
        
        {/* Top Header - Configuration Center */}
        <div className="mb-4 pb-2 border-b border-gray-100">
          <button 
            onClick={() => onSelectTab('work-orders')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-lg text-left"
          >
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex-1 truncate">
              <div className="text-sm font-bold text-gray-900 leading-none truncate">Centre de configuration</div>
              <div className="text-[11px] text-gray-500 font-normal mt-0.5">GMAO Maintenance</div>
            </div>
          </button>
        </div>

        {/* SECTION: TRAVAIL */}
        <div className="mb-4">
          <div className="px-3 mb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            TRAVAIL
          </div>
          <nav className="space-y-0.5">
            <button
              onClick={() => onSelectTab('work-orders')}
              className={getItemClass('work-orders')}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className={`w-4 h-4 ${isActive('work-orders') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Ordres de travail</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('requests')}
              className={getItemClass('requests')}
            >
              <div className="flex items-center gap-3">
                <Inbox className={`w-4 h-4 ${isActive('requests') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Demandes</span>
              </div>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('messages')}
              className={getItemClass('messages')}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className={`w-4 h-4 ${isActive('messages') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Messages</span>
              </div>
              {unreadMessagesCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* SECTION: OPTIMISER */}
        <div className="mb-4">
          <div className="px-3 mb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            OPTIMISER
          </div>
          <nav className="space-y-0.5">
            <button
              onClick={() => onSelectTab('reports')}
              className={getItemClass('reports')}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className={`w-4 h-4 ${isActive('reports') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Rapports</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('automations')}
              className={getItemClass('automations')}
            >
              <div className="flex items-center gap-3">
                <Zap className={`w-4 h-4 ${isActive('automations') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Automatisations</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('meters')}
              className={getItemClass('meters')}
            >
              <div className="flex items-center gap-3">
                <Gauge className={`w-4 h-4 ${isActive('meters') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Compteurs</span>
              </div>
            </button>
          </nav>
        </div>

        {/* SECTION: GÉRER */}
        <div className="mb-4">
          <div className="px-3 mb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            GÉRER
          </div>
          <nav className="space-y-0.5">
            <button
              onClick={() => onSelectTab('equipment')}
              className={getItemClass('equipment')}
            >
              <div className="flex items-center gap-3">
                <Layers className={`w-4 h-4 ${isActive('equipment') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Équipements</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('health-records')}
              className={getItemClass('health-records')}
            >
              <div className="flex items-center gap-3">
                <HeartPulse className={`w-4 h-4 ${isActive('health-records') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Carnets de santé</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('inventory')}
              className={getItemClass('inventory')}
            >
              <div className="flex items-center gap-3">
                <Package className={`w-4 h-4 ${isActive('inventory') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Inventaire des pièces</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('preventive')}
              className={getItemClass('preventive')}
            >
              <div className="flex items-center gap-3">
                <CalendarClock className={`w-4 h-4 ${isActive('preventive') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Maintenance préventive</span>
              </div>
            </button>

            {/* Accordion: Bibliothèque */}
            <div>
              <button
                onClick={() => setLibraryOpen(!libraryOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-4 h-4 text-gray-500" />
                  <span className="font-normal">Bibliothèque</span>
                </div>
                {libraryOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {libraryOpen && (
                <div className="ml-4 pl-3 border-l border-gray-200 mt-1 space-y-0.5">
                  <button
                    onClick={() => onSelectTab('templates')}
                    className={getItemClass('templates')}
                  >
                    <div className="flex items-center gap-2.5">
                      <LayoutTemplate className={`w-3.5 h-3.5 ${isActive('templates') ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="truncate">Modèles d'ordre de ...</span>
                    </div>
                  </button>

                  <button
                    onClick={() => onSelectTab('procedures')}
                    className={getItemClass('procedures')}
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckSquare className={`w-3.5 h-3.5 ${isActive('procedures') ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span>Procédures</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => onSelectTab('tags')}
              className={getItemClass('tags')}
            >
              <div className="flex items-center gap-3">
                <TagIcon className={`w-4 h-4 ${isActive('tags') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Étiquettes</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('locations')}
              className={getItemClass('locations')}
            >
              <div className="flex items-center gap-3">
                <MapPin className={`w-4 h-4 ${isActive('locations') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Emplacements</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('users')}
              className={getItemClass('users')}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-4 h-4 ${isActive('users') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Utilisateurs et équipes</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('suppliers')}
              className={getItemClass('suppliers')}
            >
              <div className="flex items-center gap-3">
                <Truck className={`w-4 h-4 ${isActive('suppliers') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Fournisseurs</span>
              </div>
            </button>

            <button
              onClick={() => onSelectTab('clients')}
              className={getItemClass('clients')}
            >
              <div className="flex items-center gap-3">
                <Building2 className={`w-4 h-4 ${isActive('clients') ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>Clients</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="p-3 border-t border-gray-200 bg-gray-50/50 space-y-2">
        <button
          onClick={onOpenHelp}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Aide</span>
        </button>

        <div className="flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center border border-blue-200">
              C
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-gray-900 leading-tight">ckom</span>
              <span className="text-[11px] text-gray-500">Administrateur</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </aside>
  );
};
