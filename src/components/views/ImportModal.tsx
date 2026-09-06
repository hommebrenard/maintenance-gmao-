import React, { useState } from 'react';
import { X, FileSpreadsheet, Upload, Check, AlertCircle, Zap, FileText, ListChecks, Building2 } from 'lucide-react';
import { WorkOrder, GammePlan } from '../../types';
import { parsePlanningCSV, parseGammeCSV, formatActionCode } from '../../utils/csvParser';
import { SAMPLE_PLANNING_CSV, SAMPLE_GAMME_CSV } from '../../data/rawImportModels';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportWorkOrders: (workOrders: WorkOrder[], replaceExisting?: boolean) => void;
  onImportGammes: (gammes: GammePlan[]) => void;
  existingGammes: GammePlan[];
  availableSites?: string[];
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportWorkOrders,
  onImportGammes,
  existingGammes,
  availableSites = []
}) => {
  const [activeTab, setActiveTab] = useState<'planning' | 'gamme'>('planning');
  const [pastedText, setPastedText] = useState('');
  const [parsedPreviewWorkOrders, setParsedPreviewWorkOrders] = useState<WorkOrder[]>([]);
  const [parsedPreviewGammes, setParsedPreviewGammes] = useState<GammePlan[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Import strategy: append to existing orders or replace current list
  const [importBehavior, setImportBehavior] = useState<'append' | 'replace'>('replace');

  // Multi-site override toggle & selection state
  const [useMultiSiteOverride, setUseMultiSiteOverride] = useState(false);
  const [selectedImportSites, setSelectedImportSites] = useState<string[]>([]);

  // Dynamically extract unique site names detected in the uploaded CSV file
  const sitesFromParsedCSV = React.useMemo(() => {
    if (activeTab !== 'planning' || parsedPreviewWorkOrders.length === 0) return [];
    const sites = parsedPreviewWorkOrders.map(w => w.location).filter((s): s is string => Boolean(s) && s !== 'Site Principal');
    return Array.from(new Set(sites));
  }, [parsedPreviewWorkOrders, activeTab]);

  const combinedSiteList = React.useMemo(() => {
    return Array.from(new Set([...sitesFromParsedCSV, ...availableSites])).filter(Boolean);
  }, [sitesFromParsedCSV, availableSites]);

  if (!isOpen) return null;

  const toggleSiteForImport = (siteName: string) => {
    setSelectedImportSites(prev => {
      if (prev.includes(siteName)) {
        return prev.filter(s => s !== siteName);
      } else {
        return [...prev, siteName];
      }
    });
  };

  // Handle File Upload (.csv, .txt, .tsv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        // Auto-detect encoding: many exports Excel/CSV français sont en Windows-1252
        // (ISO-8859-1) et non en UTF-8. On tente d'abord un décodage UTF-8 strict ;
        // s'il échoue (octets invalides), on retombe sur Windows-1252.
        let content: string;
        try {
          content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          content = new TextDecoder('windows-1252').decode(buffer);
        }
        setPastedText(content);
        processCSVContent(content, activeTab);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input value so re-importing the same file or another file always triggers onChange
    e.target.value = '';
  };

  // Process CSV Text
  const processCSVContent = (content: string, type: 'planning' | 'gamme') => {
    try {
      if (type === 'planning') {
        const parsed = parsePlanningCSV(content, existingGammes);
        setParsedPreviewWorkOrders(parsed);
        if (parsed.length === 0) {
          setErrorMsg("Aucun ordre de travail valide n'a pu être extrait. Vérifiez les en-têtes CSV.");
        } else {
          setSuccessMsg(`${parsed.length} ordre(s) de travail détecté(s) prêts à être importés.`);
        }
      } else {
        const parsed = parseGammeCSV(content);
        setParsedPreviewGammes(parsed);
        if (parsed.length === 0) {
          setErrorMsg("Aucune gamme opératoire valide n'a pu être extraite. Vérifiez le format.");
        } else {
          const totalTasks = parsed.reduce((sum, p) => sum + p.tasks.length, 0);
          setSuccessMsg(`${parsed.length} gamme(s) détectée(s) avec un total de ${totalTasks} action(s) / checklist(s).`);
        }
      }
    } catch (err) {
      setErrorMsg("Erreur lors de la lecture du fichier. Assurez-vous qu'il s'agit d'un fichier CSV valide.");
    }
  };

  // Quick Load Model from Prompt
  const handleLoadSample = () => {
    setErrorMsg('');
    if (activeTab === 'planning') {
      setPastedText(SAMPLE_PLANNING_CSV);
      processCSVContent(SAMPLE_PLANNING_CSV, 'planning');
    } else {
      setPastedText(SAMPLE_GAMME_CSV);
      processCSVContent(SAMPLE_GAMME_CSV, 'gamme');
    }
  };

  // Confirm Import
  const handleConfirmImport = () => {
    if (activeTab === 'planning') {
      if (parsedPreviewWorkOrders.length === 0) return;
      
      let finalWorkOrders: WorkOrder[] = [];
      
      if (useMultiSiteOverride && selectedImportSites.length > 0) {
        selectedImportSites.forEach((site, siteIdx) => {
          const siteOrders = parsedPreviewWorkOrders.map((wo, woIdx) => ({
            ...wo,
            id: (typeof crypto !== 'undefined' && crypto.randomUUID)
              ? `imported-${crypto.randomUUID()}`
              : `imported-${Date.now()}-${siteIdx}-${woIdx}-${Math.floor(Math.random()*1000000)}`,
            code: siteIdx === 0 ? wo.code : `${wo.code}-${site.substring(0,3).toUpperCase()}`,
            location: site,
            entity: site
          }));
          finalWorkOrders.push(...siteOrders);
        });
      } else {
        // Keep original sites/locations extracted directly from the uploaded CSV file
        finalWorkOrders = parsedPreviewWorkOrders;
      }

      onImportWorkOrders(finalWorkOrders, importBehavior === 'replace');
      const actionLabel = importBehavior === 'replace' ? 'Remplacement effectué' : 'Ajout effectué';
      setSuccessMsg(`✅ ${actionLabel} : ${finalWorkOrders.length} ordre(s) de travail importé(s) avec succès ! Vous pouvez passer à l'onglet "Gamme de Maintenance" ci-dessus ou fermer la fenêtre.`);
      setParsedPreviewWorkOrders([]);
      setPastedText('');
    } else {
      if (parsedPreviewGammes.length === 0) return;
      onImportGammes(parsedPreviewGammes);
      setSuccessMsg(`✅ Importation réussie de ${parsedPreviewGammes.length} gamme(s) opératoire(s) ! Vos checklists et actions ont été mises à jour.`);
      setParsedPreviewGammes([]);
      setPastedText('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Importation Excel / CSV</h3>
              <p className="text-xs text-gray-300">Intégrez vos plannings de maintenance et vos gammes opératoires</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-3 gap-2">
          <button
            onClick={() => {
              setActiveTab('planning');
              setParsedPreviewWorkOrders([]);
              setParsedPreviewGammes([]);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-xs rounded-t-lg transition-colors border-t border-x ${
              activeTab === 'planning'
                ? 'bg-white text-blue-600 border-gray-200 border-b-white font-semibold'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Fichier Planning OT (Ordres de travail)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('gamme');
              setParsedPreviewWorkOrders([]);
              setParsedPreviewGammes([]);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-xs rounded-t-lg transition-colors border-t border-x ${
              activeTab === 'gamme'
                ? 'bg-white text-blue-600 border-gray-200 border-b-white font-semibold'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span>Fichier Gamme de Maintenance (Actions/Checklists)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">

          {/* Quick Load sample button */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-gray-900">Utiliser le modèle de données fourni</h4>
                <p className="text-[11px] text-gray-600">
                  {activeTab === 'planning' 
                    ? "Charge instantanément les ordres de travail extraits du fichier planning."
                    : "Charge instantanément les gammes opératoires avec leurs checklists d'actions."}
                </p>
              </div>
            </div>
            <button
              onClick={handleLoadSample}
              className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Charger le modèle</span>
            </button>
          </div>

          {/* File Upload Zone */}
          <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-6 text-center bg-gray-50/50 transition-colors">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-700">Sélectionner un fichier Excel (.csv, .txt, .tsv)</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Format supporté: séparateur point-virgule (;) ou virgule (,)</p>

            <input
              type="file"
              accept=".csv,.txt,.tsv,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="mt-3 inline-flex items-center px-4 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer shadow-2xs"
            >
              Parcourir les fichiers
            </label>
          </div>

          {/* Manual CSV Paste */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Ou collez le contenu du fichier CSV / Excel ici :
            </label>
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                processCSVContent(e.target.value, activeTab);
              }}
              placeholder={
                activeTab === 'planning'
                  ? "Zone;Équipement;Planificateur;Intervention;Date de début;..."
                  : "Équipement,Description intervention,Action,Description équipement..."
              }
              className="w-full font-mono text-[11px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            />
          </div>

          {/* Mode d'importation : Cumuler vs Remplacer */}
          {activeTab === 'planning' && (
            <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 space-y-2">
              <label className="block text-xs font-bold text-gray-900">
                Action lors de l'importation d'un nouveau mois / fichier :
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-2 ${
                  importBehavior === 'append' ? 'bg-white border-blue-500 font-bold text-blue-950 shadow-2xs' : 'bg-white/60 border-gray-200 text-gray-700 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="importBehavior"
                    checked={importBehavior === 'append'}
                    onChange={() => setImportBehavior('append')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block font-semibold">Ajouter aux OTs actuels</span>
                    <span className="text-[10px] text-gray-500 font-normal">Conserve le planning existant et cumule les mois</span>
                  </div>
                </label>

                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-2 ${
                  importBehavior === 'replace' ? 'bg-amber-50 border-amber-400 font-bold text-amber-950 shadow-2xs' : 'bg-white/60 border-gray-200 text-gray-700 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="importBehavior"
                    checked={importBehavior === 'replace'}
                    onChange={() => setImportBehavior('replace')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="block font-semibold text-amber-900">Vider et remplacer la liste</span>
                    <span className="text-[10px] text-amber-700 font-normal">Efface les anciens OT pour repartir à zéro avec le nouveau mois</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Site / Location Management */}
          {activeTab === 'planning' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Gestion des Sites / Emplacements d'importation</span>
                </div>
                {sitesFromParsedCSV.length > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Sites détectés dans le fichier : <strong>{sitesFromParsedCSV.join(', ')}</strong></span>
                  </span>
                )}
              </div>

              {/* Mode Selection Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${!useMultiSiteOverride ? 'bg-blue-50/80 border-blue-400 text-blue-950 font-medium shadow-2xs' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="siteImportMode"
                    checked={!useMultiSiteOverride}
                    onChange={() => setUseMultiSiteOverride(false)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-gray-900">Conserver les sites du fichier CSV (Recommandé)</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">Chaque OT conserve son site/emplacement d'origine extrait du fichier. Aucun site fictif ne sera ajouté.</div>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${useMultiSiteOverride ? 'bg-purple-50/80 border-purple-400 text-purple-950 font-medium shadow-2xs' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="siteImportMode"
                    checked={useMultiSiteOverride}
                    onChange={() => {
                      setUseMultiSiteOverride(true);
                      if (selectedImportSites.length === 0 && combinedSiteList.length > 0) {
                        setSelectedImportSites([combinedSiteList[0]]);
                      }
                    }}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <div className="font-bold text-gray-900">Forcer / Dupliquer la répartition sur des sites</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">Attribue ou duplique l'ensemble des OT vers les sites cochés ci-dessous.</div>
                  </div>
                </label>
              </div>

              {/* Checkbox site selection if override enabled */}
              {useMultiSiteOverride && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-purple-900 flex items-center justify-between">
                    <span>Cochez le ou les sites de destination ({selectedImportSites.length} sélectionné(s)) :</span>
                  </div>

                  {combinedSiteList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {combinedSiteList.map(site => {
                        const isSelected = selectedImportSites.includes(site);
                        const isFromFile = sitesFromParsedCSV.includes(site);
                        return (
                          <button
                            key={site}
                            type="button"
                            onClick={() => toggleSiteForImport(site)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50 hover:text-purple-700'
                            }`}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{site}</span>
                            {isFromFile && (
                              <span className={`text-[9px] px-1 rounded font-bold ${isSelected ? 'bg-purple-800 text-purple-100' : 'bg-purple-100 text-purple-800'}`}>
                                Fichier
                              </span>
                            )}
                            {isSelected && <Check className="w-3.5 h-3.5 text-white ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Chargement du fichier CSV requis ou définissez vos emplacements dans l'application.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-medium shadow-2xs">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              {activeTab === 'planning' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('gamme');
                    setErrorMsg('');
                    setSuccessMsg('');
                    setParsedPreviewGammes([]);
                    setPastedText('');
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-bold transition-colors shrink-0 shadow-2xs flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>Prochaine étape : Importer les Gammes ➡️</span>
                </button>
              )}
            </div>
          )}

          {/* Preview Table */}
          {activeTab === 'planning' && parsedPreviewWorkOrders.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-900 mb-2">Aperçu des ordres de travail à importer ({parsedPreviewWorkOrders.length})</h4>
              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-48">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 font-semibold text-gray-700">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">Titre</th>
                      <th className="p-2">Équipement</th>
                      <th className="p-2">Actions/Tasks</th>
                      <th className="p-2">Planificateur</th>
                      <th className="p-2">Échéance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedPreviewWorkOrders.slice(0, 10).map((wo, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2 font-mono font-medium text-gray-600">{wo.code}</td>
                        <td className="p-2 font-medium text-gray-900">{wo.title}</td>
                        <td className="p-2 text-gray-600">{wo.equipmentCode || '—'}</td>
                        <td className="p-2 text-blue-600 font-semibold">{wo.tasks ? `${wo.tasks.length} action(s)` : '0'}</td>
                        <td className="p-2 text-gray-600">{wo.planner || wo.assignee}</td>
                        <td className="p-2 text-gray-600">{wo.dueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'gamme' && parsedPreviewGammes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-900 mb-2">Aperçu des gammes et leurs actions/checklists ({parsedPreviewGammes.length})</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {parsedPreviewGammes.map((g, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold">
                          {g.planCode}
                        </span>
                        <span className="font-bold text-xs text-gray-900">{g.interventionTitle}</span>
                        {g.equipmentCode && (
                          <span className="text-[11px] text-gray-500 font-mono">({g.equipmentCode})</span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                        {g.tasks.length} action(s) checklist
                      </span>
                    </div>

                    {g.tasks.length > 0 ? (
                      <div className="space-y-1.5 pl-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Liste des actions de maintenance :</p>
                        <ul className="space-y-1 text-xs text-gray-700">
                          {g.tasks.map((task, tidx) => (
                            <li key={tidx} className="flex items-start gap-2 bg-gray-50/80 p-1.5 rounded border border-gray-100">
                              <span className="font-mono text-[10px] text-blue-600 font-bold shrink-0 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                {formatActionCode(task.actionCode, tidx)}
                              </span>
                              <span className="text-gray-800 text-[11px] font-medium leading-tight">{task.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Aucune action individuelle détectée sous ce titre de gamme.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Fermer
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={
              (activeTab === 'planning' && parsedPreviewWorkOrders.length === 0) ||
              (activeTab === 'gamme' && parsedPreviewGammes.length === 0)
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>
              Valider et intégrer ({activeTab === 'planning' ? parsedPreviewWorkOrders.length : parsedPreviewGammes.length})
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
