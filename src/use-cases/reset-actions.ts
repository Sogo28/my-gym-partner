import { resetData } from '../infra/reset';
import { forgetUnusedMedia } from './media-actions';

/**
 * Repartir à zéro : les exercices, séances, entraînements, objectifs et
 * relevés disparaissent.
 *
 * Ce qui reste : le vocabulaire fourni par l'application -- mesures, muscles,
 * mensurations du catalogue de départ --, et le catalogue RepDB, qui a son
 * propre bouton et se retélécharge de toute façon.
 *
 * Les vidéos et illustrations partent avec les exercices qui les portaient :
 * plus personne ne les réclame, la passe de ramassage les efface.
 */
export async function resetEverything(): Promise<void> {
  await resetData();
  await forgetUnusedMedia();
}
