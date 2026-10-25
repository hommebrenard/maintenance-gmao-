/**
 * Types d'intervention Coswin (liste communiquée par l'utilisateur le 25/10/2026, capture de Coswin).
 * Dans le formulaire « Nouvelle demande », ce choix alimente la « Source de constatation » et est
 * enregistré dans la colonne `intervention_type` (la même que le TYPE des DI importées).
 */
export interface InterventionType { code: string; label: string }

export const INTERVENTION_TYPES: InterventionType[] = [
  { code: 'CAT', label: 'Correctif-Assistance technique' },
  { code: 'CCR', label: 'Correctif-Contrôle réglementaire' },
  { code: 'CDC', label: 'Correctif-Demande du client' },
  { code: 'CO', label: 'Correctif' },
  { code: 'CSP', label: 'Correctif-Suite au préventif' },
  { code: 'CSR', label: 'Correctif-Suite ronde' },
  { code: 'DAF', label: 'Correctif-DAF' },
  { code: 'PS', label: 'PRÉVENTIF SYSTÉMATIQUE' },
  { code: 'QSE', label: 'QUALITÉ SÉCURITÉ ENVIRONNEMENT' },
  { code: 'RD', label: 'RONDE' },
  { code: 'TEB', label: 'Travaux Entretien Bâtiment' },
  { code: 'TN', label: 'Travaux neuf' },
];

export const isInterventionTypeCode = (c: string | undefined | null): boolean =>
  !!c && INTERVENTION_TYPES.some(t => t.code === c);
