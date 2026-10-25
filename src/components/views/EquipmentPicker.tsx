import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Equipment, LocationItem } from '../../types';
import { searchEquipment } from '../../utils/equipmentSearch';
import { familyKeyOf } from '../../utils/annualMatrix';

const LAST_SITE_KEY = 'gmao_request_last_site';
const readLastSite = (): string => { try { return localStorage.getItem(LAST_SITE_KEY) ?? ''; } catch { return ''; } };
const saveLastSite = (id: string) => { try { localStorage.setItem(LAST_SITE_KEY, id); } catch { /* stockage indisponible : sans conséquence */ } };

interface Props {
  equipmentList: Equipment[];
  locations: LocationItem[];
  value: string;
  onChange: (equipmentId: string) => void;
}

/** Choix d'un équipement en deux temps : site (mémorisé), puis recherche par code, nom ou famille. */
export const EquipmentPicker: React.FC<Props> = ({ equipmentList, locations, value, onChange }) => {
  const [siteId, setSiteId] = useState<string>(readLastSite);
  const [query, setQuery] = useState('');

  const sites = useMemo(() => {
    const withEquipment = new Set(equipmentList.map(e => e.locationId).filter((x): x is string => !!x));
    return locations.filter(l => withEquipment.has(l.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [equipmentList, locations]);
  const siteName = useMemo(() => new Map(locations.map(l => [l.id, l.name] as [string, string])), [locations]);
  const selected = useMemo(() => equipmentList.find(e => e.id === value), [equipmentList, value]);
  const results = useMemo(() => searchEquipment(equipmentList, { siteId: siteId || undefined, query }), [equipmentList, siteId, query]);

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-2 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{selected.name}</p>
          <p className="text-xs text-gray-600 font-mono truncate">{selected.code}</p>
          <p className="text-xs text-gray-500">{siteName.get(selected.locationId ?? '') ?? selected.location} · famille {familyKeyOf(selected.code)}</p>
        </div>
        <button type="button" onClick={() => onChange('')} className="shrink-0 flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
          <X className="w-3.5 h-3.5" />Changer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={siteId}
        onChange={e => { setSiteId(e.target.value); saveLastSite(e.target.value); }}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        aria-label="Site"
      >
        <option value="">Tous les sites</option>
        {sites.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Code, nom ou famille (ex. ARCM, climatisation)"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {results.length === 0 ? (
          <p className="px-3 py-3 text-xs text-gray-500">
            {siteId || query.trim() ? 'Aucun équipement ne correspond.' : 'Choisis un site ou tape quelques lettres du code ou du nom.'}
          </p>
        ) : results.map(eq => (
          <button key={eq.id} type="button" onClick={() => onChange(eq.id)} className="w-full text-left px-3 py-2 hover:bg-blue-50">
            <p className="text-sm font-medium text-gray-900 truncate">{eq.name}</p>
            <p className="text-xs text-gray-500 truncate"><span className="font-mono">{eq.code}</span> · {siteName.get(eq.locationId ?? '') ?? eq.location} · {familyKeyOf(eq.code)}</p>
          </button>
        ))}
      </div>
      {results.length === 30 && <p className="text-[11px] text-gray-400">30 premiers résultats : précise la recherche pour affiner.</p>}
    </div>
  );
};
