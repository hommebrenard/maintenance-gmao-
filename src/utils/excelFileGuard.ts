/**
 * Les fichiers Coswin des DI doivent être lus depuis l'Excel d'origine (.xlsx / .xls).
 * Un .csv est refusé : la bibliothèque de lecture inverse jour et mois (05/01 lu comme 1er mai) et perd les zéros initiaux
 * des numéros (N° DAF, N° d'OT), ce qui fabrique de faux écarts (testé en local sur un fichier fictif).
 */
export const EXCEL_ACCEPT = '.xlsx,.xls';

export const isExcelFileName = (name: string): boolean => /\.(xlsx|xls)$/i.test(name.trim());

export const NOT_EXCEL_MESSAGE =
  "Format refusé : utilise le fichier Excel (.xlsx) d'origine de Coswin. Les fichiers .csv ne sont pas acceptés (dates et numéros mal lus). Aucune donnée n'a été lue ni modifiée.";
