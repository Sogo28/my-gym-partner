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

/**
 * Une durée telle qu'on la dit : « 45 s » ou « 2:30 ».
 *
 * En dessous d'une minute, les secondes se lisent seules -- « 0:45 » demande
 * une conversion mentale pour rien. Au-delà, c'est l'inverse : « 180 s » ne
 * dit pas trois minutes tant qu'on n'a pas divisé.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(Math.round(totalSeconds), 0);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
}

/** Une durée est une mesure exprimée en SECONDES : c'est l'unité qui le dit. */
export function isDuration(unit: string): boolean {
  return unit === 's';
}

/** L'heure du jour : « 18:42 ». */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Une date et son heure : « 05/09/2026 · 18:42 ». */
export function formatDateTime(date: Date): string {
  return `${date.toLocaleDateString('fr-FR')} · ${formatTime(date)}`;
}

/**
 * Le nom d'un jour tel qu'on le dirait : « aujourd'hui », « demain »,
 * « hier », et sinon « mardi 8 ».
 *
 * Les trois voisins d'aujourd'hui se nomment plutôt qu'ils ne se datent : on
 * lit « demain » sans compter, alors qu'une date demande de la situer.
 */
export function dayLabel(day: Date, now: Date): string {
  const days = Math.round((atMidnight(day).getTime() - atMidnight(now).getTime()) / 86_400_000);

  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days === -1) return 'hier';

  return day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
}

/** La date du jour en toutes lettres : « mardi 6 octobre ». */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Quand un entraînement a été fait pour la dernière fois, tel qu'on le dirait.
 *
 * Dans la semaine, le nom du jour suffit -- « fait jeudi » se lit sans
 * calcul. Au-delà, un nom de jour deviendrait ambigu (lequel des jeudis ?) :
 * la date prend le relais, avec l'année seulement quand ce n'est pas la
 * nôtre.
 */
export function lastDoneLabel(done: Date | undefined, now: Date): string {
  if (!done) return 'jamais fait';

  const days = Math.round((atMidnight(now).getTime() - atMidnight(done).getTime()) / 86_400_000);
  if (days <= 0) return "fait aujourd'hui";
  if (days === 1) return 'fait hier';
  if (days < 7) return `fait ${done.toLocaleDateString('fr-FR', { weekday: 'long' })}`;

  return `fait le ${done.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(done.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })}`;
}

function atMidnight(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
