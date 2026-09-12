import { DomainError } from '../domain/domain-error';
import { findById, save } from '../infra/performance-repository';

/**
 * Attacher ou retirer la captation d'une série.
 *
 * Le FICHIER n'est pas touché ici : ce module ne connaît que la base, et
 * garder expo-file-system hors de son chemin permet aux tests de le charger
 * -- la même raison qui a sorti l'effacement de l'historique de son voisin.
 * Le ramassage des médias inutilisés se charge du reste : un fichier que plus
 * aucune série ne réclame finit par partir.
 */
export async function attachSetVideo(
  performanceId: string,
  setIndex: number,
  videoName: string,
): Promise<void> {
  await onPerformance(performanceId, (performance) =>
    performance.setVideo(setIndex, videoName),
  );
}

export async function detachSetVideo(performanceId: string, setIndex: number): Promise<void> {
  await onPerformance(performanceId, (performance) => performance.setVideo(setIndex, null));
}

async function onPerformance(
  performanceId: string,
  action: (performance: Awaited<ReturnType<typeof findById>> & {}) => void,
): Promise<void> {
  const performance = await findById(performanceId);
  if (!performance) {
    throw new DomainError('Cette performance est introuvable.');
  }
  action(performance);
  await save(performance);
}
