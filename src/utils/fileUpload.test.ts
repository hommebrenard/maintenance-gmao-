import { describe, it, expect } from 'vitest';
import { extensionFor, fitWithin, isImageType, nameWithoutExtension, resolveMime, validateDocumentFile, validatePhotoFile } from './fileUpload';

const f = (name: string, type: string, size: number) => ({ name, type, size });
const MB = 1024 * 1024;

describe('fitWithin', () => {
  it('réduit en gardant les proportions, sans jamais agrandir', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 1, 1000)).toEqual({ width: 1000, height: 1 });
  });
});

describe('type du fichier', () => {
  it('déduit le type de l\'extension quand le navigateur n\'en donne pas', () => {
    expect(resolveMime(f('PV.PDF', '', 1))).toBe('application/pdf');
    expect(resolveMime(f('photo.jpeg', '', 1))).toBe('image/jpeg');
    expect(resolveMime(f('x.docx', '', 1))).toBe('');
    expect(resolveMime(f('x.pdf', 'application/pdf', 1))).toBe('application/pdf');
  });
  it('images, extensions de sortie et noms', () => {
    expect(isImageType('image/png')).toBe(true);
    expect(isImageType('application/pdf')).toBe(false);
    expect(extensionFor('application/pdf')).toBe('pdf');
    expect(extensionFor('image/png')).toBe('jpg'); // les images sont réencodées en JPEG
    expect(nameWithoutExtension('PV VERITAS 2026.pdf')).toBe('PV VERITAS 2026');
    expect(nameWithoutExtension('.hidden')).toBe('.hidden');
  });
});

describe('validateDocumentFile', () => {
  it('accepte PDF ≤ 10 Mo et images ≤ 30 Mo (réduites ensuite)', () => {
    expect(validateDocumentFile(f('a.pdf', 'application/pdf', 10 * MB))).toBeNull();
    expect(validateDocumentFile(f('a.jpg', 'image/jpeg', 25 * MB))).toBeNull();
    expect(validateDocumentFile(f('a.pdf', '', 2 * MB))).toBeNull();
  });
  it('refuse trop gros ou mauvais format', () => {
    expect(validateDocumentFile(f('a.pdf', 'application/pdf', 11 * MB))).toContain('PDF trop volumineux');
    expect(validateDocumentFile(f('a.jpg', 'image/jpeg', 31 * MB))).toContain('Image trop volumineuse');
    expect(validateDocumentFile(f('a.docx', 'application/msword', 1))).toContain('Format non pris en charge');
    expect(validateDocumentFile(f('a.heic', 'image/heic', 1))).toContain('Format non pris en charge');
    expect(validateDocumentFile(f('a.exe', '', 1))).toContain('Format non pris en charge');
  });
});

describe('validatePhotoFile', () => {
  it('images seulement', () => {
    expect(validatePhotoFile(f('p.jpg', 'image/jpeg', 5 * MB))).toBeNull();
    expect(validatePhotoFile(f('p.pdf', 'application/pdf', 1))).toContain('Format non pris en charge');
    expect(validatePhotoFile(f('p.png', 'image/png', 40 * MB))).toContain('trop volumineuse');
  });
});
