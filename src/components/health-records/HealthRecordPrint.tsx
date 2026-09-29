import React from 'react';

interface HealthRecordPrintProps {
  /** Ref lue par l'export PDF (exportElementToPdf) — englobe tout le document imprimable. */
  printRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

/** Document imprimable du carnet : contenu de la fiche + bloc des visas (signatures). */
export const HealthRecordPrint: React.FC<HealthRecordPrintProps> = ({ printRef, children }) => {
  return (
    <div ref={printRef} className="bg-white @container carnet-print-root">
      {children}

              {/* Visas */}
              <div data-pdf-block className="mt-4 pt-4 border-t-2 border-gray-200 print:break-inside-avoid grid grid-cols-1 @xl:grid-cols-2 gap-4 @xl:gap-6 text-[11px]">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <span className="font-bold text-gray-700 block mb-1">Visa Responsable Maintenance :</span>
                  <p className="text-gray-500 text-[10px] italic">Signature & cachet :</p>
                  <div className="h-10 mt-2 border-b border-dashed border-gray-300" />
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <span className="font-bold text-gray-700 block mb-1">Visa Contrôle Qualité / HSE :</span>
                  <p className="text-gray-500 text-[10px] italic">Signature & cachet :</p>
                  <div className="h-10 mt-2 border-b border-dashed border-gray-300" />
                </div>
              </div>
    </div>
  );
};
