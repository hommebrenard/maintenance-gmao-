/**
 * Référentiel des familles d'équipements (segment « type » du code : BAM-KNT_AG-ASC-01 → ASC)
 * et classement par lot, validé par l'utilisateur le 04/10/2026.
 * Une famille absente de cette table tombe dans le lot « Divers (non classé) » : à ajouter ici.
 */
export type LotCode = 'ELEC' | 'FLUIDE' | 'CIRC' | 'DIVERS';

export const LOT_ORDER: LotCode[] = ['ELEC', 'FLUIDE', 'CIRC', 'DIVERS'];

export const LOT_LABELS: Record<LotCode, string> = {
  ELEC: 'Électricité',
  FLUIDE: 'Fluides (climatisation, ventilation, plomberie)',
  CIRC: 'Circulation mécanique',
  DIVERS: 'Divers (non classé)',
};

/** Couleurs du badge de lot (volontairement différentes des couleurs d'état des cases). */
export const LOT_BADGE: Record<LotCode, string> = {
  ELEC: 'bg-amber-100 text-amber-800',
  FLUIDE: 'bg-sky-100 text-sky-800',
  CIRC: 'bg-teal-100 text-teal-800',
  DIVERS: 'bg-gray-100 text-gray-600',
};

interface FamilyInfo { label: string; lot: LotCode }

export const FAMILIES: Record<string, FamilyInfo> = {
  // Électricité (incl. portes automatiques et sonorisation : on y suit moteurs et accessoires)
  TD: { label: 'Tableau de distribution', lot: 'ELEC' },
  TGBT: { label: 'Tableau général basse tension', lot: 'ELEC' },
  PTRSF: { label: 'Transformateur', lot: 'ELEC' },
  ECLIN: { label: 'Éclairage intérieur', lot: 'ELEC' },
  ECLSEC: { label: 'Éclairage de secours', lot: 'ELEC' },
  GPLC: { label: 'Groupe électrogène', lot: 'ELEC' },
  OND: { label: 'Onduleur', lot: 'ELEC' },
  PRAUT: { label: 'Porte automatique', lot: 'ELEC' },
  SNOR: { label: 'Sonorisation', lot: 'ELEC' },
  // Fluides : climatisation, ventilation, traitement d'air, plomberie, hydraulique
  ARCM: { label: 'Armoire de climatisation', lot: 'FLUIDE' },
  CAN: { label: "Caisson d'air neuf", lot: 'FLUIDE' },
  CTA: { label: "Centrale de traitement d'air", lot: 'FLUIDE' },
  DESH: { label: 'Déshumidificateur', lot: 'FLUIDE' },
  DSEF: { label: 'Désenfumage', lot: 'FLUIDE' },
  EXT: { label: "Extracteur d'air", lot: 'FLUIDE' },
  G: { label: 'Split gainable', lot: 'FLUIDE' },
  GEG: { label: "Groupe d'eau glacée", lot: 'FLUIDE' },
  PAC: { label: 'Pompe à chaleur', lot: 'FLUIDE' },
  SPT: { label: 'Split system', lot: 'FLUIDE' },
  VRV: { label: 'VRV', lot: 'FLUIDE' },
  VTL: { label: 'Ventilo-convecteur', lot: 'FLUIDE' },
  BCGR: { label: 'Bac à graisse', lot: 'FLUIDE' },
  COMP: { label: "Compresseur d'air", lot: 'FLUIDE' },
  PMP: { label: 'Pompe (puits, relevage)', lot: 'FLUIDE' },
  SANT: { label: 'Équipements sanitaires', lot: 'FLUIDE' },
  SURP: { label: 'Surpresseur', lot: 'FLUIDE' },
  // Circulation mécanique
  ASC: { label: 'Ascenseur', lot: 'CIRC' },
  MTC: { label: 'Monte-charge', lot: 'CIRC' },
  TPR: { label: 'Tapis roulant', lot: 'CIRC' },
  // Divers
  EQCUIS: { label: 'Équipements de cuisson', lot: 'DIVERS' },
};

/** Lot d'une famille ; « Divers » si la famille n'est pas dans le référentiel. */
export function lotOfFamily(key: string): LotCode {
  return FAMILIES[key]?.lot ?? 'DIVERS';
}

/** Libellé propre d'une famille connue, sinon undefined. */
export function familyLabel(key: string): string | undefined {
  return FAMILIES[key]?.label;
}
