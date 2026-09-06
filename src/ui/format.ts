/**
 * Mise en forme des nombres et des dates pour l'affichage.
 *
 * Le domaine manipule des instants et des secondes ; les écrans montrent
 * « 05/09/2026 · 18:42 » ou « 02:15 ». La conversion vit ici, en un seul
 * endroit, plutôt que recopiée dans chaque écran.
 */

/** Des secondes en mm:ss, toujours sur deux chiffres. */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(totalSeconds, 0) / 60);
  const seconds = Math.max(totalSeconds, 0) % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** L'heure du jour : « 18:42 ». */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Une date et son heure : « 05/09/2026 · 18:42 ». */
export function formatDateTime(date: Date): string {
  return `${date.toLocaleDateString('fr-FR')} · ${formatTime(date)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
