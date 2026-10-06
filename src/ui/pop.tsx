import { useEffect, useRef } from 'react';
import { Animated, type ViewProps } from 'react-native';

/**
 * Un petit rebond : ce qu'il enveloppe part d'un peu plus petit et revient à
 * sa taille en dépassant à peine.
 *
 * Il marque un CHANGEMENT -- une série qui vient d'être validée --, pas un
 * état : une liste rouverte ne fait pas rebondir les séries faites il y a dix
 * minutes. D'où `active`, qui ne déclenche qu'en passant de faux à vrai.
 * `appear` le joue aussi à la première apparition, pour ce qui n'existe que
 * parce que quelque chose vient d'arriver (un record).
 */
export function Pop({
  active = true,
  appear = false,
  from = 0.6,
  children,
  ...props
}: ViewProps & {
  active?: boolean;
  appear?: boolean;
  /**
   * La taille de départ. Une pastille peut partir de loin ; une ligne
   * entière qui rétrécirait autant ferait sauter la liste.
   */
  from?: number;
}) {
  const scale = useRef(new Animated.Value(appear && active ? from : 1)).current;
  const previous = useRef(appear ? false : active);

  useEffect(() => {
    if (active && !previous.current) {
      scale.setValue(from);
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 140,
        // Côté natif : une échelle en fait partie, le fil JavaScript reste
        // libre pour l'écriture de la série qui a lieu au même moment.
        useNativeDriver: true,
      }).start();
    }
    previous.current = active;
  }, [active, from, scale]);

  return (
    <Animated.View {...props} style={[props.style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}
