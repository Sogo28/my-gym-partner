import { DomainError } from '../domain-error';
import { WorkoutSession, type Rest } from './workout-session';

/**
 * Réunir deux séances terminées en une seule (décidé le 2026-10-10).
 *
 * Une séance coupée en morceaux -- parce que l'écran ne permettait pas
 * d'enchaîner ce qu'on voulait -- reste UNE séance : celle qui commence la
 * première absorbe l'autre, et garde son identifiant. Les activités se
 * suivent dans l'ordre où elles ont eu lieu.
 *
 * Le temps qui sépare les deux devient un repos : c'est ce qui s'est passé,
 * on soufflait entre deux exercices. La séance va donc du tout premier début
 * à la toute dernière fin.
 *
 * Un seul entraînement par séance : celui de la première, sinon celui de la
 * seconde. Les activités de l'autre perdent leur rang dans un programme qui
 * n'est plus le leur -- elles deviennent des exercices ajoutés en route.
 */
export function mergeSessions(a: WorkoutSession, b: WorkoutSession): WorkoutSession {
  if (a.id === b.id) {
    throw new DomainError('Une séance ne se fusionne pas avec elle-même.');
  }
  if (a.status !== 'COMPLETED' || b.status !== 'COMPLETED') {
    throw new DomainError('Seules des séances terminées se fusionnent.');
  }

  // À égalité de début, celle qui finit la première passe devant.
  const endOf = (session: WorkoutSession) => (session.endedAt ?? session.startedAt).getTime();
  const aFirst =
    a.startedAt.getTime() !== b.startedAt.getTime()
      ? a.startedAt < b.startedAt
      : endOf(a) <= endOf(b);
  const [first, second] = aFirst ? [a, b] : [b, a];
  const firstEnd = first.endedAt ?? first.startedAt;
  const secondEnd = second.endedAt ?? second.startedAt;
  if (second.startedAt < firstEnd) {
    throw new DomainError('Ces deux séances se chevauchent : impossible de les mettre bout à bout.');
  }

  const plannedWorkoutId = first.plannedWorkoutId ?? second.plannedWorkoutId;
  const keepsPlanOf = (session: WorkoutSession) => session.plannedWorkoutId === plannedWorkoutId;
  const activitiesOf = (session: WorkoutSession) =>
    session.activities.map((activity) =>
      keepsPlanOf(session) ? activity : { ...activity, plannedPosition: null },
    );

  const gap: Rest[] =
    second.startedAt > firstEnd ? [{ startedAt: firstEnd, endedAt: second.startedAt }] : [];

  return WorkoutSession.restore({
    id: first.id,
    plannedWorkoutId,
    // L'intention programmée suit l'entraînement gardé : une séance libre
    // n'en a pas, et celle d'un autre programme ne dirait plus rien.
    scheduledWorkoutId: keepsPlanOf(first)
      ? (first.scheduledWorkoutId ?? (keepsPlanOf(second) ? second.scheduledWorkoutId : null))
      : second.scheduledWorkoutId,
    startedAt: first.startedAt,
    status: 'COMPLETED',
    endedAt: secondEnd > firstEnd ? secondEnd : firstEnd,
    activities: [...activitiesOf(first), ...activitiesOf(second)],
    rests: [...first.rests, ...gap, ...second.rests],
    photoUri: first.photoUri ?? second.photoUri,
  });
}
