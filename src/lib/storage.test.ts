import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn(), getPublicUrl: vi.fn(), from: vi.fn(),
}));
vi.mock('./supabaseClient', () => ({ supabase: { storage: { from: h.from } } }));

import { getDocumentSignedUrl, removeDocumentFile, uploadDocumentFile, uploadEquipmentPhoto } from './storage';

beforeEach(() => {
  vi.clearAllMocks();
  h.from.mockReturnValue({ upload: h.upload, remove: h.remove, createSignedUrl: h.createSignedUrl, getPublicUrl: h.getPublicUrl });
  h.upload.mockResolvedValue({ error: null });
  h.remove.mockResolvedValue({ error: null });
});

describe('stockage', () => {
  it('document : bucket privé, chemin equipment/{id}/{uuid}.{ext}, jamais d\'écrasement', async () => {
    const path = await uploadDocumentFile('e1', new Blob(['x']), 'pdf', 'application/pdf');
    expect(h.from).toHaveBeenCalledWith('equipment-files');
    expect(path).toMatch(/^equipment\/e1\/[0-9a-f-]{36}\.pdf$/);
    expect(h.upload).toHaveBeenCalledWith(path, expect.anything(), { contentType: 'application/pdf', upsert: false });
  });

  it('une erreur d\'envoi est propagée', async () => {
    h.upload.mockResolvedValue({ error: new Error('quota') });
    await expect(uploadDocumentFile('e1', new Blob(['x']), 'pdf', 'application/pdf')).rejects.toThrow('quota');
  });

  it('lien signé de 5 minutes par défaut', async () => {
    h.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/x' }, error: null });
    expect(await getDocumentSignedUrl('equipment/e1/a.pdf')).toBe('https://signed/x');
    expect(h.createSignedUrl).toHaveBeenCalledWith('equipment/e1/a.pdf', 300);
    h.createSignedUrl.mockResolvedValue({ data: null, error: null });
    await expect(getDocumentSignedUrl('p')).rejects.toThrow('indisponible');
    h.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    await expect(getDocumentSignedUrl('p')).rejects.toThrow('fichier introuvable');
  });

  it('retrait d\'un fichier qu\'on vient d\'envoyer', async () => {
    await removeDocumentFile('equipment/e1/a.pdf');
    expect(h.remove).toHaveBeenCalledWith(['equipment/e1/a.pdf']);
  });

  it('photo : bucket public, un seul fichier par équipement (remplacé), lien avec ?v= anti-cache', async () => {
    h.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/equipment-photos/e1/photo.jpg' } });
    const url = await uploadEquipmentPhoto('e1', new Blob(['x']));
    expect(h.from).toHaveBeenCalledWith('equipment-photos');
    expect(h.upload).toHaveBeenCalledWith('e1/photo.jpg', expect.anything(), { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
    expect(url).toMatch(/^https:\/\/x\.supabase\.co\/.*\/e1\/photo\.jpg\?v=\d+$/);
  });
});
