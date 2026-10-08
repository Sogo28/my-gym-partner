import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './button';
import { useState } from 'react';
import { saveToGallery } from '../use-cases/gallery-actions';
import { messageOf } from './message';
import { ToastHost, useNotifications } from './notifications';

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
  /** Absent : la vidéo se regarde et s'enregistre, mais ne se supprime pas d'ici. */
  onDelete?: () => void;
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
  onDelete?: () => void;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.play();
  });
  const { notify } = useNotifications();
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    saveToGallery(uri)
      .then(() => notify('Vidéo enregistrée dans la galerie.', 'success'))
      .catch((e) => notify(messageOf(e)))
      .finally(() => setSaving(false));
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-black">
      <View className="flex-row items-center justify-between p-5">
        <Pressable onPress={onClose} hitSlop={8}>
          <Text className="text-lead text-white">Fermer</Text>
        </Pressable>
        <Text className="text-caption text-white/70">Ta série</Text>
      </View>

      <VideoView style={{ flex: 1 }} player={player} nativeControls contentFit="contain" />

      {/* Enregistrer dans la galerie : de quoi garder une série à part, sans
          la faire porter par la sauvegarde en ligne. Supprimer reste en
          rouge, à la largeur de son icône -- le geste qu'on ne vise pas. */}
      <View className="flex-row gap-3 p-5">
        {/* En blanc sur le noir du lecteur, quel que soit le thème : le
            bouton secondaire écrit en noir s'y effaçait en mode clair. */}
        <Pressable
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          className="h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-white/40 active:opacity-60"
        >
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text className="font-bold text-body text-white">
            {saving ? 'Enregistrement…' : 'Enregistrer dans la galerie'}
          </Text>
        </Pressable>
        {onDelete && (
          <Button
            label="Supprimer cette vidéo"
            icon="trash-outline"
            variant="danger"
            size="md"
            onPress={onDelete}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
