import { DomainError } from '../domain/domain-error';
import { deleteHistory, deleteSession } from '../infra/reset';
import { findActive, findById } from '../infra/workout-session-repository';

/**
 * Effacer l'historique, sans toucher à ce avec quoi on s'entraîne.
 *
 * Refusé pendant une séance : elle serait effacée sous les pieds de l'écran
 * qui la mène, et il faudrait inventer ce qu'il devient. La terminer ou
 * l'annuler est un geste que l'utilisateur sait déjà faire.
 *
 * À part de `reset-actions`, qui ramasse les médias devenus orphelins et
 * entraîne donc expo-file-system derrière lui : un test qui importerait ce
 * fichier chargerait React Native, qu'aucun test ne peut lire. Effacer
 * l'historique ne laisse aucun média orphelin -- les exercices qui les
 * portent survivent.
 */
export async function eraseHistory(): Promise<void> {
  if (await findActive()) {
    throw new DomainError("Termine ou annule la séance en cours avant d'effacer l'historique.");
  }
  await deleteHistory();
}

/**
 * Retirer une séance de l'historique.
 *
 * Une séance en cours ne s'efface pas : elle se termine ou s'annule. Les deux
 * gestes existent, et ils disent quelque chose de différent -- annuler garde
 * les séries déjà validées (décision gelée n°15), effacer ne garde rien.
 */
export async function eraseSession(sessionId: string): Promise<void> {
  const session = await findById(sessionId);
  if (!session) {
    throw new DomainError("Cette séance n'existe plus.");
  }
  if (session.status === 'ACTIVE') {
    throw new DomainError("Termine ou annule cette séance avant de l'effacer.");
  }
  await deleteSession(sessionId);
}
