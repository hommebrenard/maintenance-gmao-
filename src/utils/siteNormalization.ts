import { WorkOrder } from '../types';

// ---------------------------------------------------------------------------
// Ajouté le 15/09/2026, à partir d'une idée explorée via AI Studio sur une
// ancienne version du code — reprise ici et corrigée avant intégration.
//
// ATTENTION (raison de la réécriture) : la version originale contenait une
// table `KNOWN_BAM_SITES` avec ~19 sites codés en dur, dont AU MOINS 3 codes
// FAUX par rapport à ce qui est réellement confirmé en base Supabase :
//   - Meknès      : code inventé BAM_MEK_AG   (réel confirmé : BAM_MKN_AG)
//   - Fès         : code inventé BAM_FES_AG   (réel confirmé : BAM_FEZ_AG)
//   - Béni Mellal : code inventé BAM_BEN_AG   (réel confirmé : BAM_BML_AG)
// Les ~15 autres sites du tableau original n'ont, eux, jamais été vérifiés
// en base par personne (rappel du 13/09/2026 : il n'existe PAS de liste
// maîtresse fixe des ~30 sites côté Supabase — chaque site est ajouté à la
// main via "+ Nouvel emplacement", avec le code Zone que l'utilisateur lui
// donne). Les inclure ici aurait fait courir le même risque de mauvais
// classement de site que ceux déjà identifiés.
//
// Ce fichier ne liste donc QUE les 4 sites explicitement confirmés par SQL
// direct lors des sessions précédentes. Pour tout autre site, la fonction
// s'appuie sur `locations` (passé en paramètre, provenant de la table
// Supabase `locations` — LA référence officielle de l'app, voir
// gmao-react-migration.md) plutôt que sur une table à moitié devinée.
// Ajouter une entrée ici seulement après vérification SQL directe du code
// Zone réel (comme ça a été fait pour Kénitra/Meknès/Fès/Béni Mellal).
// ---------------------------------------------------------------------------

export const KNOWN_BAM_SITES: Record<string, { name: string; code: string }> = {
  'BAM_KNT_AG': { name: 'Kénitra', code: 'BAM_KNT_AG' },
  'KNT': { name: 'Kénitra', code: 'BAM_KNT_AG' },
  'KENITRA': { name: 'Kénitra', code: 'BAM_KNT_AG' },
  'KÉNITRA': { name: 'Kénitra', code: 'BAM_KNT_AG' },

  'BAM_MKN_AG': { name: 'Meknès', code: 'BAM_MKN_AG' },
  'MKN': { name: 'Meknès', code: 'BAM_MKN_AG' },
  'MEKNES': { name: 'Meknès', code: 'BAM_MKN_AG' },
  'MEKNÈS': { name: 'Meknès', code: 'BAM_MKN_AG' },

  'BAM_FEZ_AG': { name: 'Fès', code: 'BAM_FEZ_AG' },
  'FEZ': { name: 'Fès', code: 'BAM_FEZ_AG' },
  'FES': { name: 'Fès', code: 'BAM_FEZ_AG' },
  'FÈS': { name: 'Fès', code: 'BAM_FEZ_AG' },

  'BAM_BML_AG': { name: 'Béni Mellal', code: 'BAM_BML_AG' },
  'BML': { name: 'Béni Mellal', code: 'BAM_BML_AG' },
  'BENI MELLAL': { name: 'Béni Mellal', code: 'BAM_BML_AG' },
  'BÉNI MELLAL': { name: 'Béni Mellal', code: 'BAM_BML_AG' },
};

export interface SiteLocationItem {
  name: string;
  code?: string;
}

/**
 * Normalise un nom ou code de site vers son nom officiel unique.
 * Priorité : 1) les emplacements réellement configurés dans l'app/Supabase
 * (source officielle), 2) les 4 sites confirmés en dur ci-dessus. Si rien ne
 * correspond, renvoie la valeur d'origine telle quelle (aucune invention).
 */
export function normalizeSiteName(raw?: string, locations?: SiteLocationItem[]): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === 'all' ||
    trimmed === 'Tous les sites' ||
    trimmed === 'Site Principal' ||
    trimmed.toLowerCase() === 'sans site'
  ) {
    return '';
  }

  const upper = trimmed.toUpperCase();

  // 1) Vérifier dans les emplacements configurés par l'utilisateur (Supabase / App) —
  // référence officielle, toujours prioritaire sur la table codée en dur.
  if (locations && locations.length > 0) {
    const found = locations.find(l =>
      (l.code && l.code.trim().toUpperCase() === upper) ||
      l.name.trim().toUpperCase() === upper
    );
    if (found) return found.name;
  }

  // 2) Vérifier dans la table des 4 sites confirmés
  if (KNOWN_BAM_SITES[upper]) {
    return KNOWN_BAM_SITES[upper].name;
  }

  // 3) Aucune correspondance connue : ne rien inventer, renvoyer tel quel.
  return trimmed;
}

/**
 * Détermine si deux désignations de site (nom, code ou alias) font référence au même site.
 */
export function isSameSite(siteA?: string, siteB?: string, locations?: SiteLocationItem[]): boolean {
  if (!siteA || !siteB) return false;
  if (siteA === siteB) return true;

  const normA = normalizeSiteName(siteA, locations);
  const normB = normalizeSiteName(siteB, locations);

  if (normA && normB && normA.toUpperCase() === normB.toUpperCase()) {
    return true;
  }

  return siteA.trim().toUpperCase() === siteB.trim().toUpperCase();
}

/**
 * Filtre un ordre de travail selon le site sélectionné. Gère de manière
 * transparente les OT dont le champ location ou entity contient soit le nom
 * officiel, soit le code Zone brut (ex: BAM_KNT_AG).
 */
export function matchesSiteFilter(wo: WorkOrder, filterValue: string, locations?: SiteLocationItem[]): boolean {
  if (!filterValue || filterValue === 'all' || filterValue === 'Tous les sites') {
    return true;
  }

  const canonicalFilter = normalizeSiteName(filterValue, locations);

  if (wo.location && (isSameSite(wo.location, filterValue, locations) || isSameSite(wo.location, canonicalFilter, locations))) {
    return true;
  }

  if (wo.entity && (isSameSite(wo.entity, filterValue, locations) || isSameSite(wo.entity, canonicalFilter, locations))) {
    return true;
  }

  return false;
}
