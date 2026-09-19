/**
 * Le nom d'une sauvegarde en ligne EST son horodatage.
 *
 * Deux propriétés en dépendent, et aucune ne se voit à la lecture : la liste
 * se trie PAR NOM côté serveur, donc l'ordre alphabétique doit être l'ordre
 * chronologique ; et la date affichée se relit du nom, sans télécharger le
 * fichier pour l'apprendre.
 *
 * Ces deux fonctions vivent à part du reste du stockage parce qu'elles
 * n'ont besoin de rien -- ni réseau, ni React Native. C'est ce qui les rend
 * vérifiables en Node, comme le domaine.
 */

/**
 * Un `:` n'a rien à faire dans une clé d'objet, et un `.` y sépare d'ordinaire
 * l'extension : l'instant ISO s'écrit donc avec des tirets.
 */
export function fileNameAt(instant: Date): string {
  return `${instant.toISOString().replace(/[:.]/g, '-')}.json`;
}

/** L'instant que porte un nom d'objet, ou null s'il n'en porte pas. */
export function instantOf(fileName: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/.exec(fileName);
  if (match === null) return null;

  const [, day, hours, minutes, seconds, millis] = match;
  const parsed = new Date(`${day}T${hours}:${minutes}:${seconds}.${millis}Z`);

  // La forme peut être juste et le sens faux : un mois 47 se lit comme une
  // date, et `Date` rend alors un instant invalide plutôt qu'une erreur.
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
