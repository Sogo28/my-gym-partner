import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Une photo en plein écran, entière, sur fond noir.
 *
 * Sur le bilan, elle est recadrée en bandeau : on y voit une ambiance, pas
 * la photo qu'on a prise. Ici elle est rendue telle quelle -- `contain`, pas
 * `cover` -- et rien d'autre ne la dispute qu'une croix pour revenir.
 *
 * Toucher la photo ferme aussi : c'est le geste qu'on tente de soi-même
 * quand on a fini de regarder.
 */
export function PhotoViewer({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={uri !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-black">
        <View className="p-5">
          <Pressable
            onPress={onClose}
            accessibilityLabel="Fermer"
            className="h-11 w-11 items-center justify-center rounded-full bg-white/15 active:opacity-60"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        {uri !== null && (
          <Pressable
            onPress={onClose}
            className="flex-1"
            accessibilityLabel="Fermer la photo"
          >
            <Image source={{ uri }} style={{ flex: 1 }} resizeMode="contain" />
          </Pressable>
        )}
        {/* Le même air en bas qu'en haut : la photo se tient au centre. */}
        <View className="h-[84px]" />
      </SafeAreaView>
    </Modal>
  );
}
