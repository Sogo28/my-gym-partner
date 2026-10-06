import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './button';
import { ToastHost } from './notifications';

/**
 * Le bouton qui dit qu'une série a été filmée, et ouvre la vidéo.
 *
 * Une cible, pas une icône posée là : on la vise d'un pouce, debout, entre
 * deux séries. Une pastille de la taille du texte se rate -- d'où un aplat
 * franc, et de quoi la manquer de huit pixels sans conséquence.
 *
 * Elle reste discrète par la COULEUR et non par la taille : la plupart des
 * séries n'ont pas de vidéo, et celle qui en a ne doit pas crier plus fort
 * que ses valeurs.
 */
export function VideoBadge({ onPress }: { onPress: () => void }) {
  const dark = useColorScheme() === 'dark';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Voir la vidéo de cette série"
      className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft dark:bg-primary-soft-dark"
    >
      <Ionicons name="play" size={18} color={dark ? '#F2F4EF' : '#14160F'} />
    </Pressable>
  );
}

/**
 * La vidéo d'une série, en plein écran et avec ses commandes.
 *
 * Le lecteur NATIF, contrairement à la démonstration d'un exercice : celle-ci
 * tourne en boucle sur un extrait, sans commandes, ce qui avait demandé une
 * série de contournements. Une captation se regarde -- on veut pouvoir la
 * mettre en pause et revenir en arrière, donc on laisse faire le système.
 */
export function SetVideoViewer({
  uri,
  onClose,
  onDelete,
}: {
  uri: string | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal visible={uri !== null} animationType="slide" onRequestClose={onClose}>
      {uri !== null && <Player uri={uri} onClose={onClose} onDelete={onDelete} />}
      <ToastHost />
    </Modal>
  );
}

/**
 * Monté seulement quand une vidéo est demandée : le lecteur retient un
 * fichier, et en garder un ouvert pour une modale fermée immobiliserait une
 * ressource que personne ne regarde.
 */
function Player({
  uri,
  onClose,
  onDelete,
}: {
  uri: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.play();
  });

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-black">
      <View className="flex-row items-center justify-between p-5">
        <Pressable onPress={onClose} hitSlop={8}>
          <Text className="text-lead text-white">Fermer</Text>
        </Pressable>
        <Text className="text-caption text-white/70">Ta série</Text>
      </View>

      <VideoView style={{ flex: 1 }} player={player} nativeControls contentFit="contain" />

      <View className="p-5">
        <Button label="Supprimer cette vidéo" variant="danger" size="md" onPress={onDelete} />
      </View>
    </SafeAreaView>
  );
}
