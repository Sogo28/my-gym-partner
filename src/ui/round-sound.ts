import { createVideoPlayer, type VideoPlayer } from 'expo-video';

/**
 * Les signaux sonores d'un EMOM : le décompte des dernières secondes, puis le
 * départ du round.
 *
 * Joués par expo-video et non par un module audio : le lecteur vit très bien
 * sans vue -- il joue ce qu'on lui donne, fût-ce un fichier sans image --, et
 * expo-video est DÉJÀ dans l'application. Ajouter un module natif pour deux
 * cents millisecondes de bip aurait coûté une reconstruction complète à
 * chaque installation.
 *
 * `mixWithOthers` : la musique qu'on écoute en salle continue. Un signal qui
 * coupe le morceau à chaque minute serait pire que pas de signal du tout.
 */
const players = new Map<string, VideoPlayer>();

function play(name: string, asset: number): void {
  try {
    let player = players.get(name);
    if (!player) {
      player = createVideoPlayer(asset);
      player.audioMixingMode = 'mixWithOthers';
      players.set(name, player);
    }
    // `replay` et non `play` : au bip suivant, la lecture est terminée, et
    // `play` sur un lecteur arrivé au bout ne redit rien.
    player.replay();
  } catch {
    // Le son est un confort : s'il manque à l'appel, le round démarre quand
    // même. Rien de ce qui compte n'en dépend.
  }
}

/** Le départ d'un round : deux bips, plus hauts que le décompte. */
export function playRoundStart(): void {
  play('start', require('../../assets/round-start.wav'));
}

/**
 * Une des dernières secondes avant le round suivant.
 *
 * Un tic court et plus bas que le départ : on doit entendre la différence
 * entre « ça arrive » et « c'est parti », les yeux sur la barre et non sur
 * le téléphone.
 */
export function playRoundCountdown(): void {
  play('tick', require('../../assets/round-countdown.wav'));
}
