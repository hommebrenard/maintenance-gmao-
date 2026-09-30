import type { EquipmentPart } from '../types';

// Utilitaires purs du formulaire « Pièces de rechange » (étape 3 de la 4c, 30/09/2026).
// Règle du projet : donnée inconnue = « Non renseigné » (undefined/null), jamais une valeur inventée.

/** Entier positif ou nul (« 12 »). undefined si invalide (décimal, négatif, texte, > 9 chiffres). */
export function parseCount(text: string): number | undefined {
  const t = text.trim();
  return /^\d{1,9}$/.test(t) ? Number(t) : undefined;
}

/** Prix positif ou nul, virgule ou point, 2 décimales max (« 12,50 »). undefined si invalide. */
export function parsePrice(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  return /^\d{1,9}(\.\d{1,2})?$/.test(t) ? Number(t) : undefined;
}

/** Même ordre que la lecture en base : par désignation, accents et casse ignorés. */
export function sortParts(items: EquipmentPart[]): EquipmentPart[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}
