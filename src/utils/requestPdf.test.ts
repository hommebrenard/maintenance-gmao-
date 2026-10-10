import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest } from '../types';
import { buildRequestSections, renderRequestPdf, VISAS } from './requestPdf';

const req = (o: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  id: '1', code: 'DI00001819', title: 'Prévoir changement thermostat', description: 'Détail', priority: 'Faible', status: 'Approuvée',
  requestedBy: 'MFADEL', createdAt: '', origin: 'coswin', otNumber: '80437', otStateLabel: 'OT TERMINE', interventionType: 'DAF', dafNumber: '173-N-CTA-01-26', ...o,
} as MaintenanceRequest);

describe('requestPdf', () => {
  it('fiche Coswin : sections Demande, OT Coswin, Données Coswin', () => {
    const s = buildRequestSections({ request: req() });
    expect(s.map(x => x.title)).toEqual(['Demande', 'Informations OT (Coswin)', 'Données Coswin (import)']);
    expect(s[1].fields[0].value).toBe('OT-80437');
    expect(s[2].fields.find(f => f.label === 'N° DAF')?.value).toBe('173-N-CTA-01-26');
  });
  it('demande de l\'app en attente : pas de bloc Coswin, message « pas encore décidée »', () => {
    const s = buildRequestSections({ request: req({ origin: 'app', otNumber: undefined, status: 'En attente' }) });
    expect(s.map(x => x.title)).toEqual(['Demande', 'Informations OT']);
    expect(s[1].fields[0].value).toContain('pas encore décidée');
  });
  it('génère un PDF A4 valide, une page pour une fiche courte, plusieurs pour une description très longue', () => {
    expect(renderRequestPdf({ request: req() }).getNumberOfPages()).toBe(1);
    const long = req({ description: 'ligne de description\n'.repeat(200) });
    const doc = renderRequestPdf({ request: long });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });
  it('visas : deux cadres, présents en fin de fiche', () => {
    expect(VISAS).toEqual(['Visa du demandeur', 'Décision et visa du responsable']);
    const doc = renderRequestPdf({ request: req() });
    expect(doc.getNumberOfPages()).toBe(1);
  });
  it('titre interne du PDF = « Demande d\'intervention <N° DI> »', () => {
    expect(String(renderRequestPdf({ request: req() }).output()).includes("/Title (Demande d'intervention DI00001819)")).toBe(true);
  });
});
