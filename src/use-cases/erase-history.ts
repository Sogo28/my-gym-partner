import { DomainError } from '../domain/domain-error';
import { deleteHistory } from '../infra/reset';
import { findActive } from '../infra/workout-session-repository';

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
    throw new DomainError('Termine ou annule la séance en cours avant d effacer l historique.');
  }
  await deleteHistory();
}
