import type { LocationItem } from '../types';
import { canonicalSiteKey } from './requestFilters';

// Import des équipements recensés par Coswin (export « Sélecteur des équipements ») — ÉTAPE A : analyse
// seule, rien n'est écrit. Règles : rapprochement par CODE équipement uniquement (jamais réécrit ; la
// clé normalisée ne sert qu'à comparer, car Coswin mélange « - » et « _ ») ; la colonne « Famille » est
// ignorée (le type vient du segment du code) ; la colonne « État » (actif ?) est ignorée ; aucun
// équipement n'est supprimé ni désactivé ; un site absent de `locations` est signalé, pas créé.

/** Clé de comparaison d'un code équipement (majuscules, « - » et « _ » confondus). */
export function equipmentCompareKey(code: string): string {
  return code.trim().toUpperCase().replace(/[\s_-]+/g, '_');
}

const normHeader = (h: string): string =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const COL = {
  code: 'code equipement',
  name: 'description de l equipement',
  zone: 'zone',
  zoneName: 'description de la zone',
  parent: 'equipement parent',
} as const;

export interface ExistingEquipment { code: string; locationId?: string }

export interface NewEquipmentRow {
  code: string;
  name: string;
  siteKey: string;
  locationId: string;
  parentCode?: string;
}

export interface SiteBlock {
  siteKey: string;
  zoneName: string;
  locationId?: string;
  locationName?: string;
  known: boolean;
  fileCount: number;
  alreadyInApp: number;
  toCreate: number;
  /** Codes présents dans l'app pour ce site mais absents de l'export (jamais supprimés). */
  absentFromFile: string[];
}

export interface EquipmentImportReport {
  missingHeaders: string[];
  totalRows: number;
  emptyCodeRows: number;
  duplicateCodesInFile: string[];
  sites: SiteBlock[];
  /** Lignes dont le site n'existe pas dans `locations` (non créables tant que le site n'existe pas). */
  unknownSiteRows: number;
  alreadyInApp: number;
  toCreate: NewEquipmentRow[];
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim());

export function analyzeEquipmentRows(
  raw: Record<string, unknown>[],
  existing: ExistingEquipment[],
  locations: LocationItem[]
): EquipmentImportReport {
  const headerOf = new Map<string, string>();
  if (raw.length > 0) Object.keys(raw[0]).forEach(h => headerOf.set(normHeader(h), h));
  const missingHeaders = [COL.code, COL.zone].filter(c => !headerOf.has(c));
  const empty: EquipmentImportReport = {
    missingHeaders: missingHeaders.map(c => (c === COL.code ? 'Code équipement' : 'Zone')),
    totalRows: raw.length, emptyCodeRows: 0, duplicateCodesInFile: [], sites: [],
    unknownSiteRows: 0, alreadyInApp: 0, toCreate: [],
  };
  if (missingHeaders.length > 0) return empty;

  const get = (row: Record<string, unknown>, col: string): string => {
    const h = headerOf.get(col);
    return h ? str(row[h]) : '';
  };

  const siteByKey = new Map<string, LocationItem>();
  locations.forEach(l => { const k = canonicalSiteKey(l.code); if (k && !siteByKey.has(k)) siteByKey.set(k, l); });
  const keyByLocationId = new Map<string, string>();
  locations.forEach(l => { const k = canonicalSiteKey(l.code); if (k) keyByLocationId.set(l.id, k); });

  const existingKeys = new Set(existing.map(e => equipmentCompareKey(e.code)));
  const seenInFile = new Set<string>();
  const dupes = new Set<string>();
  const blocks = new Map<string, SiteBlock>();
  const fileKeysBySite = new Map<string, Set<string>>();
  const toCreate: NewEquipmentRow[] = [];
  let emptyCodeRows = 0, unknownSiteRows = 0, alreadyInApp = 0;

  for (const row of raw) {
    const code = get(row, COL.code);
    if (!code) { emptyCodeRows++; continue; }
    const cmp = equipmentCompareKey(code);
    if (seenInFile.has(cmp)) { dupes.add(code); continue; }
    seenInFile.add(cmp);

    const siteKey = canonicalSiteKey(get(row, COL.zone));
    const loc = siteByKey.get(siteKey);
    let block = blocks.get(siteKey);
    if (!block) {
      block = {
        siteKey: siteKey || '(vide)', zoneName: get(row, COL.zoneName), locationId: loc?.id, locationName: loc?.name,
        known: !!loc, fileCount: 0, alreadyInApp: 0, toCreate: 0, absentFromFile: [],
      };
      blocks.set(siteKey, block);
      fileKeysBySite.set(siteKey, new Set());
    }
    block.fileCount++;
    fileKeysBySite.get(siteKey)!.add(cmp);

    if (existingKeys.has(cmp)) { block.alreadyInApp++; alreadyInApp++; continue; }
    if (!loc) { unknownSiteRows++; continue; }
    block.toCreate++;
    toCreate.push({
      code, name: get(row, COL.name) || code, siteKey, locationId: loc.id,
      parentCode: get(row, COL.parent) || undefined,
    });
  }

  // Codes de l'app, pour les sites présents dans le fichier, qui manquent dans l'export.
  existing.forEach(e => {
    const k = e.locationId ? keyByLocationId.get(e.locationId) : undefined;
    const fileKeys = k ? fileKeysBySite.get(k) : undefined;
    if (k && fileKeys && !fileKeys.has(equipmentCompareKey(e.code))) blocks.get(k)!.absentFromFile.push(e.code);
  });

  return {
    missingHeaders: [], totalRows: raw.length, emptyCodeRows,
    duplicateCodesInFile: Array.from(dupes),
    sites: Array.from(blocks.values()).sort((a, b) => a.siteKey.localeCompare(b.siteKey)),
    unknownSiteRows, alreadyInApp, toCreate,
  };
}

/**
 * ÉTAPE B — dernier garde-fou avant écriture : retire les lignes dont le code existe déjà dans l'app
 * (comparaison normalisée), même si l'aperçu les croyait nouvelles, et celles du même code en double.
 * Ne renvoie que des champs « source » (code, nom, site) : statut/criticité par défaut, rien d'autre.
 */
export function selectRowsToCreate(rows: NewEquipmentRow[], existing: ExistingEquipment[]): { toCreate: NewEquipmentRow[]; skipped: number } {
  const known = new Set(existing.map(e => equipmentCompareKey(e.code)));
  const toCreate: NewEquipmentRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const k = equipmentCompareKey(r.code);
    if (known.has(k)) { skipped++; continue; }
    known.add(k);
    toCreate.push(r);
  }
  return { toCreate, skipped };
}
