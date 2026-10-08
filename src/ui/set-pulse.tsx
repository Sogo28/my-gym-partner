import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, useColorScheme, View } from 'react-native';
import { formatClock } from './format';
import { LottieView } from './lottie';
import { usePalette } from './palette';
import { useNow } from './use-now';

/** Un souffle complet -- inspiration puis expiration --, en millisecondes. */
const BREATH = 3200;

/**
 * Un athlète qui enchaîne des squats, trouvé par Daniel le 2026-10-08.
 * Deux versions : sur fond sombre, ses traits noirs -- disques, cheveux,
 * pantalon -- passent au gris clair, sans quoi ils disparaissaient.
 */
const ANIMATION = {
  light: require('../../assets/lottie/set-in-progress.json'),
  dark: require('../../assets/lottie/set-in-progress-dark.json'),
};

/**
 * Le centre de l'écran pendant une série.
 *
 * Il était vide : le chrono ne s'affichait qu'au repos, et rien ne disait
 * qu'une série tournait sinon une étiquette au bout d'une ligne. Une
 * animation y tourne en boucle au-dessus du temps de la série : ça bouge,
 * donc ça tourne -- et ça se voit de loin.
 *
 * Le halo qui respire était la première version (2026-10-07) ; il reste en
 * secours, quand le lecteur d'animation manque.
 */
export function SetPulse(props: { startedAt: number; size: number }) {
  const dark = useColorScheme() === 'dark';
  if (!LottieView) return <HaloPulse {...props} />;

  // L'animation prend toute la place de l'anneau du repos, moins la ligne du
  // temps dessous : elle se lit de loin, et c'est pour ça qu'elle est là.
  // La cible n'y est plus (retirée le 2026-10-08) : la ligne de la série,
  // au-dessus, la dit déjà.
  const animation = Math.round(props.size - TIME_LINE);
  return (
    <View style={{ width: props.size, height: props.size }} className="items-center justify-center">
      <LottieView
        source={dark ? ANIMATION.dark : ANIMATION.light}
        autoPlay
        loop
        style={{ width: animation, height: animation }}
      />
      <SetClock startedAt={props.startedAt} />
    </View>
  );
}

/** La hauteur de la ligne du temps, prise sur la place de l'animation. */
const TIME_LINE = 36;

/** Le temps de la série, sous l'animation comme dans le halo. */
function SetClock({ startedAt }: { startedAt: number }) {
  const now = useNow(250);
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <>
      <Text
        // Bien plus petit que le chrono du repos : les deux occupent la même
        // place, et un même grand chiffre se confondait d'un coup d'oeil.
        className="font-mono-bold text-[30px] leading-[34px] tracking-tighter text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatClock(elapsedSeconds)}
      </Text>
    </>
  );
}

/** Le halo qui respire : la version d'avant l'animation, gardée en secours. */
function HaloPulse({
  startedAt,
  size,
}: {
  /** Le début de la série, en millisecondes : le temps bat de lui-même. */
  startedAt: number;
  /** Le côté du carré disponible, comme pour l'anneau. */
  size: number;
}) {
  const { success } = usePalette();
  const breath = useRef(new Animated.Value(0)).current;

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
      <SetClock startedAt={startedAt} />
    </View>
  );
}
