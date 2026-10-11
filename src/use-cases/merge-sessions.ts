import { DomainError } from '../domain/domain-error';
import { mergeSessions as merge } from '../domain/workout-session/merge';
import type { WorkoutSession } from '../domain/workout-session/workout-session';
import { findAll, findById, saveMerged } from '../infra/workout-session-repository';

/** Le même jour du calendrier, à l'heure du téléphone. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Les séances avec lesquelles celle-ci peut fusionner : les autres séances
 * terminées du MÊME jour (décidé le 2026-10-10), de la plus ancienne à la
 * plus récente. Deux jours différents ne font pas une séance.
 */
export async function findMergeCandidates(sessionId: string): Promise<WorkoutSession[]> {
  const session = await findById(sessionId);
  if (!session || session.status !== 'COMPLETED') return [];

  return (await findAll())
    .filter(
      (other) =>
        other.id !== session.id &&
        other.status === 'COMPLETED' &&
        sameDay(other.startedAt, session.startedAt),
    )
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}

/**
 * Fusionner deux séances du même jour. Rend l'identifiant de la séance qui
 * reste -- celle qui a commencé la première --, pour y emmener l'écran.
 *
 * Les performances ne bougent pas : elles changent seulement de séance.
 */
export async function mergeSessions(sessionId: string, otherId: string): Promise<string> {
  const [session, other] = await Promise.all([findById(sessionId), findById(otherId)]);
  if (!session || !other) {
    throw new DomainError("L'une de ces séances n'existe plus.");
  }
  if (!sameDay(session.startedAt, other.startedAt)) {
    throw new DomainError('Seules des séances du même jour se fusionnent.');
  }

  const merged = merge(session, other);
  const absorbed = merged.id === session.id ? other.id : session.id;
  await saveMerged(merged, absorbed);
  return merged.id;
}
