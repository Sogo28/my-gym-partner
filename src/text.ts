/**
 * Comparaison de texte insensible à la casse ET aux accents : « ischio »
 * doit trouver « Ischio-jambiers », sans quoi il faut connaître
 * l'orthographe exacte de ce qu'on cherche.
 *
 * Hors de `src/ui` : la recherche dans le catalogue tiers en a besoin, et un
 * use case qui importe un composant React entraîne tout React Native
 * derrière lui -- ce qu'aucun test ne peut plus charger.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
