/**
 * Référentiel des familles d'équipements (segment « type » du code : BAM-KNT_AG-ASC-01 → ASC)
 * et classement par lot, validé par l'utilisateur le 04/10/2026.
 * Une famille absente de cette table tombe dans le lot « Divers (non classé) » : à ajouter ici.
 */
export type LotCode = 'ELEC' | 'FLUIDE' | 'CIRC' | 'DIVERS';

/** Lot TECHNIQUE interne (table FAMILIES). Ne jamais l'afficher : l'affichage utilise les lots du contrat (CONTRACT_LOT_*) ci-dessous. */

interface FamilyInfo { label: string; lot: LotCode }

export const FAMILIES: Record<string, FamilyInfo> = {
  // Électricité (incl. portes automatiques et sonorisation : on y suit moteurs et accessoires)
  TD: { label: 'Tableau électrique', lot: 'ELEC' },
  TGBT: { label: 'Tableau général basse tension', lot: 'ELEC' },
  PTRSF: { label: 'Transformateur moyenne tension', lot: 'ELEC' },
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
  // Confirmé le 20/10/2026 : les équipements de cuisine sont couverts par le contrat (lot électricité).
  EQCUIS: { label: 'Équipements de cuisine', lot: 'ELEC' },
  EQCUI: { label: 'Équipements de cuisine (variante de EQCUIS)', lot: 'ELEC' },
  ECLSE: { label: 'Éclairage de secours (variante de ECLSEC)', lot: 'ELEC' },
  // Codes absents de la nomenclature Coswin, observés sur les OT : variantes de SANT (à confirmer dans Coswin)
  SANTI5: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANTI2: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANTI3: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANTI8: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANTI9: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANI7: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANI11: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANI12: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANI13: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SANI15: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SAI12: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
  SAI13: { label: 'Équipements sanitaires (variante de SANT)', lot: 'FLUIDE' },
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
  // Validé le 16/10/2026 : seuls les RIA sont couverts par le contrat (lot Fluides). Les poteaux d'incendie et
  // les extincteurs sont hors contrat : famille connue (libellé conservé) mais classée « Divers », donc hors des
  // lots contractuels suivis.
  RIA: { label: "Robinet d'incendie armé", lot: 'FLUIDE' },
  PDI: { label: "Poteau d'incendie", lot: 'DIVERS' },
  EXI: { label: 'Extincteur', lot: 'DIVERS' },
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
  CUIS: { label: 'Équipements cuisine', lot: 'ELEC' },
  // Segments de code que Coswin range dans la famille EQCUIS / ECLSEC / C-ACC (Selecteur_des_equipements, 21/10/2026)
  FRD: { label: 'Équipements de cuisine', lot: 'ELEC' },
  LAV: { label: 'Équipements de cuisine', lot: 'ELEC' },
  ECLS: { label: 'Éclairage de secours', lot: 'ELEC' },
  BRAUT: { label: 'Barrière automatique', lot: 'ELEC' },
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

/**
 * Lots du CONTRAT (confirmé le 20/10/2026) : deux lots, « Électricité » et « Fluide ». L'IFBT et les familles
 * hors contrat sont hors lots. La « circulation mécanique » (ascenseurs, monte-charges, tapis roulants) est un
 * sous-lot de l'électricité : elle reste un lot technique (CIRC) dans la matrice, mais un seul lot de contrat ici.
 */
export type ContractLot = 'ELECTRICITE' | 'FLUIDE' | 'HORS_CONTRAT';
export const CONTRACT_LOT_ORDER: ContractLot[] = ['ELECTRICITE', 'FLUIDE', 'HORS_CONTRAT'];
export const CONTRACT_LOT_LABELS: Record<ContractLot, string> = {
  ELECTRICITE: 'Électricité',
  FLUIDE: 'Fluide',
  HORS_CONTRAT: 'Hors contrat ou non classé',
};

export function contractLotOf(lot: LotCode): ContractLot {
  return lot === 'ELEC' || lot === 'CIRC' ? 'ELECTRICITE' : lot === 'FLUIDE' ? 'FLUIDE' : 'HORS_CONTRAT';
}
export function contractLotOfFamily(key: string): ContractLot {
  return contractLotOf(lotOfFamily(key));
}

/** Sous-lot d'une famille (détail du lot de contrat). Les familles non listées tombent dans « Autres familles ». */
const SUB_LOT: Record<string, string> = {
  OND: 'Tableaux, transformateurs, onduleurs et groupes électrogènes', TD: 'Tableaux, transformateurs, onduleurs et groupes électrogènes', GPLC: 'Tableaux, transformateurs, onduleurs et groupes électrogènes', PTRSF: 'Tableaux, transformateurs, onduleurs et groupes électrogènes', TGBT: 'Tableaux, transformateurs, onduleurs et groupes électrogènes',
  ASC: 'Appareils élévateurs', MTC: 'Appareils élévateurs', TPR: 'Appareils élévateurs', AEL: 'Appareils élévateurs',
  ECLIN: 'Éclairage', ECLEX: 'Éclairage', ECLSEC: 'Éclairage', ECLSE: 'Éclairage',
  PRAUT: 'Portes automatiques', SNOR: 'Équipements de sonorisation', EQCUIS: 'Cuisine', EQCUI: 'Cuisine',
  // Familles Coswin (validées le 21/10/2026)
  TE: 'Tableaux, transformateurs, onduleurs et groupes électrogènes', APLC: 'Tableaux, transformateurs, onduleurs et groupes électrogènes', TRSF: 'Tableaux, transformateurs, onduleurs et groupes électrogènes',
  'C-ACC': 'Portes automatiques', BRAUT: 'Portes automatiques', CUIS: 'Cuisine', FRD: 'Cuisine', LAV: 'Cuisine', ECLS: 'Éclairage',
  RESAS: 'Plomberie · Assainissement', RESEP: 'Plomberie · Assainissement', COMP: 'Plomberie · Air comprimé',
  SANT: 'Plomberie · Sanitaire', PMP: 'Plomberie · Pompage', SURP: 'Plomberie · Pompage', PISC: 'Plomberie · Piscine', BCGR: 'Plomberie · Assainissement',
  PAC: 'CVCD · Production thermique', GEG: 'CVCD · Production thermique', CHDR: 'CVCD · Production thermique',
  SPT: 'CVCD · Climatisation terminale', VRV: 'CVCD · Climatisation terminale', ARCM: 'CVCD · Climatisation terminale', VTL: 'CVCD · Climatisation terminale',
  CTA: "CVCD · Traitement d'air", CAN: "CVCD · Traitement d'air", DESH: "CVCD · Traitement d'air",
  EXT: 'CVCD · Extraction et désenfumage', DSEF: 'CVCD · Extraction et désenfumage',
};
for (const c of ['SANTI5', 'SANTI2', 'SANTI3', 'SANTI8', 'SANTI9', 'SANI7', 'SANI11', 'SANI12', 'SANI13', 'SANI15', 'SAI12', 'SAI13']) SUB_LOT[c] = 'Plomberie · Sanitaire';

export function subLotOfFamily(key: string): string {
  if (contractLotOfFamily(key) === 'HORS_CONTRAT') return 'Hors contrat ou non classé';
  return SUB_LOT[key] ?? 'Autres familles';
}

/** Libellé court d'un lot du contrat (badges, colonnes, exports) : la seule forme abrégée autorisée. */
export const CONTRACT_LOT_SHORT: Record<ContractLot, string> = { ELECTRICITE: 'Électricité', FLUIDE: 'Fluide', HORS_CONTRAT: 'Hors contrat' };
export const CONTRACT_LOT_BADGE: Record<ContractLot, string> = {
  ELECTRICITE: 'bg-amber-100 text-amber-800',
  FLUIDE: 'bg-sky-100 text-sky-800',
  HORS_CONTRAT: 'bg-gray-100 text-gray-600',
};
/** Sous-lots proposés dans les filtres, dans l'ordre d'affichage. */
export const SUB_LOT_OPTIONS: Record<ContractLot, string[]> = {
  ELECTRICITE: ['Tableaux, transformateurs, onduleurs et groupes électrogènes', 'Appareils élévateurs', 'Éclairage', 'Portes automatiques', 'Équipements de sonorisation', 'Cuisine', 'Autres familles'],
  FLUIDE: ['Plomberie · Sanitaire', 'Plomberie · Pompage', 'Plomberie · Piscine', 'Plomberie · Assainissement', 'Plomberie · Air comprimé', 'CVCD · Production thermique', 'CVCD · Climatisation terminale', "CVCD · Traitement d'air", 'CVCD · Extraction et désenfumage', 'Autres familles'],
  HORS_CONTRAT: ['Hors contrat ou non classé'],
};
