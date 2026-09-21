import type { IntervenantLog, WorkOrder, WorkOrderTask } from '../types';

// Ajouté le 20/09/2026 — enregistrement en base de la checklist, du visa, des
// intervenants et des temps d'un OT (colonnes `tasks`, `intervenants_logs`,
// `visa`, `start_date`, `start_time`, `end_date`, `end_time` de `work_orders`).
// Fonctions pures, sans Supabase ni React, pour pouvoir les tester.
//
// Ajouté le 21/09/2026 — même principe pour `interventionCode`, `planNumber` et
// `entity` (colonnes `intervention_code`, `plan_number`, `entity` de `work_orders`) :
// `interventionCode` sert à rattacher l'OT à sa Gamme ; stocké seulement dans le
// navigateur qui avait fait l'import, il manquait sur les autres postes.

/** Champs d'OT désormais portés par Supabase (avant : localStorage uniquement). */
export const DB_EXTRA_FIELDS = [
  'tasks',
  'intervenantsLogs',
  'visa',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
] as const;

export type DbExtraField = (typeof DB_EXTRA_FIELDS)[number];

/** Colonnes Supabase correspondantes (lecture d'une ligne `work_orders`). */
export interface WorkOrderExtrasRow {
  tasks?: WorkOrderTask[] | null;
  intervenants_logs?: IntervenantLog[] | null;
  visa?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
}

/** Champs d'identification d'OT désormais portés par Supabase (avant : localStorage uniquement). */
export const DB_IDENTITY_FIELDS = ['interventionCode', 'planNumber', 'entity'] as const;

export type DbIdentityField = (typeof DB_IDENTITY_FIELDS)[number];

/** Colonnes Supabase correspondantes (lecture d'une ligne `work_orders`). */
export interface WorkOrderIdentityRow {
  intervention_code?: string | null;
  plan_number?: string | null;
  entity?: string | null;
}

/** Colonnes Supabase à écrire (uniquement celles présentes et non vides dans le patch). */
export interface WorkOrderIdentityWrite {
  intervention_code?: string;
  plan_number?: string;
  entity?: string;
}

/** Colonnes Supabase à écrire (uniquement celles présentes dans le patch). */
export interface WorkOrderExtrasWrite {
  tasks?: WorkOrderTask[];
  intervenants_logs?: IntervenantLog[];
  visa?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
}

/** 'AAAA-MM-JJ…' -> 'AAAA-MM-JJ', sinon null (une colonne `date` refuse '' ou un autre format). */
function toDateOrNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1] : null;
}

// Convention (corrigée le 20/09/2026) : NULL en base = « jamais enregistré » ;
// '' = « effacé volontairement » (visa, heures). Sans cette distinction, un
// visa ou des heures effacés dans un navigateur étaient remis en base par le
// rattrapage d'un autre navigateur resté sur une ancienne copie locale.
function toTrimmedText(value: string | undefined | null): string {
  return (value ?? '').trim();
}

/**
 * Colonnes à écrire pour un patch d'OT. Seuls les champs PRÉSENTS dans le patch
 * sont écrits (un champ absent n'est jamais effacé en base).
 */
export function extrasToRow(patch: Partial<WorkOrder>): WorkOrderExtrasWrite {
  const row: WorkOrderExtrasWrite = {};
  if (patch.tasks !== undefined) row.tasks = patch.tasks;
  if (patch.intervenantsLogs !== undefined) row.intervenants_logs = patch.intervenantsLogs;
  if (patch.visa !== undefined) row.visa = toTrimmedText(patch.visa);
  if (patch.startDate !== undefined) row.start_date = toDateOrNull(patch.startDate);
  if (patch.startTime !== undefined) row.start_time = toTrimmedText(patch.startTime);
  if (patch.endDate !== undefined) row.end_date = toDateOrNull(patch.endDate);
  if (patch.endTime !== undefined) row.end_time = toTrimmedText(patch.endTime);
  return row;
}

/** Lecture : une colonne NULL en base devient `undefined` (= « jamais enregistré »). */
export function rowToExtras(row: WorkOrderExtrasRow): Partial<WorkOrder> {
  const extras: Partial<WorkOrder> = {};
  if (row.tasks !== null && row.tasks !== undefined) extras.tasks = row.tasks;
  if (row.intervenants_logs !== null && row.intervenants_logs !== undefined) extras.intervenantsLogs = row.intervenants_logs;
  if (row.visa !== null && row.visa !== undefined) extras.visa = row.visa;
  if (row.start_date !== null && row.start_date !== undefined) extras.startDate = row.start_date.slice(0, 10);
  if (row.start_time !== null && row.start_time !== undefined) extras.startTime = row.start_time;
  if (row.end_date !== null && row.end_date !== undefined) extras.endDate = row.end_date.slice(0, 10);
  if (row.end_time !== null && row.end_time !== undefined) extras.endTime = row.end_time;
  return extras;
}

// Convention pour ces 3 champs : renseignés uniquement à l'import (ou à la copie
// vers un autre site), jamais modifiables à la main. Un texte vide n'est donc
// jamais écrit : NULL en base = « pas de valeur », pas de distinction « effacé ».
function toNonEmptyText(value: string | undefined | null): string | undefined {
  const t = (value ?? '').trim();
  return t === '' ? undefined : t;
}

/** Colonnes à écrire pour un patch d'OT : uniquement les champs présents ET non vides. */
export function identityToRow(patch: Partial<WorkOrder>): WorkOrderIdentityWrite {
  const row: WorkOrderIdentityWrite = {};
  const interventionCode = toNonEmptyText(patch.interventionCode);
  if (interventionCode !== undefined) row.intervention_code = interventionCode;
  const planNumber = toNonEmptyText(patch.planNumber);
  if (planNumber !== undefined) row.plan_number = planNumber;
  const entity = toNonEmptyText(patch.entity);
  if (entity !== undefined) row.entity = entity;
  return row;
}

/** Lecture : une colonne NULL (ou vide) en base devient `undefined`. */
export function rowToIdentity(row: WorkOrderIdentityRow): Partial<WorkOrder> {
  const identity: Partial<WorkOrder> = {};
  if (row.intervention_code) identity.interventionCode = row.intervention_code;
  if (row.plan_number) identity.planNumber = row.plan_number;
  if (row.entity) identity.entity = row.entity;
  return identity;
}

/**
 * Rattrapage (une fois par OT) : `interventionCode`, `planNumber` et `entity`
 * connus de CE navigateur mais absents de la base. Une valeur déjà en base n'est
 * jamais écrasée, et une valeur locale vide n'est jamais envoyée.
 */
export function computeIdentityBackfillPatch(db: WorkOrder, local?: Partial<WorkOrder>): Partial<WorkOrder> {
  const patch: Partial<WorkOrder> = {};
  if (!local) return patch;
  DB_IDENTITY_FIELDS.forEach(field => {
    const localValue = toNonEmptyText(local[field]);
    if (db[field] === undefined && localValue !== undefined) patch[field] = localValue;
  });
  return patch;
}

/**
 * Fusionne un OT lu en base avec les champs encore stockés dans le navigateur.
 * Pour les champs portés par Supabase (les 7 du 20/09 + interventionCode,
 * planNumber et entity depuis le 21/09), la valeur de la base l'emporte dès
 * qu'elle existe ; sinon on garde la valeur locale (rien n'est perdu). Les
 * autres champs locaux sont repris comme avant.
 */
export function mergeWorkOrderWithLocalExtras(db: WorkOrder, local?: Partial<WorkOrder>): WorkOrder {
  const merged: WorkOrder = { ...db, ...(local || {}) };
  const target = merged as unknown as Record<string, unknown>;
  DB_EXTRA_FIELDS.forEach(field => {
    if (db[field] !== undefined) target[field] = db[field];
  });
  DB_IDENTITY_FIELDS.forEach(field => {
    if (db[field] !== undefined) target[field] = db[field];
  });
  return merged;
}

/** Vrai si la checklist locale contient un vrai travail (pas seulement la copie de la Gamme faite à l'import). */
export function hasTaskWork(tasks?: WorkOrderTask[]): boolean {
  return !!tasks && tasks.some(
    t => t.completed === true || !!t.comment?.trim() || t.isAnomaly === true || t.id.startsWith('task-custom')
  );
}

/** Vrai si la liste d'intervenants locale contient une vraie saisie (nom ou temps ≠ 00:00). */
export function hasIntervenantWork(logs?: IntervenantLog[]): boolean {
  return !!logs && logs.some(
    l => !!l.name?.trim() || (!!l.timeSpent && l.timeSpent !== '00:00' && l.timeSpent !== '0:00')
  );
}

/**
 * Rattrapage (une fois par OT) : champs saisis dans ce navigateur alors que la
 * base n'a encore rien pour l'OT (`undefined`). On n'envoie que du vrai travail,
 * jamais une valeur par défaut ni la checklist copiée de la Gamme à l'import
 * (elle se recalcule à l'affichage). Une valeur déjà en base n'est jamais écrasée.
 */
export function computeLocalBackfillPatch(db: WorkOrder, local?: Partial<WorkOrder>): Partial<WorkOrder> {
  const patch: Partial<WorkOrder> = {};
  if (!local) return patch;

  if (db.tasks === undefined && hasTaskWork(local.tasks)) patch.tasks = local.tasks;
  if (db.intervenantsLogs === undefined && hasIntervenantWork(local.intervenantsLogs)) {
    patch.intervenantsLogs = local.intervenantsLogs;
  }
  if (db.visa === undefined && local.visa?.trim()) patch.visa = local.visa;

  const hasStartTime = !!local.startTime?.trim();
  const hasEndTime = !!local.endTime?.trim();
  if (db.startTime === undefined && hasStartTime) patch.startTime = local.startTime;
  if (db.endTime === undefined && hasEndTime) patch.endTime = local.endTime;
  // Les dates ne sont envoyées qu'AVEC des heures rattrapées dans ce même envoi
  // (sinon ce sont les dates par défaut du formulaire, égales à l'échéance, ou
  // des heures déjà effacées en base : on ne les ressuscite pas).
  if (patch.startTime !== undefined || patch.endTime !== undefined) {
    if (db.startDate === undefined && toDateOrNull(local.startDate)) patch.startDate = local.startDate;
    if (db.endDate === undefined && toDateOrNull(local.endDate)) patch.endDate = local.endDate;
  }
  return patch;
}
