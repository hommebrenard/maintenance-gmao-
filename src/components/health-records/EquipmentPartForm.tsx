import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { EquipmentPart } from '../../types';
import type { EquipmentPartInput } from '../../lib/queries/equipmentParts';
import { parseCount, parsePrice } from '../../utils/equipmentParts';

interface Props {
  /** Pièce à modifier ; absente = création. */
  part?: EquipmentPart;
  saving: boolean;
  error: string | null;
  onSubmit: (input: EquipmentPartInput) => void;
  onCancel: () => void;
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

/** Formulaire (fenêtre) d'ajout / modification d'une pièce de rechange — managers uniquement. */
export const EquipmentPartForm: React.FC<Props> = ({ part, saving, error, onSubmit, onCancel }) => {
  const [name, setName] = useState(part?.name ?? '');
  const [code, setCode] = useState(part?.code ?? '');
  const [reference, setReference] = useState(part?.reference ?? '');
  const [manufacturer, setManufacturer] = useState(part?.manufacturer ?? '');
  const [stock, setStock] = useState(part ? String(part.stock) : '0');
  const [minStock, setMinStock] = useState(part && part.minStock > 0 ? String(part.minStock) : '');
  const [unit, setUnit] = useState(part?.unit ?? '');
  const [unitPrice, setUnitPrice] = useState(part?.unitPrice !== undefined ? String(part.unitPrice) : '');
  const [location, setLocation] = useState(part?.location ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setLocalError('La désignation est obligatoire.');
    const stockN = stock.trim() === '' ? 0 : parseCount(stock);
    if (stockN === undefined) return setLocalError('Stock : indiquez un nombre entier supérieur ou égal à 0.');
    const minN = minStock.trim() === '' ? 0 : parseCount(minStock);
    if (minN === undefined) return setLocalError('Seuil mini : indiquez un nombre entier supérieur ou égal à 0.');
    let priceN: number | null = null;
    if (unitPrice.trim() !== '') {
      const parsed = parsePrice(unitPrice);
      if (parsed === undefined) return setLocalError('Prix unitaire : nombre positif avec 2 décimales maximum (ex. 12,50).');
      priceN = parsed;
    }
    setLocalError(null);
    onSubmit({
      name: name.trim(),
      code: code.trim() || null,
      reference: reference.trim() || null,
      manufacturer: manufacturer.trim() || null,
      stock: stockN,
      minStock: minN,
      unit: unit.trim() || null,
      unitPrice: priceN,
      location: location.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-gray-900">{part ? 'Modifier la pièce' : 'Ajouter une pièce'}</h3>
          <button type="button" onClick={onCancel} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Désignation *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Courroie de transmission" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Code interne</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Référence</label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Fabricant</label>
            <input type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Stock</label>
              <input type="text" inputMode="numeric" value={stock} onChange={e => setStock(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Seuil mini</label>
              <input type="text" inputMode="numeric" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0 = aucun" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unité</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="Ex. pièce" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Prix unitaire</label>
              <input type="text" inputMode="decimal" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="Ex. 12,50" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Emplacement</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex. Armoire B, étagère 2" className={inputCls} />
            </div>
          </div>

          {(localError || error) && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{localError ?? error}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg disabled:opacity-50">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Enregistrement…' : part ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
