import { extractSiteMonthYearFromFileName } from './csvParser';
import { findMasterLocationName, type SiteLocationItem } from './siteNormalization';

// Ajouté le 23/10/2026 (cas réel : fichier « …mdiq… » contenant des OT de Marina). Le code des OT « NC »
// est fabriqué à partir du NOM du fichier (NC-<site>-<mois><année>-001) : un nom qui ne correspond pas au
// contenu crée des doublons impossibles à repérer ensuite. On contrôle donc, AVANT l'aperçu, que le site
// indiqué par le nom du fichier est bien celui des lignes.

export interface ImportFileInfo {
  fileName: string;
  /** Code Zone / entité de chaque ligne du fichier (valeurs brutes). */
  entities: string[];
  /** Le fichier contient des OT sans n° Coswin (« NC »). */
  hasNcRows: boolean;
}

export interface ImportFileIssue {
  fileName: string;
  kind: 'site_mismatch' | 'name_not_standard' | 'zone_unknown';
  message: string;
  /** Problème bloquant : le fichier n'est pas chargé, sans possibilité de continuer. */
  blocking: boolean;
}

// Accents ignorés (« MUSEE FES » du nom de fichier = « Musée FES » de l'emplacement).
const key = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[\s_-]+/g, '_');

// Ajouté le 05/11/2026 (cas réel : PMP de mars de Taza, 198 OT enregistrés sous l'entité « BAM », sans emplacement).
// Une Zone qui ne correspond à AUCUN emplacement de l'application donne des OT sans site : on bloque avant l'aperçu.
// Sans liste d'emplacements (pas encore chargée), aucun blocage : on ne peut pas juger.
export function findUnknownZones(entities: string[], locations: SiteLocationItem[] | undefined): { entity: string; count: number }[] {
  if (!locations || locations.length === 0) return [];
  const counts = new Map<string, number>();
  for (const raw of entities) {
    const entity = (raw || '').trim();
    if (!entity) continue;
    counts.set(entity, (counts.get(entity) ?? 0) + 1);
  }
  return [...counts]
    .filter(([entity]) => !findMasterLocationName(entity, locations))
    .map(([entity, count]) => ({ entity, count }));
}

export function zoneUnknownMessage(unknown: { entity: string; count: number }[], subject: string): string {
  const list = unknown.map(u => `« ${u.entity} » (${u.count} ligne${u.count > 1 ? 's' : ''})`).join(', ');
  return `${subject} contient des lignes dont la Zone ne correspond à aucun emplacement de l'application : ${list}. ` +
    `Ces OT seraient enregistrés sans site. Corrigez la colonne Zone du fichier, ou créez d'abord l'emplacement si le site est nouveau. ` +
    `Rien n'est chargé.`;
}

export function checkImportFiles(files: ImportFileInfo[], locations: SiteLocationItem[]): ImportFileIssue[] {
  const issues: ImportFileIssue[] = [];
  for (const f of files) {
    const unknown = findUnknownZones(f.entities, locations);
    if (unknown.length > 0) {
      issues.push({ fileName: f.fileName, kind: 'zone_unknown', blocking: true, message: zoneUnknownMessage(unknown, `Le fichier « ${f.fileName} »`) });
    }
    const label = extractSiteMonthYearFromFileName(f.fileName);
    if (!label) {
      if (f.hasNcRows) {
        issues.push({
          fileName: f.fileName,
          kind: 'name_not_standard',
          blocking: true,
          message: `Le nom du fichier « ${f.fileName} » ne suit pas le modèle « <préfixe> <site> <mois> <année> » (avec des espaces, par ex. « PMP CV MARINA juin 2026.xlsx »). ` +
            `Ses OT « NC » recevraient des codes aléatoires : un réimport les dupliquerait. Renommez le fichier puis rechargez-le. Rien n'est chargé.`,
        });
      }
      continue;
    }
    const fileSite = label.slice(0, label.lastIndexOf('-'));
    const wrong = new Map<string, string>(); // entité -> nom officiel
    for (const entity of new Set(f.entities.map(e => (e || '').trim()).filter(Boolean))) {
      const official = findMasterLocationName(entity, locations);
      if (official && key(official) !== key(fileSite)) wrong.set(entity, official);
    }
    if (wrong.size > 0) {
      const found = [...wrong].map(([entity, name]) => `${name} (${entity})`).join(', ');
      issues.push({
        fileName: f.fileName,
        kind: 'site_mismatch',
        blocking: false,
        message: `Le nom du fichier « ${f.fileName} » indique le site « ${fileSite} », mais ses lignes concernent : ${found}. ` +
          `Corrigez le nom du fichier, sinon les OT « NC » seront mal identifiés.`,
      });
    }
  }
  return issues;
}
