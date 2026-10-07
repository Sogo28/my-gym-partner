import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  View,
} from 'react-native';
import { ToastHost } from './notifications';

/** Au-delà de cette distance vers le bas, lâcher la poignée ferme le panneau. */
const CLOSE_DISTANCE = 80;

/**
 * Le cadre de tout panneau qui monte du bas : le fond assombri, la carte aux
 * coins arrondis, et sa poignée.
 *
 * Un seul cadre pour les menus, les choix, le calendrier : quatre panneaux
 * dessinés chacun à sa façon finissaient par ne plus se ressembler.
 *
 * Trois façons de le refermer, et aucun bouton pour le dire : taper le fond,
 * le bouton retour d'Android, ou tirer la poignée vers le bas -- le geste
 * que le dessin de la poignée suggère.
 */
export function SheetFrame({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const drag = useRef(new Animated.Value(0)).current;

  // Chaque ouverture repart à sa place : un panneau refermé en le tirant
  // garderait sinon son décalage à la prochaine.
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  // Le répondeur est créé une fois : il lit la fermeture du rendu courant.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Vers le bas seulement : tirer vers le haut ne mène nulle part.
      onPanResponderMove: (_, { dy }) => drag.setValue(Math.max(dy, 0)),
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > CLOSE_DISTANCE || vy > 1.2) {
          onCloseRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Le bouton retour d'Android doit fermer le panneau, sinon il piège
      // l'utilisateur.
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      {/* Sur les deux systèmes : Android ne redimensionne pas une fenêtre
          posée par-dessus l'app quand le clavier sort, et le champ d'un
          panneau -- le nom d'une copie d'entraînement -- finissait dessous. */}
      <KeyboardAvoidingView behavior="padding">
        {/* La vue animée ne porte que le déplacement ; l'apparence vit sur
            une vue ordinaire : la version web n'applique pas les classes
            d'une vue animée. */}
        <Animated.View style={{ transform: [{ translateY: drag }] }}>
          <View className="rounded-t-[28px] bg-surface px-5 pb-8 dark:bg-surface-dark">
            {/* La poignée, et une zone de prise plus large qu'elle : un trait
                de quatre points ne se vise pas. */}
            <View {...responder.panHandlers} className="items-center pb-3 pt-3">
              <View className="h-1 w-10 rounded-full bg-border-strong dark:bg-border-strong-dark" />
            </View>

            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* En dernier : une fenêtre native masque ce que l'application dessine
          sous elle, messages compris. */}
      <ToastHost />
    </Modal>
  );
}
