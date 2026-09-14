import { DomainError } from '../domain/domain-error';
import { findById, save } from '../infra/workout-session-repository';

/**
 * Attacher ou retirer la photo de fin de séance.
 *
 * Le FICHIER n'est pas touché ici : ce module ne connaît que la base, et
 * garder expo-file-system hors de son chemin permet aux tests de le charger.
 * Le ramassage des médias inutilisés se charge du reste : un fichier que plus
 * aucune séance ne réclame finit par partir.
 */
export async function attachSessionPhoto(sessionId: string, photoName: string): Promise<void> {
  await onSession(sessionId, (session) => session.attachPhoto(photoName));
}

export async function detachSessionPhoto(sessionId: string): Promise<void> {
  await onSession(sessionId, (session) => session.attachPhoto(null));
}

async function onSession(
  sessionId: string,
  action: (session: Awaited<ReturnType<typeof findById>> & {}) => void,
): Promise<void> {
  const session = await findById(sessionId);
  if (!session) {
    throw new DomainError('Cette séance est introuvable.');
  }
  action(session);
  await save(session);
}
