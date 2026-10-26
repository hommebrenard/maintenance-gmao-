import { describe, it, expect } from 'vitest';
import { validateRequestFile, pickRequestFiles, storedMimeFor, formatFileSize, displayNameFor, canLinkAttachment, canUnlinkDocument, REQUEST_FILES_MAX } from './requestAttachments';

const f = (name: string, type: string, size = 1000) => ({ name, type, size });
const MB = 1024 * 1024;

describe('validateRequestFile', () => {
  it('accepte photo et PDF, refuse le reste', () => {
    expect(validateRequestFile(f('a.jpg', 'image/jpeg'))).toBeNull();
    expect(validateRequestFile(f('a.pdf', 'application/pdf'))).toBeNull();
    expect(validateRequestFile(f('a.exe', 'application/x-msdownload'))).toMatch(/Format non pris en charge/);
  });
  it('déduit le type de l\'extension quand le navigateur n\'en donne pas', () => {
    expect(validateRequestFile(f('IMG_1.JPG', ''))).toBeNull();
    expect(validateRequestFile(f('notes.txt', ''))).toMatch(/Format non pris en charge/);
  });
  it('limite le PDF à 5 Mo et la photo brute à 30 Mo', () => {
    expect(validateRequestFile(f('a.pdf', 'application/pdf', 5 * MB))).toBeNull();
    expect(validateRequestFile(f('a.pdf', 'application/pdf', 5 * MB + 1))).toMatch(/5 Mo/);
    expect(validateRequestFile(f('a.jpg', 'image/jpeg', 30 * MB))).toBeNull();
    expect(validateRequestFile(f('a.jpg', 'image/jpeg', 30 * MB + 1))).toMatch(/30 Mo/);
  });
});

describe('pickRequestFiles', () => {
  it('accepte jusqu\'à 5 fichiers au total et signale le surplus', () => {
    const current = [f('1.jpg', 'image/jpeg', 1), f('2.jpg', 'image/jpeg', 2), f('3.jpg', 'image/jpeg', 3)];
    const incoming = [f('4.jpg', 'image/jpeg', 4), f('5.jpg', 'image/jpeg', 5), f('6.jpg', 'image/jpeg', 6)];
    const r = pickRequestFiles(current, incoming);
    expect(r.accepted.map(x => x.name)).toEqual(['4.jpg', '5.jpg']);
    expect(r.rejected).toEqual([`6.jpg : ${REQUEST_FILES_MAX} fichiers au maximum par demande.`]);
  });
  it('refuse un doublon (même nom et même taille) et un format interdit', () => {
    const current = [f('a.jpg', 'image/jpeg', 10)];
    const r = pickRequestFiles(current, [f('a.jpg', 'image/jpeg', 10), f('a.jpg', 'image/jpeg', 11), f('b.zip', 'application/zip')]);
    expect(r.accepted.map(x => `${x.name}:${x.size}`)).toEqual(['a.jpg:11']);
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0]).toBe('a.jpg : déjà ajouté.');
  });
});

describe('storedMimeFor / formatFileSize', () => {
  it('réencode toute image en JPEG et garde le PDF', () => {
    expect(storedMimeFor('image/png')).toBe('image/jpeg');
    expect(storedMimeFor('application/pdf')).toBe('application/pdf');
  });
  it('affiche des tailles lisibles', () => {
    expect(formatFileSize(300)).toBe('1 Ko');
    expect(formatFileSize(150 * 1024)).toBe('150 Ko');
    expect(formatFileSize(1.5 * MB)).toBe('1,5 Mo');
  });
});

describe('displayNameFor', () => {
  it('aligne l\'extension des photos sur le JPEG enregistré et laisse les PDF', () => {
    expect(displayNameFor('P_NSB0.png', 'image/jpeg')).toBe('P_NSB0.jpg');
    expect(displayNameFor('IMG_1.JPEG', 'image/jpeg')).toBe('IMG_1.jpg');
    expect(displayNameFor('Rapport.pdf', 'application/pdf')).toBe('Rapport.pdf');
    expect(displayNameFor('x'.repeat(200) + '.pdf', 'application/pdf')).toHaveLength(120);
  });
});

describe('canLinkAttachment / canUnlinkDocument', () => {
  const base = { isManager: false, currentUserId: 'u1', requestedBy: 'u1', origin: 'app', equipmentId: 'eq1' };
  it('le demandeur lie ses propres pièces, pas celles des autres', () => {
    expect(canLinkAttachment(base)).toBe(true);
    expect(canLinkAttachment({ ...base, requestedBy: 'u2' })).toBe(false);
    expect(canLinkAttachment({ ...base, currentUserId: undefined })).toBe(false);
  });
  it('le manager lie partout, mais jamais sans équipement réel ni sur une DI Coswin', () => {
    expect(canLinkAttachment({ ...base, isManager: true, requestedBy: 'u2' })).toBe(true);
    expect(canLinkAttachment({ ...base, isManager: true, equipmentId: undefined })).toBe(false);
    expect(canLinkAttachment({ ...base, isManager: true, origin: 'coswin' })).toBe(false);
  });
  it('délier : manager ou auteur du lien', () => {
    expect(canUnlinkDocument({ isManager: true })).toBe(true);
    expect(canUnlinkDocument({ isManager: false, currentUserId: 'u1', createdBy: 'u1' })).toBe(true);
    expect(canUnlinkDocument({ isManager: false, currentUserId: 'u1', createdBy: 'u2' })).toBe(false);
    expect(canUnlinkDocument({ isManager: false, currentUserId: undefined, createdBy: undefined })).toBe(false);
  });
});
