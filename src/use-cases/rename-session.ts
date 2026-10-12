import { DomainError } from '../domain/domain-error';
import { findById, save } from '../infra/workout-session-repository';

/**
 * Donner un nom à une séance, ou le lui retirer (vide). Même terminée :
 * c'est souvent après coup qu'on sait ce qu'elle a été (décidé le
 * 2026-10-12).
 */
export async function renameSession(sessionId: string, name: string | null): Promise<void> {
  const session = await findById(sessionId);
  if (!session) {
    throw new DomainError('Cette séance est introuvable.');
  }
  session.rename(name);
  await save(session);
}
