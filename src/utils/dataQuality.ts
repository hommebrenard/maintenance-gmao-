import type { MaintenanceRequest, WorkOrder } from '../types';
import type { SiteNameResolver } from './siteLabel';
import { requestCodeKey } from './equipmentRequests';

/**
 * Qualité des données — contrôles en lecture seule (aucune donnée n'est modifiée) :
 * - Chaque contrôle compte les DI ou les OT du périmètre affiché qui présentent l'anomalie décrite, et propose la liste nominative.
 * - Une anomalie n'est pas une erreur prouvée : elle signale une donnée à vérifier (dans Coswin ou dans l'application).
 */
export interface QualityItem { id: string; code: string; title: string; site: string }
export interface QualityCheck { key: string; scope: 'DI' | 'OT'; label: string; definition: string; population: number; items: QualityItem[] }

const blank = (v?: string | null) => !v || !v.trim();
const validDiCode = (c?: string) => /^DI\d{6,}$/i.test((c ?? '').trim());

const otItem = (w: WorkOrder): QualityItem => ({ id: w.id, code: w.code, title: w.title || '', site: w.location || '' });

export function computeQuality(requests: MaintenanceRequest[], workOrders: WorkOrder[], siteName?: SiteNameResolver, equipmentCodes?: ReadonlySet<string>): QualityCheck[] {
  const diItem = (r: MaintenanceRequest): QualityItem => ({ id: r.id, code: r.code || '(vide)', title: r.title || '', site: siteName?.(r.siteCode) ?? (r.siteCode || r.location || '') });
  const diCodeCount = new Map<string, number>();
  for (const r of requests) if (!blank(r.code)) diCodeCount.set(r.code!.trim().toUpperCase(), (diCodeCount.get(r.code!.trim().toUpperCase()) ?? 0) + 1);
  const coswinDi = requests.filter(r => r.origin === 'coswin');
  const unlinked = requests.filter(r => blank(r.equipmentId));
  // Sépare les DI sans lien enregistré selon que le carnet les retrouve par leur code ou non (même règle que le carnet).
  const bySplit = equipmentCodes && equipmentCodes.size > 0
    ? [
      { key: 'di-noeq-code', scope: 'DI' as const, label: '… dont retrouvées par leur code', definition: "Pas de lien enregistré, mais le code Coswin (équipement planifié d'abord, source en repli) correspond à un équipement de l'application : le carnet de santé les liste.", population: requests.length, items: unlinked.filter(r => { const k = requestCodeKey(r); return !!k && equipmentCodes.has(k); }).map(diItem) },
      { key: 'di-noeq-missing', scope: 'DI' as const, label: '… dont équipement introuvable', definition: "Pas de lien enregistré et le code Coswin ne correspond à aucun équipement de l'application (ou il est vide) : le carnet ne peut pas les lister. Équipement à créer ou code à corriger dans Coswin.", population: requests.length, items: unlinked.filter(r => { const k = requestCodeKey(r); return !k || !equipmentCodes.has(k); }).map(diItem) },
      { key: 'di-noeq-ifbt', scope: 'DI' as const, label: '… … dont rattachées à un local (IFBT)', definition: "Parmi les DI à équipement introuvable : celles dont la fonction Coswin est IFBT (infrastructure et bâtiment). Coswin les rattache à un local, que l'application n'importe pas comme équipement ; une DI peut néanmoins citer un équipement dans sa description : à lire DI par DI.", population: requests.length, items: unlinked.filter(r => { const k = requestCodeKey(r); return (!k || !equipmentCodes.has(k)) && (r.functionCode ?? '').trim().toUpperCase() === 'IFBT'; }).map(diItem) },
    ]
    : [];

  return [
    { key: 'di-code', scope: 'DI', label: 'DI au code invalide', definition: "Code de DI vide ou ne respectant pas le format « DI » suivi d'au moins 6 chiffres (ex. DI00000114).", population: requests.length, items: requests.filter(r => !validDiCode(r.code)).map(diItem) },
    { key: 'di-dup', scope: 'DI', label: 'DI au code en double', definition: 'Même code de DI porté par plusieurs demandes.', population: requests.length, items: requests.filter(r => !blank(r.code) && (diCodeCount.get(r.code!.trim().toUpperCase()) ?? 0) > 1).map(diItem) },
    { key: 'di-nodate', scope: 'DI', label: 'DI sans date de déclaration', definition: "Ni date de déclaration ni date de création exploitable : l'âge de la DI ne peut pas être calculé.", population: requests.length, items: requests.filter(r => Number.isNaN(Date.parse((r.declaredAt || r.createdAtIso || '').slice(0, 10)))).map(diItem) },
    { key: 'di-noeq', scope: 'DI', label: 'DI sans lien enregistré', definition: "Aucun équipement enregistré en base pour la DI (lien vide). Elle peut quand même apparaître dans le carnet de santé si son code Coswin correspond à un équipement : voir les deux lignes suivantes.", population: requests.length, items: unlinked.map(diItem) },
    ...bySplit,
    { key: 'di-noprio', scope: 'DI', label: 'DI Coswin sans priorité', definition: "DI importée de Coswin dont le champ « Priorité Coswin » est vide : elle tombe dans « Non renseignée » de la heatmap.", population: coswinDi.length, items: coswinDi.filter(r => blank(r.priorityCode)).map(diItem) },
    { key: 'ot-noeq', scope: 'OT', label: 'OT sans équipement lié', definition: "Aucun équipement de l'application rattaché à l'OT.", population: workOrders.length, items: workOrders.filter(w => blank(w.equipmentId)).map(otItem) },
    { key: 'ot-nodue', scope: 'OT', label: "OT sans date d'échéance", definition: "Date d'échéance vide ou illisible : l'OT n'entre dans aucun calcul de retard.", population: workOrders.length, items: workOrders.filter(w => Number.isNaN(Date.parse((w.dueDate || '').slice(0, 10)))).map(otItem) },
    { key: 'ot-nogamme', scope: 'OT', label: "OT sans code d'intervention (gamme)", definition: "Code d'intervention vide : la gamme et la checklist ne peuvent pas être rattachées avec certitude.", population: workOrders.length, items: workOrders.filter(w => blank(w.interventionCode)).map(otItem) },
    { key: 'ot-nc', scope: 'OT', label: 'OT « NC » (sans numéro Coswin)', definition: "OT dont le code commence par « NC » : planifié dans l'application, non créé dans Coswin.", population: workOrders.length, items: workOrders.filter(w => /^(?:OT-)?NC/i.test((w.code || '').trim())).map(otItem) },
  ];
}
