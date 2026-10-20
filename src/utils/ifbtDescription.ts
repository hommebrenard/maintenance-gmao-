import type { ContractLot } from './equipmentFamilies';

/**
 * Reclassement des DI de fonction « IFBT » (Infrastructure et bâtiment) d'après leur description.
 * Constat du 20/10/2026 : la plupart des DI saisies en IFBT concernent en réalité l'électricité ou le fluide
 * (chauffe-eau, splits, fuites d'eau, onduleurs, éclairage…). La fonction Coswin n'est pas modifiée ; le lot est calculé à l'affichage.
 * Lots hors contrat : « Bâtiment », « Serrurerie », « Divers » ; ce qui ne se classe pas va dans « À examiner » (jamais caché).
 */
export type IfbtSub = 'Bâtiment' | 'Serrurerie' | 'Divers' | 'À examiner';
export interface IfbtClass { lot: ContractLot; sub?: IfbtSub; check: boolean; words: string[]; source: 'description' | 'override' }

/** Décisions de l'utilisateur pour des DI précises (20/10/2026) : prioritaires sur les règles. */
export const DI_LOT_OVERRIDES: Record<string, { lot: ContractLot; sub?: IfbtSub }> = {
  DI00002291: { lot: 'ELECTRICITE' }, // porte coulissante du garage (porte automatique)
  DI00002287: { lot: 'ELECTRICITE' }, // porte principale, entrée du personnel
};

type Pat = [RegExp, boolean]; // [motif, ambigu ?]
const FLUIDE: Pat[] = [
  [/chauffes?[- ]?eaux?/, false], [/\bsplits?\b/, false], [/\bclimati\w+/, false], [/\bclimat?ieurs?\b|\bclimateurs?\b/, false], [/\bventilo\w*/, false],
  [/\bfuites?\b|\bfuies?\b/, false], [/\binfiltrations?\b/, true], [/\brobinet\w*/, false], [/\bsiphons?\b/, false], [/chasses? d eau/, false],
  [/\bsanitaires?\b/, false], [/\bdouch\w+/, false], [/\bmelangeurs?\b/, false], [/\blavabos?\b/, false], [/\bvannes?\b/, false], [/\bpompes?\b/, false],
  [/\bsurpresseurs?\b/, false], [/\bpiscines?\b/, false], [/\bplomberie\b/, false], [/\bassainissement\b/, false], [/\bria\b/, false],
  [/vases? d expansion/, false], [/\babattants?\b/, false], [/\blave mains\b/, false], [/\bfiltres?\b|\bfiltration\b/, false], [/\bcanalisations?\b/, false],
  [/\beaux? (usee|potable)/, false], [/\bthermostats?\b/, true], [/armoire de precision/, true],
  [/\bpeinture\b.*\bequipements? techniques?\b/, false], // décision du 20/10/2026 : la peinture d'équipements techniques relève du fluide
];
const ELEC: Pat[] = [
  [/\bonduleurs?\b/, false], [/\blampes?\b|\bampoules?\b|\bleds?\b|\bprojecteurs?\b|\bspots?\b/, false], [/\belectri\w+/, false], [/\bcables?\b/, false],
  [/\btransformat\w+/, false], [/groupes? electrogenes?/, false], [/\bfusibles?\b/, false], [/\bcondensateurs?\b/, false],
  [/\bmotoris\w+|\bautomatis\w+|auto[- ]guichet|porte auto\w*/, false], [/\bcommutateurs?\b/, false], [/\bascenseurs?\b/, false],
  [/\bdetecteurs?\b/, true], [/\bgants isolants\b/, true], [/\bpanneaux? solaires?\b/, true], [/\balimentation\b/, true], [/\btapis roulants?\b/, false],
];
const HORS: [RegExp, boolean, IfbtSub][] = [
  [/\bserrures?\b/, false, 'Serrurerie'], [/\bpoignets?\b|\bpoignees?\b/, false, 'Serrurerie'], [/\bgrilles?\b/, false, 'Serrurerie'], [/\bporte\w*\b/, true, 'Serrurerie'],
  [/\bportails?\b/, false, 'Bâtiment'], [/\brouille\b/, false, 'Bâtiment'], [/\bpeinture\b/, false, 'Bâtiment'], [/\brideaux\b/, false, 'Bâtiment'], [/\bplafonds?\b|\bmurs?\b/, true, 'Bâtiment'],
];
const DIVERS = [/haute saison/, /preparatifs?|preparation/, /estivage/, /\bvilla\b/, /\bdossier\b/, /\bdrapeaux\b/, /\bartil\w*|\barticles?\b/];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’'`]/g, ' ');
interface Hit { pos: number; word: string; weak: boolean; sub?: IfbtSub }
const find = (t: string, pats: Pat[]): Hit[] => pats.flatMap(([re, weak]) => { const m = re.exec(t); return m ? [{ pos: m.index, word: m[0], weak }] : []; });

export function classifyIfbtDescription(code: string | undefined, text: string): IfbtClass {
  const ov = code ? DI_LOT_OVERRIDES[code] : undefined;
  if (ov) return { lot: ov.lot, sub: ov.sub, check: false, words: [], source: 'override' };
  const t = norm(text).replace(/(chauffes?[- ]?eaux?) (electriques?|a gaz)/g, '$1').replace(/mecanismes? (de )?chasses? d eau/g, 'chasse d eau');
  const fluide = find(t, FLUIDE);
  const elec = find(t, ELEC);
  let hors: Hit[] = HORS.flatMap(([re, weak, sub]) => { const m = re.exec(t); return m ? [{ pos: m.index, word: m[0], weak, sub }] : []; });
  // « peinture des équipements techniques » : relève du fluide, pas du bâtiment
  if (fluide.some(h => h.word.startsWith('peinture'))) hors = hors.filter(h => h.word !== 'peinture');
  // portes motorisées/automatiques : électricité, pas serrurerie
  if (elec.some(h => /motoris|automatis|auto[- ]guichet|porte auto/.test(h.word))) hors = hors.filter(h => !h.word.startsWith('porte'));
  // fuite d'eau au plafond/mur : cause hydraulique, effet bâtiment
  if (fluide.some(h => /fuit|fuie/.test(h.word))) hors = hors.filter(h => !/^(plafond|mur)/.test(h.word));
  const doms: [ContractLot, Hit[]][] = ([['FLUIDE', fluide], ['ELECTRICITE', elec], ['HORS_CONTRAT', hors]] as [ContractLot, Hit[]][]).filter(([, h]) => h.length > 0);
  if (!doms.length) {
    if (DIVERS.some(re => re.test(t))) return { lot: 'HORS_CONTRAT', sub: 'Divers', check: false, words: [], source: 'description' };
    return { lot: 'HORS_CONTRAT', sub: 'À examiner', check: true, words: [], source: 'description' };
  }
  doms.sort((a, b) => Math.min(...a[1].map(h => h.pos)) - Math.min(...b[1].map(h => h.pos)));
  const [lot, hits] = doms[0];
  const sub = lot === 'HORS_CONTRAT' ? [...hits].sort((a, b) => a.pos - b.pos)[0].sub : undefined;
  return { lot, sub, check: doms.length > 1 || hits.every(h => h.weak), words: [...new Set(doms.flatMap(([, h]) => h.map(x => x.word)))], source: 'description' };
}
