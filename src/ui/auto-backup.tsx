import { useEffect } from 'react';
import { AppState } from 'react-native';
import { pushBackupIfWorthwhile } from '../use-cases/cloud-backup-actions';
import { useAccount } from './account';

/**
 * La sauvegarde qui se fait toute seule, quand l'application revient.
 *
 * Une sauvegarde manuelle ne protège que ceux qui y pensent, et personne n'y
 * pense la veille du jour où le téléphone tombe. Celle-ci ne demande rien.
 *
 * Elle se déclenche à l'OUVERTURE et au RETOUR au premier plan, jamais au
 * départ vers l'arrière-plan : le système suspend l'application quelques
 * instants après l'avoir quittée, et un envoi commencé là serait interrompu
 * une fois sur deux. Au retour, l'application a tout son temps. Le prix est
 * un décalage -- la séance d'hier part ce matin -- et c'est le bon échange :
 * une sauvegarde certaine et tardive vaut mieux qu'une immédiate et douteuse.
 *
 * Le use case décide ensuite s'il y a lieu d'envoyer : rien depuis cinq
 * minutes, ou une base inchangée, et il se tait.
 *
 * Ce composant ne rend rien. Il est monté une fois, sous le compte.
 */
export function AutoBackup() {
  const { account } = useAccount();
  const userId = account?.id;

  useEffect(() => {
    if (userId === undefined) return;

    // Au démarrage, l'application est DÉJÀ active : aucun changement d'état
    // ne viendra le dire, et sans cet appel la première sauvegarde
    // attendrait le premier aller-retour.
    void pushBackupIfWorthwhile(userId);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pushBackupIfWorthwhile(userId);
    });

    return () => subscription.remove();
  }, [userId]);

  return null;
}
