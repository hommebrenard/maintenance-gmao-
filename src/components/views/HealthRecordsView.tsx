import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, HeartPulse, Printer, Download, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Equipment, WorkOrder, HealthRecordEntry } from '../../types';
import { getLinkedWorkOrders } from '../../utils/equipmentDisplay';
import { fetchHealthRecords, createHealthRecord } from '../../lib/queries/healthRecords';
import { exportElementToPdf } from '../../utils/pdfExport';

import { EquipmentPassport } from '../health-records/EquipmentPassport';
import { LinkedWorkOrdersTable } from '../health-records/LinkedWorkOrdersTable';
import { HealthTimeline } from '../health-records/HealthTimeline';
import { HealthRecordPrint } from '../health-records/HealthRecordPrint';

interface HealthRecordsViewProps {
  equipmentList: Equipment[];
  workOrders: WorkOrder[];
  currentUserId: string;
  /** Id équipement à présélectionner (lien profond depuis le QR code, format #health-records/<id>). */
  initialEquipmentId?: string | null;
  /** Lien #health-records/<id>/nouvelle-entree : déplie le formulaire d'ajout et place le curseur dessus. */
  initialOpenAddForm?: boolean;
  /** Change à chaque lien profond reçu, pour réappliquer même un lien identique au précédent. */
  deepLinkKey?: number;
}

// Chantier « carnet de santé » (22/09/2026) : vue dédiée listant tous les
// équipements, chacun avec sa fiche d'identité réelle (colonnes déjà en base :
// category, brand/model/serialNumber, qr_code, photo_url, notes...) et son
// registre chronologique d'interventions (vrais OT liés, via
// getLinkedWorkOrders — même logique que la fiche équipement classique).
// Volontairement PAS de section « Synthèse de santé / conformité
// réglementaire » avec des chiffres inventés (indice de fiabilité, DESP...) :
// aucune donnée réelle ne les alimente aujourd'hui (voir échange du 22/09).
export const HealthRecordsView: React.FC<HealthRecordsViewProps> = ({ equipmentList, workOrders, currentUserId, initialEquipmentId, initialOpenAddForm, deepLinkKey }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deepLinkNotFound, setDeepLinkNotFound] = useState<string | null>(null);
  // Disposition mobile (étape 2, 25/09) : un seul panneau visible à la fois
  // sur petit écran (liste OU fiche), avec bouton retour ; à partir de `md`
  // (≥768px) les deux restent côte à côte comme avant, cet état est ignoré.
  const [mobileShowFiche, setMobileShowFiche] = useState(false);

  // Présélection depuis le lien profond du QR code (#health-records/<id>).
  // Réappliqué à chaque fois que l'id demandé change (pas seulement au
  // montage) pour que la navigation directe par URL fonctionne aussi quand
  // l'app est déjà ouverte (écoute hashchange côté App.tsx). Si l'équipement
  // n'existe pas ou n'est pas accessible (règles Supabase), on affiche un
  // message clair au lieu de rediriger silencieusement.
  const lastAppliedDeepLink = useRef<string | null>(null);
  const pendingFormFocus = useRef(false);
  useEffect(() => {
    if (!initialEquipmentId) return;
    const signature = `${initialEquipmentId}|${initialOpenAddForm ? 1 : 0}|${deepLinkKey ?? 0}`;
    if (signature === lastAppliedDeepLink.current) return;
    if (equipmentList.length === 0) return; // liste pas encore chargée, on retente au prochain rendu
    const match = equipmentList.find(e => e.id === initialEquipmentId);
    lastAppliedDeepLink.current = signature;
    setMobileShowFiche(true);
    if (match) {
      setSelectedId(match.id);
      setDeepLinkNotFound(null);
      if (initialOpenAddForm) {
        pendingFormFocus.current = true;
        setIsAdding(true);
      }
    } else {
      setDeepLinkNotFound(initialEquipmentId);
    }
  }, [initialEquipmentId, initialOpenAddForm, deepLinkKey, equipmentList]);

  // Entrées du carnet de santé (table `carnets_sante`) de l'équipement
  // sélectionné — chargées à la demande, pas dans l'état global de App.tsx
  // (chantier borné, pas besoin de tout précharger pour l'instant).
  const [entries, setEntries] = useState<HealthRecordEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newEventType, setNewEventType] = useState('Ronde');
  const [newDescription, setNewDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const filteredList = useMemo(
    () =>
      [...equipmentList]
        .filter(
          eq =>
            eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            eq.code.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [equipmentList, searchQuery]
  );

  const selected = selectedId
    ? filteredList.find(e => e.id === selectedId)
    : deepLinkNotFound
      ? undefined // lien profond résolu vers un id absent/inaccessible : pas de repli silencieux sur le premier équipement
      : filteredList[0];

  // QR code affiché sur la fiche : lien profond en hash vers le formulaire de
  // saisie de cette même fiche (même standard que le QR de la fiche Équipement,
  // consommé par App.tsx via #health-records/<id>/nouvelle-entree — voir
  // initialEquipmentId/initialOpenAddForm). Décision du 25/09 : un seul QR,
  // qui ouvre directement le formulaire ; le lien de lecture simple
  // (#health-records/<id> sans le segment) reste géré par le code mais n'est
  // plus imprimé sur aucun QR — la fiche en lecture reste accessible en
  // cliquant sur l'équipement depuis la liste.
  useEffect(() => {
    if (!selected) {
      setQrDataUrl(null);
      return;
    }
    const url = new URL(window.location.href);
    url.hash = `health-records/${encodeURIComponent(selected.id)}/nouvelle-entree`;
    const deepLink = url.toString();
    let cancelled = false;
    QRCode.toDataURL(deepLink, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
      .then(url => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.qrCode, selected?.code]);

  // Lien « nouvelle-entree » : une fois le formulaire affiché, on le fait défiler
  // dans la vue et on place le curseur sur la description (saisie immédiate).
  useEffect(() => {
    if (!isAdding || !pendingFormFocus.current) return;
    const input = descriptionInputRef.current;
    if (!input) return;
    pendingFormFocus.current = false;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  }, [isAdding, selected?.id, isLoadingEntries]);

  const linkedWorkOrders = useMemo(
    () => (selected ? getLinkedWorkOrders(selected, workOrders) : []),
    [selected, workOrders]
  );

  // 1-3 « Dernière intervention de maintenance » : la plus récente des OT
  // réellement clôturés ("Terminé") pour cet équipement — jamais une valeur
  // inventée. Absence d'OT clôturé => affiché "Non renseigné" à l'écran.
  const lastCompletedWorkOrder = useMemo(() => {
    const completed = linkedWorkOrders.filter(wo => wo.status === 'Terminé');
    if (completed.length === 0) return null;
    return [...completed].sort((a, b) => {
      const dateA = a.endDate || a.updatedAt || '';
      const dateB = b.endDate || b.updatedAt || '';
      return dateB.localeCompare(dateA);
    })[0];
  }, [linkedWorkOrders]);

  useEffect(() => {
    if (!selected) return;
    setIsLoadingEntries(true);
    setLoadError(null);
    fetchHealthRecords(selected.id)
      .then(setEntries)
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => setIsLoadingEntries(false));
  }, [selected?.id]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !newEventType.trim()) return;
    if (newEventType === 'Anomalie' && !newDescription.trim()) {
      setDescriptionError(true);
      descriptionInputRef.current?.focus();
      return;
    }
    setDescriptionError(false);
    setIsSaving(true);
    try {
      const created = await createHealthRecord(
        {
          equipmentId: selected.id,
          eventType: newEventType.trim(),
          description: newDescription.trim(),
          status: newEventType === 'Anomalie' ? 'Ouvert' : 'Terminé',
        },
        currentUserId
      );
      setEntries(prev => [created, ...prev]);
      setNewDescription('');
      setNewEventType('Ronde');
      setIsAdding(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur d\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!printableRef.current || !selected) return;
    setIsExportingPdf(true);
    setPdfError(null);
    try {
      const result = await exportElementToPdf(
        printableRef.current,
        `Carnet_Sante_${selected.code}_${new Date().toISOString().slice(0, 10)}`
      );
      if (!result.success) setPdfError(result.error || 'Erreur lors de la génération du PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Liste — pleine largeur sur mobile, masquée quand la fiche est affichée ;
          disposition côte à côte inchangée à partir de md (≥768px). */}
      <div
        className={`print:hidden w-full md:w-80 md:shrink-0 border-r border-gray-200 bg-white flex-col ${
          mobileShowFiche ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-2">
            <HeartPulse className="w-4 h-4 text-emerald-600" />
            Carnets de santé
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher un équipement..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredList.map(eq => (
            <button
              key={eq.id}
              onClick={() => {
                setSelectedId(eq.id);
                setDeepLinkNotFound(null);
                setMobileShowFiche(true);
              }}
              className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${
                selected?.id === eq.id ? 'bg-emerald-50 border-l-2 border-l-emerald-600' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-900 truncate">{eq.name}</div>
              <div className="text-xs text-gray-500">{eq.code}</div>
            </button>
          ))}
          {filteredList.length === 0 && (
            <div className="p-4 text-xs text-gray-400 text-center">Aucun équipement</div>
          )}
        </div>
      </div>

      {/* Fiche — visible sur mobile seulement quand un équipement est ouvert
          (bouton retour ci-dessous), toujours visible à partir de md. */}
      <div
        className={`flex-1 overflow-y-auto p-4 md:p-6 ${mobileShowFiche ? 'block' : 'hidden md:block'}`}
      >
        {!selected ? (
          <div className="text-sm text-gray-400">
            {deepLinkNotFound ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 max-w-lg">
                <span className="font-semibold">Équipement introuvable ou non accessible.</span>
              </div>
            ) : (
              'Sélectionnez un équipement.'
            )}
          </div>
        ) : (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3" data-pdf-exclude="true">
              <button
                onClick={() => setMobileShowFiche(false)}
                className="print:hidden md:hidden flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                ← Liste des équipements
              </button>
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                {pdfError && <span className="text-xs text-red-600">{pdfError}</span>}
                <button
                  onClick={() => window.print()}
                  className="print:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimer
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="print:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Télécharger PDF
                </button>
              </div>
            </div>

            <HealthRecordPrint printRef={printableRef}>
              <EquipmentPassport selected={selected} qrDataUrl={qrDataUrl} lastCompletedWorkOrder={lastCompletedWorkOrder} />
              <LinkedWorkOrdersTable linkedWorkOrders={linkedWorkOrders} />
              <HealthTimeline
                entries={entries}
                isLoadingEntries={isLoadingEntries}
                loadError={loadError}
                isAdding={isAdding}
                isSaving={isSaving}
                newEventType={newEventType}
                newDescription={newDescription}
                descriptionError={descriptionError}
                descriptionInputRef={descriptionInputRef}
                onToggleAdding={() => setIsAdding(v => !v)}
                onSelectRas={() => { setNewEventType('Ronde'); setDescriptionError(false); }}
                onSelectAnomalie={() => setNewEventType('Anomalie')}
                onDescriptionChange={value => {
                  setNewDescription(value);
                  if (descriptionError) setDescriptionError(false);
                }}
                onSubmit={handleAddEntry}
              />
            </HealthRecordPrint>
          </div>
        )}
      </div>
    </div>
  );
};
