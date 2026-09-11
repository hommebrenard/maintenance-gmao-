import { WorkOrder, GammePlan, GammeTaskItem, GammeItem, WorkOrderPriority, WorkOrderTask } from '../types';

// Helper to parse a CSV or TSV line with quotes and variable delimiter
export function parseCSVLine(line: string, delimiter?: string): string[] {
  // Auto-detect delimiter if not explicitly provided
  if (!delimiter) {
    if (line.includes('\t')) delimiter = '\t';
    else if (line.includes(';')) delimiter = ';';
    else delimiter = ',';
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper to format Date as local YYYY-MM-DD
export function formatLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Format Action Code consistently
export function formatActionCode(code: string | undefined, index: number): string {
  const displayIndex = index + 1;
  if (!code || !code.trim()) {
    return `${displayIndex} - ACT-${displayIndex}`;
  }

  const clean = code.trim();

  // Pattern 1: Already has index prefix like "1 - ACT080" or "11 - ACT-11" or "11 - ACT090"
  const withPrefixMatch = clean.match(/^(\d+)\s*-\s*(.*)$/);
  if (withPrefixMatch) {
    const idxPart = withPrefixMatch[1];
    const actPart = withPrefixMatch[2].trim().toUpperCase();

    if (actPart === 'ACT090' || actPart === '090') {
      return `${idxPart} - ACT-${idxPart}`;
    }

    if (/^ACT\d{3}$/.test(actPart)) {
      return `${idxPart} - ${actPart}`;
    }

    if (actPart.startsWith('ACT-')) {
      return `${idxPart} - ${actPart}`;
    }

    if (actPart.startsWith('ACT')) {
      const rest = actPart.replace('ACT', '').trim();
      if (rest) {
        return `${idxPart} - ACT-${rest}`;
      }
      return `${idxPart} - ACT-${idxPart}`;
    }

    return `${idxPart} - ${actPart}`;
  }

  // Pattern 2: Code without prefix
  const upperClean = clean.toUpperCase();

  if (upperClean === 'ACT090' || upperClean === '090') {
    return `${displayIndex} - ACT-${displayIndex}`;
  }

  if (/^ACT\d{3}$/.test(upperClean)) {
    return `${displayIndex} - ${upperClean}`;
  }

  if (upperClean.startsWith('ACT-')) {
    return `${displayIndex} - ${upperClean}`;
  }

  if (upperClean.startsWith('ACT')) {
    const rest = upperClean.replace('ACT', '').trim();
    if (rest) {
      return `${displayIndex} - ACT-${rest}`;
    }
    return `${displayIndex} - ACT-${displayIndex}`;
  }

  if (/^\d+$/.test(clean)) {
    if (clean.length === 3 && clean !== '090') {
      return `${displayIndex} - ACT${clean}`;
    }
    return `${displayIndex} - ACT-${clean}`;
  }

  return `${displayIndex} - ${clean}`;
}

// Convert any French date (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.) to YYYY-MM-DD
export function parseFrenchDate(dateStr: string): string {
  if (!dateStr) return formatLocalDate(new Date());
  const datePart = dateStr.trim().split(' ')[0];
  if (!datePart) return formatLocalDate(new Date());

  const parts = datePart.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  }
  return dateStr;
}

// Map CSV priority string to typed priority
function parsePriority(priorityStr?: string): WorkOrderPriority {
  if (!priorityStr) return 'Moyenne';
  const lower = priorityStr.toLowerCase();
  if (lower.includes('urg') || lower.includes('high')) return 'Urgente';
  if (lower.includes('élevé') || lower.includes('eleve')) return 'Élevée';
  if (lower.includes('fai') || lower.includes('low')) return 'Faible';
  return 'Moyenne';
}

// Parse Gamme CSV into structured GammePlan array
export function parseGammeCSV(csvContent: string): GammePlan[] {
  const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  const headers = parseCSVLine(firstLine, delimiter).map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  const idxEquipment = headers.findIndex(h => h.includes('equipement') && !h.includes('description'));
  const idxIntDesc = headers.findIndex(h => h.includes('description') && (h.includes('intervention') || h.includes('action')));
  const idxAction = headers.findIndex(h => !h.includes('description') && (h.includes('intervention') || h.includes('action')));
  const idxEqDesc = headers.findIndex(h => h.includes('description') && h.includes('equipement'));

  const plans: GammePlan[] = [];
  let currentPlan: GammePlan | null = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length < 2) continue;

    const eqCode = (idxEquipment >= 0 && cols[idxEquipment]) ? cols[idxEquipment] : '';
    const intDesc = (idxIntDesc >= 0 && cols[idxIntDesc]) ? cols[idxIntDesc] : '';
    const actionCode = (idxAction >= 0 && cols[idxAction]) ? cols[idxAction] : '';
    const eqDesc = (idxEqDesc >= 0 && cols[idxEqDesc]) ? cols[idxEqDesc] : '';

    if (!actionCode && !intDesc) continue;

    const upperAction = (actionCode || '').toUpperCase().trim();
    const isHeader = upperAction.startsWith('PS') || (eqDesc && eqDesc.length > 0) || upperAction.includes('1H') || upperAction.includes('1M') || upperAction.includes('1T') || upperAction.includes('1S') || upperAction.includes('1A');

    if (isHeader) {
      currentPlan = {
        id: `plan-${i}-${Date.now()}`,
        equipmentCode: eqCode,
        planCode: actionCode,
        interventionTitle: intDesc,
        equipmentDescription: eqDesc,
        tasks: []
      };
      plans.push(currentPlan);
    } else {
      if (!currentPlan) {
        currentPlan = {
          id: `plan-gen-${i}`,
          equipmentCode: eqCode,
          planCode: 'GENERIC-GAMME',
          interventionTitle: 'Maintenance Préventive',
          tasks: []
        };
        plans.push(currentPlan);
      }
      const nextIdx = currentPlan.tasks.length;
      currentPlan.tasks.push({
        id: `task-${i}-${nextIdx}`,
        actionCode: formatActionCode(actionCode, nextIdx),
        label: intDesc
      });
    }
  }

  return plans;
}

// Find matching GammePlan for a given OT
export function findMatchingGammePlan(
  eqCode: string,
  interventionCode: string,
  intDesc: string,
  gammePlans: GammePlan[],
  siteLocation?: string
): GammePlan | undefined {
  if (!gammePlans || gammePlans.length === 0) return undefined;

  const cleanEq = (eqCode || '').trim().toLowerCase();
  const cleanCode = (interventionCode || '').trim().toLowerCase();
  const cleanTitle = (intDesc || '').trim().toLowerCase();
  const cleanSite = (siteLocation || '').trim().toLowerCase();

   const hasSiteToken = (str: string, token: string): boolean => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z])${escaped}($|[^a-z])`, 'i');
    return re.test(str);
  };

  const sitesConflict = (plan: GammePlan): boolean => {
    const pEq = (plan.equipmentCode || '').toLowerCase();
    const pDesc = (plan.equipmentDescription || '').toLowerCase();
    const pTitle = (plan.interventionTitle || '').toLowerCase();
    
    const knownSites = [
      { key: 'knt', names: ['knt', 'kenitra', 'kénitra'] },
      { key: 'cas', names: ['cas', 'casa', 'casablanca'] },
      { key: 'rab', names: ['rab', 'rabat'] },
      { key: 'tng', names: ['tng', 'tanger'] },
      { key: 'mar', names: ['mar', 'marrakech'] },
      { key: 'fez', names: ['fez', 'fes', 'fès'] },
      { key: 'agd', names: ['agd', 'agadir'] },
    ];

    const otSiteKey = knownSites.find(s => 
      s.names.some(n => hasSiteToken(cleanSite, n) || hasSiteToken(cleanEq, n) || hasSiteToken(cleanTitle, n))
    );

    const planSiteKey = knownSites.find(s => 
      s.names.some(n => hasSiteToken(pEq, n) || hasSiteToken(pDesc, n) || hasSiteToken(pTitle, n))
    );

    if (otSiteKey && planSiteKey && otSiteKey.key !== planSiteKey.key) {
      return true;
    }
    return false;
  };

  const eligiblePlans = gammePlans.filter(p => !sitesConflict(p) && p.tasks && p.tasks.length > 0);
  if (eligiblePlans.length === 0) return undefined;

  let match = eligiblePlans.find(p => 
    p.planCode.trim().toLowerCase() === cleanCode &&
    p.equipmentCode.trim().toLowerCase() === cleanEq
  );
  if (match) return match;

  if (cleanCode.length >= 3) {
    match = eligiblePlans.find(p => p.planCode.trim().toLowerCase() === cleanCode);
    if (match) return match;
  }

  match = eligiblePlans.find(p => 
    p.equipmentCode.trim().toLowerCase() === cleanEq &&
    (p.interventionTitle.trim().toLowerCase().includes(cleanTitle) || cleanTitle.includes(p.interventionTitle.trim().toLowerCase()))
  );
  if (match) return match;

  const extractFamily = (str: string) => {
    const m = str.match(/(ext|asc|pmp|pomp|cta|can|gplc|ptrsf|trsf|sant|spt|td|tgbt|pac|ond|praut|vmc|clim)/i);
    return m ? m[1].toLowerCase() : '';
  };

  const otFamily = extractFamily(cleanEq) || extractFamily(cleanCode) || extractFamily(cleanTitle);
  if (otFamily) {
    match = eligiblePlans.find(p => {
      const pFam = extractFamily(p.planCode) || extractFamily(p.equipmentCode) || extractFamily(p.interventionTitle);
      return pFam === otFamily;
    });
    if (match) return match;
  }

  const keywords = [
    'extracteur', 'extract', 'ventilateur', 'ventilation', 'desenfumage',
    'ascenseur', 'pompe', 'groupe electrogene', 'groupe', 'caisson',
    'centrale', 'cta', 'onduleur', 'porte automatique', 'porte', 'split',
    'tableau', 'tgbt', 'sanitaire', 'transformateur', 'pac', 'pompe a chaleur',
    'clim', 'climatiseur', 'chaudiere', 'compresseur', 'armoire', 'eclairage',
    'extincteur', 'ria', 'vmc'
  ];

  const matchedKw = keywords.find(kw => cleanTitle.includes(kw) || cleanEq.includes(kw));
  if (matchedKw) {
    match = eligiblePlans.find(p => 
      p.interventionTitle.toLowerCase().includes(matchedKw) || 
      p.equipmentCode.toLowerCase().includes(matchedKw) ||
      (p.equipmentDescription || '').toLowerCase().includes(matchedKw)
    );
    if (match) return match;
  }

  if (cleanCode && cleanCode.length >= 3) {
    match = eligiblePlans.find(p => p.planCode.trim().toLowerCase().includes(cleanCode));
    if (match) return match;
  }

  return undefined;
}

// Helper to clean and normalize header strings
function cleanHeaderStr(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFFFD/g, "e")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Table des abréviations de mois français (3 lettres)
const FRENCH_MONTH_ABBREV: Record<string, string> = {
  'janvier': 'JAN',
  'fevrier': 'FEV',
  'février': 'FEV',
  'mars': 'MAR',
  'avril': 'AVR',
  'mai': 'MAI',
  'juin': 'JUN',
  'juillet': 'JUL',
  'aout': 'AOU',
  'août': 'AOU',
  'septembre': 'SEP',
  'octobre': 'OCT',
  'novembre': 'NOV',
  'decembre': 'DEC',
  'décembre': 'DEC'
};

function extractSiteMonthYearFromFileName(fileName: string): string | null {
  const withoutExt = fileName.replace(/\.(csv|xlsx|xls|txt|tsv)$/i, '').trim();
  const tokens = withoutExt.split(/\s+/);
  if (tokens.length < 3) return null;

  const year = tokens[tokens.length - 1];
  const monthAbbrev = FRENCH_MONTH_ABBREV[tokens[tokens.length - 2].toLowerCase()];

  if (!/^\d{4}$/.test(year) || !monthAbbrev) return null;

  const site = tokens.slice(1, tokens.length - 2).join(' ');
  if (!site) return null;

  return `${site}-${monthAbbrev}${year}`;
}

export function parsePlanningCSV(
  csvContent: string,
  gammePlans: GammePlan[] = [],
  lineFileNames?: string[]
): WorkOrder[] {
  const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  let delimiter = ';';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';')) delimiter = ';';
  else if (firstLine.includes(',')) delimiter = ',';

  const rawHeaders = parseCSVLine(firstLine, delimiter);
  const headers = rawHeaders.map(cleanHeaderStr);
  
  const getIndex = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

  const idxEqDesc = headers.findIndex(h => 
    (h.includes('description') && h.includes('equipement')) || 
    h.includes('libelle equipement') || 
    h.includes('nom equipement') || 
    h.includes('designation equipement')
  );

  const idxEquipment = headers.findIndex((h, idx) => 
    idx !== idxEqDesc && (
      h === 'equipement' || 
      h === 'code equipement' || 
      h === 'code_equipement' || 
      h === 'eq' || 
      h === 'equipment' || 
      h === 'id equipement' || 
      (h.includes('equipement') && !h.includes('description') && !h.includes('libelle') && !h.includes('nom') && !h.includes('systeme'))
    )
  );

  const idxPlanner = getIndex(['planificateur', 'planner', 'superviseur']);
  const idxIntervention = getIndex(['intervention', 'code']);
  const idxDueDate = getIndex(['date echeancier', 'date debut', 'date', 'echeance']);
  const idxOTCode = getIndex(['ot', 'n d ot', 'no ot', 'num ot']);
  const idxIntDesc = getIndex(['description de l intervention', 'description intervention', 'libelle']);
  const idxPriority = getIndex(['priorite', 'priority']);
  const idxEntity = getIndex(['entite', 'entity', 'zone', 'site', 'emplacement', 'lieu', 'batiment', 'atelier', 'projet']);
  const idxPlanNo = getIndex(['plan', 'n de plan', 'no plan']);

  let ncSequence = 0;
  const workOrders: WorkOrder[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    if (cols.length < 2) continue;

    const eqCode = (idxEquipment >= 0 && cols[idxEquipment]) ? cols[idxEquipment].trim() : '';
    const eqDesc = (idxEqDesc >= 0 && cols[idxEqDesc]) ? cols[idxEqDesc].trim() : '';
    const otNum = (idxOTCode >= 0 && cols[idxOTCode]) ? cols[idxOTCode].trim() : '';

    let code: string;
    if (otNum && otNum.toUpperCase() !== 'NC' && otNum !== 'N/C' && otNum !== '0') {
      code = otNum.startsWith('OT-') ? otNum : `OT-${otNum}`;
    } else {
      ncSequence += 1;
      const seqStr = String(ncSequence).padStart(3, '0');
      const originFileName = lineFileNames?.[i - 1];
      const label = originFileName ? extractSiteMonthYearFromFileName(originFileName) : null;
      code = label
        ? `NC-${label}-${seqStr}`
        : `NC-${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : `${Date.now()}-${i}`}`;
    }
    
    const intDesc = (idxIntDesc >= 0 && cols[idxIntDesc]) ? cols[idxIntDesc].trim() : 'Maintenance Préventive';
    const interventionCode = (idxIntervention >= 0 && cols[idxIntervention]) ? cols[idxIntervention].trim() : '';
    const rawDate = (idxDueDate >= 0 && cols[idxDueDate]) ? cols[idxDueDate].trim() : '';
    const dueDate = parseFrenchDate(rawDate);
    const assignee = (idxPlanner >= 0 && cols[idxPlanner]) ? cols[idxPlanner].trim() : 'Technicien';
    const priorityStr = (idxPriority >= 0 && cols[idxPriority]) ? cols[idxPriority].trim() : '';
    const priority = parsePriority(priorityStr);
    const rawEntity = (idxEntity >= 0 && cols[idxEntity]) ? cols[idxEntity].trim() : '';
    const entity = rawEntity;
    const planNumber = (idxPlanNo >= 0 && cols[idxPlanNo]) ? cols[idxPlanNo].trim() : '';

    const equipmentName = eqDesc || eqCode || 'Non spécifié';
    const title = intDesc || 'Intervention de maintenance';
    const description = intDesc || (eqDesc ? `Intervention sur ${eqDesc}` : 'Maintenance préventive');
    const locationName = entity || 'Site Principal';

    const matchedPlan = findMatchingGammePlan(eqCode, interventionCode, intDesc, gammePlans, locationName);
    const tasks: WorkOrderTask[] = matchedPlan
      ? matchedPlan.tasks.map((t, idx) => ({
          id: `task-${i}-${idx}-${Math.floor(Math.random()*10000)}`,
          code: formatActionCode(t.actionCode, idx),
          label: t.label,
          completed: false
        }))
      : [];

    workOrders.push({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? `wo-imported-${crypto.randomUUID()}`
        : `wo-imported-${Date.now()}-${i}-${Math.floor(Math.random()*1000000)}-${Math.floor(Math.random()*1000000)}`,
      code,
      title,
      description,
      status: 'Ouvert',
      priority,
      type: 'Préventive',
      equipmentCode: eqCode,
      equipmentName: equipmentName || eqDesc || eqCode || 'Non spécifié',
      location: locationName,
      assignee: assignee || 'Jean Dupont',
      dueDate,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      planner: assignee,
      planNumber,
      interventionCode,
      entity,
      tasks
    });
  }

  return workOrders;
}
