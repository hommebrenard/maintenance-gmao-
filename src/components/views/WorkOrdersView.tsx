import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  Columns, 
  Star, 
  ClipboardList, 
  Calendar as CalendarIcon, 
  List, 
  Kanban, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  Circle,
  AlertTriangle,
  Building2,
  Users,
  X, 
  User, 
  Wrench, 
  Trash2, 
  Edit3, 
  Printer, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  FileSpreadsheet,
  Upload,
  ListChecks,
  Share2,
  Eye,
  Filter
} from 'lucide-react';
import { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderType, Equipment, GammePlan, WorkOrderTask, LocationItem, IntervenantLog } from '../../types';
import { ImportModal } from './ImportModal';
import { parseGammeCSV, findMatchingGammePlan, formatLocalDate, formatActionCode } from '../../utils/csvParser';
import { SAMPLE_GAMME_CSV } from '../../data/rawImportModels';
import { INITIAL_LOCATIONS } from '../../data/mockData';

interface WorkOrdersViewProps {
  workOrders: WorkOrder[];
  equipmentList: Equipment[];
  locations?: LocationItem[];
  onAddWorkOrder: (wo: Omit<WorkOrder, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateStatus: (id: string, status: WorkOrderStatus) => void;
  onDeleteWorkOrder?: (id: string) => void;
  onEditWorkOrder?: (id: string, updated: Partial<WorkOrder>) => void;
  onBulkImportWorkOrders?: (newOrders: WorkOrder[], replaceExisting?: boolean) => void;
  onClearAllWorkOrders?: () => void;
  onResetLocations?: () => void;
}

function getEquipmentNameOnly(wo?: WorkOrder | null, equipmentList: Equipment[] = []): string {
  if (!wo) return 'Non spécifié';

  // 1. If equipmentName is explicitly provided
  if (wo.equipmentName && wo.equipmentName !== 'Non spécifié' && wo.equipmentName.trim().length > 0) {
    let nameStr = wo.equipmentName.trim();
    if (wo.equipmentCode && nameStr.endsWith(`(${wo.equipmentCode})`)) {
      nameStr = nameStr.substring(0, nameStr.lastIndexOf(`(${wo.equipmentCode})`)).trim();
    } else {
      nameStr = nameStr.replace(/\s*\([^)]*\)\s*$/, '').trim();
    }
    if (nameStr) return nameStr;
  }

  // 2. Extract from legacy description if it contains "Équipement:"
  if (wo.description) {
    const match = wo.description.match(/Équipement:\s*([^;\n]+)/i);
    if (match && match[1]?.trim()) {
      let extracted = match[1].trim();
      extracted = extracted.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (extracted) return extracted;
    }
  }

  // 3. Look up in equipmentList by code
  if (wo.equipmentCode && equipmentList.length > 0) {
    const matched = equipmentList.find(e => e.code === wo.equipmentCode);
    if (matched) {
      return matched.name;
    }
  }

  return 'Non spécifié';
}

function getEquipmentCodeOnly(wo?: WorkOrder | null, equipmentList: Equipment[] = []): string {
  if (!wo) return '—';

  // 1. If equipmentCode is provided and valid
  if (wo.equipmentCode && wo.equipmentCode !== 'Non spécifié' && wo.equipmentCode !== 'NC' && wo.equipmentCode.trim().length > 0) {
    return wo.equipmentCode;
  }

  // 2. Look up in equipmentList by name
  if (wo.equipmentName && equipmentList.length > 0) {
    const nameOnly = getEquipmentNameOnly(wo, equipmentList);
    const matched = equipmentList.find(e => e.name.toLowerCase() === nameOnly.toLowerCase());
    if (matched) return matched.code;
  }

  return '—';
}

function getDisplayDescription(wo?: WorkOrder | null): string {
  if (!wo) return 'Aucune description spécifique renseignée.';
  if (wo.description && wo.description.trim().length > 0) {
    let d = wo.description.trim();
    if (d.toLowerCase().startsWith('équipement:')) {
      const semiIdx = d.indexOf(';');
      if (semiIdx !== -1) {
        d = d.substring(semiIdx + 1).trim();
      } else {
        d = wo.title || 'Intervention de maintenance préventive';
      }
    }
    if (d) return d;
  }
  return wo.title || 'Intervention de maintenance préventive';
}

function getEquipmentLabel(wo?: WorkOrder | null, equipmentList: Equipment[] = []): string {
  return getEquipmentNameOnly(wo, equipmentList);
}

function formatDateLabel(dateStr?: string): string {
  if (!dateStr || dateStr === '—') return '—';

  const cleanStr = dateStr.trim();

  // If ISO string or YYYY-MM-DD or YYYY-MM-DDTHH:mm
  const dateOnly = cleanStr.split('T')[0].split(' ')[0];
  const dashParts = dateOnly.split('-');
  if (dashParts.length === 3) {
    const [y, m, d] = dashParts;
    if (y.length === 4) {
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }

  // If already DD/MM/YYYY or DD/MM/YY
  const slashParts = dateOnly.split('/');
  if (slashParts.length === 3) {
    const [d, m, y] = slashParts;
    const fullYear = y.length === 2 ? `20${y}` : y;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${fullYear}`;
  }

  // If text like "28 avr." or "28 avr. 2026"
  const monthsFr: Record<string, string> = {
    'janv': '01', 'jan': '01', 'janvier': '01',
    'févr': '02', 'fevr': '02', 'feb': '02', 'février': '02', 'fevrier': '02',
    'mars': '03', 'mar': '03',
    'avr': '04', 'avril': '04', 'apr': '04',
    'mai': '05',
    'juin': '06', 'jun': '06',
    'juil': '07', 'jul': '07', 'juillet': '07',
    'août': '08', 'aout': '08', 'aug': '08',
    'sept': '09', 'sep': '09', 'septembre': '09',
    'oct': '10', 'octobre': '10',
    'nov': '11', 'novembre': '11',
    'déc': '12', 'dec': '12', 'décembre': '12', 'decembre': '12'
  };

  const textMatch = cleanStr.match(/^(\d{1,2})\s+([a-zA-Zà-ÿ]+)\.?\s*(\d{4})?$/i);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const monthText = textMatch[2].toLowerCase().replace('.', '');
    const year = textMatch[3] || '2026';
    const foundMonthKey = Object.keys(monthsFr).find(k => monthText.startsWith(k));
    const monthNum = foundMonthKey ? monthsFr[foundMonthKey] : '01';
    return `${day}/${monthNum}/${year}`;
  }

  return dateStr;
}

function getWorkOrderIntervenants(wo?: WorkOrder | null): IntervenantLog[] {
  const durMins = computeDurationMinutes(
    wo?.startDate || wo?.dueDate,
    wo?.startTime,
    wo?.endDate || wo?.dueDate,
    wo?.endTime
  );
  const formattedDur = durMins > 0 ? formatMinutesToHHMM(durMins) : '00:00';

  const logs = wo?.intervenantsLogs;
  if (!logs || logs.length === 0) {
    return [
      { id: '1', name: wo?.assignee || '', timeSpent: formattedDur }
    ];
  }

  return logs.map((log) => {
    if (logs.length === 1 || !log.timeSpent || log.timeSpent === '00:00' || log.timeSpent === '00:00:00' || log.timeSpent === '0') {
      return { ...log, timeSpent: formattedDur };
    }
    return log;
  });
}

function computeDurationMinutes(startDateStr?: string, startTimeStr?: string, endDateStr?: string, endTimeStr?: string): number {
  if (!startTimeStr || !endTimeStr) return 0;
  
  const sDate = startDateStr && startDateStr.includes('-') ? startDateStr : '2026-01-01';
  const eDate = endDateStr && endDateStr.includes('-') ? endDateStr : (startDateStr && startDateStr.includes('-') ? startDateStr : '2026-01-01');
  
  const start = new Date(`${sDate}T${startTimeStr.length === 5 ? startTimeStr + ':00' : startTimeStr}`);
  const end = new Date(`${eDate}T${endTimeStr.length === 5 ? endTimeStr + ':00' : endTimeStr}`);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const sParts = startTimeStr.split(':');
    const eParts = endTimeStr.split(':');
    if (sParts.length >= 2 && eParts.length >= 2) {
      const sMins = (parseInt(sParts[0], 10) || 0) * 60 + (parseInt(sParts[1], 10) || 0);
      const eMins = (parseInt(eParts[0], 10) || 0) * 60 + (parseInt(eParts[1], 10) || 0);
      let diff = eMins - sMins;
      if (diff < 0) diff += 24 * 60;
      return diff;
    }
    return 0;
  }
  
  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) diffMs += 24 * 3600 * 1000;
  
  return Math.floor(diffMs / (1000 * 60));
}

function formatMinutesToHHMM(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return '00:00';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function computeTotalIntervenantsMinutes(logs?: IntervenantLog[]): number {
  if (!logs || logs.length === 0) return 0;
  let totalMins = 0;
  logs.forEach(l => {
    if (l.timeSpent) {
      const parts = l.timeSpent.split(':');
      if (parts.length === 2) {
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        totalMins += h * 60 + m;
      } else {
        const m = parseInt(l.timeSpent, 10);
        if (!isNaN(m)) totalMins += m;
      }
    }
  });
  return totalMins;
}

function formatEcartLabel(durationMins: number, intervenantsMins: number): { label: string; isPositive: boolean; isZero: boolean } {
  const diffMins = durationMins - intervenantsMins;
  if (diffMins === 0) {
    return { label: '00:00 (Conforme)', isPositive: false, isZero: true };
  }
  const sign = diffMins > 0 ? '+' : '-';
  const absMins = Math.abs(diffMins);
  const hrs = Math.floor(absMins / 60);
  const mins = absMins % 60;
  const formatted = `${sign}${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  return {
    label: formatted,
    isPositive: diffMins > 0,
    isZero: false
  };
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  workOrders,
  equipmentList,
  locations = [],
  onAddWorkOrder,
  onUpdateStatus,
  onDeleteWorkOrder,
  onEditWorkOrder,
  onBulkImportWorkOrders,
  onClearAllWorkOrders,
  onResetLocations
}) => {
  const [viewMode, setViewMode] = useState<'todo' | 'list' | 'calendar' | 'workload'>('todo');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
  const [expandedAssignees, setExpandedAssignees] = useState<Set<string>>(new Set());
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  
  // Multi-site dispatch state
  const [isMultiSiteModalOpen, setIsMultiSiteModalOpen] = useState(false);
  const [dispatchWO, setDispatchWO] = useState<WorkOrder | null>(null);
  const [selectedTargetSites, setSelectedTargetSites] = useState<string[]>([]);
  const [dispatchIncludeChecklist, setDispatchIncludeChecklist] = useState(true);
  const [dispatchDateOption, setDispatchDateOption] = useState<'same' | 'sequence'>('same');
  
  // Modals & Popovers state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [isSavedFiltersOpen, setIsSavedFiltersOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [deletingWoId, setDeletingWoId] = useState<string | null>(null);
  
  // Gammes & Checklists state
  const [gammesList, setGammesList] = useState<GammePlan[]>(() => {
    try {
      const saved = localStorage.getItem('gmao_gammesList');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Erreur chargement gammes depuis localStorage:', err);
    }
    return [];
  });

  // Persist gammesList so it no longer disappears on every reload
  useEffect(() => {
    localStorage.setItem('gmao_gammesList', JSON.stringify(gammesList));
  }, [gammesList]);
  const [newTaskText, setNewTaskText] = useState('');
  
  // Calendar Month & Filter State
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarType, setCalendarType] = useState<'month' | 'year'>('month');
  const [calendarFilterSite, setCalendarFilterSite] = useState<string>('all');
  const [calendarFilterStatus, setCalendarFilterStatus] = useState<string>('all');
  const [selectedDayModalDate, setSelectedDayModalDate] = useState<string | null>(null);

  // Sync calendar site filter with global site filter
  useEffect(() => {
    setCalendarFilterSite(selectedLocationFilter);
  }, [selectedLocationFilter]);

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    code: true,
    title: true,
    equipment: true,
    priority: true,
    status: true,
    assignee: true,
    dueDate: true,
    location: true,
    actions: true
  });

  // Create / Edit Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentNameInput, setEquipmentNameInput] = useState('');
  const [equipmentCodeInput, setEquipmentCodeInput] = useState('');
  const [priority, setPriority] = useState<WorkOrderPriority>('Moyenne');
  const [type, setType] = useState<WorkOrderType>('Corrective');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [location, setLocation] = useState('');
  const [assignee, setAssignee] = useState('Jean Dupont');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  // Dynamic Suivi Intervenants, Horaires & Visa
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [visa, setVisa] = useState('');
  const [intervenantsLogs, setIntervenantsLogs] = useState<IntervenantLog[]>([
    { id: '1', name: '', timeSpent: '00:00' }
  ]);

  useEffect(() => {
    const durMins = computeDurationMinutes(startDate, startTime, endDate, endTime);
    if (durMins > 0) {
      const formatted = formatMinutesToHHMM(durMins);
      setIntervenantsLogs(prev => {
        if (prev.length === 1) {
          if (prev[0].timeSpent !== formatted) {
            return [{ ...prev[0], timeSpent: formatted }];
          }
          return prev;
        }
        return prev.map(inter => ({
          ...inter,
          timeSpent: (!inter.timeSpent || inter.timeSpent === '00:00') ? formatted : inter.timeSpent
        }));
      });
    }
  }, [startDate, startTime, endDate, endTime]);

  const handleAddIntervenantRow = () => {
    setIntervenantsLogs(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', timeSpent: '00:00' }
    ]);
  };

  const handleUpdateIntervenantRow = (id: string, field: 'name' | 'timeSpent', val: string) => {
    setIntervenantsLogs(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleRemoveIntervenantRow = (id: string) => {
    setIntervenantsLogs(prev => prev.filter(item => item.id !== id));
  };

  // Sites List Computation - strictly based on active work orders & custom locations
  const availableSiteNames = useMemo(() => {
    // Collect sites present in current active work orders
    const woSites = workOrders
      .flatMap(w => [w.location, w.entity])
      .filter((s): s is string => Boolean(s) && s.trim().length > 0 && s !== 'Tous les sites' && s !== 'all');
    
    const uniqueWOSites = Array.from(new Set(woSites)).sort();

    // If active work orders contain sites, return ONLY those active site names
    if (uniqueWOSites.length > 0) {
      return uniqueWOSites;
    }

    // Fallback if work orders have no site info: return user-configured locations
    if (locations && locations.length > 0) {
      return Array.from(new Set(locations.map(l => l.name))).filter(Boolean).sort();
    }

    return [];
  }, [locations, workOrders]);

  // Available Months Computation (YYYY-MM)
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    workOrders.forEach(wo => {
      if (wo.dueDate && wo.dueDate.length >= 7) {
        monthsSet.add(wo.dueDate.slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort();
  }, [workOrders]);

  const formatMonthLabel = (ymStr: string) => {
    if (!ymStr || ymStr === 'all') return 'Tous les mois';
    const parts = ymStr.split('-');
    if (parts.length < 2) return ymStr;
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return `${monthNames[monthIdx] || parts[1]} ${year}`;
  };

  // Multi-site Dispatch Handler
  const handleConfirmMultiSiteDispatch = () => {
    if (!dispatchWO || selectedTargetSites.length === 0) return;

    const matchedPlan = findMatchingGammePlan(
      dispatchWO.equipmentCode || '',
      dispatchWO.interventionCode || '',
      dispatchWO.title || '',
      gammesList,
      dispatchWO.location || dispatchWO.entity || ''
    );

    const tasksToCopy: WorkOrderTask[] = (dispatchWO.tasks && dispatchWO.tasks.length > 0)
      ? dispatchWO.tasks.map(t => ({ ...t, completed: false }))
      : (matchedPlan?.tasks.map((t, idx) => ({
          id: `task-auto-${idx}`,
          code: formatActionCode(t.actionCode, idx),
          label: t.label,
          completed: false
        })) || []);

    const newOrders: WorkOrder[] = selectedTargetSites.map((siteName, index) => {
      let finalDueDate = dispatchWO.dueDate;
      if (dispatchDateOption === 'sequence') {
        const parts = (dispatchWO.dueDate || '').split('-');
        const baseDate = parts.length === 3
          ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
          : new Date();
        baseDate.setDate(baseDate.getDate() + (index + 1) * 7);
        finalDueDate = formatLocalDate(baseDate);
      }

      return {
        ...dispatchWO,
        id: `wo-site-${Date.now()}-${index}`,
        code: `OT-${Math.floor(100000 + Math.random() * 900000)}`,
        location: siteName,
        entity: siteName,
        tasks: dispatchIncludeChecklist ? tasksToCopy : [],
        status: 'Ouvert' as WorkOrderStatus,
        createdAt: new Date().toLocaleString('fr-FR'),
        updatedAt: new Date().toLocaleString('fr-FR')
      };
    });

    if (onBulkImportWorkOrders) {
      onBulkImportWorkOrders(newOrders);
    } else {
      newOrders.forEach(wo => onAddWorkOrder(wo));
    }

    setIsMultiSiteModalOpen(false);
    setDispatchWO(null);
    setSelectedTargetSites([]);
  };

  // Filter Logic
  const todayStr = formatLocalDate(new Date());

  const filteredOrders = workOrders.filter(wo => {
    const matchesSearch = wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          wo.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (wo.equipmentName && wo.equipmentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (wo.assignee && wo.assignee.toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchesStatus = true;
    if (selectedStatusFilter === 'Ouvert') matchesStatus = wo.status === 'Ouvert';
    else if (selectedStatusFilter === 'En cours') matchesStatus = wo.status === 'En cours';
    else if (selectedStatusFilter === 'En attente') matchesStatus = wo.status === 'En attente';
    else if (selectedStatusFilter === 'Terminé') matchesStatus = wo.status === 'Terminé';
    else if (selectedStatusFilter === 'Affecté à moi') matchesStatus = wo.assignee === 'ckom' || wo.assignee === 'Jean Dupont' || wo.assignee === 'Moi';
    else if (selectedStatusFilter === 'En retard') {
      matchesStatus = wo.dueDate < todayStr && wo.status !== 'Terminé';
    }
    else if (selectedStatusFilter === 'Anomalies') {
      matchesStatus = !!wo.tasks?.some(t => t.isAnomaly);
    }

    let matchesPriority = true;
    if (selectedPriorityFilter !== 'all') {
      matchesPriority = wo.priority === selectedPriorityFilter;
    }

    let matchesLocation = true;
    if (selectedLocationFilter !== 'all') {
      matchesLocation = wo.location === selectedLocationFilter || wo.entity === selectedLocationFilter;
    }

    let matchesMonth = true;
    if (selectedMonthFilter !== 'all') {
      matchesMonth = Boolean(wo.dueDate && wo.dueDate.startsWith(selectedMonthFilter));
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesLocation && matchesMonth;
  });

  // Reset Create Form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEquipmentNameInput('');
    setEquipmentCodeInput('');
    setPriority('Moyenne');
    setType('Corrective');
    setSelectedEquipmentId('');
    setLocation('');
    setAssignee('Jean Dupont');
    const todayFormatted = formatLocalDate(new Date());
    setDueDate(todayFormatted);
    setStartDate(todayFormatted);
    setStartTime('');
    setEndDate(todayFormatted);
    setEndTime('');
    setVisa('');
    setIntervenantsLogs([{ id: '1', name: assignee || '', timeSpent: '00:00' }]);
  };

  // Bulk Import Handlers
  const handleImportWorkOrders = (importedOrders: WorkOrder[], replaceExisting?: boolean) => {
    if (replaceExisting && onClearAllWorkOrders) {
      onClearAllWorkOrders();
    }
    if (onBulkImportWorkOrders) {
      onBulkImportWorkOrders(importedOrders, replaceExisting);
    } else {
      importedOrders.forEach(wo => {
        onAddWorkOrder({
          title: wo.title,
          description: wo.description,
          priority: wo.priority,
          type: wo.type,
          status: wo.status,
          equipmentName: wo.equipmentName,
          location: wo.location,
          assignee: wo.assignee,
          dueDate: wo.dueDate,
          equipmentCode: wo.equipmentCode,
          planner: wo.planner,
          planNumber: wo.planNumber,
          interventionCode: wo.interventionCode,
          entity: wo.entity,
          tasks: wo.tasks
        });
      });
    }
  };

  const handleImportGammes = (importedGammes: GammePlan[]) => {
    setGammesList(prev => [...importedGammes, ...prev]);
  };

  const handleClearGammes = () => {
    setGammesList([]);
  };

  // Open Edit Mode inside Detail Modal
  const handleOpenEdit = (wo: WorkOrder) => {
    setSelectedWorkOrder(wo);
    setTitle(wo.title);
    setDescription(getDisplayDescription(wo));
    setPriority(wo.priority);
    setType(wo.type);
    setSelectedEquipmentId(wo.equipmentId || '');
    setEquipmentNameInput(getEquipmentNameOnly(wo, equipmentList));
    setEquipmentCodeInput(getEquipmentCodeOnly(wo, equipmentList));
    setLocation(wo.location || '');
    setAssignee(wo.assignee);
    setDueDate(wo.dueDate);
    setStartDate(wo.startDate || wo.dueDate || '');
    setStartTime(wo.startTime || '');
    setEndDate(wo.endDate || wo.dueDate || '');
    setEndTime(wo.endTime || '');
    setVisa(wo.visa || '');
    setIntervenantsLogs(getWorkOrderIntervenants(wo));
    setIsEditMode(true);
  };

  // Submit Create Form
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const eq = equipmentList.find(e => e.id === selectedEquipmentId);

    onAddWorkOrder({
      title,
      description,
      status: 'Ouvert',
      priority,
      type,
      equipmentId: selectedEquipmentId || undefined,
      equipmentName: eq ? `${eq.name} (${eq.code})` : undefined,
      location: location || (eq ? eq.location : 'Atelier Principal'),
      assignee,
      dueDate,
      startDate: startDate || dueDate,
      startTime: startTime || '',
      endDate: endDate || dueDate,
      endTime: endTime || '',
      intervenantsLogs: intervenantsLogs.length > 0 ? intervenantsLogs : [{ id: '1', name: assignee || '', timeSpent: '00:00' }],
      visa: visa || ''
    });

    resetForm();
    setIsCreateModalOpen(false);
  };

  // Submit Edit Form
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkOrder || !onEditWorkOrder) return;

    const eq = equipmentList.find(e => e.id === selectedEquipmentId);
    const finalEqName = equipmentNameInput.trim() || (eq ? eq.name : selectedWorkOrder.equipmentName);
    const finalEqCode = equipmentCodeInput.trim() || (eq ? eq.code : selectedWorkOrder.equipmentCode);

    const updatedData = {
      title,
      description,
      priority,
      type,
      equipmentId: selectedEquipmentId || undefined,
      equipmentName: finalEqName,
      equipmentCode: finalEqCode,
      location: location || selectedWorkOrder.location,
      assignee,
      dueDate,
      startDate,
      startTime,
      endDate,
      endTime,
      intervenantsLogs,
      visa,
    };

    onEditWorkOrder(selectedWorkOrder.id, updatedData);

    setSelectedWorkOrder(prev => prev ? {
      ...prev,
      ...updatedData
    } : null);

    setIsEditMode(false);
  };

  // Delete Work Order
  const handleDelete = (id: string) => {
    setDeletingWoId(id);
  };

  // CSV Export Functionality
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    const headers = ["Code", "Titre", "Statut", "Priorite", "Type", "Equipement", "Assigne", "Echeance", "Emplacement", "Date Creation"];
    const rows = filteredOrders.map(wo => [
      `"${wo.code}"`,
      `"${wo.title.replace(/"/g, '""')}"`,
      `"${wo.status}"`,
      `"${wo.priority}"`,
      `"${wo.type}"`,
      `"${(wo.equipmentName || '').replace(/"/g, '""')}"`,
      `"${wo.assignee}"`,
      `"${wo.dueDate}"`,
      `"${(wo.location || '').replace(/"/g, '""')}"`,
      `"${wo.createdAt}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ordres_de_travail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Work Order Ticket with full formatted PDF/A4-style sheet
  const handlePrint = () => {
    if (!selectedWorkOrder) {
      window.print();
      return;
    }

    try {
      const eqName = getEquipmentNameOnly(selectedWorkOrder, equipmentList);
      const eqCode = getEquipmentCodeOnly(selectedWorkOrder, equipmentList);
      const matchedPlan = findMatchingGammePlan(
        selectedWorkOrder.equipmentCode || '',
        selectedWorkOrder.interventionCode || '',
        selectedWorkOrder.title || '',
        gammesList,
        selectedWorkOrder.location || selectedWorkOrder.entity || ''
      );
      const activeTasks = (selectedWorkOrder.tasks && selectedWorkOrder.tasks.length > 0)
        ? selectedWorkOrder.tasks
        : (matchedPlan?.tasks.map((t, idx) => ({ code: formatActionCode(t.actionCode, idx), label: t.label, completed: false, comment: undefined as string | undefined, isAnomaly: false })) || []);

      const printIntervenants = getWorkOrderIntervenants(selectedWorkOrder);
      const printTotalInterMins = computeTotalIntervenantsMinutes(printIntervenants);
      const printStartDate = selectedWorkOrder.startDate || selectedWorkOrder.dueDate;
      const printStartTime = selectedWorkOrder.startTime || '—';
      const printEndDate = selectedWorkOrder.endDate || selectedWorkOrder.dueDate;
      const printEndTime = selectedWorkOrder.endTime || '—';
      const printDurMins = computeDurationMinutes(printStartDate, selectedWorkOrder.startTime, printEndDate, selectedWorkOrder.endTime);
      const printEcart = formatEcartLabel(printDurMins, printTotalInterMins);

      const printWindow = window.open('', '_blank', 'width=850,height=900');
      if (printWindow) {
        const htmlContent = `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8">
            <title>Fiche Ordre de Travail - ${selectedWorkOrder.code}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 10mm 12mm;
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                padding: 16px;
                color: #0f172a;
                line-height: 1.35;
                background: #ffffff;
                font-size: 12px;
              }
              .no-print { margin-bottom: 16px; text-align: right; }
              .btn-print {
                padding: 8px 18px;
                background: #2563eb;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                font-weight: bold;
                cursor: pointer;
                font-size: 13px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .btn-print:hover { background: #1d4ed8; }
              
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 10px;
                margin-bottom: 14px;
              }
              .title-group { max-width: 75%; }
              .ot-code { font-family: monospace; font-size: 13px; font-weight: bold; color: #2563eb; letter-spacing: 0.5px; }
              .ot-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 2px 0 0 0; line-height: 1.25; }
              .badge-container { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
              .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
              .badge-status { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
              .badge-priority { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
              
              .grid-info {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                margin-bottom: 14px;
                background: #f8fafc;
                padding: 10px 14px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
              }
              .info-block { display: flex; flex-direction: column; }
              .label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
              .value { font-size: 12px; color: #0f172a; font-weight: 600; word-break: break-word; }
              .code-badge { font-family: monospace; font-weight: bold; color: #1d4ed8; background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe; display: inline-block; }
              
              .section-header {
                font-size: 11px;
                font-weight: 800;
                color: #334155;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-top: 14px;
                margin-bottom: 6px;
                border-bottom: 1.5px solid #e2e8f0;
                padding-bottom: 4px;
                page-break-after: avoid;
                break-after: avoid;
              }
              .desc-box {
                background: #ffffff;
                padding: 8px 12px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
                font-size: 11px;
                color: #334155;
                font-weight: 500;
              }
              
              table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; page-break-inside: auto; }
              thead { display: table-header-group; }
              th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 10px; }
              td { padding: 6px 8px; border: 1px solid #cbd5e1; color: #1e293b; vertical-align: middle; }
              tr { page-break-inside: avoid; break-inside: avoid; }
              .action-code { font-family: monospace; font-weight: bold; color: #2563eb; }
              .check-col { text-align: center; font-weight: bold; width: 70px; }
              
              .signatures {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 20px;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .sig-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center; background: #fafafa; }
              .sig-box { height: 45px; border: 1px dashed #94a3b8; border-radius: 4px; margin-top: 6px; background: #ffffff; }
              
              @media print {
                body { padding: 0; background: #ffffff; }
                .no-print { display: none !important; }
                .grid-info { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="no-print">
              <button onclick="window.print()" class="btn-print">
                🖨️ Imprimer la Fiche OT
              </button>
            </div>
            
            <div class="header">
              <div class="title-group">
                <div class="ot-code">${selectedWorkOrder.code}</div>
                <h1 class="ot-title">${selectedWorkOrder.title}</h1>
              </div>
              <div class="badge-container">
                <span class="badge badge-status">Statut: ${selectedWorkOrder.status}</span>
                <span class="badge badge-priority">Priorité: ${selectedWorkOrder.priority}</span>
              </div>
            </div>

            <div class="grid-info">
              <div class="info-block">
                <span class="label">Équipement (Nom)</span>
                <span class="value">${eqName}</span>
              </div>
              <div class="info-block">
                <span class="label">Code Équipement</span>
                <span class="value"><span class="code-badge">${eqCode}</span></span>
              </div>
              <div class="info-block">
                <span class="label">Emplacement / Site</span>
                <span class="value">${selectedWorkOrder.location || selectedWorkOrder.entity || 'Site Principal'}</span>
              </div>
              <div class="info-block" style="margin-top: 6px;">
                <span class="label">Planificateur / Assigné à</span>
                <span class="value">${selectedWorkOrder.assignee || selectedWorkOrder.planner || 'Technicien'}</span>
              </div>
              <div class="info-block" style="margin-top: 6px;">
                <span class="label">Date d'échéance</span>
                <span class="value">${selectedWorkOrder.dueDate}</span>
              </div>
              <div class="info-block" style="margin-top: 6px;">
                <span class="label">Type d'intervention</span>
                <span class="value">${selectedWorkOrder.type || 'Préventive'}</span>
              </div>
            </div>

            <div class="section-header">Description de l'intervention</div>
            <div class="desc-box">
              ${getDisplayDescription(selectedWorkOrder)}
            </div>

            <div class="section-header">Suivi des Intervenants, Temps & Horaires de réalisation</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px;">
              <thead>
                <tr style="background-color: #e2e8f0; color: #0f172a; font-weight: bold;">
                  <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 35px; text-align: center;">#</th>
                  <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Nom(s) Intervenant(s)</th>
                  <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 130px; text-align: right;">Temps passé</th>
                </tr>
              </thead>
              <tbody>
                ${printIntervenants.map((item, idx) => `
                  <tr>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; background-color: #f1f5f9; font-weight: bold;">${idx + 1}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${item.name || 'Non spécifié'}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: bold;">${item.timeSpent || '00:00'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="display: flex; gap: 12px; margin-top: 10px; font-size: 11px;">
              <div style="flex: 1.3;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="background-color: #f1f5f9; color: #334155; font-weight: bold;">
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; width: 75px;"></th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">Date</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; width: 80px;">Heure</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">de Début</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">${printStartDate ? formatDateLabel(printStartDate) : '—'}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: bold;">${printStartTime}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">de Fin</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">${printEndDate ? formatDateLabel(printEndDate) : '—'}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: bold;">${printEndTime}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style="flex: 1; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 4px; background-color: #fafafa; display: flex; flex-direction: column;">
                <div style="font-weight: bold; font-size: 10px; color: #475569; text-transform: uppercase;">Visa</div>
                <div style="flex: 1; min-height: 40px; margin-top: 4px; font-size: 11px; color: #334155;">
                  ${selectedWorkOrder.visa ? selectedWorkOrder.visa : ''}
                </div>
              </div>
            </div>

            <div class="section-header">Gamme opératoire & Checklist des actions (${activeTasks.length})</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 100px;">Code Action</th>
                  <th>Description de l'action / contrôle</th>
                  <th class="check-col">Réalisé</th>
                  <th style="width: 130px;">Visa / Observations</th>
                </tr>
              </thead>
              <tbody>
                ${activeTasks.length > 0 ? activeTasks.map((t, idx) => `
                  <tr>
                    <td class="action-code">${formatActionCode(t.code, idx)}</td>
                    <td>${t.label}</td>
                    <td class="check-col">${t.completed ? '✅ Oui' : '[  ]'}</td>
                    <td>${t.isAnomaly ? '⚠️ ANOMALIE — ' : ''}${t.comment ? t.comment.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 12px;">Aucune action enregistrée sous cet ordre de travail.</td></tr>'}
              </tbody>
            </table>

            <div class="signatures">
              <div class="sig-card">
                <span class="label">Signature & Visa Technicien</span>
                <div class="sig-box"></div>
              </div>
              <div class="sig-card">
                <span class="label">Validation & Remarques Superviseur</span>
                <div class="sig-box"></div>
              </div>
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 400);
              };
            </script>
          </body>
          </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Print error:", err);
      window.print();
    }
  };

  // Badges styling
  const getPriorityBadgeClass = (p: WorkOrderPriority) => {
    switch(p) {
      case 'Urgente': return 'bg-red-100 text-red-700 border-red-200';
      case 'Élevée': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Moyenne': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadgeClass = (s: WorkOrderStatus) => {
    switch(s) {
      case 'Terminé': return 'bg-green-100 text-green-700 border-green-200';
      case 'En cours': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'En attente': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Mon index 0

    const days = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  // Workload Helper Grouping
  const assigneesMap = filteredOrders.reduce((acc, wo) => {
    const name = wo.assignee || 'Non assigné';
    if (!acc[name]) acc[name] = [];
    acc[name].push(wo);
    return acc;
  }, {} as Record<string, WorkOrder[]>);

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col">
      {/* Header Section */}
      <div className="px-6 py-5 border-b border-gray-200 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Ordres de travail</h1>
            <p className="text-sm text-gray-500 mt-1">
              Planifiez, affectez et suivez les travaux de maintenance ({filteredOrders.length} résultat{filteredOrders.length > 1 ? 's' : ''}).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switcher */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg text-sm border border-gray-200">
              <button
                onClick={() => setViewMode('todo')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'todo' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Kanban className="w-4 h-4" />
                <span>À faire</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Liste</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Calendrier</span>
              </button>
              <button
                onClick={() => setViewMode('workload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'workload' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Charge de travail</span>
              </button>
            </div>

            {/* New Work Order Button */}
            <button
              onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel ordre de travail</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[240px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher (code, titre, technicien)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Pill Filters */}
            {['Ouvert', 'En cours', 'En attente', 'Terminé', 'Affecté à moi', 'En retard'].map(pill => (
              <button
                key={pill}
                onClick={() => setSelectedStatusFilter(selectedStatusFilter === pill ? null : pill)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  selectedStatusFilter === pill
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pill}
              </button>
            ))}

            {workOrders.some(wo => wo.tasks?.some(t => t.isAnomaly)) && (
              <button
                onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'Anomalies' ? null : 'Anomalies')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  selectedStatusFilter === 'Anomalies'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Anomalies ({workOrders.filter(wo => wo.tasks?.some(t => t.isAnomaly)).length})
              </button>
            )}

            {/* Dropdown Filters */}
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none cursor-pointer hover:bg-gray-50"
            >
              <option value="all">Priorité (Toutes)</option>
              <option value="Faible">Faible</option>
              <option value="Moyenne">Moyenne</option>
              <option value="Élevée">Élevée</option>
              <option value="Urgente">Urgente</option>
            </select>

            {/* Site / Location Dropdown Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={selectedLocationFilter}
                onChange={(e) => setSelectedLocationFilter(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer pr-1 font-semibold text-gray-800"
              >
                <option value="all">Tous les sites (Global)</option>
                {availableSiteNames.map((site) => (
                  <option key={site} value={site}>{site}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocationFilter('all');
                  if (onResetLocations) {
                    onResetLocations();
                  }
                }}
                className={`p-1 rounded transition-colors ${
                  selectedLocationFilter !== 'all'
                    ? 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                    : 'text-gray-400 hover:text-blue-600 hover:bg-gray-100'
                }`}
                title="Réinitialiser et sélectionner 'Tous les sites (Global)'"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Month / Period Dropdown Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-2xs">
              <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={selectedMonthFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMonthFilter(val);
                  if (val !== 'all') {
                    const [y, m] = val.split('-');
                    setCalendarDate(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1));
                  }
                }}
                className="bg-transparent focus:outline-none cursor-pointer pr-1 font-semibold text-gray-800"
              >
                <option value="all">Tous les mois ({availableMonths.length})</option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters Button if any filter active */}
            {(selectedStatusFilter || selectedPriorityFilter !== 'all' || selectedLocationFilter !== 'all' || selectedMonthFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedStatusFilter(null);
                  setSelectedPriorityFilter('all');
                  setSelectedLocationFilter('all');
                  setSelectedMonthFilter('all');
                  setSearchQuery('');
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                title="Réinitialiser les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Effacer filtres</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Mes filtres Button & Popover */}
            <div className="relative">
              <button 
                onClick={() => setIsSavedFiltersOpen(!isSavedFiltersOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                  isSavedFiltersOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span>Mes filtres</span>
              </button>

              {isSavedFiltersOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-30 space-y-2 text-xs">
                  <div className="font-semibold text-gray-900 border-b pb-1.5">Filtres rapides enregistrés</div>
                  <button
                    onClick={() => {
                      setSelectedStatusFilter('En retard');
                      setSelectedPriorityFilter('all');
                      setIsSavedFiltersOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-gray-700 flex items-center justify-between"
                  >
                    <span>Urgent & En retard</span>
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Priorité</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStatusFilter('Affecté à moi');
                      setSelectedPriorityFilter('all');
                      setIsSavedFiltersOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-gray-700 flex items-center justify-between"
                  >
                    <span>Mes travaux en cours</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Moi</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStatusFilter('Ouvert');
                      setSelectedPriorityFilter('Urgente');
                      setIsSavedFiltersOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-gray-700 flex items-center justify-between"
                  >
                    <span>Interventions urgentes</span>
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Critique</span>
                  </button>
                </div>
              )}
            </div>

            {/* Exporter CSV Button */}
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Exporter au format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter</span>
            </button>

            {/* Importer Excel / CSV Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-2xs"
              title="Importer des fichiers Planning et Gamme opératoire (Excel / CSV)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Importer Excel / CSV</span>
            </button>

            {/* Clear / Reset All Work Orders Button */}
            {onClearAllWorkOrders && workOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs"
                title="Vider et effacer tous les Ordres de Travail actuels"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Tout vider</span>
              </button>
            )}

            {/* Colonnes Button & Modal */}
            <div className="relative">
              <button 
                onClick={() => setIsColumnsModalOpen(!isColumnsModalOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                  isColumnsModalOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Colonnes</span>
              </button>

              {isColumnsModalOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-30 space-y-2 text-xs">
                  <div className="font-semibold text-gray-900 border-b pb-1.5">Colonnes affichées</div>
                  {Object.entries({
                    code: 'Code OT',
                    title: 'Titre',
                    equipment: 'Équipement',
                    priority: 'Priorité',
                    status: 'Statut',
                    assignee: 'Assigné à',
                    dueDate: 'Échéance',
                    location: 'Emplacement',
                    actions: 'Actions'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={visibleColumns[key as keyof typeof visibleColumns]}
                        onChange={(e) => setVisibleColumns({
                          ...visibleColumns,
                          [key]: e.target.checked
                        })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 bg-gray-50/50">
        {filteredOrders.length === 0 ? (
          /* Empty State Box */
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-white my-6 max-w-4xl mx-auto shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 text-blue-500">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Aucun ordre de travail ne correspond</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Essayez de modifier vos termes de recherche ou vos filtres pour voir d'autres résultats.
            </p>
            <button
              onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel ordre de travail</span>
            </button>
          </div>
        ) : viewMode === 'todo' ? (
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['Ouvert', 'En cours', 'En attente', 'Terminé'] as WorkOrderStatus[]).map(status => {
              const ordersInStatus = filteredOrders.filter(o => o.status === status);
              return (
                <div key={status} className="bg-gray-100/70 p-3 rounded-xl border border-gray-200 flex flex-col h-full min-h-[500px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="font-semibold text-xs text-gray-700 uppercase tracking-wider">{status}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
                      {ordersInStatus.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {ordersInStatus.map(order => (
                      <div
                        key={order.id}
                        onClick={() => { setSelectedWorkOrder(order); setIsEditMode(false); }}
                        className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2.5 group relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          {order.code && order.code.toUpperCase() !== 'NC' && order.code !== 'OT-NC' ? (
                            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{order.code}</span>
                          ) : (
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300" title="Ordre de travail non encore créé / sans N° OT (NC)">
                              N° OT: NC (Non créé)
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            {order.tasks?.some(t => t.isAnomaly) && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300" title="Une anomalie a été signalée sur cet OT">
                                <AlertTriangle className="w-2.5 h-2.5" />
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(order.priority)}`}>
                              {order.priority}
                            </span>
                            {onDeleteWorkOrder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(order.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer cet OT"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <h4 className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-blue-600 transition-colors">
                          {order.title}
                        </h4>

                        <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                          <Wrench className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{getEquipmentLabel(order, equipmentList)}</span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span>{order.assignee}</span>
                          </div>
                          <div className={`flex items-center gap-1 ${order.dueDate < todayStr && order.status !== 'Terminé' ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{order.dueDate}</span>
                          </div>
                        </div>

                        {/* Quick complete button on card */}
                        {order.status !== 'Terminé' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateStatus(order.id, 'Terminé');
                            }}
                            className="mt-2 w-full py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md flex items-center justify-center gap-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Terminer</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'list' ? (
          /* Table List View */
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase">
                <tr>
                  {visibleColumns.code && <th className="px-4 py-3">Code</th>}
                  {visibleColumns.title && <th className="px-4 py-3">Titre</th>}
                  {visibleColumns.equipment && <th className="px-4 py-3">Équipement</th>}
                  {visibleColumns.priority && <th className="px-4 py-3">Priorité</th>}
                  {visibleColumns.status && <th className="px-4 py-3">Statut</th>}
                  {visibleColumns.assignee && <th className="px-4 py-3">Assigné à</th>}
                  {visibleColumns.dueDate && <th className="px-4 py-3">Échéance</th>}
                  {visibleColumns.location && <th className="px-4 py-3">Emplacement</th>}
                  {visibleColumns.actions && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map(order => (
                  <tr 
                    key={order.id}
                    onClick={() => { setSelectedWorkOrder(order); setIsEditMode(false); }}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {visibleColumns.code && (
                      <td className="px-4 py-3">
                        {order.code && order.code.toUpperCase() !== 'NC' && order.code !== 'OT-NC' ? (
                          <span className="font-mono text-xs font-bold text-gray-800">{order.code}</span>
                        ) : (
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300" title="Ordre de travail non encore créé / sans N° OT (NC)">
                            NC (Non créé)
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.title && (
                      <td className="px-4 py-3 font-medium text-gray-900">{order.title}</td>
                    )}
                    {visibleColumns.equipment && (
                      <td className="px-4 py-3 text-gray-800 font-medium">{getEquipmentLabel(order, equipmentList)}</td>
                    )}
                    {visibleColumns.priority && (
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getPriorityBadgeClass(order.priority)}`}>
                          {order.priority}
                        </span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-3">
                        <select
                          value={order.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onUpdateStatus(order.id, e.target.value as WorkOrderStatus)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border focus:outline-none cursor-pointer ${getStatusBadgeClass(order.status)}`}
                        >
                          <option value="Ouvert">Ouvert</option>
                          <option value="En cours">En cours</option>
                          <option value="En attente">En attente</option>
                          <option value="Terminé">Terminé</option>
                        </select>
                      </td>
                    )}
                    {visibleColumns.assignee && (
                      <td className="px-4 py-3 text-gray-600">{order.assignee}</td>
                    )}
                    {visibleColumns.dueDate && (
                      <td className={`px-4 py-3 text-xs ${order.dueDate < todayStr && order.status !== 'Terminé' ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {order.dueDate}
                      </td>
                    )}
                    {visibleColumns.location && (
                      <td className="px-4 py-3 text-gray-600 text-xs">{order.location || 'Atelier'}</td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(order)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {onDeleteWorkOrder && (
                            <button
                              onClick={() => handleDelete(order.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'calendar' ? (
          /* Calendar View */
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5">
            {/* Calendar Header Controls & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900 capitalize flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  <span>
                    {calendarType === 'year' 
                      ? `Calendrier Annuel ${calendarDate.getFullYear()}` 
                      : calendarDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                </h3>

                {/* Calendar View Type Switcher (Mensuel vs Annuel) */}
                <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-semibold ml-2">
                  <button
                    type="button"
                    onClick={() => setCalendarType('month')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      calendarType === 'month' 
                        ? 'bg-white text-blue-700 shadow-2xs font-bold' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Vue Mensuelle
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarType('year')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      calendarType === 'year' 
                        ? 'bg-white text-blue-700 shadow-2xs font-bold' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Vue Annuelle (12 mois)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date())}
                  className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shadow-2xs"
                >
                  Aujourd'hui
                </button>
              </div>

              {/* Calendar Quick Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Site Filter */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1">
                  <Building2 className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-[11px] font-semibold text-gray-500 uppercase">Site:</span>
                  <select
                    value={calendarFilterSite}
                    onChange={(e) => setCalendarFilterSite(e.target.value)}
                    className="text-xs font-bold text-gray-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tous les sites ({availableSiteNames.length})</option>
                    {availableSiteNames.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1">
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-semibold text-gray-500 uppercase">Statut:</span>
                  <select
                    value={calendarFilterStatus}
                    onChange={(e) => setCalendarFilterStatus(e.target.value)}
                    className="text-xs font-bold text-gray-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="Ouvert">Ouvert</option>
                    <option value="En cours">En cours</option>
                    <option value="En attente">En attente</option>
                    <option value="Terminé">Terminé</option>
                  </select>
                </div>

                {/* Navigation Arrows */}
                <div className="flex items-center gap-1 ml-auto md:ml-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarType === 'year') {
                        setCalendarDate(new Date(calendarDate.getFullYear() - 1, 0, 1));
                      } else {
                        setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
                      }
                    }}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                    title={calendarType === 'year' ? "Année précédente" : "Mois précédent"}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarType === 'year') {
                        setCalendarDate(new Date(calendarDate.getFullYear() + 1, 0, 1));
                      } else {
                        setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
                      }
                    }}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                    title={calendarType === 'year' ? "Année suivante" : "Mois suivant"}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Annual View vs Monthly View Render */}
            {calendarType === 'year' ? (
              /* ANNUAL VIEW (12 MONTHS GRID) */
              <div className="space-y-4">
                <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex items-center justify-between text-xs text-blue-900">
                  <span className="font-semibold flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    Vue d'ensemble sur l'année <strong>{calendarDate.getFullYear()}</strong> — Cliquez sur n'importe quel OT pour voir ou modifier son état instantanément.
                  </span>
                  <span className="font-bold bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                    Total : {filteredOrders.filter(o => o.dueDate && o.dueDate.startsWith(`${calendarDate.getFullYear()}`)).length} OT planifiés
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 12 }).map((_, mIdx) => {
                    const monthDate = new Date(calendarDate.getFullYear(), mIdx, 1);
                    const monthName = monthDate.toLocaleString('fr-FR', { month: 'long' });
                    const monthIsoPrefix = `${calendarDate.getFullYear()}-${String(mIdx + 1).padStart(2, '0')}`;

                    // Filter OTs for this specific month
                    const monthOrders = filteredOrders.filter(o => {
                      const matchesMonth = Boolean(o.dueDate && o.dueDate.startsWith(monthIsoPrefix));
                      const matchesSite = calendarFilterSite === 'all' || o.location === calendarFilterSite || o.entity === calendarFilterSite;
                      const matchesStatus = calendarFilterStatus === 'all' || o.status === calendarFilterStatus;
                      return matchesMonth && matchesSite && matchesStatus;
                    });

                    const countCompleted = monthOrders.filter(o => o.status === 'Terminé').length;
                    const countInProgress = monthOrders.filter(o => o.status === 'En cours').length;
                    const countPending = monthOrders.filter(o => o.status === 'En attente').length;
                    const countOpen = monthOrders.filter(o => o.status === 'Ouvert').length;

                    return (
                      <div 
                        key={mIdx}
                        className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-2.5"
                      >
                        {/* Month Title & Zoom Button */}
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <h4 className="font-extrabold text-sm capitalize text-gray-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600" />
                            {monthName} {calendarDate.getFullYear()}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setCalendarDate(new Date(calendarDate.getFullYear(), mIdx, 1));
                              setCalendarType('month');
                            }}
                            className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors"
                            title="Zoomer sur la grille mensuelle complète"
                          >
                            Ouvrir le mois
                          </button>
                        </div>

                        {/* Status Summary Chips */}
                        <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200">
                            Total: {monthOrders.length}
                          </span>
                          {countCompleted > 0 && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                              {countCompleted} faits
                            </span>
                          )}
                          {countInProgress > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                              {countInProgress} en cours
                            </span>
                          )}
                          {(countOpen > 0 || countPending > 0) && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">
                              {countOpen + countPending} à faire
                            </span>
                          )}
                        </div>

                        {/* Work Orders List inside Month Box */}
                        <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                          {monthOrders.length === 0 ? (
                            <p className="text-[11px] text-gray-400 italic py-2 text-center">Aucun OT planifié</p>
                          ) : (
                            monthOrders.map(wo => {
                              const isNC = !wo.code || wo.code.toUpperCase() === 'NC' || wo.code === 'OT-NC';
                              return (
                                <div
                                  key={wo.id}
                                  onClick={() => { setSelectedWorkOrder(wo); setIsEditMode(false); }}
                                  className={`p-2 rounded-lg border text-xs cursor-pointer hover:shadow-xs transition-all space-y-1 ${
                                    wo.status === 'Terminé' 
                                      ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/70' 
                                      : wo.priority === 'Urgente'
                                      ? 'bg-red-50/70 border-red-200 hover:bg-red-100'
                                      : 'bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                                  }`}
                                  title="Cliquer pour voir ou modifier la fiche détaillée de cet OT"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1 min-w-0">
                                      {!isNC ? (
                                        <span className="font-mono text-[10px] font-extrabold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                          {wo.code}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300 shrink-0" title="Ordre de travail non créé / sans N° OT">
                                          NC (Non créé)
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {wo.dueDate && (
                                        <span className="text-[9px] font-bold text-gray-700 bg-white px-1.5 py-0.2 rounded border border-gray-200 flex items-center gap-0.5" title={`Date d'échéance: ${wo.dueDate}`}>
                                          📅 {formatDateLabel(wo.dueDate)}
                                        </span>
                                      )}
                                      <span className={`shrink-0 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                                        wo.status === 'Terminé'
                                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                          : wo.status === 'En cours'
                                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                                          : wo.status === 'En attente'
                                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                                          : 'bg-slate-100 text-slate-800 border-slate-300'
                                      }`}>
                                        {wo.status}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-[10px] font-semibold text-gray-800 truncate leading-tight">
                                    {wo.title}
                                  </p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* MONTHLY VIEW (GRID DAY BY DAY) */
              <>
                {/* Calendar Days Header */}
                <div className="grid grid-cols-7 text-center font-bold text-xs text-gray-600 py-2.5 bg-gray-50 rounded-t-lg border border-gray-200">
                  <div>Lundi</div>
                  <div>Mardi</div>
                  <div>Mercredi</div>
                  <div>Jeudi</div>
                  <div>Vendredi</div>
                  <div>Samedi</div>
                  <div>Dimanche</div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 auto-rows-fr border-b border-r border-gray-200 bg-gray-100/50">
                  {getDaysInMonth(calendarDate).map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="bg-gray-50/40 min-h-[110px] border-l border-t border-gray-200" />;
                    }

                    const dayIso = formatLocalDate(day);
                    const dayOrders = filteredOrders.filter(o => {
                      const matchesDay = o.dueDate === dayIso;
                      const matchesSite = calendarFilterSite === 'all' || o.location === calendarFilterSite || o.entity === calendarFilterSite;
                      const matchesStatus = calendarFilterStatus === 'all' || o.status === calendarFilterStatus;
                      return matchesDay && matchesSite && matchesStatus;
                    });

                    const isToday = dayIso === todayStr;
                    const visibleOrders = dayOrders.slice(0, 2);
                    const extraCount = dayOrders.length - visibleOrders.length;

                    return (
                      <div
                        key={dayIso}
                        className={`min-h-[110px] p-1.5 border-l border-t border-gray-200 flex flex-col justify-between transition-colors ${
                          isToday ? 'bg-blue-50/50' : 'bg-white'
                        }`}
                      >
                        <div>
                          {/* Day Number Header */}
                          <div
                            onClick={() => {
                              if (dayOrders.length > 0) setSelectedDayModalDate(dayIso);
                            }}
                            className={`flex items-center justify-between mb-1.5 select-none ${
                              dayOrders.length > 0 ? 'cursor-pointer group' : ''
                            }`}
                          >
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                              isToday ? 'bg-blue-600 text-white' : 'text-gray-800 group-hover:bg-blue-100 group-hover:text-blue-800'
                            }`}>
                              {day.getDate()}
                            </span>
                            {dayOrders.length > 0 && (
                              <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100/80 border border-blue-200 px-1.5 py-0.2 rounded-full">
                                {dayOrders.length} OT
                              </span>
                            )}
                          </div>

                          {/* Work order card previews */}
                          <div className="space-y-1">
                            {visibleOrders.map(wo => (
                              <div
                                key={wo.id}
                                onClick={() => { setSelectedWorkOrder(wo); setIsEditMode(false); }}
                                className={`px-1.5 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer hover:shadow-xs transition-all ${
                                  wo.status === 'Terminé'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                    : wo.priority === 'Urgente'
                                    ? 'bg-red-50 border-red-200 text-red-950'
                                    : 'bg-blue-50/80 border-blue-200 text-blue-950'
                                }`}
                                title={`${wo.code} - ${wo.title} (${wo.location || 'Atelier'})`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      wo.status === 'Terminé' ? 'bg-emerald-500' : wo.status === 'En cours' ? 'bg-blue-500' : 'bg-amber-500'
                                    }`} />
                                    {wo.code && wo.code.toUpperCase() !== 'NC' && wo.code !== 'OT-NC' ? (
                                      <span className="font-mono text-[10px] font-bold shrink-0">{wo.code}</span>
                                    ) : (
                                      <span className="text-[9px] font-black bg-amber-100 text-amber-900 px-1 py-0.2 rounded border border-amber-300 shrink-0">
                                        NC
                                      </span>
                                    )}
                                  </div>
                                  {(wo.location || wo.entity) && (
                                    <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-200 shrink-0 truncate max-w-[65px]">
                                      {(wo.location || wo.entity).split(' ')[0]}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] leading-tight font-medium text-gray-700 truncate mt-0.5">
                                  {wo.title}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* View All Button for days with many orders */}
                        {extraCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedDayModalDate(dayIso)}
                            className="mt-1 w-full py-1 px-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-900 font-extrabold text-[10px] rounded-md border border-blue-200 transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>+ {extraCount} autre(s) OT...</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Workload / Charge de travail View */
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
              <h3 className="font-bold text-gray-900 text-base mb-1">Répartition de la charge par intervenant</h3>
              <p className="text-xs text-gray-500 mb-4">
                Visualisez la charge de travail et la disponibilité de l'équipe de maintenance.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(assigneesMap).map(([assigneeName, rawOrders]) => {
                  const orders = rawOrders as WorkOrder[];
                  const doneCount = orders.filter(o => o.status === 'Terminé').length;
                  const openCount = orders.filter(o => o.status === 'Ouvert' || o.status === 'En cours').length;
                  const pendingCount = orders.filter(o => o.status === 'En attente').length;
                  const completionRate = orders.length > 0 ? Math.round((doneCount / orders.length) * 100) : 0;

                  return (
                    <div key={assigneeName} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {assigneeName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">{assigneeName}</h4>
                            <span className="text-xs text-gray-500">{orders.length} tâche{orders.length > 1 ? 's' : ''} affectée{orders.length > 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                          {completionRate}% complété
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500 h-full transition-all duration-300"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>

                      {/* Stats Pills */}
                      <div className="grid grid-cols-3 gap-1 text-center text-[11px] pt-1">
                        <div className="bg-white p-1.5 rounded border border-gray-200">
                          <span className="block font-bold text-blue-600">{openCount}</span>
                          <span className="text-gray-500">Actifs</span>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-gray-200">
                          <span className="block font-bold text-purple-600">{pendingCount}</span>
                          <span className="text-gray-500">Attente</span>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-gray-200">
                          <span className="block font-bold text-green-600">{doneCount}</span>
                          <span className="text-gray-500">Terminés</span>
                        </div>
                      </div>

                      {/* Task preview list */}
                      <div className="space-y-1.5 pt-2 border-t border-gray-200">
                        <div className={`space-y-1.5 ${expandedAssignees.has(assigneeName) ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
                          {(expandedAssignees.has(assigneeName) ? orders : orders.slice(0, 3)).map(o => (
                            <div
                              key={o.id}
                              onClick={() => { setSelectedWorkOrder(o); setIsEditMode(false); }}
                              className="text-xs bg-white p-2 rounded border border-gray-200 flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors"
                            >
                              <span className="font-medium text-gray-800 truncate">{o.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBadgeClass(o.status)}`}>
                                {o.status}
                              </span>
                            </div>
                          ))}
                        </div>
                        {orders.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedAssignees(prev => {
                                const next = new Set(prev);
                                if (next.has(assigneeName)) next.delete(assigneeName);
                                else next.add(assigneeName);
                                return next;
                              });
                            }}
                            className="w-full text-center text-[11px] font-semibold text-blue-600 hover:text-blue-700 pt-1"
                          >
                            {expandedAssignees.has(assigneeName) ? 'Réduire ▲' : `Voir tout (${orders.length}) ▼`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Nouvel ordre de travail</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Titre de l'intervention *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Remplacement filtre compresseur"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Détails des tâches à accomplir..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Priorité</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Faible">Faible</option>
                    <option value="Moyenne">Moyenne</option>
                    <option value="Élevée">Élevée</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as WorkOrderType)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Corrective">Corrective</option>
                    <option value="Préventive">Préventive</option>
                    <option value="Inspection">Inspection</option>
                    <option value="Amélioration">Amélioration</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Équipement associé</label>
                  <select
                    value={selectedEquipmentId}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Aucun équipement</option>
                    {equipmentList.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} ({eq.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Assigné à</label>
                  <input
                    type="text"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Date d'échéance</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    if (!startDate) setStartDate(e.target.value);
                    if (!endDate) setEndDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Dynamic Intervenants & Horaires in Create Modal */}
              <div className="border border-blue-200 bg-blue-50/40 p-3 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Intervenants & Horaires prévus
                  </span>
                  <button
                    type="button"
                    onClick={handleAddIntervenantRow}
                    className="text-xs bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Intervenant
                  </button>
                </div>

                <div className="space-y-2">
                  {intervenantsLogs.map((inter, idx) => (
                    <div key={inter.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-xs font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        placeholder="Nom de l'intervenant"
                        value={inter.name}
                        onChange={(e) => handleUpdateIntervenantRow(inter.id, 'name', e.target.value)}
                        className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded font-semibold"
                      />
                      <input
                        type="text"
                        placeholder="00:45"
                        value={inter.timeSpent || ''}
                        onChange={(e) => handleUpdateIntervenantRow(inter.id, 'timeSpent', e.target.value)}
                        className="w-20 text-xs px-2 py-1 border border-slate-300 rounded font-mono text-center font-bold"
                      />
                      {intervenantsLogs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveIntervenantRow(inter.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Début (Date & Heure)</label>
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                      />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-20 text-xs px-1.5 py-1 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Fin (Date & Heure)</label>
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                      />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-20 text-xs px-1.5 py-1 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Créer l'ordre de travail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 print:max-w-none print:max-h-none print:shadow-none print:static">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0 print:bg-white">
              <div>
                {selectedWorkOrder.code && selectedWorkOrder.code.toUpperCase() !== 'NC' && selectedWorkOrder.code !== 'OT-NC' ? (
                  <span className="text-xs font-mono font-bold text-gray-500">{selectedWorkOrder.code}</span>
                ) : (
                  <span className="text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded">
                    N° OT: NC (Non créé)
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-900">{selectedWorkOrder.title}</h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={handlePrint}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg"
                  title="Imprimer cette fiche"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedWorkOrder(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isEditMode ? (
              /* Edit Form inside Modal */
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Titre de l'intervention</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Description de l'intervention</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nom Équipement</label>
                    <input
                      type="text"
                      value={equipmentNameInput}
                      onChange={(e) => setEquipmentNameInput(e.target.value)}
                      placeholder="ex: Pompe centrifuge"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Code Équipement</label>
                    <input
                      type="text"
                      value={equipmentCodeInput}
                      onChange={(e) => setEquipmentCodeInput(e.target.value)}
                      placeholder="ex: POMP-01 ou NC"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Priorité</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="Faible">Faible</option>
                      <option value="Moyenne">Moyenne</option>
                      <option value="Élevée">Élevée</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as WorkOrderType)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="Corrective">Corrective</option>
                      <option value="Préventive">Préventive</option>
                      <option value="Inspection">Inspection</option>
                      <option value="Amélioration">Amélioration</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Assigné à / Responsable</label>
                    <input
                      type="text"
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Date d'échéance</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Section Édition Dynamique des Intervenants, Horaires & Calcul d'Écart */}
                <div className="border border-blue-200 bg-blue-50/40 p-3.5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      Édition Intervenants, Horaires & Calcul Écart
                    </span>
                    <button
                      type="button"
                      onClick={handleAddIntervenantRow}
                      className="text-xs bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ajouter Intervenant
                    </button>
                  </div>

                  {/* Intervenants Editable Rows */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">Liste des Intervenants & Temps Passé</label>
                    {intervenantsLogs.map((inter, idx) => (
                      <div key={inter.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-xs font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                        <input
                          type="text"
                          placeholder="Nom de l'intervenant (ex: AMARA OMAR)"
                          value={inter.name}
                          onChange={(e) => handleUpdateIntervenantRow(inter.id, 'name', e.target.value)}
                          className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 font-semibold"
                        />
                        <div className="flex items-center gap-1 w-28">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="00:45"
                            value={inter.timeSpent || ''}
                            onChange={(e) => handleUpdateIntervenantRow(inter.id, 'timeSpent', e.target.value)}
                            className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-center font-bold"
                          />
                        </div>
                        {intervenantsLogs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIntervenantRow(inter.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Supprimer l'intervenant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Horaires Start & End */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="block text-[11px] font-bold text-slate-700 uppercase">Horaires de Début</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-medium">Date début</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-medium">Heure début</label>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                      <span className="block text-[11px] font-bold text-slate-700 uppercase">Horaires de Fin</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-medium">Date fin</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-medium">Heure fin</label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Duration & Écart */}
                  {(() => {
                    const durMins = computeDurationMinutes(startDate, startTime, endDate, endTime);
                    const interMins = computeTotalIntervenantsMinutes(intervenantsLogs);
                    const ecart = formatEcartLabel(durMins, interMins);

                    return (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 font-medium">Durée effective (Horaires): </span>
                          <span className="font-mono font-bold text-blue-700">{formatMinutesToHHMM(durMins)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Écart calculé: </span>
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            ecart.isZero ? 'bg-emerald-100 text-emerald-800' : (ecart.isPositive ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')
                          }`}>
                            {ecart.label}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Visa Input */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Visa / Emplacement signature technicien</label>
                    <input
                      type="text"
                      placeholder="ex: Signé et validé par M. AMARA"
                      value={visa}
                      onChange={(e) => setVisa(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 shrink-0">
                  {onDeleteWorkOrder && (
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedWorkOrder.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                      title="Supprimer cet ordre de travail"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer cet OT</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs"
                    >
                      Enregistrer les modifications
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* Detail View inside Modal - Flex container with scrollable body + fixed bottom footer */
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Scrollable Body */}
                <div className="p-6 space-y-4 text-sm overflow-y-auto flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Statut:</span>
                    <select
                      value={selectedWorkOrder.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as WorkOrderStatus;
                        onUpdateStatus(selectedWorkOrder.id, newStatus);
                        setSelectedWorkOrder({ ...selectedWorkOrder, status: newStatus });
                      }}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer ${getStatusBadgeClass(selectedWorkOrder.status)}`}
                    >
                      <option value="Ouvert">Ouvert</option>
                      <option value="En cours">En cours</option>
                      <option value="En attente">En attente</option>
                      <option value="Terminé">Terminé</option>
                    </select>

                    <span className="text-xs font-semibold text-gray-500 uppercase ml-auto">Priorité:</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getPriorityBadgeClass(selectedWorkOrder.priority)}`}>
                      {selectedWorkOrder.priority}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Description de l'intervention</h4>
                    <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200 font-medium">
                      {getDisplayDescription(selectedWorkOrder)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-gray-50/70 p-3 rounded-xl border border-gray-200">
                    <div>
                      <span className="text-gray-500 block font-medium">Équipement (Nom):</span>
                      <span className="font-semibold text-gray-900 block mt-0.5">{getEquipmentNameOnly(selectedWorkOrder, equipmentList)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block font-medium">Code Équipement:</span>
                      {getEquipmentCodeOnly(selectedWorkOrder, equipmentList) !== '—' ? (
                        <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                          {getEquipmentCodeOnly(selectedWorkOrder, equipmentList)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic block mt-0.5">Non renseigné</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 block font-medium">Emplacement:</span>
                      <span className="font-semibold text-gray-800 block mt-0.5">{selectedWorkOrder.location || 'Atelier Principal'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block font-medium">Assigné à / Planificateur:</span>
                      <span className="font-semibold text-gray-800 block mt-0.5">{selectedWorkOrder.assignee || selectedWorkOrder.planner || 'Jean Dupont'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block font-medium">Date d'échéance:</span>
                      <span className={`font-semibold block mt-0.5 ${selectedWorkOrder.dueDate < todayStr && selectedWorkOrder.status !== 'Terminé' ? 'text-red-600' : 'text-gray-800'}`}>
                        {selectedWorkOrder.dueDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block font-medium">Type d'intervention:</span>
                      <span className="font-semibold text-gray-800 block mt-0.5">{selectedWorkOrder.type || 'Préventive'}</span>
                    </div>
                  </div>

                  {/* Suivi Intervenants, Temps passé, Horaires & Visa (Modèle fiche OT Dynamique) */}
                  <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-600" />
                        Suivi des Intervenants, Temps & Horaires
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(selectedWorkOrder)}
                        className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <Edit3 className="w-3 h-3" /> Modifier les Horaires / Intervenants
                      </button>
                    </div>

                    {/* Table Intervenant & Temps passé */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse bg-white rounded-lg overflow-hidden border border-slate-300">
                        <thead>
                          <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                            <th className="p-1.5 text-center w-10 border-r border-slate-300">#</th>
                            <th className="p-1.5 text-left border-r border-slate-300">Nom(s) Intervenant(s)</th>
                            <th className="p-1.5 text-right w-32">Temps passé</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getWorkOrderIntervenants(selectedWorkOrder).map((inter, idx) => (
                            <tr key={inter.id || idx} className="border-b border-slate-200">
                              <td className="p-1.5 text-center bg-slate-100 font-bold text-slate-600 border-r border-slate-300">
                                {idx + 1}
                              </td>
                              <td className="p-1.5 font-semibold text-slate-900 border-r border-slate-300">
                                {inter.name || selectedWorkOrder.assignee || 'Non spécifié'}
                              </td>
                              <td className="p-1.5 text-right font-mono font-bold text-slate-900">
                                {inter.timeSpent || '00:00'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Horaires & Visa Side-by-Side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Left: Table Horaires */}
                      <div className="bg-white rounded-lg border border-slate-300 p-2 space-y-2">
                        <table className="w-full text-xs border-collapse border border-slate-200">
                          <thead>
                            <tr className="bg-slate-100 font-bold text-slate-700">
                              <th className="p-1 border border-slate-200 text-left"></th>
                              <th className="p-1 border border-slate-200 text-center">Date</th>
                              <th className="p-1 border border-slate-200 text-center">Heure</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="p-1 border border-slate-200 font-bold bg-slate-50 text-slate-700">de Début</td>
                              <td className="p-1 border border-slate-200 text-center font-medium text-slate-800">
                                {selectedWorkOrder.startDate ? formatDateLabel(selectedWorkOrder.startDate) : (selectedWorkOrder.dueDate ? formatDateLabel(selectedWorkOrder.dueDate) : '—')}
                              </td>
                              <td className="p-1 border border-slate-200 text-center font-mono font-bold text-slate-900">
                                {selectedWorkOrder.startTime || '—'}
                              </td>
                            </tr>
                            <tr>
                              <td className="p-1 border border-slate-200 font-bold bg-slate-50 text-slate-700">de Fin</td>
                              <td className="p-1 border border-slate-200 text-center font-medium text-slate-800">
                                {selectedWorkOrder.endDate ? formatDateLabel(selectedWorkOrder.endDate) : (selectedWorkOrder.dueDate ? formatDateLabel(selectedWorkOrder.dueDate) : '—')}
                              </td>
                              <td className="p-1 border border-slate-200 text-center font-mono font-bold text-slate-900">
                                {selectedWorkOrder.endTime || '—'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Right: Visa Box */}
                      <div className="bg-white rounded-lg border border-slate-300 p-2 flex flex-col justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">Visa</span>
                          <div className="min-h-[48px] border border-dashed border-slate-300 rounded bg-slate-50 p-2 text-xs text-slate-700">
                            {selectedWorkOrder.visa ? selectedWorkOrder.visa : <span className="text-slate-400 italic">Visa / Emplacement signature technicien</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Site Dispatch Banner */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-purple-950 block">Répartition Multi-Sites</span>
                        <span className="text-[11px] text-purple-700">Dupliquez cet OT et sa gamme d'actions sur d'autres sites de votre réseau.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDispatchWO(selectedWorkOrder);
                        const otherSites = availableSiteNames.filter(s => s !== (selectedWorkOrder.location || 'Atelier Principal'));
                        setSelectedTargetSites(otherSites);
                        setIsMultiSiteModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-2xs shrink-0 flex items-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Répartir sur d'autres sites</span>
                    </button>
                  </div>

                  {/* Gamme Opératoire / Checklist Actions */}
                  <div className="border-t border-gray-200 pt-3">
                    {(() => {
                      const matchedPlan = findMatchingGammePlan(
                        selectedWorkOrder.equipmentCode || '',
                        selectedWorkOrder.interventionCode || '',
                        selectedWorkOrder.title || '',
                        gammesList,
                        selectedWorkOrder.location || selectedWorkOrder.entity || ''
                      );

                      // Filter out tasks if they came from an old mismatched fallback import (e.g. Ascenseur task on Extracteur OT)
                      const tasksAreMismatched = (() => {
                        if (!selectedWorkOrder.tasks || selectedWorkOrder.tasks.length === 0) return false;
                        const woText = `${selectedWorkOrder.title} ${selectedWorkOrder.equipmentName} ${selectedWorkOrder.equipmentCode}`.toLowerCase();
                        
                        const isAscenseurTask = selectedWorkOrder.tasks.some(t => 
                          t.label.toLowerCase().includes('désincarcération') || 
                          t.label.toLowerCase().includes('desincarcération') || 
                          t.label.toLowerCase().includes('ascenseur')
                        );
                        if (isAscenseurTask && (woText.includes('extracteur') || woText.includes('pompe') || woText.includes('cta') || woText.includes('vmc') || woText.includes('caisson') || woText.includes('split'))) {
                          return true;
                        }

                        if (matchedPlan && selectedWorkOrder.tasks.some(t => t.id.includes('task-auto') || t.id.includes('task-imported') || t.id.includes('task-0'))) {
                          const matchedTaskCodes = new Set(matchedPlan.tasks.map(t => t.actionCode.toLowerCase()));
                          const matchingCount = selectedWorkOrder.tasks.filter(t => matchedTaskCodes.has(t.code.toLowerCase())).length;
                          if (matchingCount === 0 && matchedPlan.tasks.length > 0) {
                            return true;
                          }
                        }

                        return false;
                      })();

                      const activeTasks: WorkOrderTask[] = (selectedWorkOrder.tasks && selectedWorkOrder.tasks.length > 0 && !tasksAreMismatched)
                        ? selectedWorkOrder.tasks
                        : (matchedPlan?.tasks.map((t, idx) => ({
                            id: `task-auto-${idx}`,
                            code: formatActionCode(t.actionCode, idx),
                            label: t.label,
                            completed: false
                          })) || []);

                      const doneCount = activeTasks.filter(t => t.completed).length;
                      const progressPercent = activeTasks.length > 0 ? Math.round((doneCount / activeTasks.length) * 100) : 0;

                      const toggleTask = (taskId: string) => {
                        const updatedTasks = activeTasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
                        const updatedWO = { ...selectedWorkOrder, tasks: updatedTasks };
                        setSelectedWorkOrder(updatedWO);
                        if (onEditWorkOrder) {
                          onEditWorkOrder(selectedWorkOrder.id, { tasks: updatedTasks });
                        }
                      };

                      const updateTaskComment = (taskId: string, comment: string) => {
                        const updatedTasks = activeTasks.map(t => t.id === taskId ? { ...t, comment } : t);
                        const updatedWO = { ...selectedWorkOrder, tasks: updatedTasks };
                        setSelectedWorkOrder(updatedWO);
                        if (onEditWorkOrder) {
                          onEditWorkOrder(selectedWorkOrder.id, { tasks: updatedTasks });
                        }
                      };

                      const toggleTaskAnomaly = (taskId: string) => {
                        const updatedTasks = activeTasks.map(t => t.id === taskId ? { ...t, isAnomaly: !t.isAnomaly } : t);
                        const updatedWO = { ...selectedWorkOrder, tasks: updatedTasks };
                        setSelectedWorkOrder(updatedWO);
                        if (onEditWorkOrder) {
                          onEditWorkOrder(selectedWorkOrder.id, { tasks: updatedTasks });
                        }
                      };

                      const handleToggleAll = (completedState: boolean) => {
                        const updatedTasks = activeTasks.map(t => ({ ...t, completed: completedState }));
                        const updatedWO = { ...selectedWorkOrder, tasks: updatedTasks };
                        setSelectedWorkOrder(updatedWO);
                        if (onEditWorkOrder) {
                          onEditWorkOrder(selectedWorkOrder.id, { tasks: updatedTasks });
                        }
                      };

                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                              <ListChecks className="w-4 h-4 text-blue-600" />
                              <span>Gamme Opératoire & Checklist des Actions</span>
                            </div>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              doneCount === activeTasks.length && activeTasks.length > 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {activeTasks.length > 0 ? `${doneCount}/${activeTasks.length} complété(s) (${progressPercent}%)` : '0 action'}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          {activeTasks.length > 0 && (
                            <div className="mb-2">
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {matchedPlan && (
                            <div className="mb-2 bg-blue-50/60 border border-blue-200 rounded-lg p-2 text-xs flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                                  {matchedPlan.planCode}
                                </span>
                                <span className="font-semibold text-blue-900">{matchedPlan.interventionTitle}</span>
                              </div>
                              <span className="text-[10px] text-blue-700 font-mono">({matchedPlan.equipmentCode})</span>
                            </div>
                          )}

                          {/* Quick Select Buttons */}
                          {activeTasks.length > 0 && (
                            <div className="flex items-center justify-end gap-2 mb-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => handleToggleAll(true)}
                                className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                              >
                                Tout cocher ✓
                              </button>
                              <span className="text-gray-300">•</span>
                              <button
                                type="button"
                                onClick={() => handleToggleAll(false)}
                                className="text-gray-500 hover:text-gray-700 font-medium hover:underline"
                              >
                                Tout décocher
                              </button>
                            </div>
                          )}

                          {/* Task Checklist Items */}
                          <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-200 space-y-1.5 max-h-64 overflow-y-auto">
                            {activeTasks.length === 0 ? (
                              <p className="text-xs text-gray-400 italic text-center py-2">
                                Aucune gamme prédéfinie pour cet équipement. Ajoutez des tâches ci-dessous.
                              </p>
                            ) : (
                              activeTasks.map((task, index) => (
                                <div
                                  key={task.id}
                                  onClick={() => toggleTask(task.id)}
                                  className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer select-none transition-all border ${
                                    task.isAnomaly
                                      ? 'bg-red-50 border-red-300 text-red-950'
                                      : task.completed
                                      ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950 shadow-2xs font-semibold'
                                      : 'bg-white border-gray-200 hover:bg-blue-50/50 hover:border-blue-200 text-gray-800'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTask(task.id);
                                    }}
                                    className="mt-0.5 shrink-0 focus:outline-none"
                                  >
                                    {task.completed ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-gray-300 hover:text-blue-500" />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                        task.completed ? 'bg-emerald-200/80 text-emerald-900' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {formatActionCode(task.code, index)}
                                      </span>
                                      {task.completed && (
                                        <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full uppercase">
                                          Action Fait ✓
                                        </span>
                                      )}
                                      {task.isAnomaly && (
                                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-800 bg-red-100 px-1.5 py-0.2 rounded-full uppercase">
                                          <AlertTriangle className="w-2.5 h-2.5" />
                                          Anomalie
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-xs leading-relaxed transition-all ${
                                      task.isAnomaly
                                        ? 'text-red-950 font-bold'
                                        : task.completed
                                        ? 'text-emerald-950 font-bold'
                                        : 'font-semibold text-gray-800'
                                    }`}>
                                      {task.label}
                                    </p>

                                    {/* Commentaire / RAS / Anomalie */}
                                    <div
                                      className="mt-1.5 flex items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="text"
                                        value={task.comment || ''}
                                        onChange={(e) => updateTaskComment(task.id, e.target.value)}
                                        placeholder="Commentaire / observation..."
                                        className={`flex-1 text-[11px] px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400 ${
                                          task.isAnomaly ? 'border-red-300 bg-white text-red-900' : 'border-gray-200 bg-white text-gray-700'
                                        }`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateTaskComment(task.id, 'RAS')}
                                        className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                                        title="Rien à signaler"
                                      >
                                        RAS
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleTaskAnomaly(task.id)}
                                        className={`shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                                          task.isAnomaly
                                            ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                            : 'border-red-300 text-red-600 hover:bg-red-50'
                                        }`}
                                        title="Signaler une anomalie sur cette action"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        {task.isAnomaly ? 'Anomalie ✓' : 'Signaler'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Add Custom Action to Gamme */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Ajouter une action à la gamme..."
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTaskText.trim()) {
                            e.preventDefault();
                            const currentPlan = findMatchingGammePlan(
                              selectedWorkOrder.equipmentCode || '',
                              selectedWorkOrder.title || '',
                              selectedWorkOrder.description || '',
                              gammesList,
                              selectedWorkOrder.location || selectedWorkOrder.entity || ''
                            );
                            const existingTasks: WorkOrderTask[] = (selectedWorkOrder.tasks && selectedWorkOrder.tasks.length > 0)
                              ? selectedWorkOrder.tasks
                              : (currentPlan?.tasks.map((t, idx) => ({ id: `task-auto-${idx}`, code: formatActionCode(t.actionCode, idx), label: t.label, completed: false })) || []);
                            const nextIndex = existingTasks.length + 1;
                            const formattedCode = `${nextIndex} - ACT-${nextIndex}`;
                            const newTask: WorkOrderTask = {
                              id: `task-custom-${Date.now()}`,
                              code: formattedCode,
                              label: newTaskText.trim(),
                              completed: false
                            };
                            const updatedTasks = [...existingTasks, newTask];
                            setSelectedWorkOrder({ ...selectedWorkOrder, tasks: updatedTasks });
                            if (onEditWorkOrder) {
                              onEditWorkOrder(selectedWorkOrder.id, { tasks: updatedTasks });
                            }
                            setNewTaskText('');
                          }
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newTaskText.trim()) return;
                          const currentPlan = findMatchingGammePlan(
                            selectedWorkOrder.equipmentCode || '',
                            selectedWorkOrder.title || '',
                            selectedWorkOrder.description || '',
                            gammesList,
                            selectedWorkOrder.location || selectedWorkOrder.entity || ''
                          );
                          const existingTasks: WorkOrderTask[] = (selectedWorkOrder.tasks && selectedWorkOrder.tasks.length > 0)
                            ? selectedWorkOrder.tasks
                            : (currentPlan?.tasks.map((t, idx) => ({ id: `task-auto-${idx}`, code: formatActionCode(t.actionCode, idx), label: t.label, completed: false })) || []);
                          const nextIndex = existingTasks.length + 1;
                          const formattedCode = `${nextIndex} - ACT-${nextIndex}`;
                          const newTask: WorkOrderTask = {
                            id: `task-custom-${Date.now()}`,
                            code: formattedCode,
                            label: newTaskText.trim(),
                            completed: false
                          };
                          const updatedTasks = [...existingTasks, newTask];
                          setSelectedWorkOrder({ ...selectedWorkOrder, tasks: updatedTasks });
                          if (onEditWorkOrder) {
                            onEditWorkOrder(selectedWorkOrder.id, { tasks: updatedTasks });
                          }
                          setNewTaskText('');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100"
                      >
                        + Ajouter
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] text-gray-400 flex justify-between">
                    <span>Créé le: {selectedWorkOrder.createdAt}</span>
                    {selectedWorkOrder.interventionCode && (
                      <span className="font-mono text-gray-500">Code: {selectedWorkOrder.interventionCode}</span>
                    )}
                  </div>
                </div>

                {/* Footer Buttons - Always Sticky at the Bottom */}
                <div className="flex items-center justify-between px-6 py-3.5 bg-gray-50 border-t border-gray-200 shrink-0 print:hidden">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(selectedWorkOrder)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-gray-600" />
                      <span>Modifier</span>
                    </button>

                    {onDeleteWorkOrder && (
                      <button
                        onClick={() => handleDelete(selectedWorkOrder.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedWorkOrder.status !== 'Terminé' && (
                      <button
                        onClick={() => {
                          onUpdateStatus(selectedWorkOrder.id, 'Terminé');
                          setSelectedWorkOrder({ ...selectedWorkOrder, status: 'Terminé' });
                        }}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>Terminer l'OT</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedWorkOrder(null)}
                      className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shadow-2xs"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Multi-Site Dispatch Modal */}
      {isMultiSiteModalOpen && dispatchWO && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Répartition Multi-Sites GMAO</h3>
                  <p className="text-[11px] text-gray-300">Dupliquez l'ordre de travail & sa gamme vers d'autres sites</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMultiSiteModalOpen(false);
                  setDispatchWO(null);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Selected Work Order Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
                    {dispatchWO.code}
                  </span>
                  <span className="text-[10px] text-purple-700 font-bold">
                    Site d'origine : {dispatchWO.location || 'Atelier Principal'}
                  </span>
                </div>
                <h4 className="font-bold text-purple-950 text-xs">{dispatchWO.title}</h4>
                <p className="text-purple-700 text-[11px]">
                  Équipement: <span className="font-semibold">{getEquipmentLabel(dispatchWO, equipmentList)}</span>
                </p>
              </div>

              {/* Sites Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2">
                  Sélectionnez les sites destinataires ({selectedTargetSites.length} site(s) sélectionné(s)) :
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                  {availableSiteNames.map(site => {
                    const isOrigin = site === (dispatchWO.location || 'Atelier Principal');
                    const isChecked = selectedTargetSites.includes(site);
                    return (
                      <button
                        key={site}
                        type="button"
                        disabled={isOrigin}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedTargetSites(prev => prev.filter(s => s !== site));
                          } else {
                            setSelectedTargetSites(prev => [...prev, site]);
                          }
                        }}
                        className={`p-2.5 rounded-lg text-xs font-semibold border flex items-center justify-between transition-all ${
                          isOrigin
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                            : isChecked
                              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{site}</span>
                        </div>
                        {isOrigin ? (
                          <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Origine</span>
                        ) : isChecked ? (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Options */}
              <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                <label className="flex items-center gap-2 text-gray-800 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dispatchIncludeChecklist}
                    onChange={(e) => setDispatchIncludeChecklist(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Inclure la gamme opératoire (checklist des actions)</span>
                </label>

                <div className="pt-1">
                  <span className="block text-gray-700 font-semibold mb-1">Planification des dates :</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`p-2 rounded-lg border text-[11px] font-semibold cursor-pointer flex items-center gap-2 ${
                      dispatchDateOption === 'same' ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-white border-gray-200 text-gray-600'
                    }`}>
                      <input
                        type="radio"
                        name="dispatchDate"
                        checked={dispatchDateOption === 'same'}
                        onChange={() => setDispatchDateOption('same')}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <span>Même date ({dispatchWO.dueDate})</span>
                    </label>

                    <label className={`p-2 rounded-lg border text-[11px] font-semibold cursor-pointer flex items-center gap-2 ${
                      dispatchDateOption === 'sequence' ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-white border-gray-200 text-gray-600'
                    }`}>
                      <input
                        type="radio"
                        name="dispatchDate"
                        checked={dispatchDateOption === 'sequence'}
                        onChange={() => setDispatchDateOption('sequence')}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <span>Échelonner (+1 sem. / site)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsMultiSiteModalOpen(false);
                  setDispatchWO(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={selectedTargetSites.length === 0}
                onClick={handleConfirmMultiSiteDispatch}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                <span>Confirmer la répartition ({selectedTargetSites.length} site(s))</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Planning Modal (When clicking on a calendar day or "+ X autres OTs") */}
      {selectedDayModalDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Ordres de Travail du {new Date(selectedDayModalDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {filteredOrders.filter(o => o.dueDate === selectedDayModalDate && (calendarFilterSite === 'all' || o.location === calendarFilterSite || o.entity === calendarFilterSite) && (calendarFilterStatus === 'all' || o.status === calendarFilterStatus)).length} ordre(s) de travail programmé(s)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayModalDate(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-gray-50/50">
              {(() => {
                const dayOrders = filteredOrders.filter(o =>
                  o.dueDate === selectedDayModalDate &&
                  (calendarFilterSite === 'all' || o.location === calendarFilterSite || o.entity === calendarFilterSite) &&
                  (calendarFilterStatus === 'all' || o.status === calendarFilterStatus)
                );

                if (dayOrders.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
                      Aucun ordre de travail pour cette date avec les filtres actuels.
                    </div>
                  );
                }

                return dayOrders.map(wo => {
                  const matchedPlan = findMatchingGammePlan(
                    wo.equipmentCode || '',
                    wo.interventionCode || '',
                    wo.title || '',
                    gammesList,
                    wo.location || wo.entity || ''
                  );

                  const activeTasks: WorkOrderTask[] = (wo.tasks && wo.tasks.length > 0)
                    ? wo.tasks
                    : (matchedPlan?.tasks.map((t, idx) => ({
                        id: `task-auto-${idx}`,
                        code: formatActionCode(t.actionCode, idx),
                        label: t.label,
                        completed: false
                      })) || []);

                  const doneCount = activeTasks.filter(t => t.completed).length;

                  return (
                    <div key={wo.id} className="bg-white rounded-xl p-4 border border-gray-200 shadow-2xs space-y-3 hover:border-blue-300 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {wo.code && wo.code.toUpperCase() !== 'NC' && wo.code !== 'OT-NC' ? (
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              {wo.code}
                            </span>
                          ) : (
                            <span className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              N° OT: NC (Non créé)
                            </span>
                          )}
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(wo.status)}`}>
                            {wo.status}
                          </span>
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getPriorityBadgeClass(wo.priority)}`}>
                            {wo.priority}
                          </span>
                        </div>

                        {(wo.location || wo.entity) && (
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{wo.location || wo.entity}</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-gray-900">{wo.title}</h4>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-4">
                          <span>Équipement: <strong className="text-gray-800">{getEquipmentLabel(wo, equipmentList)}</strong></span>
                          <span>Assigné à: <strong className="text-gray-800">{wo.assignee}</strong></span>
                        </div>
                      </div>

                      {/* Gamme Checklist Summary */}
                      {activeTasks.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-xs space-y-2">
                          <div className="flex items-center justify-between font-bold text-gray-800">
                            <span className="flex items-center gap-1.5 text-blue-700">
                              <ListChecks className="w-4 h-4" />
                              Gamme Opératoire ({doneCount}/{activeTasks.length} actions complétées)
                            </span>
                            <span className="text-gray-500 font-bold">
                              {Math.round((doneCount / activeTasks.length) * 100)}%
                            </span>
                          </div>

                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-300"
                              style={{ width: `${(doneCount / activeTasks.length) * 100}%` }}
                            />
                          </div>

                          <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto">
                            {activeTasks.map((t, idx) => (
                              <div key={t.id} className="flex items-start gap-2 bg-white p-1.5 rounded border border-gray-200">
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                  t.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {formatActionCode(t.code, idx)}
                                </span>
                                <span className={`text-xs ${t.completed ? 'text-emerald-950 font-bold' : 'text-gray-800 font-semibold'}`}>
                                  {t.label} {t.completed ? '✓' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayModalDate(null);
                            setSelectedWorkOrder(wo);
                            setIsEditMode(false);
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors shadow-2xs"
                        >
                          Ouvrir la fiche OT complète
                        </button>
                        {wo.status !== 'Terminé' && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateStatus(wo.id, 'Terminé');
                            }}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
                          >
                            Terminer l'OT
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayModalDate(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shadow-2xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset / Clear Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Tout vider - Effacer tous les Ordres de Travail ?</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Voulez-vous effacer l'intégralité des Ordres de Travail actuels ({workOrders.length} OT) ?
            </p>
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg font-medium">
              ⚠️ <strong>Cette action efface la liste.</strong> Vous pourrez réimporter vos propres fichiers à tout moment.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllWorkOrders) {
                    onClearAllWorkOrders();
                  }
                  setIsResetConfirmOpen(false);
                }}
                className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Oui, tout vider</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportWorkOrders={handleImportWorkOrders}
        onImportGammes={handleImportGammes}
        onClearGammes={handleClearGammes}
        existingGammes={gammesList}
        existingWorkOrdersCount={workOrders.length}
        availableSites={availableSiteNames}
      />

      {/* Delete Work Order Confirmation Modal */}
      {deletingWoId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Supprimer cet OT ?</h3>
                <p className="text-xs text-gray-500">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Voulez-vous vraiment supprimer définitivement cet ordre de travail ?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingWoId(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteWorkOrder && deletingWoId) {
                    onDeleteWorkOrder(deletingWoId);
                  }
                  if (selectedWorkOrder?.id === deletingWoId) {
                    setSelectedWorkOrder(null);
                  }
                  setDeletingWoId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Oui, supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
