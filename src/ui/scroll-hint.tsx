import { Animated, View } from 'react-native';

/** Assez fine pour ne rien voler à la liste, assez large pour se voir. */
const WIDTH = 4;
/** En dessous, le curseur n'est plus qu'un point : une longue liste le dirait mal. */
const SHORTEST = 24;

/**
 * La barre qui dit qu'il y a autre chose en dessous.
 *
 * Celle d'Android n'apparaît qu'en défilant -- or le problème est justement
 * de ne pas savoir qu'on PEUT défiler -- et sa couleur vient du thème natif,
 * hors d'atteinte depuis React Native. Celle-ci reste affichée et porte
 * l'accent de l'application, comme tout ce qui montre où l'on en est.
 *
 * Elle ne se montre que s'il y a de quoi défiler : une liste qui tient
 * entière n'a rien à annoncer.
 *
 * Elle ne reçoit aucune touche (`pointerEvents="none"`) : elle est posée sur
 * le bord des lignes, et celles-ci s'ouvrent au tap. Une barre qui les
 * intercepterait rendrait la dernière série inatteignable.
 *
 * Le défilement la déplace SANS re-rendre l'écran : la position passe par une
 * valeur animée, pas par un état React. L'écran de séance se redessine déjà
 * quatre fois par seconde pendant un EMOM ; soixante de plus pendant un
 * glissement se verraient.
 */
export function ScrollHint({
  offset,
  visible,
  content,
}: {
  /** Le défilement courant, alimenté par `onScroll`. */
  offset: Animated.Value;
  /** La hauteur de la fenêtre, et celle de ce qu'elle montre. */
  visible: number;
  content: number;
}) {
  const overflow = content - visible;
  if (visible <= 0 || overflow <= 1) return null;

  // La barre dit la PROPORTION visible : moitié de la liste, moitié de la
  // hauteur. C'est ce qui distingue « il en reste une » de « il en reste dix ».
  const thumb = Math.min(visible, Math.max(SHORTEST, Math.round((visible * visible) / content)));

  return (
    <View
      pointerEvents="none"
      style={{ width: WIDTH, height: visible }}
      className="absolute right-0 top-0 overflow-hidden rounded-full bg-border dark:bg-border-dark"
    >
      <Animated.View
        className="w-full rounded-full bg-primary-ink dark:bg-primary-ink-dark"
        style={{
          height: thumb,
          transform: [
            {
              translateY: offset.interpolate({
                inputRange: [0, overflow],
                outputRange: [0, visible - thumb],
                extrapolate: 'clamp',
              }),
            },
          ],
        }}
      />
    </View>
  );
}
