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
  ECLEX: { label: 'Éclairage extérieur', lot: 'ELEC' },
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
  // Ajouts du 15/10/2026 (export Coswin « Sélecteur des familles ») — lot ELEC, à valider
  AE: { label: 'Armoire de distribution électrique', lot: 'ELEC' },
  APLC: { label: 'Appareillage électrique', lot: 'ELEC' },
  BBC: { label: 'Batteries de compensation', lot: 'ELEC' },
  CE: { label: 'Compteur électrique', lot: 'ELEC' },
  CEL: { label: 'Cellule', lot: 'ELEC' },
  CFA: { label: 'Courant faible', lot: 'ELEC' },
  CFO: { label: 'Courant fort', lot: 'ELEC' },
  DD: { label: 'Disjoncteur débrochable', lot: 'ELEC' },
  DG: { label: 'Disjoncteur général BT', lot: 'ELEC' },
  ELC: { label: 'Électricité et appareillage', lot: 'ELEC' },
  TE: { label: 'Tableau électrique', lot: 'ELEC' },
  TRMT: { label: 'Transformateur moyenne tension', lot: 'ELEC' },
  TRSF: { label: 'Transformateur moyenne tension', lot: 'ELEC' },
  MEL: { label: "Mât d'éclairage", lot: 'ELEC' },
  PH: { label: 'Programmateur horaire', lot: 'ELEC' },
  PSL: { label: 'Panneaux solaires', lot: 'ELEC' },
  SON: { label: 'Sonorisation', lot: 'ELEC' },
  SCHM: { label: 'Sèche-mains', lot: 'ELEC' },
  'C-ACC': { label: "Contrôle d'accès", lot: 'ELEC' },
  CDI: { label: 'Détection incendie', lot: 'ELEC' },
  SDI: { label: 'Système de détection incendie', lot: 'ELEC' },
  INT: { label: 'Détection intrusion', lot: 'ELEC' },
  VDS: { label: 'Vidéosurveillance', lot: 'ELEC' },
  SGN: { label: 'Signalisation', lot: 'ELEC' },
  AFF: { label: 'Télé-affichage', lot: 'ELEC' },
  DST: { label: 'Télédistribution', lot: 'ELEC' },
  TEL: { label: 'Téléphonie', lot: 'ELEC' },
  PTST: { label: 'Postes téléphoniques et télécommunication', lot: 'ELEC' },
  RIN: { label: 'Réseau informatique', lot: 'ELEC' },
  RR: { label: 'Radio repeater', lot: 'ELEC' },
  GTC: { label: 'Gestion technique centralisée', lot: 'ELEC' },
  'GTC-GTB': { label: 'GTC-GTB', lot: 'ELEC' },
  CODP: { label: 'Compteur de personnes', lot: 'ELEC' },
  PMI: { label: 'Pupitre micro', lot: 'ELEC' },
  STM: { label: 'Station météo', lot: 'ELEC' },
  ECIN: { label: 'ECIN', lot: 'ELEC' },
  ECSC: { label: 'ECSC', lot: 'ELEC' },
  // Ajouts du 15/10/2026 (export Coswin « Sélecteur des familles ») — lot FLUIDE, à valider
  CHAF: { label: 'Chauffe-eau', lot: 'FLUIDE' },
  CHB: { label: 'Chaudière / brûleur', lot: 'FLUIDE' },
  CHDR: { label: 'Chaudière', lot: 'FLUIDE' },
  CLM: { label: 'Climatisation', lot: 'FLUIDE' },
  CVCD: { label: 'Chauffage, ventilation, climatisation, désenfumage', lot: 'FLUIDE' },
  RFTP: { label: 'Rooftop', lot: 'FLUIDE' },
  UEDR: { label: 'Unité extérieure DRV', lot: 'FLUIDE' },
  UIDR: { label: 'Unité intérieure DRV', lot: 'FLUIDE' },
  VEN: { label: "Ventilation, traitement d'air", lot: 'FLUIDE' },
  PLB: { label: 'Plomberie', lot: 'FLUIDE' },
  SNT: { label: 'Plomberie et sanitaire', lot: 'FLUIDE' },
  FEP: { label: "Fontaine d'eau potable", lot: 'FLUIDE' },
  FSE: { label: 'Fontaine', lot: 'FLUIDE' },
  TRM: { label: 'Traitement des eaux', lot: 'FLUIDE' },
  PIS: { label: 'Piscine', lot: 'FLUIDE' },
  PISC: { label: 'Piscine', lot: 'FLUIDE' },
  PISC_FON: { label: 'Équipements piscine / fontaine', lot: 'FLUIDE' },
  RESAS: { label: 'Réseaux assainissement', lot: 'FLUIDE' },
  RESEP: { label: 'Réseaux eaux pluviales', lot: 'FLUIDE' },
  CEE: { label: 'Compteur eau', lot: 'FLUIDE' },
  RIA: { label: "Robinet d'incendie armé", lot: 'FLUIDE' },
  PDI: { label: "Poteau d'incendie", lot: 'FLUIDE' },
  EXI: { label: 'Extincteur', lot: 'FLUIDE' },
  GAR: { label: 'Gestion arrosage', lot: 'FLUIDE' },
  RBD: { label: 'Rain Bird décodeur interface', lot: 'FLUIDE' },
  RBS: { label: 'Station de gestion Rain Bird', lot: 'FLUIDE' },
  RDB: { label: 'Rain Bird décodeur interface', lot: 'FLUIDE' },
  // Ajouts du 15/10/2026 (export Coswin « Sélecteur des familles ») — lot CIRC, à valider
  AEL: { label: 'Appareil élévateur', lot: 'CIRC' },
  // Ajouts du 15/10/2026 (export Coswin « Sélecteur des familles ») — lot DIVERS, à valider
  BAT_COV: { label: 'Bâtiment / clos couvert', lot: 'DIVERS' },
  DGC: { label: 'Divers génie civil', lot: 'DIVERS' },
  ETN: { label: 'Étanchéité', lot: 'DIVERS' },
  FP: { label: 'Faux plafond', lot: 'DIVERS' },
  GO: { label: 'Gros œuvre', lot: 'DIVERS' },
  IFBT: { label: 'Infrastructure et bâtiment', lot: 'DIVERS' },
  MA: { label: 'Menuiserie aluminium', lot: 'DIVERS' },
  MB: { label: 'Menuiserie bois', lot: 'DIVERS' },
  MENS: { label: 'Menuiserie bois / aluminium / vitrage', lot: 'DIVERS' },
  MM: { label: 'Menuiserie métallique', lot: 'DIVERS' },
  PNT: { label: 'Peinture', lot: 'DIVERS' },
  PRTE: { label: 'Porte de salle de bloc', lot: 'DIVERS' },
  QRM: { label: 'Quai et rideaux métalliques', lot: 'DIVERS' },
  REV: { label: 'Revêtement', lot: 'DIVERS' },
  SOV: { label: 'Second œuvre bâtiment', lot: 'DIVERS' },
  VRD: { label: 'Voirie et réseaux divers', lot: 'DIVERS' },
  FOR: { label: 'Coffre-fort', lot: 'DIVERS' },
  ITL: { label: 'Jeux intelligents', lot: 'DIVERS' },
  CUIS: { label: 'Équipements cuisine', lot: 'DIVERS' },
  'EQ-TRANS': { label: 'Équipements transverses', lot: 'DIVERS' },
  EQCS: { label: 'EQCS', lot: 'DIVERS' },
  FDEF: { label: 'Famille à définir', lot: 'DIVERS' },
  TEST: { label: 'Test', lot: 'DIVERS' },
  RSAS: { label: 'RSAS', lot: 'DIVERS' },
  RSPV: { label: 'RSPV', lot: 'DIVERS' },
  CAC: { label: 'CAC', lot: 'DIVERS' },
};

/** Lot d'une famille ; « Divers » si la famille n'est pas dans le référentiel. */
export function lotOfFamily(key: string): LotCode {
  return FAMILIES[key]?.lot ?? 'DIVERS';
}

/** Libellé propre d'une famille connue, sinon undefined. */
export function familyLabel(key: string): string | undefined {
  return FAMILIES[key]?.label;
}
