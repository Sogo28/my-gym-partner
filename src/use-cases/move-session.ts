import { DomainError } from '../domain/domain-error';
import { findByIds, save as savePerformance } from '../infra/performance-repository';
import { findById, save } from '../infra/workout-session-repository';

/**
 * Corriger quand une séance a eu lieu.
 *
 * Une séance saisie le lendemain porte la date du lendemain : la corriger,
 * c'est dire ce qui s'est passé, comme corriger les valeurs d'une série. Rien
 * de ce qui a été mesuré ne change.
 *
 * Tout ce que la séance porte se déplace du MÊME écart -- ses activités, ses
 * repos, ses performances et leurs séries. Ces instants disent des durées :
 * le temps d'une tenue, le repos entre deux séries. Déplacer la seule date de
 * départ ferait une séance qui dure un jour et des repos de plusieurs heures.
 *
 * Une séance en cours ne se déplace pas : elle n'a pas fini d'avoir lieu.
 */
export async function moveSession(sessionId: string, at: Date): Promise<void> {
  const session = await findById(sessionId);
  if (!session) {
    throw new DomainError('Cette séance n existe plus.');
  }
  if (session.status === 'ACTIVE') {
    throw new DomainError('Cette séance est en cours : termine-la d abord.');
  }

  const shift = at.getTime() - session.startedAt.getTime();
  if (shift === 0) return;

  const performanceIds = session.activities
    .map((activity) => activity.performanceId)
    .filter((id): id is string => id !== null);

  for (const performance of (await findByIds(performanceIds)).values()) {
    await savePerformance(performance.movedBy(shift));
  }

  await save(session.movedTo(at));
}
