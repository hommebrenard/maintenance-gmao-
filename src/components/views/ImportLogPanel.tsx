import React from 'react';
import type { WorkOrder } from '../../types';
import { fetchImportLog } from '../../lib/queries/importLog';
import { importMismatch, recentAdditions, type ImportLogEntry } from '../../utils/importLog';

const num = (n: number) => n.toLocaleString('fr-FR');

/** Suivi des imports d'OT : total en base, OT ajoutés ces 7 / 30 jours, et les 10 derniers imports. Lecture seule. */
export function ImportLogPanel({ workOrders }: { workOrders: WorkOrder[] }) {
  const [entries, setEntries] = React.useState<ImportLogEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetchImportLog(10).then(l => { if (alive) setEntries(l); }).catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);
  const add = React.useMemo(() => recentAdditions(workOrders, new Date()), [workOrders]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-800">Suivi des imports d'OT</h2>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] leading-snug text-gray-500">
          Lecture seule. « Ajoutés » = OT créés en base ces N derniers jours (date de création en base). Un import est signalé ⚠ quand le nombre d'OT créés diffère du nombre d'OT nouveaux annoncés à l'écran d'import.
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-gray-800">
          <span>OT en base : <b>{num(add.total)}</b></span>
          <span>Ajoutés 7 jours : <b>{num(add.last7)}</b></span>
          <span>Ajoutés 30 jours : <b>{num(add.last30)}</b></span>
          {add.withoutDate > 0 && <span className="text-amber-700">Sans date de création : <b>{num(add.withoutDate)}</b></span>}
        </div>
        {error && <p className="text-xs text-amber-700">Journal indisponible ({error}). Le script sql/15 a-t-il été exécuté ?</p>}
        {entries && entries.length === 0 && <p className="text-xs text-gray-500">Aucun import enregistré pour l'instant : le journal se remplit à partir du prochain import d'OT.</p>}
        {entries && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Fichiers</th><th className="px-3 py-2 text-right">Lues</th><th className="px-3 py-2 text-right">Nouveaux</th><th className="px-3 py-2 text-right">Créés</th><th className="px-3 py-2 text-right">Complétés</th><th className="px-3 py-2 text-right">Ignorés</th></tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const gap = importMismatch(e);
                  return (
                    <tr key={e.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">{new Date(e.created_at).toLocaleString('fr-FR')}</td>
                      <td className="max-w-xs truncate px-3 py-1.5 text-gray-900" title={e.file_names.join('\n')}>{e.file_names.length > 0 ? `${e.file_names.length} fichier(s)` : 'texte collé'}</td>
                      <td className="px-3 py-1.5 text-right">{num(e.rows_in_files)}</td>
                      <td className="px-3 py-1.5 text-right">{num(e.rows_new)}</td>
                      <td className={`px-3 py-1.5 text-right font-semibold ${gap !== 0 ? 'text-amber-700' : ''}`}>{num(e.rows_created)}{gap !== 0 && ` ⚠ (${gap > 0 ? '+' : ''}${gap})`}</td>
                      <td className="px-3 py-1.5 text-right">{num(e.rows_patched)}</td>
                      <td className="px-3 py-1.5 text-right">{num(e.rows_ignored)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
