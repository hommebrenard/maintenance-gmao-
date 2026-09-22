import { describe, it, expect } from 'vitest';
import { resolveImportLocationId, buildNewEquipmentsFromImport } from './importEquipment';
import { parsePlanningCSV } from './csvParser';
import { WorkOrder } from '../types';

const codeToId = new Map([['BAM_KNT_AG', 'loc-knt'], ['BAM_FEZ_AG', 'loc-fez']]);
const nameToId = new Map([['AG Type A KENITRA', 'loc-knt'], ['Succursale régionale Type A FES', 'loc-fez']]);

const wo = (over: Partial<WorkOrder>): WorkOrder => ({
  id: 'x', code: 'OT-1', title: 't', description: '', status: 'Ouvert', priority: 'Moyenne', type: 'Préventive',
  dueDate: '2026-06-01', createdAt: '', updatedAt: '', ...over
} as WorkOrder);

describe('resolveImportLocationId', () => {
  it('le code Zone brut (entity) est utilisé en premier', () => {
    expect(resolveImportLocationId({ entity: 'BAM_FEZ_AG', location: 'Nom sans rapport' }, codeToId, nameToId)).toBe('loc-fez');
  });

  it('insensible à la casse et aux espaces', () => {
    expect(resolveImportLocationId({ entity: '  bam_knt_ag ' }, codeToId, nameToId)).toBe('loc-knt');
  });

  it("sans entity : location traité comme un code, puis comme un NOM d'emplacement", () => {
    expect(resolveImportLocationId({ location: 'BAM_KNT_AG' }, codeToId, nameToId)).toBe('loc-knt');
    expect(resolveImportLocationId({ location: 'Succursale régionale Type A FES' }, codeToId, nameToId)).toBe('loc-fez');
  });

  it('site inconnu : undefined (équipement créé sans emplacement, comme avant)', () => {
    expect(resolveImportLocationId({ entity: 'BAM_XYZ_AG', location: 'Site inconnu' }, codeToId, nameToId)).toBeUndefined();
    expect(resolveImportLocationId({}, codeToId, nameToId)).toBeUndefined();
  });
});

describe('buildNewEquipmentsFromImport', () => {
  it('une fiche par code absent, les codes déjà connus sont ignorés, emplacement résolu', () => {
    const rows = [
      wo({ equipmentCode: 'BAM-FEZ_AG-VTL-10', equipmentName: 'VENTILO N10', location: 'Succursale régionale Type A FES', entity: 'BAM_FEZ_AG' }),
      wo({ code: 'OT-2', equipmentCode: 'BAM-FEZ_AG-VTL-10', location: 'Succursale régionale Type A FES', entity: 'BAM_FEZ_AG' }),
      wo({ code: 'OT-3', equipmentCode: 'BAM-KNT_AG-PMP-01', location: 'AG Type A KENITRA', entity: 'BAM_KNT_AG' }),
      wo({ code: 'OT-4', equipmentCode: 'DEJA-CONNU', location: 'AG Type A KENITRA', entity: 'BAM_KNT_AG' }),
      wo({ code: 'OT-5', equipmentCode: undefined }),
    ];
    const result = buildNewEquipmentsFromImport(rows, new Set(['DEJA-CONNU']), codeToId, nameToId);
    expect(result.map(e => e.code).sort()).toEqual(['BAM-FEZ_AG-VTL-10', 'BAM-KNT_AG-PMP-01']);
    expect(result.find(e => e.code === 'BAM-FEZ_AG-VTL-10')?.locationId).toBe('loc-fez');
    expect(result.find(e => e.code === 'BAM-FEZ_AG-VTL-10')?.name).toBe('VENTILO N10');
    expect(result.find(e => e.code === 'BAM-KNT_AG-PMP-01')?.locationId).toBe('loc-knt');
    expect(result.find(e => e.code === 'BAM-KNT_AG-PMP-01')?.name).toBe('BAM-KNT_AG-PMP-01');
  });

  it("bout en bout : les OT réellement analysés (location = NOM du site, entity = code Zone) donnent bien un emplacement", () => {
    const header = "Zone;Équipement système;Équipement;Planificateur;Intervention;Date de début;Date échéancier;N° d'OT;N° de plan;Description de l'équipement;Description de l'intervention;Date de fin;Type d'intervention;Classe d'intervention;Priorité";
    const row = 'BAM_FEZ_AG;;BAM-FEZ_AG-VTL-10;AMARA OMAR;PS-VTL-1S-01;27/04/2026;30/04/2026;102001;159;VENTILO CONVECTEUR N10 MARQUE: TRANE;PREVENTIF SYSTEMATIQUE SEMESTRIEL VENTILO CONVECTEUR;27/04/2026;PS;;';
    const locations = [
      { name: 'Succursale régionale Type A FES', code: 'BAM_FEZ_AG' },
      { name: 'AG Type A KENITRA', code: 'BAM_KNT_AG' },
    ] as any;
    const parsed = parsePlanningCSV([header, row].join('\n'), [], [], locations);
    // Le fait qui a causé le bug : `location` est un NOM, pas un code.
    expect(parsed[0].location).toBe('Succursale régionale Type A FES');
    expect(parsed[0].entity).toBe('BAM_FEZ_AG');
    // L'ancienne résolution (nom cherché dans une table de codes) ne trouvait rien :
    expect(codeToId.get(parsed[0].location as string)).toBeUndefined();
    // La nouvelle trouve l'emplacement.
    const [eq] = buildNewEquipmentsFromImport(parsed, new Set(), codeToId, nameToId);
    expect(eq.code).toBe('BAM-FEZ_AG-VTL-10');
    expect(eq.locationId).toBe('loc-fez');
  });

  it("§4.2 point 6 : le fabricant est préremplit depuis « MARQUE: » du nom importé, sans modifier le nom", () => {
    const rows = [
      wo({ equipmentCode: 'BAM-FEZ_AG-VTL-10', equipmentName: 'VENTILO CONVECTEUR N10 MARQUE: TRANE , PUISSANCE: 32000 BTU', location: 'Succursale régionale Type A FES', entity: 'BAM_FEZ_AG' }),
      wo({ code: 'OT-2', equipmentCode: 'BAM-KNT_AG-PMP-01', equipmentName: 'POMPE SANS MARQUE CONNUE', location: 'AG Type A KENITRA', entity: 'BAM_KNT_AG' }),
    ];
    const result = buildNewEquipmentsFromImport(rows, new Set(), codeToId, nameToId);
    const vtl = result.find(e => e.code === 'BAM-FEZ_AG-VTL-10');
    expect(vtl?.manufacturer).toBe('TRANE');
    expect(vtl?.name).toBe('VENTILO CONVECTEUR N10 MARQUE: TRANE , PUISSANCE: 32000 BTU');
    expect(result.find(e => e.code === 'BAM-KNT_AG-PMP-01')?.manufacturer).toBe('');
  });
});
