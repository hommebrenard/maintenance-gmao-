import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Equipment, WorkOrder } from '../types';

// Faux client Supabase : capture les charges utiles envoyées, sans réseau.
const { calls, EQ_ROW } = vi.hoisted(() => ({
  calls: [] as { op: 'insert' | 'update'; payload: any }[],
  EQ_ROW: {
    id: '22222222-2222-2222-2222-222222222222',
    code: 'BAM-BML_AG-TD-11',
    name: 'TABLEAUX DISTRIBUTION',
    description: null,
    category: null,
    brand: null,
    model: null,
    serial_number: null,
    location_id: 'loc-1',
    supplier_id: null,
    status: 'operationnel',
    criticality: 'Normal',
    created_at: '2026-09-18T19:56:42Z',
    updated_at: '2026-09-20T10:00:00Z',
    locations: { name: 'AG Type B BENI MELLAL' },
    suppliers: null,
  } as Record<string, unknown>,
}));

vi.mock('../lib/supabaseClient', () => {
  const chain: any = {
    eq: () => chain,
    select: () => chain,
    single: () => Promise.resolve({ data: EQ_ROW, error: null }),
  };
  return {
    supabase: {
      from: () => ({
        insert: (payload: any) => {
          calls.push({ op: 'insert', payload });
          return chain;
        },
        update: (payload: any) => {
          calls.push({ op: 'update', payload });
          return chain;
        },
      }),
    },
  };
});

import {
  isBlankField,
  getLinkedWorkOrders,
  getOperationalStatusBadgeClass,
  getWorkOrderStatusBadgeClass,
  formatIsoDate,
  buildEquipmentEditPatch,
  extractBrandFromDescription,
  type EquipmentEditForm,
} from './equipmentDisplay';
import { updateEquipment, createEquipment } from '../lib/queries/equipment';

beforeEach(() => {
  calls.length = 0;
});

function makeWO(partial: Partial<WorkOrder> & { id: string; code: string }): WorkOrder {
  return {
    title: 'Contrôle',
    description: '',
    status: 'Ouvert',
    priority: 'Moyenne',
    type: 'Préventive',
    dueDate: '2026-06-15',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    ...partial,
  };
}

describe('isBlankField', () => {
  it('considère vide, espaces et tiret cadratin comme non renseignés', () => {
    expect(isBlankField(undefined)).toBe(true);
    expect(isBlankField(null)).toBe(true);
    expect(isBlankField('')).toBe(true);
    expect(isBlankField('   ')).toBe(true);
    expect(isBlankField('—')).toBe(true);
    expect(isBlankField(' — ')).toBe(true);
  });

  it('considère une vraie valeur comme renseignée', () => {
    expect(isBlankField('Schindler')).toBe(false);
    expect(isBlankField('105916')).toBe(false);
  });
});

describe('getLinkedWorkOrders', () => {
  const eq = { id: 'eq-1', code: 'BAM-MKN_AG-ASC-01' };

  it('rattache par equipmentId', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentId: 'eq-1' }),
      makeWO({ id: 'b', code: 'OT-2', equipmentId: 'eq-2' }),
    ];
    expect(getLinkedWorkOrders(eq, list).map(w => w.id)).toEqual(['a']);
  });

  it('rattache par code équipement quand l\'OT n\'a pas d\'equipmentId', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentCode: 'BAM-MKN_AG-ASC-01' }),
      makeWO({ id: 'b', code: 'OT-2', equipmentCode: 'AUTRE' }),
      makeWO({ id: 'c', code: 'OT-3' }),
    ];
    expect(getLinkedWorkOrders(eq, list).map(w => w.id)).toEqual(['a']);
  });

  it('equipmentId fait foi : un OT lié à un autre équipement ne remonte pas par le code', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentId: 'eq-2', equipmentCode: 'BAM-MKN_AG-ASC-01' }),
    ];
    expect(getLinkedWorkOrders(eq, list)).toEqual([]);
  });

  it('trie par échéance décroissante puis par code', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-2', equipmentId: 'eq-1', dueDate: '2026-04-10' }),
      makeWO({ id: 'b', code: 'OT-9', equipmentId: 'eq-1', dueDate: '2026-06-10' }),
      makeWO({ id: 'c', code: 'OT-1', equipmentId: 'eq-1', dueDate: '2026-06-10' }),
    ];
    expect(getLinkedWorkOrders(eq, list).map(w => w.id)).toEqual(['c', 'b', 'a']);
  });

  it('ne modifie pas le tableau d\'origine et renvoie [] sans OT', () => {
    const list = [
      makeWO({ id: 'a', code: 'OT-1', equipmentId: 'eq-1', dueDate: '2026-04-10' }),
      makeWO({ id: 'b', code: 'OT-2', equipmentId: 'eq-1', dueDate: '2026-06-10' }),
    ];
    getLinkedWorkOrders(eq, list);
    expect(list.map(w => w.id)).toEqual(['a', 'b']);
    expect(getLinkedWorkOrders(eq, [])).toEqual([]);
  });
});

describe('badges', () => {
  it('badge d\'état opérationnel : vert / orange / rouge', () => {
    expect(getOperationalStatusBadgeClass('En service')).toContain('green');
    expect(getOperationalStatusBadgeClass('Arrêt planifié')).toContain('amber');
    expect(getOperationalStatusBadgeClass('Arrêt non planifié')).toContain('red');
  });

  it('badge de statut d\'OT', () => {
    expect(getWorkOrderStatusBadgeClass('Terminé')).toContain('green');
    expect(getWorkOrderStatusBadgeClass('En cours')).toContain('blue');
    expect(getWorkOrderStatusBadgeClass('En attente')).toContain('purple');
    expect(getWorkOrderStatusBadgeClass('Ouvert')).toContain('gray');
    expect(getWorkOrderStatusBadgeClass('Annulé')).toContain('gray');
  });
});

describe('formatIsoDate', () => {
  it('formate AAAA-MM-JJ en JJ/MM/AAAA', () => {
    expect(formatIsoDate('2026-06-15')).toBe('15/06/2026');
    expect(formatIsoDate('2026-06-15T00:00:00Z')).toBe('15/06/2026');
  });

  it('tolère vide et format inattendu', () => {
    expect(formatIsoDate('')).toBe('');
    expect(formatIsoDate(undefined)).toBe('');
    expect(formatIsoDate('juin')).toBe('juin');
  });
});

// ---------------------------------------------------------------------------
// Étape 2 (20/09/2026) : « Modifier » équipement enregistré en base
// ---------------------------------------------------------------------------

function makeEq(partial: Partial<Equipment> = {}): Equipment {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    code: 'BAM-BML_AG-TD-11',
    name: 'TABLEAUX DISTRIBUTION',
    status: 'En service',
    criticality: 'Normal',
    location: '',
    supplier: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    createdAt: '',
    updatedAt: '',
    description: '',
    workOrdersCount: 0,
    ...partial,
  };
}

function formOf(eq: Equipment, over: Partial<EquipmentEditForm> = {}): EquipmentEditForm {
  return {
    name: eq.name,
    status: eq.status,
    criticality: eq.criticality,
    manufacturer: eq.manufacturer,
    model: eq.model,
    serialNumber: eq.serialNumber,
    description: eq.description,
    locationId: eq.locationId ?? '',
    ...over,
  };
}

const LOCS = [
  { id: 'loc-1', name: 'AG Type B BENI MELLAL' },
  { id: 'loc-2', name: 'AG Type A MEKNES' },
];

describe('buildEquipmentEditPatch', () => {
  it('formulaire inchangé => rien à envoyer', () => {
    const eq = makeEq({ manufacturer: 'Schindler', locationId: 'loc-1', location: 'AG Type B BENI MELLAL' });
    expect(buildEquipmentEditPatch(eq, formOf(eq), LOCS)).toEqual({});
  });

  it('un champ vide ou « — » côté actuel et vide dans le formulaire = inchangé', () => {
    const eq = makeEq({ manufacturer: '—', model: '', serialNumber: '—', description: '—' });
    expect(buildEquipmentEditPatch(eq, formOf(eq, { manufacturer: '', serialNumber: '', description: '' }), LOCS)).toEqual({});
  });

  it("n'envoie que les champs modifiés, sans espaces superflus", () => {
    const eq = makeEq();
    const patch = buildEquipmentEditPatch(
      eq,
      formOf(eq, { name: '  TD LOCAL CLIM  ', manufacturer: ' Schneider ', serialNumber: '105916', criticality: 'Critique', status: 'Arrêt planifié' }),
      LOCS
    );
    expect(patch).toEqual({
      name: 'TD LOCAL CLIM',
      manufacturer: 'Schneider',
      serialNumber: '105916',
      criticality: 'Critique',
      status: 'Arrêt planifié',
    });
  });

  it('permet de vider un champ renseigné (chaîne vide)', () => {
    const eq = makeEq({ model: 'GA-37' });
    expect(buildEquipmentEditPatch(eq, formOf(eq, { model: '' }), LOCS)).toEqual({ model: '' });
  });

  it("emplacement : envoyé seulement s'il change et existe dans la liste", () => {
    const eq = makeEq({ locationId: 'loc-1', location: 'AG Type B BENI MELLAL' });
    expect(buildEquipmentEditPatch(eq, formOf(eq, { locationId: 'loc-2' }), LOCS)).toEqual({
      locationId: 'loc-2',
      location: 'AG Type A MEKNES',
    });
    expect(buildEquipmentEditPatch(eq, formOf(eq, { locationId: 'inconnu' }), LOCS)).toEqual({});
    expect(buildEquipmentEditPatch(eq, formOf(eq, { locationId: '' }), LOCS)).toEqual({});
  });

  it("équipement sans emplacement : en choisir un l'enregistre", () => {
    const eq = makeEq();
    expect(buildEquipmentEditPatch(eq, formOf(eq, { locationId: 'loc-2' }), LOCS)).toEqual({
      locationId: 'loc-2',
      location: 'AG Type A MEKNES',
    });
  });

  it('un nom vidé est ignoré (le nom reste obligatoire)', () => {
    const eq = makeEq();
    expect(buildEquipmentEditPatch(eq, formOf(eq, { name: '   ' }), LOCS)).toEqual({});
  });
});

describe('écriture équipement Supabase (client simulé)', () => {
  it('updateEquipment envoie les champs modifiés vers les bonnes colonnes', async () => {
    await updateEquipment(EQ_ROW.id as string, {
      name: 'TD LOCAL CLIM',
      description: 'Tableau local clim',
      manufacturer: 'Schneider',
      model: 'Prisma',
      serialNumber: '105916',
      criticality: 'Critique',
      status: 'En service',
      locationId: 'loc-2',
    });
    expect(calls[0].op).toBe('update');
    expect(calls[0].payload).toEqual({
      name: 'TD LOCAL CLIM',
      description: 'Tableau local clim',
      brand: 'Schneider',
      model: 'Prisma',
      serial_number: '105916',
      criticality: 'Critique',
      status: 'operationnel',
      location_id: 'loc-2',
    });
  });

  it("n'écrit pas d'emplacement vide et ne touche pas aux champs absents", async () => {
    await updateEquipment(EQ_ROW.id as string, { model: 'X', locationId: '' });
    expect(calls[0].payload).toEqual({ model: 'X' });
  });

  it("relit l'emplacement (id et nom) dans la ligne renvoyée", async () => {
    const saved = await updateEquipment(EQ_ROW.id as string, { model: 'X' });
    expect(saved.locationId).toBe('loc-1');
    expect(saved.location).toBe('AG Type B BENI MELLAL');
  });

  it("createEquipment : champs vides = chaînes vides (jamais « — ») et emplacement écrit", async () => {
    await createEquipment(
      { code: 'EQ-123', name: 'POMPE', manufacturer: '', model: '', serialNumber: '', description: '', locationId: 'loc-2' },
      'user-1'
    );
    const p = calls[0].payload;
    expect(calls[0].op).toBe('insert');
    expect(p.brand).toBe('');
    expect(p.model).toBe('');
    expect(p.serial_number).toBe('');
    expect(p.description).toBe('');
    expect(Object.values(p)).not.toContain('—');
    expect(p.location_id).toBe('loc-2');
    expect(p.created_by).toBe('user-1');
  });

  it('§22/09 chantier carnet de santé : écrit qr_code/photo_url/manual_url/notes/purchase_date/purchase_price/warranty_end_date', async () => {
    await updateEquipment(EQ_ROW.id as string, {
      qrCode: 'QR-EQ-123',
      photoUrl: 'https://exemple/photo.jpg',
      manualUrl: 'https://exemple/manuel.pdf',
      notes: 'RAS',
      purchaseDate: '2022-01-15',
      purchasePrice: 45000,
      warrantyEndDate: '2025-01-15',
    });
    expect(calls[0].payload).toEqual({
      qr_code: 'QR-EQ-123',
      photo_url: 'https://exemple/photo.jpg',
      manual_url: 'https://exemple/manuel.pdf',
      notes: 'RAS',
      purchase_date: '2022-01-15',
      purchase_price: 45000,
      warranty_end_date: '2025-01-15',
    });
  });

  it('§22/09 chantier carnet de santé : lit qr_code/photo_url/manual_url/notes/purchase_date/purchase_price/warranty_end_date (défaut chaîne vide si NULL)', async () => {
    const saved = await updateEquipment(EQ_ROW.id as string, { model: 'X' });
    expect(saved.qrCode).toBe('');
    expect(saved.photoUrl).toBe('');
    expect(saved.category).toBe('');
    expect(saved.purchasePrice).toBeUndefined();
  });
});

describe('extractBrandFromDescription', () => {
  it('extrait la marque jusqu\'à la virgule suivante (exemples réels du 21/09)', () => {
    expect(extractBrandFromDescription('VENTILO CONVECTEUR N10 MARQUE: TRANE , PUISSANCE: 32000 BTU , FREON: R407C')).toBe('TRANE');
    expect(extractBrandFromDescription('MONTE CHARGE N1 MARQUE: OTIS , POID: 1000KG')).toBe('OTIS');
  });

  it('la marque peut contenir plusieurs mots', () => {
    expect(extractBrandFromDescription('ONDULEUR N3 MARQUE: FADESOL UPS SYSTEMS, PUISSANCE: 20KVA')).toBe('FADESOL UPS SYSTEMS');
  });

  it("marque en fin de chaîne (pas de virgule après)", () => {
    expect(extractBrandFromDescription('VENTILO CONVECTEUR N10 MARQUE: TRANE')).toBe('TRANE');
  });

  it('insensible à la casse', () => {
    expect(extractBrandFromDescription('pompe marque: grundfos')).toBe('grundfos');
  });

  it("absence de « MARQUE » : chaîne vide", () => {
    expect(extractBrandFromDescription('TABLEAUX DISTRIBUTION')).toBe('');
    expect(extractBrandFromDescription('')).toBe('');
    expect(extractBrandFromDescription(undefined)).toBe('');
    expect(extractBrandFromDescription(null)).toBe('');
  });
});
