import { useEffect, useRef } from 'react';
import { Animated, type ViewProps } from 'react-native';

/**
 * Fait entrer son contenu par un côté, à chaque fois que `token` change.
 *
 * Le token est ce qui désigne CE qu'on montre -- l'exercice en cours, par
 * exemple. Quand il change, le contenu n'est plus le même : l'animation le
 * dit, au lieu de laisser un écran se remplacer d'une image à l'autre sans
 * qu'on sache si l'on a bougé.
 *
 * Écrit avec l'Animated de React Native, comme le repli d'une carte ou la
 * notification qui descend : même maison, mêmes outils.
 */
export function SlideIn({
  token,
  from = 'right',
  children,
  ...props
}: ViewProps & {
  token: string | number;
  /** D'où vient le contenu : la droite en avançant, la gauche en revenant. */
  from?: 'right' | 'left';
}) {
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      // L'animation tourne côté natif : opacité et translation en font
      // partie, donc le fil JavaScript n'est pas sollicité à chaque image.
      useNativeDriver: true,
    }).start();
  }, [token, progress]);

  return (
    <Animated.View
      {...props}
      style={[
        props.style,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [from === 'right' ? 40 : -40, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
