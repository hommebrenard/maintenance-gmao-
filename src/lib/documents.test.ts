import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  order: [] as string[],
  uploadDocumentFile: vi.fn(),
  removeDocumentFile: vi.fn(),
  getDocumentSignedUrl: vi.fn(),
  createEquipmentDocument: vi.fn(),
  deleteEquipmentDocument: vi.fn(),
  compressImage: vi.fn(),
}));

vi.mock('./storage', () => ({
  uploadDocumentFile: h.uploadDocumentFile,
  removeDocumentFile: h.removeDocumentFile,
  getDocumentSignedUrl: h.getDocumentSignedUrl,
}));
vi.mock('./queries/equipmentDocuments', () => ({ createEquipmentDocument: h.createEquipmentDocument, deleteEquipmentDocument: h.deleteEquipmentDocument }));
vi.mock('../utils/imageCompress', () => ({ compressImage: h.compressImage }));

import { addEquipmentDocuments, deleteEquipmentDocumentWithFile } from './documents';

const pdf = (size = 1000) => ({ name: 'PV VERITAS.pdf', type: 'application/pdf', size }) as File;

beforeEach(() => {
  vi.clearAllMocks();
  h.order.length = 0;
  h.uploadDocumentFile.mockImplementation(async () => { h.order.push('upload'); return 'equipment/e1/uuid.pdf'; });
  h.removeDocumentFile.mockResolvedValue(undefined);
  h.deleteEquipmentDocument.mockResolvedValue(undefined);
  h.createEquipmentDocument.mockImplementation(async (i: Record<string, unknown>) => { h.order.push('insert'); return { id: 'd1', ...i }; });
});

describe('addEquipmentDocuments', () => {
  it('envoie le fichier d\'abord, puis enregistre la ligne (nom par défaut = nom du fichier)', async () => {
    const { docs, warning } = await addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', file: pdf(), controlId: 'k1', category: 'report' });
    expect(h.order).toEqual(['upload', 'insert']);
    expect(h.uploadDocumentFile).toHaveBeenCalledWith('e1', expect.anything(), 'pdf', 'application/pdf');
    expect(h.createEquipmentDocument).toHaveBeenCalledWith(
      { equipmentId: 'e1', name: 'PV VERITAS', storagePath: 'equipment/e1/uuid.pdf', mimeType: 'application/pdf', sizeBytes: 1000, category: 'report', controlId: 'k1' },
      'u1'
    );
    expect(docs).toHaveLength(1);
    expect(warning).toBeUndefined();
    expect(h.compressImage).not.toHaveBeenCalled();
  });

  it('si la ligne échoue, le fichier qu\'on vient d\'envoyer est retiré', async () => {
    h.createEquipmentDocument.mockRejectedValueOnce(new Error('RLS'));
    await expect(addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', file: pdf() })).rejects.toThrow('RLS');
    expect(h.removeDocumentFile).toHaveBeenCalledWith('equipment/e1/uuid.pdf');
  });

  it('une photo est réduite puis enregistrée en JPEG avec la taille réduite', async () => {
    h.compressImage.mockResolvedValue({ size: 400000 } as Blob);
    const photo = { name: 'IMG_1.png', type: 'image/png', size: 9000000 } as File;
    await addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', file: photo, name: 'Photo plaque' });
    expect(h.compressImage).toHaveBeenCalledWith(photo, { maxEdge: 2000, quality: 0.8 });
    expect(h.uploadDocumentFile).toHaveBeenCalledWith('e1', expect.anything(), 'jpg', 'image/jpeg');
    expect(h.createEquipmentDocument.mock.calls[0][0]).toMatchObject({ name: 'Photo plaque', mimeType: 'image/jpeg', sizeBytes: 400000 });
  });

  it('lien GED seul : aucun envoi', async () => {
    const { docs } = await addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', externalUrl: 'https://ged/x', name: 'PV GED' });
    expect(h.uploadDocumentFile).not.toHaveBeenCalled();
    expect(h.createEquipmentDocument.mock.calls[0][0]).toEqual({ equipmentId: 'e1', name: 'PV GED', externalUrl: 'https://ged/x', category: undefined, controlId: undefined });
    expect(docs).toHaveLength(1);
  });

  it('fichier + lien : deux lignes ; si le lien échoue, avertissement sans perdre le fichier', async () => {
    h.createEquipmentDocument
      .mockImplementationOnce(async (i: Record<string, unknown>) => ({ id: 'dF', ...i }))
      .mockRejectedValueOnce(new Error('lien refusé'));
    const { docs, warning } = await addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', file: pdf(), externalUrl: 'https://ged/x' });
    expect(docs).toHaveLength(1);
    expect(warning).toContain('lien refusé');
    expect(h.removeDocumentFile).not.toHaveBeenCalled();
  });

  it('refus : rien, lien non http, intitulé introuvable, fichier trop gros', async () => {
    await expect(addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1' })).rejects.toThrow('fichier ou indiquez un lien');
    await expect(addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', externalUrl: 'javascript:alert(1)', name: 'x' })).rejects.toThrow('http');
    await expect(addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', externalUrl: 'https://ged/x' })).rejects.toThrow('intitulé');
    await expect(addEquipmentDocuments({ equipmentId: 'e1', createdBy: 'u1', file: pdf(11 * 1024 * 1024) })).rejects.toThrow('PDF trop volumineux');
    expect(h.uploadDocumentFile).not.toHaveBeenCalled();
  });
});

describe('deleteEquipmentDocumentWithFile', () => {
  const fileDoc = { id: 'd1', storagePath: 'equipment/e1/uuid.pdf' } as never;
  const linkDoc = { id: 'd2', externalUrl: 'https://exemple.ma/pv' } as never;

  it('supprime la ligne puis le fichier', async () => {
    h.deleteEquipmentDocument.mockImplementation(async () => { h.order.push('row'); });
    h.removeDocumentFile.mockImplementation(async () => { h.order.push('file'); });
    expect(await deleteEquipmentDocumentWithFile(fileDoc)).toEqual({});
    expect(h.order).toEqual(['row', 'file']);
  });

  it('ne touche pas au stockage pour un simple lien', async () => {
    await deleteEquipmentDocumentWithFile(linkDoc);
    expect(h.deleteEquipmentDocument).toHaveBeenCalledWith('d2');
    expect(h.removeDocumentFile).not.toHaveBeenCalled();
  });

  it('garde le fichier si la ligne ne peut pas être supprimée', async () => {
    h.deleteEquipmentDocument.mockRejectedValue(new Error('refusée'));
    await expect(deleteEquipmentDocumentWithFile(fileDoc)).rejects.toThrow('refusée');
    expect(h.removeDocumentFile).not.toHaveBeenCalled();
  });

  it('avertit si le fichier ne part pas du stockage', async () => {
    h.removeDocumentFile.mockRejectedValue(new Error('réseau'));
    const r = await deleteEquipmentDocumentWithFile(fileDoc);
    expect(r.warning).toContain('réseau');
  });
});
