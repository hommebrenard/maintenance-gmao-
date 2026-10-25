/** Courriel simple (un @, un point dans le domaine, pas d'espace). Vide = valide (champ facultatif). */
export function isValidOptionalEmail(s: string | undefined | null): boolean {
  const v = (s ?? '').trim();
  return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
