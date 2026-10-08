import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { formatClock } from './format';
import { usePalette } from './palette';
import { useNow } from './use-now';

/** Un souffle complet -- inspiration puis expiration --, en millisecondes. */
const BREATH = 3200;

/**
 * Le centre de l'écran pendant une série.
 *
 * Il était vide : le chrono ne s'affichait qu'au repos, et rien ne disait
 * qu'une série tournait sinon une étiquette au bout d'une ligne. Un halo y
 * respire lentement derrière le temps de la série -- assez pour se voir de
 * loin, jamais assez pour presser.
 *
 * Une première version, décidée le 2026-10-07 : Daniel imagine à terme une
 * vraie animation (de type Lottie). Le halo tient la place en attendant,
 * et vit dans ce seul composant pour être remplacé d'un bloc.
 */
export function SetPulse({
  startedAt,
  values,
  size,
}: {
  /** Le début de la série, en millisecondes : le temps bat de lui-même. */
  startedAt: number;
  /** Ce que vise la série : « 12 reps × 20 kg ». */
  values: string;
  /** Le côté du carré disponible, comme pour l'anneau. */
  size: number;
}) {
  const { success } = usePalette();
  const breath = useRef(new Animated.Value(0)).current;
  const now = useNow(250);
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  // La taille de l'anneau du repos : les deux se succèdent au même endroit.
  const halo = size;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      {/* Deux cercles décalés : le second suit le premier avec un temps de
          retard apparent, ce qui donne au souffle de la profondeur plutôt
          qu'un simple clignotement. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: halo,
          height: halo,
          borderRadius: halo / 2,
          backgroundColor: success,
          opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.22] }),
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: halo * 0.7,
          height: halo * 0.7,
          borderRadius: (halo * 0.7) / 2,
          backgroundColor: success,
          opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.16] }),
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.92] }) }],
        }}
      />

      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
        En cours
      </Text>
      <Text
        // Bien plus petit que le chrono du repos : les deux occupent la même
        // place, et un même grand chiffre se confondait d'un coup d'oeil.
        className="font-mono-bold text-[30px] leading-[34px] tracking-tighter text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatClock(elapsedSeconds)}
      </Text>
      {values ? (
        <Text
          className="font-mono text-small text-muted dark:text-muted-dark"
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {values}
        </Text>
      ) : null}
    </View>
  );
}
