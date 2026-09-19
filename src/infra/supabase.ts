// Le moteur JavaScript de React Native n'implémente `URL` qu'à moitié, et
// supabase-js s'en sert pour construire chacune de ses requêtes. Ce polyfill
// doit donc être chargé AVANT le client, pas n'importe où dans le fichier.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

/**
 * Le lien vers le projet Supabase -- le seul morceau de l'application qui
 * parle à autre chose que ce téléphone.
 *
 * Les deux valeurs viennent de `.env`, qui ne voyage pas avec le dépôt. Leur
 * absence n'est donc pas une panne improbable : c'est l'état d'une copie du
 * code fraîchement clonée. L'application doit continuer de fonctionner sans
 * elles -- tout ce qu'elle fait d'utile se passe hors ligne -- et se contenter
 * de ne pas proposer de compte.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Y a-t-il un projet à contacter ? Les écrans s'en servent pour se taire. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

const client: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          // La session vit dans le stockage du téléphone : sans cela, il
          // faudrait se reconnecter à chaque démarrage.
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          // Cette option guette un jeton dans l'adresse de la page. Il n'y a
          // pas de page : nous ne sommes pas dans un navigateur.
          detectSessionInUrl: false,
        },
      })
    : null;

/**
 * Le client, ou une panne franche.
 *
 * Appeler ceci sans configuration est un défaut du CODE, pas une situation
 * que l'utilisateur a provoquée : les écrans sont censés avoir consulté
 * `isSupabaseConfigured` avant. D'où une erreur ordinaire et non un
 * `DomainError` -- l'écran affichera « quelque chose n'a pas fonctionné »,
 * qui est exactement la vérité.
 */
export function supabase(): SupabaseClient {
  if (client === null) {
    throw new Error(
      'Supabase non configuré : EXPO_PUBLIC_SUPABASE_URL et ' +
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquent dans .env.',
    );
  }
  return client;
}

/**
 * Le jeton d'accès expire en une heure. Supabase le renouvelle tout seul,
 * mais seulement tant qu'on le lui demande : une minuterie qui tournerait
 * pendant que l'application dort viderait la batterie pour rien, et
 * échouerait de toute façon sur un téléphone sans réseau au fond d'un sac.
 *
 * On la démarre donc quand l'application revient au premier plan, et on
 * l'arrête quand elle le quitte. Une seule fois, ici : deux écouteurs
 * renouvelleraient le jeton deux fois.
 */
if (client !== null) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}
