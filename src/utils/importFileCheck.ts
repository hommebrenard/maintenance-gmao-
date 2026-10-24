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
  kind: 'site_mismatch' | 'name_not_standard';
  message: string;
}

// Accents ignorés (« MUSEE FES » du nom de fichier = « Musée FES » de l'emplacement).
const key = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[\s_-]+/g, '_');

export function checkImportFiles(files: ImportFileInfo[], locations: SiteLocationItem[]): ImportFileIssue[] {
  const issues: ImportFileIssue[] = [];
  for (const f of files) {
    const label = extractSiteMonthYearFromFileName(f.fileName);
    if (!label) {
      if (f.hasNcRows) {
        issues.push({
          fileName: f.fileName,
          kind: 'name_not_standard',
          message: `Le nom du fichier « ${f.fileName} » ne suit pas le modèle « <préfixe> <site> <mois> <année> » (avec des espaces). ` +
            `Ses OT « NC » recevront des codes aléatoires : un réimport les dupliquerait.`,
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
        message: `Le nom du fichier « ${f.fileName} » indique le site « ${fileSite} », mais ses lignes concernent : ${found}. ` +
          `Corrigez le nom du fichier, sinon les OT « NC » seront mal identifiés.`,
      });
    }
  }
  return issues;
}
