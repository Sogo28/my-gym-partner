import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import type { MediaTrim } from '../domain/exercise/media';

/**
 * Un lecteur qui ne joue qu'un extrait, en boucle, sans commandes.
 *
 * Le lecteur natif ne sait boucler que sur un fichier entier : la boucle sur
 * une plage est refaite ici, en surveillant sa position et en le renvoyant au
 * début dès qu'il dépasse la fin.
 */
function useLoopedExcerpt(uri: string | null, trim: MediaTrim | null): VideoPlayer {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = trim === null;
    // Muette : une démonstration se regarde, elle ne s'écoute pas.
    instance.muted = true;
  });

  useEffect(() => {
    if (uri === null) return;

    /**
     * Se placer et démarrer dès la CRÉATION du lecteur ne servirait à rien :
     * la source n'est pas encore chargée, la position demandée est perdue, et
     * la lecture repartirait de zéro -- donc de toute la vidéo.
     */
    function start() {
      if (trim) player.currentTime = trim.from;
      player.play();
    }

    const loaded = player.addListener('sourceLoad', start);
    // Si la source était déjà prête avant que l'écouteur n'existe, son
    // événement est passé : on démarre tout de suite.
    if (player.status === 'readyToPlay') start();

    if (!trim) return () => loaded.remove();

    // 0,05 s : le lecteur dépasse la fin de l'extrait d'un battement avant
    // qu'on le rattrape, et deux dixièmes de trop se voient sur cinq secondes.
    player.timeUpdateEventInterval = 0.05;
    // Un retour au début à 50 ms près, obtenu tout de suite, vaut mieux qu'un
    // retour à l'image exacte qui fige le lecteur le temps de la trouver.
    player.seekTolerance = { toleranceBefore: 0.05, toleranceAfter: 0 };
    const beat = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime >= trim.to) player.currentTime = trim.from;
    });

    return () => {
      loaded.remove();
      beat.remove();
    };
  }, [player, uri, trim]);

  return player;
}

/**
 * Un extrait qui tourne tout seul, et s'agrandit d'un tap.
 *
 * Le plein écran est le NÔTRE, pas celui du lecteur : le sien impose ses
 * commandes -- la plateforme l'exige, sans quoi on ne pourrait plus en
 * sortir --, alors qu'ici il n'y a rien à commander. Un tap agrandit, un tap
 * réduit.
 */
export function TrimmedVideo({
  uri,
  trim,
  active,
  height = 200,
}: {
  uri: string;
  trim: MediaTrim | null;
  /** Faux quand l'écran n'est plus affiché : la lecture s'arrête. */
  active: boolean;
  height?: number;
}) {
  const [large, setLarge] = useState(false);
  const player = useLoopedExcerpt(uri, trim);

  useEffect(() => {
    // Deux lecteurs sur la même vidéo n'ont pas à tourner ensemble : celui de
    // la vignette se tait pendant que le grand joue.
    if (active && !large) player.play();
    else player.pause();
  }, [player, active, large]);

  return (
    <>
      <View className="overflow-hidden rounded-2xl border border-border bg-black dark:border-border-dark">
        <VideoView
          player={player}
          style={{ width: '100%', height }}
          contentFit="contain"
          nativeControls={false}
        />
        {/* La zone tapable se pose PAR-DESSUS : une vue vidéo native garde
            ses touchers pour elle, et un Pressable qui l'entoure n'apprend
            jamais qu'on a tapé dessus. */}
        <Pressable className="absolute inset-0" onPress={() => setLarge(true)} />
      </View>

      {large && <LargeVideo uri={uri} trim={trim} onClose={() => setLarge(false)} />}
    </>
  );
}

/**
 * Le grand écran, avec son propre lecteur.
 *
 * Composant à part, monté seulement quand il s'affiche : son lecteur naît
 * d'un crochet, qui ne peut pas être appelé sous une condition.
 */
function LargeVideo({
  uri,
  trim,
  onClose,
}: {
  uri: string;
  trim: MediaTrim | null;
  onClose: () => void;
}) {
  const player = useLoopedExcerpt(uri, trim);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          nativeControls={false}
        />
        {/* Par-dessus, comme pour la vignette : entourer la vidéo ne suffit
            pas, elle garde ses touchers pour elle. */}
        <Pressable className="absolute inset-0" onPress={onClose} />
      </View>
    </Modal>
  );
}
